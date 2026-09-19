# Arena Test — Pi Testnet

Arena Test is the Testnet development build for Arena. It uses `Pi.init({ version: "2.0", sandbox: true })` and Test-Pi only.

## Current release

- Pi SDK authentication with server verification through `/v2/me`
- Short-lived HMAC-signed Arena sessions after `/v2/me` verification, avoiding a Pi API round trip for every card flip
- Classic memory mode with server-side progress persistence
- Daily Arena: 12 cards, 18-move limit, one persistent challenge per verified Pi UID and UTC day
- Server-verified daily attempt count, personal best and Top 10 leaderboard
- Daily deck, revealed cards, matches, move count and result are controlled by the backend
- Premium unlock: exactly 1 Test-Pi, approved/completed server-side and persisted by verified Pi UID
- Daily Replay Ticket: exactly 0.1 Test-Pi, a repeatable consumable that creates one additional server-controlled challenge for the current UTC day
- Test-Pi gameplay rewards are disabled while the new challenge model is evaluated
- No Mainnet payment, key or wallet seed is used by this repository

## Security boundaries

Classic mode remains a casual progression mode: its score is calculated in the browser and must not be used for prizes or a competitive leaderboard. Daily Arena is the server-validated foundation for future leaderboards and asynchronous PvP. Daily results award gameplay points only and never Pi.

Daily ranking prioritizes a completed challenge with fewer moves; when moves are equal, the higher score ranks first. Only server-completed Daily Arena results can enter the leaderboard. Authorized Pi usernames are displayed in the daily Top 10.

The backend validates Pi access tokens and never accepts a client-supplied UID as identity. Premium is granted only after the payment matches the fixed Testnet network, amount, memo, product and authenticated Pi UID, and Pi reports developer completion plus transaction verification.

The Arena session contains only the verified app UID and an expiry time. It is signed server-side with a key derived from the server-only Pi API key, expires after six hours and cannot be altered by the browser. Payments continue to require the original Pi access token and full payment verification.

Replay Tickets use the same verification lifecycle. Each verified payment identifier can grant exactly one ticket, and consuming a ticket is serialized with the Daily Arena lock to prevent duplicate resets.

## Environment variables

- `PI_API_KEY`: Testnet Developer Portal Server API Key; server only.
- `ARENA_KV_KV_REST_API_URL`: persistent Redis-compatible REST endpoint.
- `ARENA_KV_KV_REST_API_TOKEN`: persistent store token; server only.

`PI_APP_WALLET_SEED` is not required while A2U rewards are disabled. Never expose server variables with a public prefix or commit real credentials.

## Data separation

All Testnet records use the `arena:test:*` namespace. Mainnet uses the separate `arena:*` namespace. Testnet and Mainnet product identifiers, memos and network checks must remain distinct.

## Regression checklist

1. Open the deployment inside Pi Browser and sign in.
2. Confirm Classic progress restores after reopening the app.
3. Start Daily Arena and confirm the same challenge resumes after reload.
4. Confirm matched cards, moves and result cannot be overwritten through the Classic state endpoint.
5. Confirm the Daily challenge stops after completion or 18 moves.
6. Confirm Daily results do not create an A2U payment.
7. Confirm attempts, personal best and Top 10 update only after server-verified completion.
8. Confirm an inferior replay does not replace the personal best.
9. Confirm Premium costs exactly 1 Test-Pi and persists after reopening.
10. Buy a 0.1 Test-Pi Daily Replay Ticket, consume it after a completed challenge, and confirm a new deck is created.
11. Confirm reusing or recovering the same payment does not create a second ticket.
12. Interrupt one payment and confirm recovery does not duplicate fulfillment.
13. Confirm Privacy, Terms and validation key are publicly reachable.

Test-Pi has no real-world value. Arena Test is not an investment, gambling or earning product.
