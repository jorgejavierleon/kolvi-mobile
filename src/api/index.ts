/**
 * The typed `/api/v1` surface. Import from `@/api`, never from the files below —
 * per the README, nothing outside this directory calls `fetch`.
 *
 * Endpoint-specific request and response types belong to the feature that owns
 * them and are passed in as the `request` type parameter; this module is the
 * transport, not a catalogue of endpoints.
 */
export { api, configureApi, createApiClient } from './client';
export type {
  ApiClient,
  ApiClientOptions,
  HttpMethod,
  RequestOptions,
  TokenProvider,
} from './client';

export {
  API_VERSION_PREFIX,
  REQUEST_TIMEOUT_MS,
  resolveApiBaseUrl,
  resolveApiOrigin,
} from './config';

export { ApiError, isApiError } from './errors';
export type { ApiErrorKind, FieldErrors, ResponseHeaders } from './errors';

export { createConnectivitySource } from './connectivity';
export type { ConnectivitySource, NetworkModule } from './connectivity';

export {
  compareNaiveDateTime,
  dateOf,
  formatNaiveDate,
  formatNaiveDateTime,
  formatNaiveTime,
  isNaiveDate,
  isNaiveDateTime,
  isNaiveTime,
  naiveDate,
  naiveDateTime,
  naiveTime,
  NaiveDateTimeError,
  parseNaiveDate,
  parseNaiveDateTime,
  parseNaiveTime,
  timeOf,
} from './datetime';
export type {
  NaiveDate,
  NaiveDateParts,
  NaiveDateTime,
  NaiveDateTimeParts,
  NaiveTime,
  NaiveTimeParts,
} from './datetime';
