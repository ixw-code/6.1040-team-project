import { MongoServerError, type Db } from "mongodb";

export class SelfTrade extends Error {}
export class EmptySide extends Error {}
export class AlreadyOffered extends Error {}
export class OfferNotFound extends Error {}
export class NotRecipient extends Error {}
export class NotProposer extends Error {}
export class NotDraft extends Error {}
export class NotPending extends Error {}

type Side = "OFFERED" | "REQUESTED";
type Status = "DRAFT" | "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "WITHDRAWN";
type Closed = Exclude<Status, "DRAFT" | "PENDING">;

type Offer = {
  _id: string;
  proposer: string;
  recipient: string;
  // Each side is a set: addItem never adds the same item twice. Order is the order added.
  offered: string[];
  requested: string[];
  status: Status;
  createdAt: Date;
  sentAt?: Date;
  closedAt?: Date;
  // Set when sent: the two sides in a fixed order, so A-for-B and B-for-A share one key.
  pair?: string;
};
// An accept holds a short lock on each of its items so two accepts cannot trade the same item.
type ItemLock = { _id: string; offer: string; lockedAt: Date };

type OfferRef = { offer: string };
type Actor = OfferRef & { person: string };
type ItemChange = Actor & { item: string; side: Side };
type OfferRow = Pick<Offer, "proposer" | "recipient" | "status" | "createdAt" | "sentAt" | "closedAt">;
type ItemRow = { item: string; side: Side };
type IncomingRow = OfferRef & { proposer: string; sentAt: Date };
type OutgoingRow = OfferRef & { recipient: string; status: Status; createdAt: Date };
type InvolvingRow = OfferRef & { proposer: string; recipient: string; side: Side };

// A lock older than this belongs to an accept that crashed partway, so it can be cleared.
const STALE_LOCK_MS = 10_000;
const RETRY_MS = 25;

const NOT_PROPOSER = "Only the person who made this offer can change it.";
const NOT_RECIPIENT = "Only the person this trade was offered to can answer it.";
const NOT_PENDING = "This trade offer is not open for an answer.";

const sideField = (side: Side) => (side === "OFFERED" ? "offered" : "requested");

// The same items in either direction give the same key.
function pairKey(offered: string[], requested: string[]): string {
  const a = JSON.stringify([...new Set(offered)].sort());
  const b = JSON.stringify([...new Set(requested)].sort());
  return JSON.stringify(a < b ? [a, b] : [b, a]);
}

function involving(items: string[]) {
  return { $or: [{ offered: { $in: items } }, { requested: { $in: items } }] };
}

function isDuplicateKey(error: unknown) {
  return error instanceof MongoServerError && error.code === 11000;
}

export class TradingConcept {
  #indexes?: Promise<unknown>;

  constructor(private readonly getDb: () => Db) {}

