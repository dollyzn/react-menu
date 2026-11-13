import type { PhotoChange } from "@/components/app/photo-field";
import { useRemoveAddonPhotoMutation, useUploadAddonPhotoMutation } from "@/redux/features/addon/addonApi";
import { getErrorMessage } from "@/utils/get-error-message";

/**
 * Applies the photo picked in an add-on form, after the add-on itself is
 * saved (a new one needs its id first). Returns an error message, or null.
 */
export function useSaveAddonPhoto() {
  const [upload, uploadState] = useUploadAddonPhotoMutation();
  const [remove, removeState] = useRemoveAddonPhotoMutation();

  const save = async (change: PhotoChange, storeId: string, addonId: string) => {
    try {
      if (change.kind === "new") await upload({ storeId, addonId, photo: change.blob }).unwrap();
      if (change.kind === "remove") await remove({ storeId, addonId }).unwrap();
      return null;
    } catch (error) {
      return getErrorMessage(error as { data?: { error?: string } }, "Não foi possível salvar a foto.");
    }
  };

  return { save, saving: uploadState.isLoading || removeState.isLoading };
}
