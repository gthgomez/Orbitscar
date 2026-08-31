# Android Preparation Notes

The prototype is a Vite-served Phaser 3 web client, deliberately kept free of browser-only rendering assumptions that would prevent a future Capacitor wrapper.

- Canvas is responsive and landscape-first; resize is handled by Phaser Scale.
- Input uses pointer events, not hover-only interaction. The current scene supports drag pan, wheel zoom, tap/click selection, and large touch-target buttons.
- The simulation is pure TypeScript and can run in a WebView without a server or Node API.
- No audio, filesystem, notification, billing, or background-lifecycle behavior is included yet.
- A later Android benchmark must measure WebView WebGL fallback behavior, context loss/restart, safe-area insets, suspended-tab timing, touch latency, and memory on a low-end device.

This document is preparation, not Android certification.
