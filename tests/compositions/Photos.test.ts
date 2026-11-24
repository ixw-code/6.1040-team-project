import { describe, expect, test } from "bun:test";
import type { Db } from "mongodb";
import { assembleApplication } from "../../src/assembly.ts";
import { createPhotoHandler, createPhotoStore } from "../../src/compositions/Photos.ts";
import { maxRequestBodyBytes, policy, sessionCookieName } from "../../src/http.ts";
import { accountRequests } from "../helpers/accounts.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

const url = "http://127.0.0.1";
const png = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2QAAAAASUVORK5CYII=", "base64",
));

function requests(database: () => Db) {
  const application = assembleApplication(database);
  const photo = createPhotoHandler(createPhotoStore(database()), application.concepts.Sessioning);
  return { ...accountRequests(application), photo };
}

function uploadRequest(options: {
  cookie?: string;
  body?: Uint8Array<ArrayBuffer>;
  contentType?: string;
  origin?: string;
} = {}) {
  const { cookie, body = png, contentType = "image/png", origin } = options;
  const headers = new Headers({ "Content-Type": contentType });
  if (cookie) headers.set("Cookie", cookie);
  if (origin) headers.set("Origin", origin);
  return new Request(`${url}/api/photos`, { method: "POST", headers, body });
}

function readRequest(path: string, cookie?: string) {
  return new Request(`${url}${path}`, { headers: cookie ? { Cookie: cookie } : undefined });
}

describe("Photo uploads", () => {
  const database = useMongoTestDb("photos");

  test("the owner can retrieve the exact uploaded bytes after signing in again", async () => {
    const first = requests(database);
    const { cookie } = await first.session("register", "photo-owner");
    const upload = await first.photo(uploadRequest({ cookie, origin: policy.publicOrigin }));
    expect(upload.status).toBe(201);
    const { photo } = await upload.json() as { photo: string };
    const path = `/api/photos/${photo}`;
    expect(upload.headers.get("location")).toBe(path);
    expect((await first.accountRequest("logout", {}, cookie)).status).toBe(200);
    expect((await first.photo(readRequest(path, cookie))).status).toBe(401);

    const second = requests(database);
    const { cookie: newCookie } = await second.session("login", "photo-owner");
    const response = await second.photo(readRequest(path, newCookie));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);

    const { cookie: other } = await second.session("register", "another-user");
    const denied = await second.photo(readRequest(path, other));
    expect(denied.status).toBe(404);
    expect(await denied.json()).toEqual({ error: "NOT_FOUND" });
    expect((await second.photo(readRequest(path))).status).toBe(401);
  });

  test("requires a real session and the app origin for browser uploads", async () => {
    const { session, photo } = requests(database);
    expect((await photo(uploadRequest())).status).toBe(401);
    expect((await photo(uploadRequest({ cookie: `${sessionCookieName}=unknown` }))).status).toBe(401);
    const { cookie } = await session("register", "origin-test");
    const denied = await photo(uploadRequest({ cookie, origin: "https://other.example" }));
    expect(denied.status).toBe(403);
  });

  test("rejects unsupported, mislabeled, empty, and oversized bodies", async () => {
    const { session, photo } = requests(database);
    const { cookie } = await session("register", "format-test");
    expect((await photo(uploadRequest({ cookie, contentType: "image/svg+xml" }))).status).toBe(415);
    expect((await photo(uploadRequest({ cookie, contentType: "image/jpeg" }))).status).toBe(400);
    expect((await photo(uploadRequest({ cookie, body: new Uint8Array() }))).status).toBe(400);
    const oversized = new Uint8Array(maxRequestBodyBytes + 1);
    oversized.set(png);
    expect((await photo(uploadRequest({ cookie, body: oversized }))).status).toBe(413);
  });
});
