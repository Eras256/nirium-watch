import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { sign, alertOnStateChange } from '../src/pullcord.js';
import type { HistoryRecord } from '../src/types.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.PULLCORD_ALERT_SECRET;
});

function record(partial: Partial<HistoryRecord>): HistoryRecord {
  return {
    ts: '2026-10-26T00:00:00Z',
    endpoint: 'https://example.test/paid',
    facilitator: 'test',
    http402: true,
    paid: true,
    tx: null,
    verified: true,
    state: 'ok',
    latencyMs: 100,
    error: null,
    cid: null,
    ...partial,
  };
}

describe('pullcord signing', () => {
  it('produces t=<seconds>,v1=<hex> over `${t}.${rawBody}`', () => {
    const header = sign('s3cr3t', '{"a":1}');
    const match = header.match(/^t=(\d+),v1=([0-9a-f]+)$/);
    expect(match).not.toBeNull();
    const [, t, hex] = match!;
    const expected = createHmac('sha256', 's3cr3t').update(`${t}.{"a":1}`).digest('hex');
    expect(hex).toBe(expected);
  });
});

describe('alertOnStateChange', () => {
  it('does nothing when state is unchanged', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await alertOnStateChange(record({ state: 'ok' }), record({ state: 'ok' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing when there is no previous record', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await alertOnStateChange(undefined, record({ state: 'down' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('alerts once when settled -> failing', async () => {
    process.env.PULLCORD_ALERT_SECRET = 'test-secret';
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await alertOnStateChange(record({ state: 'ok' }), record({ state: 'down', error: 'boom' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://pullcord-notify.fly.dev/v1/alerts/external');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.type).toBe('endpoint.failing');
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty('Pullcord-Signature');
  });

  it('alerts once when failing -> recovered', async () => {
    process.env.PULLCORD_ALERT_SECRET = 'test-secret';
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await alertOnStateChange(record({ state: 'down' }), record({ state: 'ok' }));
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.type).toBe('endpoint.recovered');
  });

  it('does not alert for degraded -> down (neither end is settled)', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await alertOnStateChange(record({ state: 'degraded' }), record({ state: 'down' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips sending when the secret is missing, without throwing', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await alertOnStateChange(record({ state: 'ok' }), record({ state: 'down' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
