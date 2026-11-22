import { afterEach, describe, expect, test } from "bun:test";
import {
  configurePhotoStore,
  deletePhoto,
  photoUrl,
  PhotoStorageNotConfigured,
  resetPhotoStore,
  savePhoto,
  type PhotoStore,
} from "../../src/storage/photos.ts";

const photo = { bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" };

describe("photo storage", () => {
  afterEach(resetPhotoStore);

  test("every call says storage is not set up until a store is plugged in", async () => {
    await expect(savePhoto(photo)).rejects.toBeInstanceOf(PhotoStorageNotConfigured);
    await expect(photoUrl("ref")).rejects.toBeInstanceOf(PhotoStorageNotConfigured);
    await expect(deletePhoto("ref")).rejects.toBeInstanceOf(PhotoStorageNotConfigured);
  });

  test("a plugged-in store handles every call", async () => {
    const saved = new Map<string, Uint8Array>();
    const memory: PhotoStore = {
      async save({ bytes }) {
        const reference = `photo-${saved.size + 1}`;
        saved.set(reference, bytes);
        return reference;
      },
      async url(reference) {
        return `https://photos.example/${reference}`;
      },
      async remove(reference) {
        saved.delete(reference);
      },
    };
    configurePhotoStore(memory);

    const reference = await savePhoto(photo);
    expect(saved.get(reference)).toEqual(photo.bytes);
    expect(await photoUrl(reference)).toBe(`https://photos.example/${reference}`);
    await deletePhoto(reference);
    expect(saved.has(reference)).toBe(false);
  });
});
