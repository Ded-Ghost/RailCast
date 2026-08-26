/**
 * Simulates network latency for mock services so loading states are
 * exercised the same way they will be once these are swapped for real
 * `fetch`/WebSocket-backed implementations. Keep the delay short — this is
 * about exercising the loading UI, not slowing down development.
 */
export function resolveAfter<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
