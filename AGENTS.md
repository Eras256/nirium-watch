# AGENTS.md — Nirium Watch

## Mission

Nirium Watch: uptime and settlement checks for x402 APIs on Stellar. See `thesis.md`.

## Rules

- **Deadline:** submissions lock Mon 26-oct 12:00 Lisbon = 06:00 Mexico City. Target submitted by 05:00 Mexico. Stop adding features at 02:30 Mexico.
- **Remote, not prize-eligible.** Never imply we were on-site in Lisbon.
- **Genesis = new code written during this event.** Nirium (SDK, Audit Trail, testnet agent) and Pullcord (phase 2) are prior work used as dependencies, disclosed in the README. Nothing from either repo is copied into this repo.
- **Testnet only.** Never put a mainnet secret anywhere.
- **Identity before any write:** `gh api user --jq .login` must print `Eras256`. In this repo only (no `--global`): `git config user.name "Giovanny Amador"` and `git config user.email "219895655+Eras256@users.noreply.github.com"`. Push with `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push`.
- **Do not depend on GitHub Actions.** Schedule runs with a local loop (`npm run watch`) instead.
- **Vercel:** run `vercel whoami` right before `vercel --prod` and stop if it's not the intended account. Deploy with the CLI, not the git integration.
- Do not claim external users, partnerships, that a facilitator is "down" from one failed check, mainnet, Audit Trail traction from these receipts, or "no one has built this." See `spec.md` / section 8 of the original build note for the full list.
- Do not use "SDK" or "Developer" in the project name or title.

## Scope

`spec.md`, section "Build steps", plus phase 2 (Pullcord alerts) only if M1–M3 are done with time to spare.

## Tools

Node 22.12+, TypeScript, `nirium@0.16.1`, `@stellar/stellar-sdk@16`, Stellar RPC testnet (`https://soroban-testnet.stellar.org`), Vercel CLI.

## Done

See "Done criteria" in `spec.md`.

## Working style

One small commit per working step. One GitHub issue per spec item where useful.
