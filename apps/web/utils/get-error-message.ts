type ErrorWithPayload = {
  data?: { message?: string; error?: string };
  errors?: Array<{ message?: string }>;
  message?: string;
};

export function getErrorMessage(error: unknown, defaultMessage?: string): string {
  const parsed = (error ?? {}) as ErrorWithPayload;

  if (typeof parsed.data?.message === "string") {
    return parsed.data.message;
  }
  if (typeof parsed.data?.error === "string") {
    return parsed.data.error;
  }
  if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
    const firstMessage = parsed.errors[0]?.message;
    if (firstMessage) {
      return firstMessage;
    }
  }
  if (parsed.message) {
    return parsed.message;
  }
  return (
    defaultMessage || "Ocorreu um erro inesperado. Por favor, tente novamente."
  );
}

/** The request never got an answer (offline, dropped or too slow). */
export function isConnectionError(error: unknown) {
  const status = (error as { status?: unknown } | null)?.status;
  return status === "FETCH_ERROR" || status === "TIMEOUT_ERROR" || status === 502 || status === 503 || status === 504;
}
