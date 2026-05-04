export function getErrorMessage(error: any, defaultMessage?: string): string {
  if (error?.data?.message && typeof error.data.message === "string") {
    return error.data.message;
  }
  if (error?.data?.error && typeof error.data.error === "string") {
    return error.data.error;
  }
  if (error.errors && Array.isArray(error.errors) && !!error.errors.length) {
    if (error.errors[0].message) {
      return error.errors[0].message;
    }
  }
  if (error.message) {
    return error.message;
  }
  return (
    defaultMessage || "Ocorreu um erro inesperado. Por favor, tente novamente."
  );
}
