import { toast } from "sonner";

interface CopyToClipboardOptions {
  toastSuccessMessage: string;
  toastErrorMessage: string;
  toastSuccessId: string;
  toastErrorId: string;
}

export function copyToClipboard(
  value: string,
  options?: Partial<CopyToClipboardOptions>
): void {
  const {
    toastSuccessMessage = "Texto copiado com sucesso!",
    toastErrorMessage = "Ocorreu um erro ao copiar.",
    toastSuccessId = "copy-success",
    toastErrorId = "copy-error",
  } = options || {};

  navigator.clipboard
    .writeText(value)
    .then(() => {
      toast.success(toastSuccessMessage, { id: toastSuccessId });
    })
    .catch(() => {
      toast.error(toastErrorMessage, { id: toastErrorId });
    });
}
