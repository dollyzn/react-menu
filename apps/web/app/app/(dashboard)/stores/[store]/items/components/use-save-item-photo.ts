import type { PhotoChange } from "@/components/app/photo-field";
import { useRemoveItemPhotoMutation, useUploadItemPhotoMutation } from "@/redux/features/item/itemApi";
import { getErrorMessage } from "@/utils/get-error-message";

/**
 * Applies the photo picked in an item form, after the item itself is saved
 * (a new item needs its id first). Returns an error message, or null.
 */
export function useSaveItemPhoto() {
  const [upload, uploadState] = useUploadItemPhotoMutation();
  const [remove, removeState] = useRemoveItemPhotoMutation();

  const save = async (change: PhotoChange, storeId: string, itemId: string) => {
    try {
      if (change.kind === "new") await upload({ storeId, itemId, photo: change.blob }).unwrap();
      if (change.kind === "remove") await remove({ storeId, itemId }).unwrap();
      return null;
    } catch (error) {
      return getErrorMessage(error as { data?: { error?: string } }, "Não foi possível salvar a foto.");
    }
  };

  return { save, saving: uploadState.isLoading || removeState.isLoading };
}
