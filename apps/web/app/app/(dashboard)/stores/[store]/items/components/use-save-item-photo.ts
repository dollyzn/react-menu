import type { PhotoChange } from "@/components/app/photo-field";
import { applyPhotoChange } from "@/lib/photo-change";
import { useRemoveItemPhotoMutation, useUploadItemPhotoMutation } from "@/redux/features/item/itemApi";

/**
 * Applies the photo picked in an item form, after the item itself is saved
 * (a new one needs its id first). Returns an error message, or null.
 */
export function useSaveItemPhoto() {
  const [upload, uploadState] = useUploadItemPhotoMutation();
  const [remove, removeState] = useRemoveItemPhotoMutation();

  const save = (change: PhotoChange, storeId: string, itemId: string) =>
    applyPhotoChange(change, {
      upload: (photo) => upload({ storeId, itemId, photo }).unwrap(),
      remove: () => remove({ storeId, itemId }).unwrap(),
    });

  return { save, saving: uploadState.isLoading || removeState.isLoading };
}
