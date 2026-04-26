# Giulex Hub Test

A Pi Network Testnet application designed to demonstrate and verify **User-to-App (U2A)** and **App-to-User (A2U)** payment flows.

## 🚀 Overview
Giulex Hub Test is built to be fully **Pi Compliant**. It serves as a technical benchmark for implementing the Pi SDK v2.0 in a Next.js/Vercel environment.

## 🛠 Features
- **User Authentication**: Secure login via Pi SDK.
- **U2A Payments**: Users can send 0.1 Test-Pi to the app.
- **A2U Payments**: The app can send 1.0 Test-Pi to the user.
- **Compliance Ready**: Includes English Privacy Policy and Terms of Service as per Pi Network requirements.

## 📁 Project Structure
- `/api/pi-payment.js`: Handles U2A approval and completion.
- `/api/a2u.js`: Handles server-side Test-Pi transfers to users.
- `/public/`: Contains `privacy.html` and `terms.html`.
- `index.html`: Main frontend logic and SDK integration.

## ⚙️ Configuration
The app requires the following environment variables on Vercel:
- `PI_API_KEY`: Your Pi Network Developer Portal API Key (Testnet).

## ⚖️ Legal
This app is for testing purposes only. It uses Test-Pi which has no monetary value.
