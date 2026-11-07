/**
 * Reads Strapi's error contract (`{ error: { status, name, message, details } }`) from a
 * failed `useFetchClient` call.
 */
interface ErrorBody {
  status?: number;
  name?: string;
  message?: string;
  details?: { fieldErrors?: Record<string, string[]> };
}

const errorBody = (error: unknown): ErrorBody | undefined =>
  (error as { response?: { data?: { error?: ErrorBody } } })?.response?.data?.error;

/**
 * HTTP status of a failed request, or undefined for network errors.
 * @param error - Thrown value.
 */
export const errorStatus = (error: unknown): number | undefined =>
  errorBody(error)?.status ?? (error as { status?: number })?.status;

/**
 * Field errors from a 400 ValidationError (zod's flattened `fieldErrors`).
 * @param error - Thrown value.
 * @returns Map of field name to first message.
 */
export const fieldErrors = (error: unknown): Record<string, string> => {
  const fields = errorBody(error)?.details?.fieldErrors ?? {};
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, messages]) => Array.isArray(messages) && messages.length)
      .map(([field, messages]) => [field, messages[0]])
  );
};

/**
 * True when the request was cancelled through its AbortSignal.
 * @param error - Thrown value.
 */
export const isAbort = (error: unknown): boolean =>
  (error as { name?: string })?.name === 'AbortError' ||
  (error as { name?: string })?.name === 'CanceledError';
