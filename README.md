# Arena Test — Pi Testnet

Arena Test is the hardened Pi Testnet companion for Arena Mainnet. It is intentionally configured with `Pi.init({ version: "2.0", sandbox: true })` and uses Test-Pi only.

## Review / release status

- Network: **Pi Testnet**
- Pi SDK mode: `sandbox: true`
- Developer Portal version currently submitted/pending: **1.0.1**
- Authentication: Pi SDK only
- Transactions: Test-Pi only
- Premium: **1 Test-Pi U2A**, verified server-side and persisted by verified Pi UID
- A2U gameplay reward: **0.3 Test-Pi** for a server-verified Triple Combo, with durable anti-duplication controls
- Gameplay progress: persisted server-side and restored by verified Pi UID
- Public review documents: `privacy.html`, `terms.html`, and `validation-key.txt` on the deployed HTTPS domain

The current Developer Portal update request should not be discarded merely to change the version number; use the next version only for a future submission after the pending review is resolved.

## Current verified behavior

- Pi identity is verified server-side with `/v2/me`; client-provided identity is never trusted for backend authorization.
- Authentication requests `username`, `payments`, and `wallet_address`. The wallet scope is required by the current Testnet A2U reward flow; Arena Test does not request a user wallet passphrase or private key.
- U2A Premium costs exactly 1 Test-Pi and uses fixed memo/product validation, authenticated server approval/completion, txid matching, final re-fetch from Pi, and persistent entitlement by verified Pi UID.
- Incomplete Premium payments can be safely recovered server-side.
- Premium remains active after closing/reopening the app because entitlement is stored server-side by verified Pi UID.
- Gameplay progress (`level`, `lives`, `score`) is stored server-side and restored after sign-in. A Game Over can restart the same level without deleting accumulated score/progress.
- A2U rewards are Testnet-only. A verified Triple Combo can request exactly 0.3 Test-Pi.
- Reward amount and UID are fixed/verified server-side; the browser cannot choose either value.
- Reward processing includes persistent anti-duplication state, a processing lock, 60-second cooldown, 20-reward/day Testnet limit, incomplete-payment recovery, blockchain transaction recovery by payment memo, and final Pi payment verification before success is shown.
- A failed or interrupted reward attempt is recoverable and does not intentionally create a duplicate payout.
- No wallet seed, Pi Server API Key, or Redis credential is exposed to the browser.

## Required Vercel environment variables

Server-only variables:

- `PI_API_KEY` — Server API Key for the **Testnet** Developer Portal app.
- `PI_APP_WALLET_SEED` — secret seed/passphrase for the **Testnet app wallet used for A2U rewards**. Never prefix this with `NEXT_PUBLIC_` and never commit it to GitHub.
- Persistent Redis-compatible REST KV credentials. Supported names include `ARENA_KV_KV_REST_API_URL` and `ARENA_KV_KV_REST_API_TOKEN`.

The same Upstash database may be connected to Testnet and Mainnet because Arena Test keys are namespaced under `arena:test:*` while Mainnet uses the separate `arena:*` namespace.

If persistent storage is unavailable, login/gameplay can still load, but Premium purchasing and A2U rewards are intentionally unavailable because those features require durable server-side state.

## Final regression checklist

1. Open Arena Test inside Pi Browser and authorize Pi sign-in.
2. Confirm the backend reports the account as verified by Pi.
3. Confirm saved level/HP/score are restored after closing and reopening the app.
4. Confirm Game Over offers a level restart while preserving accumulated progress.
5. Confirm Premium is restored for an account that already purchased it.
6. With a controlled Testnet account, confirm a new Premium purchase completes at exactly 1 Test-Pi.
7. Reach a Triple Combo and confirm exactly 0.3 Test-Pi is verified and sent.
8. Confirm an immediate repeat reward is blocked by cooldown rather than duplicated.
9. Confirm a deliberately interrupted/pending A2U payment is recovered rather than recreated.
10. Confirm `privacy.html`, `terms.html`, and `validation-key.txt` are reachable from the deployed HTTPS domain.

Test-Pi has no real-world value. Arena Test is not an investment or earning product.
