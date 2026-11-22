// The one place the app stores uploaded photos.
//
// Everything else (endpoints, compositions) calls savePhoto / photoUrl / deletePhoto and
// passes the returned reference to concepts such as PhotoChecking. Concepts never see photo
// bytes, only references.
//
// No storage is plugged in yet, so every call throws PhotoStorageNotConfigured. To plug one in,
// write an object that implements PhotoStore (S3, Cloudinary, GridFS, local disk, ...) and call
// configurePhotoStore(yourStore) once at startup in src/main.ts. Nothing else has to change.

// An opaque string the store hands back, such as an object key. Store it, don't parse it.
export type PhotoReference = string;

export type PhotoUpload = {
  bytes: Uint8Array;
  // The MIME type, such as "image/jpeg".
  contentType: string;
};

export interface PhotoStore {
  // Save the photo and return a reference that photoUrl and deletePhoto accept.
  save(photo: PhotoUpload): Promise<PhotoReference>;
  // A URL the browser can load the photo from. It may be short-lived (for example, a signed URL).
  url(reference: PhotoReference): Promise<string>;
  // Delete the photo. Deleting a reference that is already gone does nothing.
  remove(reference: PhotoReference): Promise<void>;
}

export class PhotoStorageNotConfigured extends Error {
  constructor() {
    super("Photo storage is not set up yet. Call configurePhotoStore in src/main.ts.");
  }
}

// Leave the methods empty: this is the slot to plug real storage into.
const notConfigured: PhotoStore = {
  async save() {
    throw new PhotoStorageNotConfigured();
  },
  async url() {
    throw new PhotoStorageNotConfigured();
  },
  async remove() {
    throw new PhotoStorageNotConfigured();
  },
};

let store: PhotoStore = notConfigured;

export function configurePhotoStore(next: PhotoStore): void {
  store = next;
}

// Put back the empty store. Tests use this to undo configurePhotoStore.
export function resetPhotoStore(): void {
  store = notConfigured;
}

export function savePhoto(photo: PhotoUpload): Promise<PhotoReference> {
  return store.save(photo);
}

export function photoUrl(reference: PhotoReference): Promise<string> {
  return store.url(reference);
}

export function deletePhoto(reference: PhotoReference): Promise<void> {
  return store.remove(reference);
}
