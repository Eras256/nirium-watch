import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { HistoryRecord } from './types.js';

const HISTORY_PATH = 'data/history.json';

export async function readHistory(path = HISTORY_PATH): Promise<HistoryRecord[]> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as HistoryRecord[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

/** Append one record and write the file back out, keeping the most recent 500 per endpoint bounded overall. */
export async function appendHistory(record: HistoryRecord, path = HISTORY_PATH): Promise<HistoryRecord[]> {
  return appendHistoryBatch([record], path);
}

/** Append several records (e.g. a whole check round) in a single read+write. */
export async function appendHistoryBatch(
  records: HistoryRecord[],
  path = HISTORY_PATH,
): Promise<HistoryRecord[]> {
  const existing = await readHistory(path);
  const next = [...existing, ...records].slice(-2000);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

/** Most recent record per endpoint, for driving the status page. */
export function latestByEndpoint(records: HistoryRecord[]): Map<string, HistoryRecord> {
  const latest = new Map<string, HistoryRecord>();
  for (const r of records) {
    latest.set(r.endpoint, r);
  }
  return latest;
}
