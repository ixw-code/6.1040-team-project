import { Binary, type Db } from "mongodb";
import { allowsAppOrigin, maxRequestBodyBytes, signedInPerson } from "../http.ts";

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

export function createPhotoStore(db: Db) {
  const photos = db.collection<StoredPhoto>("completion_photos");

  return {
    async save(owner: string, contentType: PhotoType, bytes: Buffer): Promise<string> {
      const photo = crypto.randomUUID();
      await photos.insertOne({ _id: photo, owner, contentType, bytes: new Binary(bytes) });
      return photo;
    },
    async owns(photo: string, owner: string): Promise<boolean> {
      return Boolean(await photos.findOne({ _id: photo, owner }, { projection: { _id: 1 } }));
    },
    read(photo: string, owner: string) {
      return photos.findOne({ _id: photo, owner });
    },
  };
}

export type PhotoStore = ReturnType<typeof createPhotoStore>;

export function photoResponse(stored: StoredPhoto): Response {
  return new Response(new Uint8Array(stored.bytes.value()), {
    headers: {
      "Content-Type": stored.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}

export function createPhotoHandler(photos: PhotoStore, sessions: Parameters<typeof signedInPerson>[1]) {
  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname;
    const uploading = path === photoPath;
    const photo = photoIdPath.exec(path)?.[1];
    if (!uploading && !photo) return error(404, "NOT_FOUND");
    const method = uploading ? "POST" : "GET";
    if (request.method !== method) return error(405, "METHOD_NOT_ALLOWED", { Allow: method });

    if (!allowsAppOrigin(request)) return error(403, "FORBIDDEN");

    try {
      const owner = await signedInPerson(request, sessions);
      if (!owner) return error(401, "UNAUTHORIZED");

      if (photo) {
        const stored = await photos.read(photo, owner);
        return stored ? photoResponse(stored) : error(404, "NOT_FOUND");
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

      const id = await photos.save(owner, contentType, bytes);
      return Response.json({ photo: id }, {
        status: 201,
        headers: { "Cache-Control": "no-store", Location: `${photoPath}/${id}` },
      });
    } catch {
      return error(500, "INTERNAL_ERROR");
    }
  };
}
