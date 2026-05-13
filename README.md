# Giulex Hub Arena Pro (Testnet)

An interactive memory game built for the Pi Network ecosystem to demonstrate advanced **U2A (User-to-App)** and **A2U (App-to-User)** payment flows with game-loop logic.

## 🚀 Game Overview
Giulex Hub Arena is a fully **Pi Compliant** application that integrates real-time SDK interactions within a dynamic gameplay experience.

## 🎮 Game Mechanics
- **Dynamic Difficulty**: 10 progressive levels increasing grid size and symbol complexity.
- **Life System**: Players start with limited lives; matching pairs heals the player (+1 Life).
- **Premium Unlock**: Users can pay **1.0 Test-Pi** to get infinite lives and double points for 10 levels.
- **Skill Rewards**: Achieving a **Triple Combo (x3)** triggers an automatic reward of **0.3 Test-Pi** back to the player's wallet.

## 🛠 Technical Stack
- **Frontend**: Vanilla JS + CSS3 (Gaming UI)
- **Backend**: Next.js / Node.js (Vercel)
- **SDK**: Pi Network SDK v2.0
- **Pi-Compliant**: Includes English `privacy.html` and `terms.html`.

## 📁 API Endpoints
- `/api/pi-payment.js`: Manages the 1.0 Pi Premium subscription (Approve/Complete).
- `/api/a2u.js`: Processes the 0.3 Pi rewards for skilled players.

## ⚙️ Setup
Add the following to your Vercel Environment Variables:
- `PI_API_KEY`: Your Pi Network Developer Portal API Key (Testnet).

## ⚖️ Legal
This application is for demonstration and testing purposes. All currency used is Test-Pi.
