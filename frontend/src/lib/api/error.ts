/**
 * SecureFlow Error Normalization Utility
 * Ensures all API, network, Pydantic validation, and client errors
 * are normalized into clean, human-readable strings and never render [object Object].
 */

export interface PydanticValidationError {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
  input?: any;
  ctx?: Record<string, any>;
}

/**
 * Formats FastAPI/Pydantic validation errors (array or object) into human-readable text.
 */
export function formatPydanticErrors(detail: any): string {
  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    const formatted = detail
      .map((item: PydanticValidationError | any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const field = Array.isArray(item.loc)
            ? item.loc.filter((part: string | number) => part !== 'body' && part !== 'query' && part !== 'path').join(' → ')
            : '';
          const msg = item.msg || item.message || 'Invalid value';
          return field ? `${formatFieldName(field)}: ${msg}` : msg;
        }
        return 'Validation error';
      })
      .filter(Boolean);

    return formatted.length > 0 ? formatted.join(' • ') : 'Please check the highlighted form fields.';
  }

  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string') return detail.message;
    if (typeof detail.detail === 'string') return detail.detail;
    if (typeof detail.error === 'string') return detail.error;
    if (typeof detail.msg === 'string') return detail.msg;
  }

  return 'Please check the highlighted form fields.';
}

function formatFieldName(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Returns a user-friendly default message based on HTTP status codes.
 */
export function getStatusFallbackMessage(status?: number): string {
  switch (status) {
    case 400:
      return 'Invalid request parameters. Please verify your input.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'A resource conflict occurred. Please refresh and try again.';
    case 422:
      return 'Please check the highlighted form fields.';
    case 429:
      return 'Rate limit exceeded. Please wait a moment before trying again.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Something went wrong on the server. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * Main normalization function.
 * Accepts any error type (ApiError, Error, string, object, unknown)
 * and guarantees a safe, non-empty, non-object string output.
 */
export function normalizeApiError(error: unknown, fallbackMessage = 'Something went wrong. Please try again.'): string {
  if (!error) {
    return fallbackMessage;
  }

  if (typeof error === 'string') {
    return error.trim() || fallbackMessage;
  }

  if (typeof error === 'object') {
    const errObj = error as Record<string, any>;

    // Handle ApiError or fetch error containing status and data
    const status = typeof errObj.status === 'number' ? errObj.status : undefined;
    const data = errObj.data;

    // 1. Check data.detail (FastAPI standard)
    if (data?.detail) {
      const formatted = formatPydanticErrors(data.detail);
      if (formatted && formatted !== '[object Object]') {
        return sanitizeErrorMessage(formatted);
      }
    }

    // 2. Check errObj.message
    if (typeof errObj.message === 'string' && errObj.message.trim() && errObj.message !== '[object Object]') {
      // Check if the message is raw JSON
      if (errObj.message.startsWith('{') || errObj.message.startsWith('[')) {
        try {
          const parsed = JSON.parse(errObj.message);
          return sanitizeErrorMessage(formatPydanticErrors(parsed?.detail || parsed));
        } catch {
          // not JSON, continue
        }
      }

      // Check for network errors
      if (
        errObj.message.includes('Failed to fetch') ||
        errObj.message.includes('NetworkError') ||
        errObj.message.includes('ECONNREFUSED') ||
        errObj.message.includes('Network connection')
      ) {
        return 'Unable to connect to SecureFlow. Check that the service is running.';
      }

      return sanitizeErrorMessage(errObj.message);
    }

    // 3. Check data.message or data.error
    if (typeof data?.message === 'string' && data.message.trim()) {
      return sanitizeErrorMessage(data.message);
    }
    if (typeof data?.error === 'string' && data.error.trim()) {
      return sanitizeErrorMessage(data.error);
    }

    // 4. Status code fallback
    if (status) {
      return getStatusFallbackMessage(status);
    }
  }

  return fallbackMessage;
}

/**
 * Sanitizes errors to prevent exposing internal stack traces, DB details, or tokens.
 */
function sanitizeErrorMessage(msg: string): string {
  if (!msg || typeof msg !== 'string') return 'Something went wrong. Please try again.';

  const lower = msg.toLowerCase();

  // Redact internal database or Python stack trace leakages
  if (
    lower.includes('traceback (most recent call last)') ||
    lower.includes('sqlalchemy') ||
    lower.includes('sqlite3') ||
    lower.includes('psycopg') ||
    lower.includes('asyncpg')
  ) {
    return 'A database error occurred while processing your request. Please try again.';
  }

  // Redact token/credential strings
  if (lower.includes('bearer eyj') || lower.includes('sf_live_')) {
    return 'Authentication error. Please sign in again.';
  }

  return msg.trim();
}
