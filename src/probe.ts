import type { ProbeResult, X402PaymentRequired } from './types.js';

/**
 * GET an endpoint with no payment attached. A healthy x402 seller answers 402
 * with a `payment-required` header: base64 JSON with an `accepts[]` array.
 */
export async function probe(url: string): Promise<ProbeResult> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  }

  if (res.status !== 402) {
    return { ok: false, status: res.status, error: `expected 402, got ${res.status}` };
  }

  const header = res.headers.get('payment-required');
  if (!header) {
    return { ok: false, status: 402, error: 'missing payment-required header' };
  }

  let parsed: X402PaymentRequired;
  try {
    parsed = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
  } catch (err) {
    return { ok: false, status: 402, error: `could not parse payment-required header: ${err}` };
  }

  const requirement = parsed.accepts?.[0];
  if (!requirement) {
    return { ok: false, status: 402, error: 'payment-required header has no accepts[]' };
  }

  return { ok: true, status: 402, requirement };
}