  #offers() {
    return this.getDb().collection<Offer>("trading_offers");
  }

  #locks() {
    return this.getDb().collection<ItemLock>("trading_item_locks");
  }

  // Create indexes on first use. The partial unique index enforces one pending offer per set of items,
  // even when two people send the same trade at the same moment.
  #ready() {
    this.#indexes ??= Promise.all([
      this.#offers().createIndex(
        { pair: 1 },
        { unique: true, partialFilterExpression: { status: "PENDING" }, name: "one_pending_per_pair" },
      ),
      this.#offers().createIndex({ recipient: 1, status: 1, sentAt: 1 }),
      this.#offers().createIndex({ proposer: 1, status: 1, createdAt: 1 }),
      this.#offers().createIndex({ offered: 1, status: 1 }),
      this.#offers().createIndex({ requested: 1, status: 1 }),
    ]).catch((error: unknown) => {
      this.#indexes = undefined;
      throw error;
    });
    return this.#indexes;
  }

  async #find(offer: string): Promise<Offer> {
    const found = await this.#offers().findOne({ _id: offer });
    if (!found) throw new OfferNotFound("This trade offer does not exist.");
    return found;
  }

  async #findAsProposer(offer: string, person: string): Promise<Offer> {
    const found = await this.#find(offer);
    if (found.proposer !== person) throw new NotProposer(NOT_PROPOSER);
    return found;
  }

  async #findDraft(offer: string, person: string): Promise<Offer> {
    const found = await this.#findAsProposer(offer, person);
    if (found.status !== "DRAFT") throw new NotDraft("This offer has already been sent.");
    return found;
  }

  async #findPendingFor(offer: string, person: string): Promise<Offer> {
    const found = await this.#find(offer);
    if (found.recipient !== person) throw new NotRecipient(NOT_RECIPIENT);
    if (found.status !== "PENDING") throw new NotPending(NOT_PENDING);
    return found;
  }

  // Move an offer from one of `from` to `status`. Writing only while it is still in `from` means a
  // concurrent change wins cleanly; the loser re-reads and gets the right refusal.
  async #close(offer: string, from: Status[], status: Closed): Promise<boolean> {
    const changed = await this.#offers().updateOne(
      { _id: offer, status: { $in: from } },
      { $set: { status, closedAt: new Date() } },
    );
    return changed.matchedCount === 1;
  }

  async propose({ proposer, recipient }: { proposer: string; recipient: string }): Promise<OfferRef> {
    if (proposer === recipient) throw new SelfTrade("You cannot trade with yourself.");
    await this.#ready();
    const offer = crypto.randomUUID();
    await this.#offers().insertOne({
      _id: offer,
      proposer,
      recipient,
      offered: [],
      requested: [],
      status: "DRAFT",
      createdAt: new Date(),
    });
    return { offer };
  }

  async addItem({ offer, person, item, side }: ItemChange): Promise<OfferRef> {
    return this.#editDraft({ offer, person }, { $addToSet: { [sideField(side)]: item } });
  }

  async removeItem({ offer, person, item, side }: ItemChange): Promise<OfferRef> {
    return this.#editDraft({ offer, person }, { $pull: { [sideField(side)]: item } });
  }

  async #editDraft({ offer, person }: Actor, update: object): Promise<OfferRef> {
    while (true) {
      await this.#findDraft(offer, person);
      const changed = await this.#offers().updateOne({ _id: offer, status: "DRAFT" }, update);
      if (changed.matchedCount === 1) return { offer };
      // Sent or cancelled in between: loop to re-read and refuse for the right reason.
    }
  }

  async send({ offer, person }: Actor): Promise<OfferRef> {
    await this.#ready();
    while (true) {
      const found = await this.#findDraft(offer, person);
      if (found.offered.length === 0 || found.requested.length === 0) {
        throw new EmptySide("Choose at least one task to give and one task to get.");
      }
      try {
        // Match the exact items read above, so an item added in between is never sent under a stale key.
        const changed = await this.#offers().updateOne(
          { _id: offer, status: "DRAFT", offered: found.offered, requested: found.requested },
          { $set: { status: "PENDING", sentAt: new Date(), pair: pairKey(found.offered, found.requested) } },
        );
        if (changed.matchedCount === 1) return { offer };
      } catch (error) {
        if (isDuplicateKey(error)) throw new AlreadyOffered("This trade has already been offered.");
        throw error;
      }
    }
  }

  async accept({ offer, person }: Actor): Promise<OfferRef & { proposer: string; recipient: string }> {
    await this.#ready();
    while (true) {
      const found = await this.#findPendingFor(offer, person);
      const items = [...new Set([...found.offered, ...found.requested])];
      if (!(await this.#lock(offer, items))) {
        // Another accept is using one of these items. Wait, then recheck: it may have withdrawn this offer.
        await Bun.sleep(RETRY_MS);
        continue;
      }
      try {
        if (!(await this.#close(offer, ["PENDING"], "ACCEPTED"))) continue;
        // Each item now has a new holder, so every other open offer for any of them is out of date.
        await this.#offers().updateMany(
          { _id: { $ne: offer }, status: "PENDING", ...involving(items) },
          { $set: { status: "WITHDRAWN", closedAt: new Date() } },
        );
      } finally {
        await this.#locks().deleteMany({ offer });
      }
      return { offer, proposer: found.proposer, recipient: found.recipient };
    }
  }

  // Try to lock every item for this offer. Returns false, holding nothing, if any item is already locked.
  async #lock(offer: string, items: string[]): Promise<boolean> {
    const locks = this.#locks();
    await locks.deleteMany({ _id: { $in: items }, lockedAt: { $lt: new Date(Date.now() - STALE_LOCK_MS) } });
    try {
      const lockedAt = new Date();
      await locks.insertMany(items.map((item) => ({ _id: item, offer, lockedAt })), { ordered: true });
      return true;
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      await locks.deleteMany({ offer });
      return false;
    }
  }

  async decline({ offer, person }: Actor): Promise<OfferRef> {
    while (true) {
      await this.#findPendingFor(offer, person);
      if (await this.#close(offer, ["PENDING"], "DECLINED")) return { offer };
    }
  }

  async cancel({ offer, person }: Actor): Promise<OfferRef> {
    while (true) {
      const found = await this.#findAsProposer(offer, person);
      if (found.status !== "DRAFT" && found.status !== "PENDING") throw new NotPending(NOT_PENDING);
      if (await this.#close(offer, ["DRAFT", "PENDING"], "CANCELLED")) return { offer };
    }
  }

  async withdraw({ item }: { item: string }): Promise<{ count: number }> {
    const changed = await this.#offers().updateMany(
      { status: "PENDING", ...involving([item]) },
      { $set: { status: "WITHDRAWN", closedAt: new Date() } },
    );
    return { count: changed.modifiedCount };
  }

  async _offer({ offer }: OfferRef): Promise<OfferRow[]> {
    const row = await this.#offers().findOne<OfferRow>(
      { _id: offer },
      { projection: { _id: 0, offered: 0, requested: 0, pair: 0 } },
    );
    return row ? [row] : [];
  }

  async _items({ offer }: OfferRef): Promise<ItemRow[]> {
    const found = await this.#offers().findOne({ _id: offer });
    if (!found) return [];
    return [
      ...found.offered.map((item) => ({ item, side: "OFFERED" as const })),
      ...found.requested.map((item) => ({ item, side: "REQUESTED" as const })),
    ];
  }

  async _incoming({ recipient }: { recipient: string }): Promise<IncomingRow[]> {
    const rows = await this.#offers()
      .find({ recipient, status: "PENDING" })
      .sort({ sentAt: 1, _id: 1 })
      .toArray();
    return rows.map((row) => ({ offer: row._id, proposer: row.proposer, sentAt: row.sentAt! }));
  }

  async _outgoing({ proposer }: { proposer: string }): Promise<OutgoingRow[]> {
    const rows = await this.#offers()
      .find({ proposer, status: { $in: ["DRAFT", "PENDING"] } })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();
    return rows.map((row) => ({ offer: row._id, recipient: row.recipient, status: row.status, createdAt: row.createdAt }));
  }

  async _involving({ item }: { item: string }): Promise<InvolvingRow[]> {
    const rows = await this.#offers()
      .find({ status: "PENDING", ...involving([item]) })
      .sort({ sentAt: 1, _id: 1 })
      .toArray();
    return rows.flatMap((row) => {
      const base = { offer: row._id, proposer: row.proposer, recipient: row.recipient };
      return [
        ...(row.offered.includes(item) ? [{ ...base, side: "OFFERED" as const }] : []),
        ...(row.requested.includes(item) ? [{ ...base, side: "REQUESTED" as const }] : []),
      ];
    });
  }
}
