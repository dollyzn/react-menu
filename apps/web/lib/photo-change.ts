import type { PhotoChange } from "@/components/app/photo-field";
import { getErrorMessage } from "@/utils/get-error-message";

/**
 * Applies a photo picked in a form (an item's, an add-on's) once the row is
 * saved: uploads it, removes it, or leaves it. Returns an error message, or null.
 */
export async function applyPhotoChange(
  change: PhotoChange,
  actions: { upload: (photo: Blob) => Promise<unknown>; remove: () => Promise<unknown> }
) {
  try {
    if (change.kind === "new") await actions.upload(change.blob);
    if (change.kind === "remove") await actions.remove();
    return null;
  } catch (error) {
    return getErrorMessage(error as { data?: { error?: string } }, "Não foi possível salvar a foto.");
  }
}
