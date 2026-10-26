import { describe, it, expect, vi, afterEach } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { createHash } from 'node:crypto';
import { buildSignedRecord, anchor } from '../src/anchor.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.MONITOR_SECRET;
  delete process.env.PINATA_JWT;
});

describe('buildSignedRecord', () => {
  it('produces a verifiable ed25519 signature over nirium-audit-v1:<sha256(content)>', () => {
    const kp = Keypair.random();
    const content = [{ endpoint: 'https://example.test', state: 'ok' }];
    const record = buildSignedRecord(content, kp);

    const expectedSha = createHash('sha256').update(JSON.stringify(content)).digest('hex');
    expect(record.content_sha256).toBe(expectedSha);
    expect(record.agent.statement).toBe(`nirium-audit-v1:${expectedSha}`);
    expect(record.agent.key).toBe(kp.publicKey());
    expect(record.node).toBe('nirium-watch');
    expect(record.version).toBe('nirium-audit-v1');

    const verifyKp = Keypair.fromPublicKey(record.agent.key);
    const sigOk = verifyKp.verify(
      Buffer.from(record.agent.statement),
      Buffer.from(record.agent.signature, 'base64'),
    );
    expect(sigOk).toBe(true);
  });

  it('produces a different signature for different content', () => {
    const kp = Keypair.random();
    const a = buildSignedRecord({ a: 1 }, kp);
    const b = buildSignedRecord({ a: 2 }, kp);
    expect(a.content_sha256).not.toBe(b.content_sha256);
    expect(a.agent.signature).not.toBe(b.agent.signature);
  });
});

describe('anchor', () => {
  it('pins one signed record to Pinata and returns its cid', async () => {
    process.env.MONITOR_SECRET = Keypair.random().secret();
    process.env.PINATA_JWT = 'test-jwt';

    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://uploads.pinata.cloud/v3/files');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-jwt');
      const form = init.body as FormData;
      expect(form.get('network')).toBe('public');
      return new Response(JSON.stringify({ data: { cid: 'bafy-test-cid' } }), { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { cid } = await anchor([{ endpoint: 'x', state: 'ok' }]);
    expect(cid).toBe('bafy-test-cid');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws with the response body when Pinata rejects the upload', async () => {
    process.env.MONITOR_SECRET = Keypair.random().secret();
    process.env.PINATA_JWT = 'test-jwt';
    globalThis.fetch = vi.fn(
      async () => new Response('bad jwt', { status: 401 }),
    ) as unknown as typeof fetch;

    await expect(anchor([{ endpoint: 'x' }])).rejects.toThrow(/401/);
  });
});
