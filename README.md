# Arena Test — Pi Testnet

Hardened Testnet companion for Arena Mainnet. It is intentionally configured with `Pi.init({ version: "2.0", sandbox: true })` and uses Test-Pi only.

## Security / compliance changes

- Pi identity is verified server-side with `/v2/me`; the client user object is not trusted for backend authorization.
- U2A Premium uses fixed amount/memo/product validation, authenticated server approval/completion, txid matching, final re-fetch from Pi, and persistent entitlement by Pi UID.
- Incomplete Premium payments can be safely recovered from the payment object fetched server-to-server from Pi.
- A2U rewards remain Testnet-only. The browser no longer supplies UID or amount. The backend fixes the reward at 0.3 Test-Pi, verifies the Pi user, applies a 60-second cooldown and a 20-reward/day Testnet limit, and verifies completion before reporting success.
- No wallet seed or Server API Key is exposed to the browser.
- `wallet_address` scope was removed because Arena Test does not currently use it.

## Required Vercel environment variables

Server-only variables:

- `PI_API_KEY` — Server API Key for the **Testnet** Developer Portal app.
- `PI_APP_WALLET_SEED` — secret seed/passphrase for the **Testnet app wallet used for A2U rewards**. Never prefix this with `NEXT_PUBLIC_` and never put it in GitHub.
- Persistent Redis-compatible REST KV credentials. The code supports the same Vercel/Upstash names used by Arena Mainnet, including `ARENA_KV_KV_REST_API_URL` and `ARENA_KV_KV_REST_API_TOKEN`.

The same Upstash database can be connected to this Vercel project because Testnet keys are namespaced under `arena:test:*` and Mainnet uses a separate namespace.

If persistent storage is not configured, login/gameplay still work but Premium purchases and A2U rewards are intentionally disabled.

## Test plan

1. Open the Testnet app in Pi Browser and sign in.
2. Confirm status says `verified by Pi`.
3. Buy Premium with 1 Test-Pi and confirm it persists after closing/reopening the app.
4. Reach a Triple Combo and confirm a 0.3 Test-Pi A2U reward is sent.
5. Trigger another Triple Combo immediately and confirm the server cooldown blocks rapid repeat rewards.

Test-Pi has no real-world value.
