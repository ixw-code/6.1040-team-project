import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { assembleApplication } from "./assembly.ts";
import { createCompletionHandler, createCompletionHooks } from "./adapters/completionHttp.ts";
import { createPhotoHandler, createPhotoStore } from "./adapters/photos.ts";
import { createCatalogHandler } from "./compositions/Catalog.ts";
import { maxRequestBodyBytes, policy } from "./http.ts";
import { getDb } from "./db.ts";

const production = process.env.NODE_ENV === "production";
const frontend = new URL("../web/dist/", import.meta.url);
const index = Bun.file(new URL("index.html", frontend));

if (production && !await index.exists()) {
  throw new Error("Frontend build is missing. Run bun run build before bun run start.");
}

const db = getDb();
const application = assembleApplication();
const gateway = createGateway({ application });
const api = createHttpHandler({ application, gateway, policy });
const photoStore = createPhotoStore(db);
const photos = createPhotoHandler(photoStore, application.concepts.Sessioning);

const server = Bun.serve({
  hostname: process.env.HOST ?? (production ? "0.0.0.0" : "127.0.0.1"),
  port: Number(process.env.PORT ?? 3000),
  maxRequestBodySize: maxRequestBodyBytes,
  routes: {
    "/": {
      GET: () => production
        ? new Response(index, { headers: { "Cache-Control": "no-cache" } })
        : new Response(null, { status: 404 }),
    },
    "/assets/:asset": {
      async GET(request) {
        const { asset } = request.params;
        if (!production || !/^[\w-][\w.-]*$/.test(asset)) return new Response(null, { status: 404 });
        const file = Bun.file(new URL("assets/" + asset, frontend));
        if (!await file.exists()) return new Response(null, { status: 404 });
        return new Response(file, { headers: { "Cache-Control": "public, max-age=31536000, immutable" } });
      },
    },
    "/api/photos": photos,
    "/api/photos/:photo": photos,
    "/api/catalog/*": createCatalogHandler(application.concepts, photoStore),
    "/api/completion/submit": api,
    "/api/completion/*": createCompletionHandler(application.concepts, photoStore, createCompletionHooks(application.concepts)),
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
