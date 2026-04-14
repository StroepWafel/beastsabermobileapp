# BeatSaver mobile + PC downloader

## This is a purely vibecoded app i made for the fun of it, it is not guaranteed to work well or at all. it is under the ICCLEIYSIUYA license.

- **`android/`** — Android app (Kotlin, Jetpack Compose): browse [BeatSaver](https://beatsaver.com/) maps, preview audio and ArcViewer, curate a list, export JSON or send over LAN.
- **`pc/`** — Windows desktop app (Electron): import the list, download map ZIPs, optional `.bplist`, LAN receiver, and optional **internet relay** client (see `relay/`).
- **`relay/`** — Optional Node server for **Send to PC across different networks** (phone and PC not on the same Wi‑Fi). Deploy with HTTPS; see [relay/README.md](relay/README.md).
- **`packages/export-schema/`** — JSON Schema for the shared export file (`bsaber-map-list`).

Map metadata is loaded from the [BeatSaver API](https://api.beatsaver.com/docs/). Community news and articles on third-party sites are not mirrored here; the catalog matches custom maps hosted on BeatSaver.

## Building

### Android app (`android/`)

**What you need:** Android Studio (recommended) or the Android SDK + command-line tools, and a **full JDK 17+** (not a JRE-only install). The Android Gradle Plugin uses `jlink`, which comes with a JDK. If Gradle reports that `jlink` is missing, install a JDK (e.g. [Eclipse Temurin 17](https://adoptium.net/)) and set `JAVA_HOME`, or set `org.gradle.java.home` in `local.properties` (see [android/README.md](android/README.md)).

**Project setup**

1. Copy `android/local.properties.example` to `android/local.properties`.
2. Set `sdk.dir` to your Android SDK path (on Windows, often `%LOCALAPPDATA%\Android\Sdk`). Android Studio usually creates `local.properties` automatically when you open the project.

**Build**

- **Android Studio:** File → Open → select the `android` folder → **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
- **Command line** (from `android/`): run `gradlew.bat assembleDebug` on Windows (`./gradlew assembleDebug` on macOS/Linux).

Debug APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.

### PC app (`pc/`)

**What you need:** [Node.js](https://nodejs.org/) (LTS) and npm.

**Run in development**

```bash
cd pc
npm install
npm start
```

**Packaged Windows build** (portable executable; output under `pc/dist/`)

```bash
cd pc
npm install
npm run dist:portable
```

The PC app’s `package.json` sets **`signAndEditExecutable": false`** so local builds do not run Windows code-signing tooling (which can fail on some setups when 7-Zip cannot create symbolic links). If a build still errors on symlinks, enable **Windows Developer Mode** (Settings → System → For developers) or run the terminal **as Administrator**, then retry. You can also clear the cache folder `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign` and build again.

## Export file

See [packages/export-schema/README.md](packages/export-schema/README.md).
