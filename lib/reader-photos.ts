import { supabase } from "@/lib/supabase";
import { readAccountCache, writeAccountCache } from "./account-cache";
import type { Reader } from "./readers";
import { validReaderId } from "@/lib/readers";

export const AVATAR_BUCKET = "reader-avatars";
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validAvatarPath(path: unknown, userId?: string): path is string {
  if (typeof path !== "string") return false;
  const parts = path.split("/");
  return parts.length === 2 && validReaderId(parts[0]) && (!userId || parts[0] === userId)
    && /^[0-9a-f-]{36}\.jpg$/i.test(parts[1]) && validReaderId(parts[1].slice(0, -4));
}

export function avatarUrl(path: unknown) {
  return validAvatarPath(path) ? supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl : null;
}

// Re-encode to a small square JPEG: no EXIF location data or original filename.
export async function prepareReaderPhoto(file: File): Promise<Blob> {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error("Choose a JPG, PNG, or WebP photo.");
  if (!file.size || file.size > MAX_PHOTO_BYTES) throw new Error("Choose a photo smaller than 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new Error("This photo could not be opened. Please choose another.");
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this photo.");
    context.fillStyle = "#fffdf9"; context.fillRect(0, 0, 512, 512);
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 512, 512);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare this photo.")), "image/jpeg", 0.85));
  } finally { URL.revokeObjectURL(url); }
}

export async function saveReaderPhoto(userId: string, blob: Blob | null, oldPath: string | null) {
  const { data } = await supabase.auth.getUser();
  if (!validReaderId(userId) || data.user?.id !== userId || data.user.is_anonymous) throw new Error("Please sign in again to change your photo.");
  if (blob && (blob.type !== "image/jpeg" || blob.size > 1024 * 1024)) throw new Error("This photo could not be saved. Choose another.");
  const bucket = supabase.storage.from(AVATAR_BUCKET);
  const path = blob ? `${userId}/${crypto.randomUUID()}.jpg` : null;
  if (path && blob) {
    const upload = await bucket.upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (upload.error) throw upload.error;
  }
  const result = await supabase.from("reader_profiles").update({ avatar_path: path }).eq("user_id", userId).select("user_id").single();
  if (result.error || !result.data) {
    if (path) await bucket.remove([path]).catch(() => {});
    throw result.error || new Error("Your reader profile is unavailable.");
  }
  if (oldPath && oldPath !== path && validAvatarPath(oldPath, userId)) {
    // A cleanup failure must not undo the newly saved profile picture.
    await bucket.remove([oldPath]).catch(() => {});
  }
  window.dispatchEvent(new CustomEvent("aepilog-photo-changed", { detail: { userId, path } }));
  const cached = readAccountCache<Reader>("reader");
  if (cached?.user_id === userId) writeAccountCache("reader", userId, { ...cached, avatar_path: path });
  return path;
}
