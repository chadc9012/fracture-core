#!/bin/bash
# World Fracture: build the Unreal Android APK on this Mac. Logs to ~/WorldFracture/logs/unreal-build.log.
# Needs unreal.tgz (the repo's unreal/), joined.tgz (buildings/fleet) and chars.tgz (rigged characters) next to it.
cd "$(dirname "$0")"; exec > logs/unreal-build.log 2>&1; set -x
UE="/Users/Shared/Epic Games/UE_5.8"
export ANDROID_HOME="$HOME/Library/Android/sdk" NDKROOT="$HOME/Library/Android/sdk/ndk/27.2.12479018" NDK_ROOT="$HOME/Library/Android/sdk/ndk/27.2.12479018"
# Gradle 8.13 (UE 5.8's Android packaging) can't run on Android Studio's Java 25: use a private Temurin JDK 21
if [ ! -x jdk21/Contents/Home/bin/java ]; then
  rm -rf jdk21 jdk21.tgz && curl -sSfL "https://api.adoptium.net/v3/binary/latest/21/ga/mac/x64/jdk/hotspot/normal/eclipse" -o jdk21.tgz \
    && mkdir jdk21 && tar xzf jdk21.tgz -C jdk21 --strip-components 1 && rm jdk21.tgz || { echo JDK_FAILED; exit 1; }
fi
export JAVA_HOME="$PWD/jdk21/Contents/Home"; "$JAVA_HOME/bin/java" -version
export DEVELOPER_DIR=/Users/sir/Applications/Xcode-26.app/Contents/Developer
xcode-select -p; xcodebuild -version
mkdir -p proj && rm -rf proj/unreal/Source proj/unreal/Plugins/WorldFractureCore/Source proj/unreal/tools && tar xzf unreal.tgz -C proj
[ -d joined ] || tar xzf joined.tgz
[ -f chars.tgz ] && { rm -rf chars && mkdir chars && tar xzf chars.tgz -C chars; }
P="$PWD/proj/unreal/WorldFracture.uproject"
"$UE/Engine/Build/BatchFiles/Mac/Build.sh" WorldFractureEditor Mac Development -project="$P" || { echo BUILD_EDITOR_FAILED; exit 1; }
ED="$UE/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor"
if [ ! -f proj/.assets-done ]; then
  WF_JOINED_MODELS="$PWD/joined" WF_CHARACTER_MODELS="$PWD/chars" "$ED" "$P" -run=pythonscript -script="$PWD/proj/unreal/tools/setup_assets.py" -unattended -nullrhi -nosplash || { echo SETUP_ASSETS_FAILED; exit 1; }
  touch proj/.assets-done proj/.chars-done
elif [ ! -f proj/.chars-done ]; then
  WF_ONLY_CHARACTERS=1 WF_CHARACTER_MODELS="$PWD/chars" "$ED" "$P" -run=pythonscript -script="$PWD/proj/unreal/tools/setup_assets.py" -unattended -nullrhi -nosplash || { echo SETUP_CHARACTERS_FAILED; exit 1; }
  touch proj/.chars-done
fi
"$UE/Engine/Build/BatchFiles/RunUAT.sh" BuildCookRun -project="$P" -platform=Android -cookflavor=ASTC -clientconfig=Development \
  -build -cook -stage -package -pak -archive -archivedirectory="$PWD/apk" -utf8output -nop4 -unattended || { echo PACKAGE_FAILED; exit 1; }
find apk -name '*.apk' -exec ls -la {} \;
echo ALL_DONE
