# Spec — Nirium Watch

## Architecture

```
endpoints (static list + Rail402 Bazaar discovery)
   |
   v
probe:  GET without payment --> expect 402 + parse requirements (scheme, network, asset, amount, payTo)
   |
   v
pay:    Nirium x402 client, testnet buyer key --> expect 200 + `payment-response` header (tx hash)
   |
   v
verify: Stellar RPC getTransaction(hash) --> SUCCESS? transfer to payTo for amount?
   |
   v
record: result JSON -> sha256 -> signed with the monitor key -> Nirium Audit Trail anchor (CID)
   |
   v
data/history.json --> static status page (web/) on Vercel
   |
   `--> (phase 2) Pullcord alert on state change: settled -> failing, failing -> recovered
```

## Targets (verified 25-oct-2026 ~22:00 UTC)

| Endpoint | Facilitator | Price | Status when checked |
|---|---|---|---|
| `https://nirium-agent.fly.dev/api/v1/premium/market` | OpenZeppelin (via Nirium testnet agent) | 0.05 testnet USDC | 402 OK |
| `https://nirium-agent.fly.dev/api/v1/premium/signals` | same | check the 402 | 402 OK |
| `https://demo.rail402.dev/weather?city=Istanbul` | Rail402 (fees sponsored) | 0.001 USDC (`amount: 10000`) | listed in discovery feed OK |
| AgentSmith seller | `https://testnet.agentsmith.xyz/facilitator` (no key) | - | no hosted seller; only if time allows |

**Discovery:** also pull endpoints dynamically from `GET https://testnet.rail402.dev/discovery/resources` (`items[].resource`, `items[].accepts[]`). Cap at 3 discovered endpoints per run so the buyer doesn't burn money.

## Done criteria (minimum to submit)

- [ ] Public repo, history visibly started today
- [ ] >=2 endpoints on >=2 facilitators checked end to end on testnet, >=1 verified settlement hash
- [ ] Receipts anchored, CIDs on the page
- [ ] Public live URL with the status page
- [ ] README with problem, setup, env, demo, architecture, prior art and prior work
- [ ] 3-min video in our own voice, and the deck
- [ ] Submission form filled in, evidence tx hash included

## Build steps (owner G = core, M = web + docs)

1. Repo + harness files + buyer/monitor keys
2. `src/probe.ts` + `src/pay.ts` against Nirium's `market` endpoint -> M1: one real testnet tx hash printed
3. `src/verify.ts`: RPC `getTransaction`, decode SAC transfer, compare to 402 requirements
4. Rail402 discovery + pay `demo.rail402.dev/weather` -> second facilitator verified
5. `src/anchor.ts` + `data/history.json` -> M2: history has >=3 records with CIDs
6. `npm run watch`: loop every 15 min, commits + pushes `history.json`
7. `web/`: static status page, deployed with `vercel --prod` -> M3: public URL live
8. README: full writeup
9. Phase 2 (only if M1-M3 done): Pullcord alerts
10. Video + deck
11. Submission form

## Testnet constants

- USDC SAC: `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`
- Stellar RPC (testnet): `https://soroban-testnet.stellar.org`
- `maxAmountPerPayment` is NOT in `nirium@0.16.1` (ships in 0.17.0, issue #213) — default $1 cap is fine for cents.
