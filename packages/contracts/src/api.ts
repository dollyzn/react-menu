export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * HTTP envelope used by every JSON endpoint under /api/v1.
 * Producers: apps/api/app/helpers/api_response.ts and app/exceptions/handler.ts.
 */

export type ApiSuccess<T, M = undefined> = M extends undefined
  ? { success: true; data: T; message?: string }
  : { success: true; data: T; meta: M; message?: string };

/** Success without payload (e.g. delete, logout). */
export type ApiMessage = { success: true; message: string };

export type ApiErrorCode =
  | 'E_VALIDATION_ERROR'
  | 'E_INVALID_CREDENTIALS'
  | 'E_UNAUTHORIZED_ACCESS'
  | 'E_USER_INACTIVE'
  | 'E_AUTHORIZATION_FAILURE'
  | 'E_ROW_NOT_FOUND'
  | 'E_ROUTE_NOT_FOUND'
  | 'E_TOO_MANY_REQUESTS'
  | 'APP_EXCEPTION'
  | 'INTERNAL_SERVER_ERROR'
  | (string & {});

/**
 * Every non-2xx JSON response. The HTTP status is authoritative:
 * 401 = no/expired session, 403 = not allowed, 404 = not found (or not
 * visible to this user), 422 = validation, 429 = rate limited.
 */
export type ApiError = {
  success: false;
  error: string;
  code: ApiErrorCode;
  details?: unknown;
};

/** Lucid paginator meta (snake_case naming strategy). */
export type PaginationMeta = {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
  first_page: number;
  first_page_url: string;
  last_page_url: string;
  next_page_url: string | null;
  previous_page_url: string | null;
};

export type Paginated<T, ExtraMeta = {}> = ApiSuccess<T[], PaginationMeta & ExtraMeta>;

/** `data` of every `POST .../bulk-delete`: always 200, partial failure in `failed`. */
export type BulkDeleteResult<T> = {
  deleted: T[];
  failed: T[];
};
