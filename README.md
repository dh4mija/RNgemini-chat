# 💬 Gemini Chat — React Native App

A polished mobile chat application built with React Native and Expo. It connects to a local Express proxy server to stream conversations with Google's Gemini AI model, featuring persistent chat history, dark/light mode, and copy-to-clipboard support.

[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)

---

## ✨ Features

- Multi-conversation management (create, open, delete, clear all)
- Persistent chat history via AsyncStorage — chats survive app restarts
- Dark / Light mode toggle (auto-detects system preference)
- Copy-to-clipboard on any message bubble
- Smooth animated slide-in sidebar for conversation switching
- "New chat" quick-access button in the header
- Typing indicator while Gemini is generating a response
- Detailed error messages (invalid key, quota exceeded, safety blocks, timeouts)
- Android soft-keyboard awareness — composer stays above the keyboard
- System instruction support on the proxy server

---

## 🛠️ Tech Stack

- **Frontend**: React Native (Expo SDK 54)
- **Storage**: `@react-native-async-storage/async-storage`
- **Clipboard**: `expo-clipboard`
- **UI**: `react-native-safe-area-context`, `Animated` API
- **Backend proxy**: Node.js + Express
- **AI**: Google Gemini via `@google/generative-ai`

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- Expo Go app on your device, or an Android/iOS emulator
- A Gemini API key from [ai.google.dev](https://ai.google.dev/)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/RNgemini-chat.git
cd RNgemini-chat/chat-app
```

2. Install client dependencies:
```bash
npm install
```

3. Install server dependencies:
```bash
cd server
npm install
cd ..
```

4. Configure the server API key:
```bash
# server/.env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash        # optional, defaults to gemini-1.5-flash
SYSTEM_INSTRUCTION=You are a helpful AI.  # optional custom system prompt
```

5. Start the proxy server:
```bash
cd server
node index.js
```

6. Start the Expo app (in a separate terminal):
```bash
npm start
```

> **Note**: If running on a physical device, set `EXPO_PUBLIC_API_BASE_URL=http://<your-local-ip>:3001` in a `.env` file at the project root.

---

## 📁 Project Structure

```
chat-app/
├── App.js               # Main app — UI, state, AsyncStorage, theming
├── app.json             # Expo config
├── package.json
├── index.js             # Expo entry point
└── server/
    ├── index.js         # Express proxy → Gemini API
    ├── .env             # API key
    └── package.json
```

---

## 🔑 Environment Variables

| Variable | Location | Description |
|---|---|---|
| `GEMINI_API_KEY` | `server/.env` | **Required.** Your Gemini API key |
| `GEMINI_MODEL` | `server/.env` | Model name (default: `gemini-1.5-flash`) |
| `SYSTEM_INSTRUCTION` | `server/.env` | Optional system prompt for Gemini |
| `PORT` | `server/.env` | Server port (default: `3001`) |
| `EXPO_PUBLIC_API_BASE_URL` | `.env` (root) | Override the proxy URL for physical devices |

---

## 🤝 Contributing

Pull requests are welcome. Please open an issue first for major changes.
