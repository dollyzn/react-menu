import type { PhotoChange } from "@/components/app/photo-field";
import { applyPhotoChange } from "@/lib/photo-change";
import { useRemoveAddonPhotoMutation, useUploadAddonPhotoMutation } from "@/redux/features/addon/addonApi";

/**
 * Applies the photo picked in an add-on form, after the add-on itself is saved
 * (a new one needs its id first). Returns an error message, or null.
 */
export function useSaveAddonPhoto() {
  const [upload, uploadState] = useUploadAddonPhotoMutation();
  const [remove, removeState] = useRemoveAddonPhotoMutation();

  const save = (change: PhotoChange, storeId: string, addonId: string) =>
    applyPhotoChange(change, {
      upload: (photo) => upload({ storeId, addonId, photo }).unwrap(),
      remove: () => remove({ storeId, addonId }).unwrap(),
    });

  return { save, saving: uploadState.isLoading || removeState.isLoading };
}
