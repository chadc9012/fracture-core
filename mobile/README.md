# World Fracture for Android

A Capacitor app that runs the game full screen in landscape on Android phones: system bars hidden, screen kept on, touch controls
from the web build. It loads the live game (`server.url` in `capacitor.config.json`), so every change pushed to the game shows up
in the app without reinstalling.

## Getting the APK
GitHub builds it: `.github/workflows/android-apk.yml` runs on every push that touches `mobile/` (or by hand from the Actions tab)
and publishes `WorldFracture.apk` as the **android-latest** release:
https://github.com/chadc9012/fracture-core/releases/tag/android-latest

On the phone: open that page, tap `WorldFracture.apk`, allow installs from the browser when Android asks, then open World Fracture.

## Building locally
Requires the Android SDK (Android Studio) and Java 21:
```
cd mobile
npm install
npm run apk          # → android/app/build/outputs/apk/debug/app-debug.apk
```

## Changing which game it loads
`server.url` points at the Lovable preview. When the game is published (or moves to its own domain), change the URL there and push.
The `www/` page only shows while the game is loading or offline.
