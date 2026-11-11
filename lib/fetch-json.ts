// Keep the deadline active until the body has arrived and JSON is decoded.
// Timing out only fetch() leaves streamed AI responses waiting indefinitely.
export async function fetchJsonWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
  try {
    const response = await fetch(url, { ...options, signal });
    if (!response.ok) throw new Error(`Upstream request failed (${response.status})`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}
