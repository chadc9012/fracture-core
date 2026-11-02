# Building the Unreal Android APK on a Mac

Epic's cloud (container) images only build for Linux, so the Unreal APK is built on the owner's Mac. One-time setup,
about 150 GB of disk and a few hours of downloads:

1. **Xcode**: install from the App Store, open it once to accept the licence, then in Terminal: `xcode-select --install`.
2. **Epic Games Launcher**: https://store.epicgames.com/download, sign in with the Epic account linked to GitHub.
   Unreal Engine tab > Library > + > **5.8** > Install. Under Options, tick **Android** under Target Platforms.
3. **Android Studio**: https://developer.android.com/studio. Open it once and finish the setup wizard (standard install).
   Then in Terminal:
   `"/Users/Shared/Epic Games/UE_5.8/Engine/Extras/Android/SetupAndroid.command"`
   (installs the exact SDK, NDK and build tools Unreal 5.8 wants).
4. **Register the Mac as a build machine**: on GitHub, open fracture-core > Settings > Actions > Runners >
   **New self-hosted runner** > macOS. Run the commands it shows in Terminal. When `config.sh` asks for labels, type
   `unreal`. Then run `./run.sh` and leave that window open (or `./svc.sh install && ./svc.sh start` to keep it running
   in the background).

Then: Actions > **Unreal Android APK (Mac)** > Run workflow. The first build takes a few hours (the engine compiles the
project and cooks every asset), later ones much less. The APK appears on the `unreal-android-latest` release page.
