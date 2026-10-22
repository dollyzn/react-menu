import { toast } from "sonner";

interface CopyToClipboardOptions {
  toastSuccessMessage: string;
  toastErrorMessage: string;
  toastSuccessId: string;
  toastErrorId: string;
}

/**
 * navigator.clipboard only exists on secure origins (https, localhost); on a
 * plain-http LAN address (testing on a phone) a hidden textarea copies instead.
 */
async function write(value: string) {
  if (navigator.clipboard) return navigator.clipboard.writeText(value);

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (!document.execCommand("copy")) throw new Error("copy refused");
  } finally {
    textarea.remove();
  }
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

  write(value)
    .then(() => {
      toast.success(toastSuccessMessage, { id: toastSuccessId });
    })
    .catch(() => {
      toast.error(toastErrorMessage, { id: toastErrorId });
    });
}
