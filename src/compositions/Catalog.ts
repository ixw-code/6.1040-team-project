import type { assembleApplication } from "../assembly.ts";
import type { User } from "../concepts/Registering/Registering.ts";
import { allowsAppOrigin, signedInPerson } from "../http.ts";
import { photoResponse, type PhotoStore } from "./Photos.ts";

type Concepts = ReturnType<typeof assembleApplication>["concepts"];

const failure = (status: number, error: string) => Response.json({ error }, { status });
const text = (v: unknown): v is string => typeof v === "string" && !!v.trim() && v.length <= 4000;

// Catalog reads include the display names needed by household and schedule screens.
// Reference photos are shared only through a chore belonging to the viewer's household.
export function createCatalogHandler(
  { HouseholdManaging, ChoreCataloguing, Registering, Sessioning, Ranking }: Concepts, photos: PhotoStore,
) {
  return async (request: Request) => {
    const url = new URL(request.url);
    const reference = /^\/api\/catalog\/([^/]+)\/references\/([^/]+)$/.exec(url.pathname);
    const operation = url.pathname.slice("/api/catalog/".length);
    if (!reference && !["list", "create", "add-resident"].includes(operation)) return failure(404, "NOT_FOUND");
    if (!allowsAppOrigin(request)) return failure(403, "FORBIDDEN");
    if (request.method !== (reference ? "GET" : "POST")) return failure(405, "METHOD_NOT_ALLOWED");
    try {
      const requester = await signedInPerson(request, Sessioning);
      if (!requester) return failure(401, "UNAUTHORIZED");
      if (reference) {
        const [, chore, photo] = reference;
        const [entry] = await ChoreCataloguing._get({ chore });
        if (!entry?.references.includes(photo)) return failure(404, "NOT_FOUND");
        const members = await HouseholdManaging._residents({ household: entry.group });
        if (!members.some(m => m.person === requester)) return failure(404, "NOT_FOUND");
        const stored = await photos.readReference(photo);
        return stored ? photoResponse(stored) : failure(404, "NOT_FOUND");
      }
      if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return failure(415, "INVALID_REQUEST");
      const body = await request.json().catch(() => null);
      if (!text(body?.household)) return failure(400, "INVALID_REQUEST");
      const { household } = body;
      const [home] = await HouseholdManaging._household({ household });
      if (!home) return failure(404, "NOT_FOUND");
      if (operation === "list") {
        const members = await HouseholdManaging._residents({ household });
        if (!members.some(m => m.person === requester)) return failure(403, "FORBIDDEN");
        const [chores, ranking, people] = await Promise.all([
          ChoreCataloguing._chores({ group: household, sortByDifficulty: false }),
          Ranking._ranking({ group: household }),
          Promise.all(members.map(async ({ person }) => {
            const [account] = await Registering._username({ user: person as User });
            return { person, username: account?.username ?? person };
          })),
        ]);
        return Response.json({ people, chores, ranking });
      }
      if (home.overseer !== requester) return failure(403, "FORBIDDEN");
      if (operation === "add-resident") {
        if (!text(body.username)) return failure(400, "INVALID_REQUEST");
        const [account] = await Registering._byUsername({ username: body.username.trim() });
        if (!account) return failure(404, "USERNAME_NOT_FOUND");
        const result = await HouseholdManaging.addResident({ household, person: account.user });
        return "error" in result ? failure(409, result.error) : Response.json(result);
      }
      const { name, category, difficulty, description, criteria, photo } = body;
      if (![name, category, description, criteria, photo].every(text) || !Number.isInteger(difficulty)
        || difficulty < 1 || difficulty > 10) return failure(400, "INVALID_REQUEST");
      const categories = await HouseholdManaging._categories({ household });
      if (!categories.some(c => c.category === category) || !await photos.owns(photo, requester)) return failure(404, "NOT_FOUND");
      const result = await ChoreCataloguing.create({
        group: household, name: name.trim(), category, difficulty, description: description.trim(),
        requirements: [criteria.trim()], references: [photo],
      });
      return "error" in result ? failure(409, result.error) : Response.json(result, { status: 201 });
    } catch {
      return failure(500, "INTERNAL_ERROR");
    }
  };
}
