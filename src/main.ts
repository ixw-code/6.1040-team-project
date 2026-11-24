import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { assembleApplication } from "./assembly.ts";
import { createCatalogHandler } from "./compositions/Catalog.ts";
import { completionHooks } from "./compositions/completionHooks.ts";
import { createCompletionHandler } from "./compositions/CompletionChecking.ts";
import { createPhotoHandler, createPhotoStore } from "./compositions/Photos.ts";
import { maxRequestBodyBytes, policy } from "./http.ts";
import { getDb } from "./db.ts";

const db = getDb();
const application = assembleApplication();
const gateway = createGateway({ application });
const api = createHttpHandler({ application, gateway, policy });
const photoStore = createPhotoStore(db);
const photos = createPhotoHandler(photoStore, application.concepts.Sessioning);

const server = Bun.serve({
  hostname: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
  maxRequestBodySize: maxRequestBodyBytes,
  routes: {
    "/api/photos": photos,
    "/api/photos/:photo": photos,
    "/api/catalog/*": createCatalogHandler(application.concepts, photoStore),
    "/api/completion/*": createCompletionHandler(application.concepts, photoStore, completionHooks(application.concepts)),
    "/api/*": api,
    "/health": async () => {
      try {
        await db.command({ ping: 1 }, { timeoutMS: 3000 });
        return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
      } catch {
        return Response.json(
          { status: "unavailable" },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    },
  },
});

console.log(`Backend listening on ${server.url}`);
