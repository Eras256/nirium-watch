import { rpc, scValToNative, StrKey, xdr } from '@stellar/stellar-sdk';
import type { X402Accept, VerifyResult } from './types.js';

const server = new rpc.Server('https://soroban-testnet.stellar.org');

interface DecodedTransfer {
  contract: string;
  to: string;
  amount: bigint;
}

/** Pull every SAC `transfer` event out of a transaction's contract events. */
export function decodeTransfers(contractEventsXdr: xdr.ContractEvent[][]): DecodedTransfer[] {
  const transfers: DecodedTransfer[] = [];
  for (const perOp of contractEventsXdr) {
    for (const event of perOp) {
      const contractIdBuf = event.contractId();
      if (!contractIdBuf) continue;
      const body = event.body().value();
      if (!body) continue;
      const topics = body.topics().map(scValToNative);
      if (topics[0] !== 'transfer') continue;
      const to = topics[2];
      const amount = scValToNative(body.data());
      transfers.push({
        // contractId() is typed as a Hash wrapper but decodes to a raw Buffer at runtime.
        contract: StrKey.encodeContract(contractIdBuf as unknown as Buffer),
        to: typeof to === 'string' ? to : String(to),
        amount: typeof amount === 'bigint' ? amount : BigInt(amount),
      });
    }
  }
  return transfers;
}

/**
 * Confirm on chain that a payment settled: the transaction succeeded, and one
 * of its SAC transfer events moved the required asset to the required payTo
 * for at least the required amount.
 */
export async function verify(txHash: string, requirement: X402Accept): Promise<VerifyResult> {
  let res;
  try {
    res = await server.getTransaction(txHash);
  } catch (err) {
    return { verified: false, reason: `RPC error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (res.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    return { verified: false, reason: 'transaction not found on testnet RPC (yet)' };
  }
  if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
    return { verified: false, reason: 'transaction failed on chain', ledger: res.ledger };
  }

  const transfers = decodeTransfers(res.events.contractEventsXdr);
  const result = matchTransfer(transfers, requirement);
  return { ...result, ledger: res.ledger };
}

/** Pure match: does any decoded transfer satisfy the 402 requirement? */
export function matchTransfer(
  transfers: DecodedTransfer[],
  requirement: X402Accept,
): Omit<VerifyResult, 'ledger'> {
  const requiredAmount = BigInt(requirement.amount);
  const match = transfers.find(
    (t) => t.contract === requirement.asset && t.to === requirement.payTo && t.amount >= requiredAmount,
  );

  if (!match) {
    return {
      verified: false,
      reason: `no transfer of >=${requiredAmount} to ${requirement.payTo} on ${requirement.asset} found in tx events`,
    };
  }

  return { verified: true, reason: `settled ${match.amount} to ${match.to}` };
}
