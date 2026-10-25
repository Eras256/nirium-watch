# Design — Nirium Watch status page

- Dark background, teal accent (Nirium palette), monospace for hashes.
- Three states per endpoint:
  - **OK** — settled (402 answered, payment made, on-chain transfer verified)
  - **degraded** — 402 OK but settle failed or slow
  - **down** — no 402, or request error
- Big status dot per endpoint, readable at a glance.
- Per-endpoint card shows: state, last settled tx (short link to `stellar.expert`), receipt CID (short link to Pinata gateway), latency, last 24 checks as a dot strip.
- Works on a phone — single column, no horizontal scroll, tap targets >= 40px.
