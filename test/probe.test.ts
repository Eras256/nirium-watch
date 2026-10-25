import { describe, it, expect, vi, afterEach } from 'vitest';
import { probe } from '../src/probe.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function headerPayload(accepts: unknown[]) {
  return Buffer.from(JSON.stringify({ x402Version: 2, accepts })).toString('base64');
}

describe('probe', () => {
  it('parses a real-shaped payment-required header into a requirement', async () => {
    const accept = {
      scheme: 'exact',
      network: 'stellar:testnet',
      amount: '500000',
      asset: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
      payTo: 'GC4Q5TWWXI7IHN6DYCBEKCOWJWCKY4JE2NLKLU5SE3YL44IUUFPKUOPC',
    };
    globalThis.fetch = vi.fn(
      async () =>
        new Response('{}', { status: 402, headers: { 'payment-required': headerPayload([accept]) } }),
    ) as unknown as typeof fetch;

    const result = await probe('https://example.test/paid');
    expect(result.ok).toBe(true);
    expect(result.requirement).toEqual(accept);
  });

  it('reports a non-402 response as not ok', async () => {
    globalThis.fetch = vi.fn(async () => new Response('oops', { status: 500 })) as unknown as typeof fetch;
    const result = await probe('https://example.test/broken');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/expected 402/);
  });

  it('reports a 402 with no payment-required header as not ok', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 402 })) as unknown as typeof fetch;
    const result = await probe('https://example.test/broken-402');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/missing payment-required/);
  });

  it('reports a network error as not ok', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const result = await probe('https://example.test/down');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
  });
});
