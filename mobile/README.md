# World Fracture for Android

A Capacitor app that runs the game full screen in landscape on Android phones: system bars hidden, screen kept on, touch controls
and the phone HUD from the web build. The whole game is built as a static single-page app (`WF_MOBILE=1 vite build`, TanStack
Start SPA mode) and shipped inside the APK, so it plays without a server; signing in syncs the same cloud save as the browser game.
Models hosted only by Lovable (`/__l5e/...`) are not in the bundle; the game falls back to its own stand-ins for those.

## Getting the APK
GitHub builds it: `.github/workflows/android-apk.yml` runs every night, on every push that touches `mobile/`, or by hand from the
Actions tab, and publishes `WorldFracture.apk` as the **android-latest** release:
https://github.com/chadc9012/fracture-core/releases/tag/android-latest

On the phone: open that page, tap `WorldFracture.apk`, allow installs from the browser when Android asks, then open World Fracture.

## Building locally
Requires the Android SDK (Android Studio) and Java 21:
```
WF_MOBILE=1 npx vite build                      # from the repo root
rm -rf mobile/www && cp -r .output/public mobile/www && cp mobile/www/_shell.html mobile/www/index.html
cd mobile && npm install && npm run apk         # → android/app/build/outputs/apk/debug/app-debug.apk
```
`mobile/www/index.html` in the repo is only a placeholder; the build replaces the folder.

_Phone HUD layout reworked Oct 25 (landscape touch layout: no overlapping buttons or meters)._
