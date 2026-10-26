# Nirium Watch

**Uptime and settlement checks for x402 APIs on Stellar.**

Live status page: **https://nirium-watch.vercel.app**
Built during HackMeridian 2026 — remote, testnet only, not prize-eligible (see [Eligibility](#eligibility)).

## Problem

An x402 endpoint that answers `402 Payment Required` proves nothing about whether you can actually get paid. A facilitator can stay broken for weeks while every endpoint behind it keeps returning a perfect 402. On Stellar this already happened: the OpenZeppelin facilitator's issue #47 (~32-day outage) was diagnosed by hand by four separate integrators. We were burned ourselves — a payment method we listed as "live" had zero settled payments, and nothing caught it.

## Users

- **x402 sellers** — is my API actually getting paid?
- **Agent builders** — should my agent trust this seller / this facilitator?
- **Facilitators** — is my settlement path healthy, end to end?

Three Stellar x402 facilitators were just funded in SCF round #45 — this problem is about to matter to more people, not fewer.

## What it does

Nirium Watch pays each endpoint the way an agent would, on **testnet**, then confirms **on chain** that the money actually moved to the right `payTo` for the right amount. Every result is a signed, independently verifiable receipt (Nirium Audit Trail, IPFS CID). A public status page shows it per endpoint and per facilitator.

```
endpoints (static list + Rail402 Bazaar discovery)
   |
   v
probe:  GET without payment --> expect 402 + parse requirements (scheme, network, asset, amount, payTo)
   |
   v
pay:    Nirium x402 client, testnet buyer key --> expect 200 + payment-response header (tx hash)
   |
   v
verify: Stellar RPC getTransaction(hash) --> SUCCESS? SAC transfer event to payTo for amount?
   |
   v
record: result JSON -> sha256 -> signed with the monitor key -> Nirium Audit Trail anchor (CID)
   |
   v
data/history.json --> status page (web/) on Vercel, fetched live from this repo
```

`npm run watch` runs this on a 15-minute loop and commits + pushes `data/history.json` itself — no GitHub Actions dependency. In production it runs as a small worker on Fly.io (`nirium-watch`, Dockerfile at repo root), not on anyone's laptop — see `fly.toml`.

### Phase 2: Pullcord alerts

On a state change per endpoint (settled → failing, failing → recovered), Nirium Watch posts a signed alert to Pullcord's external alert intake (`POST /v1/alerts/external`, HMAC-SHA256 over `<timestamp>.<rawBody>` in the `Pullcord-Signature` header). One alert per endpoint per state change — no repeats while a failure persists. See `src/pullcord.ts`.

## Endpoints checked

| Endpoint | Facilitator | Price |
|---|---|---|
| `nirium-agent.fly.dev/api/v1/premium/market` | OpenZeppelin (via Nirium testnet agent) | 0.05 testnet USDC |
| `nirium-agent.fly.dev/api/v1/premium/signals` | OpenZeppelin (via Nirium testnet agent) | varies |
| `demo.rail402.dev/weather?city=Istanbul` | Rail402 (fees sponsored) | 0.001 USDC |
| + up to 3 more, pulled live from the Rail402 Bazaar discovery feed | Rail402 | varies |

Discovery source: `GET https://testnet.rail402.dev/discovery/resources`, capped at 3 extra endpoints per run.

Stellar testnet constants used throughout:
- USDC (SAC): `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`
- Stellar RPC: `https://soroban-testnet.stellar.org`

## Setup

```
npm install
npm run setup-keys       # generates buyer + monitor Stellar testnet keys into .env, funds buyer via friendbot
npx tsx src/setup-trustline.ts   # USDC trustline + DEX swap (or faucet.circle.com if no DEX route)
npm run check             # one pass over all targets
npm run watch             # repeats every 15 min, commits + pushes data/history.json
npm test                  # unit tests: 402 header parsing, on-chain verify logic (recorded fixture), history append
```

### Env vars (written by `setup-keys`, never committed)

| Var | Purpose |
|---|---|
| `STELLAR_SECRET` | buyer key — holds testnet USDC, pays each endpoint |
| `MONITOR_SECRET` | monitor key — signs receipts before anchoring, holds no funds |
| `PULLCORD_ALERT_SECRET` | per-source HMAC secret for Pullcord's alert intake (phase 2; optional — alerts are skipped if unset) |

## Design

Dark background, teal accent, monospace hashes. Three states per endpoint: **OK** (settled and verified on chain), **degraded** (402 OK but payment or settlement failed), **down** (no 402 or request error). See [design.md](design.md).

## Prior art

Nearest prior art we found: [`carstenjacobsen/x402-testing-tool`](https://github.com/carstenjacobsen/x402-testing-tool) (Stellar Hacks: Agents), which mocks endpoints and clients for development. Nirium Watch checks **live** endpoints continuously and verifies **settlement on chain** — a neighbour, not a duplicate.

## Prior work (disclosed)

Everything in this repo (`src/`, `web/`, `test/`) was written during HackMeridian. It depends on, but does not copy from:

- [`nirium`](https://www.npmjs.com/package/nirium) `0.16.1` — Stellar x402 SDK, used for `Agent.x402Fetch` and `Agent.anchorAuditRecord`.
- The Nirium Audit Trail testnet node, used to anchor signed receipts (tag `nirium-watch`, excluded from any aggregate Nirium reporting — these are self-generated monitoring receipts, not organic traffic).
- The Nirium testnet agent (`nirium-agent.fly.dev`), used as one of the endpoints checked.
- [Pullcord](https://pullcord-notify.fly.dev) — its existing, already-deployed external alert intake (`/v1/alerts/external`), used in phase 2 to notify on state changes. We did not modify Pullcord's repo or service; we only call its public alert-intake route with a per-source secret issued to us.

## Honest limits

- **All payments are ours.** The buyer key is our own team key. This is not adoption, not customers, not external traffic.
- **No partnerships.** We have no relationship with OpenZeppelin, Rail402, or Nirium beyond calling their public testnet endpoints.
- **A failed check is not proof a facilitator is "down."** One failure just means one failed check at one timestamp; the status page shows history, not verdicts.
- **Testnet only.** No mainnet secret exists anywhere in this project.
- **Rail402 Bazaar discovery is called literally.** A couple of discovered resources are templated (e.g. `/users/:id`) or need query params we don't always supply; those show up honestly as `down` rather than being special-cased.
- **Phase 2 (Pullcord alerts)** is only attempted if the core monitor (this README's scope) is done with time to spare — see `spec.md`.

## Eligibility

We built remotely, not on site in Lisbon, so this submission is **not eligible for a prize** under HackMeridian's rules. We're submitting for the artifact and the follow-on Instaward track.

## License

MIT (or as required by the hackathon — update before any reuse).
