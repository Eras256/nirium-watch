import { describe, it, expect, afterEach } from 'vitest';
import { rm } from 'node:fs/promises';
import { appendHistory, readHistory, latestByEndpoint } from '../src/history.js';
import type { HistoryRecord } from '../src/types.js';

const TEST_PATH = 'data/history.test.json';

function record(partial: Partial<HistoryRecord>): HistoryRecord {
  return {
    ts: '2026-10-25T22:00:00Z',
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

afterEach(async () => {
  await rm(TEST_PATH, { force: true });
});

describe('history', () => {
  it('starts empty when the file does not exist', async () => {
    expect(await readHistory(TEST_PATH)).toEqual([]);
  });

  it('appends records and persists them', async () => {
    await appendHistory(record({ tx: 'tx1' }), TEST_PATH);
    const after = await appendHistory(record({ tx: 'tx2' }), TEST_PATH);
    expect(after).toHaveLength(2);
    expect(await readHistory(TEST_PATH)).toHaveLength(2);
  });

  it('keeps the most recent record per endpoint', () => {
    const records = [
      record({ endpoint: 'a', tx: 'old-a' }),
      record({ endpoint: 'b', tx: 'old-b' }),
      record({ endpoint: 'a', tx: 'new-a' }),
    ];
    const latest = latestByEndpoint(records);
    expect(latest.get('a')?.tx).toBe('new-a');
    expect(latest.get('b')?.tx).toBe('old-b');
  });
});
