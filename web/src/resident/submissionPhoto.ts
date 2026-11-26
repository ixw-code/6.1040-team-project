// Keep in sync with the upload limit in src/http.ts.
const maxPhotoBytes = 1_048_576;
const uploadTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function prepareSubmissionPhoto(file: File): Promise<File> {
  if (!file.size) throw new Error("The selected photo is empty. Choose another image.");

  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    if (uploadTypes.has(file.type) && file.size <= maxPhotoBytes) return file;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error();

    for (const maxEdge of [1600, 1200, 900, 640]) {
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      if (blob?.type === "image/jpeg" && blob.size && blob.size <= maxPhotoBytes) {
        return new File([blob], "submission.jpg", { type: blob.type });
      }
    }
  } catch {
    throw new Error("Couldn't open this image. Choose a JPEG, PNG, or WebP photo.");
  } finally {
    URL.revokeObjectURL(url);
  }
  throw new Error("The photo is too large. Choose a smaller image.");
}
