import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseAuth, getFirebaseStorage } from "./firebase";

/**
 * Upload a local image (file:// URI from the picker) to Firebase Storage
 * and return its tokenized download URL. Paths are keyed by the owner's
 * uid so storage rules can scope writes to the owner's own folder; the
 * returned download URL is tokenized, so customers can view it freely.
 *
 *   shop-images/{ownerUid}/shop.jpg
 *   service-images/{ownerUid}/{serviceKey}.jpg
 */
async function uploadImage(path: string, localUri: string): Promise<string> {
  const storage = getFirebaseStorage();
  const uid = getFirebaseAuth()?.currentUser?.uid;
  if (!storage || !uid) {
    throw new Error("Not signed in — please log in again before uploading.");
  }
  const response = await fetch(localUri);
  const blob = await response.blob();
  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(objectRef);
}

export async function uploadShopImage(localUri: string): Promise<string> {
  const uid = getFirebaseAuth()?.currentUser?.uid;
  return uploadImage(`shop-images/${uid}/shop.jpg`, localUri);
}

/**
 * serviceKey is the service id when editing, or a fresh timestamp when
 * creating (the service has no id yet). Either way it stays within the
 * owner's uid folder.
 */
export async function uploadServiceImage(
  serviceKey: string,
  localUri: string,
): Promise<string> {
  const uid = getFirebaseAuth()?.currentUser?.uid;
  return uploadImage(`service-images/${uid}/${serviceKey}.jpg`, localUri);
}
