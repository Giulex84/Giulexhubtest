# Arena Test — Pi Testnet

Arena Test is the Testnet development build for Arena. It uses `Pi.init({ version: "2.0", sandbox: true })` and Test-Pi only.

## Current release

- Pi SDK authentication with server verification through `/v2/me`
- Short-lived HMAC-signed Arena sessions after `/v2/me` verification, avoiding a Pi API round trip for every card flip
- Classic memory mode with server-side progress persistence
- Daily Arena: 12 cards, 18-move limit, one persistent challenge per verified Pi UID and UTC day
- A Daily attempt starts only after the Pioneer explicitly presses Start; opening the Daily tab only restores an existing Testnet attempt. The interface shows pair progress and preserves same-day resume.
- Server-verified daily attempt count, personal best and Top 10 leaderboard
- Asynchronous PvP Testnet: server-controlled shared deck, real-opponent matchmaking and a clearly identified Arena Bot fallback
- Daily deck, revealed cards, matches, move count and result are controlled by the backend
- Premium unlock: exactly 1 Test-Pi, approved/completed server-side and persisted by verified Pi UID
- Daily Replay Ticket: exactly 0.1 Test-Pi, a repeatable consumable that creates one additional server-controlled challenge for the current UTC day
- Test-Pi gameplay rewards are disabled while the new challenge model is evaluated
- No Mainnet payment, key or wallet seed is used by this repository

## Security boundaries

Classic remains a casual progression mode: its score is calculated in the browser and bounded by the server. Its weekly ranking is for gameplay only and must not be used for prizes. Daily Arena is the server-validated foundation for future leaderboards and asynchronous PvP. Daily results award gameplay points only and never Pi.

Daily ranking prioritizes a completed challenge with fewer moves; when moves are equal, the higher score ranks first. Only server-completed Daily Arena results can enter the leaderboard. Authorized Pi usernames are displayed in the daily Top 10.

## Async PvP

PvP opponents play the same 12-card server-controlled deck. The winner is the player who completes it in fewer moves; score breaks a tie. Match state is persisted for 48 hours so real opponents do not need to be online simultaneously. A waiting player may explicitly choose the disclosed `Arena Bot`; bot results are generated server-side and are always labelled as bot play. PvP has no entry fee, Pi payout or purchasable competitive advantage.

Classic difficulty is capped at 20 cards from level 4 onward instead of jumping from 16 to 36 cards, keeping the mobile board readable.

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
14. Start PvP on two Pi accounts and confirm both receive the same deck.
15. Complete both sides and confirm fewer moves wins, with score as tie-breaker.
16. Start another match, choose Arena Bot, and confirm the opponent is visibly labelled as a bot.

Test-Pi has no real-world value. Arena Test is not an investment, gambling or earning product.

## Recovery and interface parity

Daily status reconciliation, first-flip restoration, atomic best-result and streak updates, atomic ticket delivery and fenced start/reset operations are aligned with Mainnet recovery fixes. Late responses, double taps and UTC day changes are guarded. Classic weekly rankings and a private mobile metrics dashboard are available; rankings show names above statistics. All Testnet products, amounts, sandbox mode, session signing and Redis `arena:test:*` keys are retained. No Next.js runtime is introduced. Gameplay A2U remains disabled.

Run `npm test` and `npm run check:build`. Optional real-Lua tests use `REDIS_TEST_SERVER` pointing to an isolated local redis-server. Confirm login, recovery, Daily and PvP in Pi Browser manually. Admin metrics require a server-verified Pi username (existing owner default); no deployment environment is changed by this update.


## Weekly cosmetic badges (October 12, 2026)
Classic weekly points count earned score increments, not lifetime totals. Historical progress remains saved. Equal weekly scores share competition rank (1, 1, 3); lifetime level no longer changes the displayed position. Top-three positions earn permanent gold/silver/bronze badges, with all ties included. Premium affects Classic scoring, so this is cosmetic recognition, not an equal-condition contest or a monetary reward.

The first eligible week starts October 12 UTC; first awards are available October 19 UTC. Closed weeks are finalized atomically on the next authenticated Classic leaderboard request, not by a scheduled job. All enrolled weeks are reconciled, so players can return late and still receive their badges. New badge-eligible weekly entries, completed award snapshots and per-user badges persist; pre-existing legacy weeks are not awarded or reset. The Hall of Fame displays the eight latest closed weeks; personal badges remain permanent. No Pi payouts, frames or paid advantages are introduced.

Progress, points and rank writes are atomic. Lower-score stale saves cannot roll back historical progress. Finalized weeks reject delayed writes before mutation and the client can retry against the current week. Existing scores saved before the weekly-rule deployment cannot be safely backfilled from lifetime totals. All Testnet key prefixes and payment settings remain isolated.


## Minimal analytics release

New Testnet analytics collection is disabled at the telemetry boundary. Existing historical data is preserved under the existing retention policy. Gameplay persistence, security controls and payment test receipts are unchanged.


## Testnet UX update — 22 October 2026

This update is limited to Giulexhubtest (Pi Testnet). Mainnet is not part of this release.

- Permanent language selection covers the game interface, dynamic messages and card labels in English, Italian, Spanish, French, Portuguese, German, Indonesian and Chinese. Local dictionaries make no translation API requests.
- Sign-in feedback is visible before authentication; duplicate attempts are blocked. Service failures return 503 separately from invalid Pi identity (401). Reauthentication preserves the current board and checks that the Pi account has not changed.
- Classic stores the current card arrangement, matched pairs, first revealed card and combo in the existing atomic Redis save. Older progress without a board continues to work. The new level-two board has four pairs; existing saved level-two boards with eight pairs remain valid. Score and level history are retained. Concurrent Classic sessions on different devices should be avoided.
- Reveal timing matches Mainnet and is fixed: Classic 420 ms, Daily and PvP 180 ms. There is no user timing preference. Daily and PvP remain server-controlled.
- Premium and Replay have a review dialog before the Pi wallet opens. Test prices and payment product IDs remain unchanged (Premium 1 Test-Pi, Replay 0.1 Test-Pi). Purchasing Premium preserves the current board; Replay purchase does not automatically consume its credit. Existing server receipt validation and recovery are retained.
- Waiting PvP searches can be cancelled under the matchmaking and match locks. An already joined duel is kept. Polling runs every ten seconds only while PvP is visible, and stops when the document is hidden.
- Game instructions, permanent support links, local action feedback, screen-reader card names, keyboard navigation between tabs, zoom and reduced-motion support are included.

Validation: `npm run check:build`; `REDIS_TEST_SERVER=/path/to/redis-server npm test`. UX regression tests cover board persistence and validation, stale snapshots, level transitions, identity vs storage errors, waiting-search cancellation and joined-duel protection. DOM-based simulated UI checks cover language switching, failed login/retry, board restoration and wallet confirmation. Real Pi Browser authorization and real Testnet wallet interactions still require a manual device check.

UX refinement: the optional How to play guide starts collapsed and contains only three short lines. Daily instructions are shortened. Previously saved reveal-time preferences are ignored.
