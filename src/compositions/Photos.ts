import { Binary, type Db } from "mongodb";
import type { assembleApplication } from "../assembly.ts";
import type { Session } from "../concepts/Sessioning/Sessioning.ts";
import { maxRequestBodyBytes, policy, sessionCookieName } from "../http.ts";

type Sessioning = ReturnType<typeof assembleApplication>["concepts"]["Sessioning"];
type PhotoType = "image/jpeg" | "image/png" | "image/webp";

type StoredPhoto = {
  _id: string;
  owner: string;
  contentType: PhotoType;
  bytes: Binary;
};

const photoPath = "/api/photos";
const photoIdPath = /^\/api\/photos\/([\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})$/;
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function imageType(value: string | undefined): value is PhotoType {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}

function matchesImageType(bytes: Buffer, contentType: PhotoType): boolean {
  switch (contentType) {
    case "image/jpeg":
      return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return bytes.length > 8 && bytes.subarray(0, 8).equals(pngSignature);
    case "image/webp":
      return bytes.length > 12 &&
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP";
  }
}

function error(status: number, code: string, headers?: Record<string, string>) {
  return Response.json({ error: code }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function createPhotoHandler(db: Db, sessions: Sessioning) {
  const photos = db.collection<StoredPhoto>("completion_photos");

  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname;
    const uploading = path === photoPath;
    const photo = photoIdPath.exec(path)?.[1];
    if (!uploading && !photo) return error(404, "NOT_FOUND");
    const method = uploading ? "POST" : "GET";
    if (request.method !== method) return error(405, "METHOD_NOT_ALLOWED", { Allow: method });

    const origin = request.headers.get("origin");
    if (origin !== null && origin !== policy.publicOrigin) return error(403, "FORBIDDEN");

    try {
      const cookies = new Bun.CookieMap(request.headers.get("cookie") ?? "");
      const token = cookies.get(sessionCookieName);
      if (!token) return error(401, "UNAUTHORIZED");
      const session = await sessions.use({ session: token as Session });
      if ("error" in session) return error(401, "UNAUTHORIZED");
      const owner = session.subject;

      if (photo) {
        // Restrict the database lookup to the signed-in owner until review access is wired in.
        const stored = await photos.findOne({ _id: photo, owner });
        if (!stored) return error(404, "NOT_FOUND");
        return new Response(new Uint8Array(stored.bytes.value()), {
          headers: {
            "Content-Type": stored.contentType,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Cross-Origin-Resource-Policy": "same-origin",
          },
        });
      }

      const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
      if (!imageType(contentType)) return error(415, "UNSUPPORTED_MEDIA_TYPE");
      if (Number(request.headers.get("content-length")) > maxRequestBodyBytes) return error(413, "PHOTO_TOO_LARGE");

      // Bun caps the incoming body. The byte check also applies when calling this handler directly.
      const body = await request.arrayBuffer().catch(() => undefined);
      if (!body) return error(400, "INVALID_REQUEST");
      if (body.byteLength > maxRequestBodyBytes) return error(413, "PHOTO_TOO_LARGE");
      const bytes = Buffer.from(body);
      if (!matchesImageType(bytes, contentType)) return error(400, "INVALID_PHOTO");

      const id = crypto.randomUUID();
      await photos.insertOne({ _id: id, owner, contentType, bytes: new Binary(bytes) });
      return Response.json({ photo: id }, {
        status: 201,
        headers: { "Cache-Control": "no-store", Location: `${photoPath}/${id}` },
      });
    } catch {
      return error(500, "INTERNAL_ERROR");
    }
  };
}
