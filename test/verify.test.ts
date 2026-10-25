import { describe, it, expect } from 'vitest';
import { xdr } from '@stellar/stellar-sdk';
import { decodeTransfers, matchTransfer } from '../src/verify.js';
import fixture from './fixtures/transfer-event.json' with { type: 'json' };

describe('verify (against a recorded testnet tx fixture)', () => {
  const events = fixture.contractEventsXdr.map((perOp) =>
    perOp.map((b64) => xdr.ContractEvent.fromXDR(b64, 'base64')),
  );

  it('decodes the real SAC transfer event', () => {
    const transfers = decodeTransfers(events);
    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toEqual({
      contract: fixture.requirement.asset,
      to: fixture.requirement.payTo,
      amount: BigInt(fixture.requirement.amount),
    });
  });

  it('matches when the transfer satisfies the requirement', () => {
    const transfers = decodeTransfers(events);
    const result = matchTransfer(transfers, fixture.requirement);
    expect(result.verified).toBe(true);
  });

  it('does not match a requirement for a different payTo', () => {
    const transfers = decodeTransfers(events);
    const result = matchTransfer(transfers, { ...fixture.requirement, payTo: 'GDIFFERENTPAYTO' });
    expect(result.verified).toBe(false);
  });

  it('does not match a requirement asking for more than was paid', () => {
    const transfers = decodeTransfers(events);
    const result = matchTransfer(transfers, { ...fixture.requirement, amount: '999999999' });
    expect(result.verified).toBe(false);
  });
});
