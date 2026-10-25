export interface X402Accept {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
}

export interface X402PaymentRequired {
  x402Version: number;
  error?: string;
  resource?: { url: string; description?: string; mimeType?: string };
  accepts: X402Accept[];
}

export interface ProbeResult {
  ok: boolean;
  status: number;
  requirement?: X402Accept;
  error?: string;
}

export interface PayResult {
  ok: boolean;
  status: number;
  tx?: string;
  error?: string;
}

export interface VerifyResult {
  verified: boolean;
  reason: string;
  ledger?: number;
}

export type CheckState = 'ok' | 'degraded' | 'down';

export interface EndpointTarget {
  name: string;
  url: string;
  facilitator: string;
}

export interface HistoryRecord {
  ts: string;
  endpoint: string;
  facilitator: string;
  http402: boolean;
  paid: boolean;
  tx: string | null;
  verified: boolean;
  state: CheckState;
  latencyMs: number;
  error: string | null;
  cid: string | null;
}
