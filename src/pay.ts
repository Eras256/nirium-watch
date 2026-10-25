import { Agent } from 'nirium';
import type { PayResult } from './types.js';

let agent: Agent | undefined;

function getAgent(): Agent {
  if (agent) return agent;
  const secretKey = process.env.STELLAR_SECRET;
  if (!secretKey) throw new Error('STELLAR_SECRET not set — run `npm run setup-keys` first.');
  agent = new Agent({ baseUrl: 'https://nirium-agent.fly.dev' });
  agent.initX402({ secretKey, network: 'stellar:testnet' });
  return agent;
}

/** Fetch an x402 endpoint with Nirium's testnet buyer key, paying whatever 402 it returns. */
export async function pay(url: string): Promise<PayResult> {
  try {
    const res = await getAgent().x402Fetch(url);
    if (res.status !== 200) {
      return { ok: false, status: res.status, error: `expected 200 after payment, got ${res.status}` };
    }
    const header = res.headers.get('payment-response');
    if (!header) {
      return { ok: false, status: 200, error: '200 OK but no payment-response header' };
    }
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    const tx = decoded.transaction;
    if (!tx) {
      return { ok: false, status: 200, error: 'payment-response header has no transaction hash' };
    }
    return { ok: true, status: 200, tx };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}
