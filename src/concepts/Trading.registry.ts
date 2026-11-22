import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/Trading.md" with { type: "text" };
import {
  AlreadyOffered,
  NotDraft,
  NotPending,
  NotProposer,
  NotRecipient,
  OfferNotFound,
  EmptySide,
  SelfTrade,
  TradingConcept,
} from "./Trading.ts";

// Sync-engine uses the spec and these error classes to return the declared refusal codes.
export const trading = registerConcept({
  class: TradingConcept,
  spec,
  refusals: {
    SELF_TRADE: SelfTrade,
    EMPTY_SIDE: EmptySide,
    ALREADY_OFFERED: AlreadyOffered,
    NOT_FOUND: OfferNotFound,
    NOT_RECIPIENT: NotRecipient,
    NOT_PROPOSER: NotProposer,
    NOT_DRAFT: NotDraft,
    NOT_PENDING: NotPending,
  },
});
