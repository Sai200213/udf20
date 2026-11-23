/**
 * Resilient Single-Retry Fetch
 * 
 * Specifically designed for mobile networks / spotty 4G connections:
 * - If a network drop occurs (TypeError: Failed to fetch / offline),
 *   it waits 1.5 seconds and performs AT MOST ONE single retry.
 * - Strictly avoids multiple retries or request flooding.
 * - Only retries idempotent operations (GET, HEAD) or safe network read requests.
 */

export async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  const isSafeToRetry = method === 'GET' || method === 'HEAD';

  try {
    return await fetch(input, init);
  } catch (err: any) {
    if (err?.name === 'AbortError' || init?.signal?.aborted) throw err;
    const isNetworkDrop = err?.name === 'TypeError' || (typeof navigator !== 'undefined' && !navigator.onLine);

    if (isNetworkDrop && isSafeToRetry) {
      // Exactly ONE controlled retry after a 1.5-second recovery window
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (init?.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
      return await fetch(input, init);
    }

    throw err;
  }
}

export default resilientFetch;

