# Mots mobile app

The Mots app is an [Expo](https://expo.dev) / React Native client for the Mots server. It talks to one Cloudflare Durable Object per session over a WebSocket. The app is a projection of the session state: the server and the agent hold the truth.

Screens:

- **Onboarding**: create a new space or join one with its code. The server field sits under **Avanzate**.
- **Chat**: streaming replies, conversation list, fork from any message, model picker, and a connection status that retries on its own.

The visual language follows the Mots design system: pastel fills with dark ink, Figtree and JetBrains Mono, and a speech-bubble mascot that holds still when reduced motion is on. The UI copy is Italian.

## Run it

From the repository root, see [README.md](../../README.md#avvio-rapido). In short:

```bash
bun install
bun run dev          # Worker on Node, Expo, and the LAN address for your phone
bun run dev:web      # web preview at http://localhost:8081
```

Scan the Expo QR code with Expo Go, or open the web preview. Tests for the pure mobile logic run with `bun test apps/mobile/test`.

## Build an Android app

The `preview` profile in `eas.json` builds an `.apk` for internal distribution. The first build needs only a free Expo account. Run these from `apps/mobile`. On Windows, use `bunx` if `npx` is blocked by the execution policy:

```bash
bunx eas-cli@latest login
bunx eas-cli@latest init
bunx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_MOTS_API_URL --value https://mots.<tuo-sottodominio>.workers.dev --visibility plaintext
bunx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_MOTS_CREATE_TOKEN --value <stesso MOTS_CREATE_TOKEN del Worker> --visibility plaintext
bunx eas-cli@latest build --platform android --profile preview
```

EAS prints a link to the APK when the build finishes. Open it on the phone and allow the installation from that source.

The `preview` profile sets `"environment": "preview"`, so EAS loads only the variables created for that environment. The profile pins Bun `1.4.4`, the same version as CI, so EAS installs the workspace from the root `bun.lock`.

The first run can write `extra.eas.projectId` into `app.json`. That is expected.

### Public variables in the build

`EXPO_PUBLIC_*` values are compiled into the JavaScript bundle, so they are plain text and anyone with the app can read them. Keep the values out of `eas.json` and out of git, and create them with `env:create` as above.

- `EXPO_PUBLIC_MOTS_API_URL` is the Worker URL the app uses by default. The onboarding screen can still change it.
- `EXPO_PUBLIC_MOTS_CREATE_TOKEN` must match the `MOTS_CREATE_TOKEN` secret of the Worker. A different value makes the app fail with `401` when it creates a space. The token is an app-wide gate, not a per-user secret.

## Build for iOS

`eas.json` also has an iOS target for the same profile. It produces an ad hoc `.ipa` for registered devices, and it needs an Apple Developer Program membership. The free route for iPhone is Expo Go.

The bundle id is `com.mots.app` (`app.json`). Set up the credentials on the Apple Developer team that will sign the app, then store them with EAS (`bunx eas-cli@latest credentials` from this directory):

1. **Apple Developer Program membership** for the team.
2. **App ID** `com.mots.app`, under Certificates, Identifiers & Profiles. EAS can register it during `eas credentials`.
3. **Apple Distribution certificate**. EAS can generate it. If you export your own `.p12`, upload it with its password through `eas credentials`.
4. **Ad hoc provisioning profile** for `com.mots.app`, listing each iPhone that will install the build. Register a device with `bunx eas-cli@latest device:create` before the build. A phone added later needs a new profile, or `eas build:resign` on an existing build.
5. **App Store Connect API key** with the Admin role, so EAS can refresh the certificate and profile without an Apple ID password. Download the `.p8` once, and keep the Key ID and the Issuer ID with it. Upload all three through `eas credentials`.

Keep `.p8`, `.p12`, `.mobileprovision`, `.cer`, `.key`, `.pem` and `credentials.json` out of git. `.gitignore` in this directory already ignores them, along with `/ios` and `/android`, the output of `expo prebuild`. Prefer EAS-hosted credentials. The preview build has no push entitlement yet.

## Development build

A development build is a native Android app with `expo-dev-client` inside. You build it once. After that, JavaScript and UI changes reach the emulator through Metro in a few seconds, with no new EAS build. Install it once, then use `bunx expo start` for every change.

Build it (from `apps/mobile`, Android only, uses the `development` profile):

```powershell
bunx eas-cli@latest build --platform android --profile development
```

The free plan queues the build, and a full native Android build takes about 13 minutes. When the build finishes, EAS asks whether to install it on an emulator. Answer yes with the emulator open (see below). To install the APK by hand, download it from the link EAS prints and run `adb install -r <file>.apk`.

Then, with the emulator running and the Worker up (`bun run dev` from the repo root, or `bun run dev:server:lan`):

```powershell
cd apps\mobile
bunx expo start
```

Press `a` in the Expo terminal to open the app on the emulator. The app connects to `http://10.0.2.2:8787`, which is the emulator's address for the host machine, so no `EXPO_PUBLIC_MOTS_API_URL` is needed for this flow. `bun run setup` writes the create token to `.env.local`, which Metro reads at startup. Reload the app in the emulator with `r` in the Expo terminal, or shake it and choose Reload.

The `development` profile reuses the `preview` EAS environment. That only matters for a device build that points at a deployed Worker. The local emulator flow reads the environment from your machine at `expo start`.

### Windows: emulator and adb on the PATH

`bunx` replaces `npx`, which PowerShell's execution policy can block. If `adb` or `emulator` is not found, add the Android SDK to the PATH for the current window:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator"
adb devices
emulator -list-avds
emulator -avd <nome-avd>
```

To keep the setting, add the same lines to your PowerShell profile (`notepad $PROFILE`), or set `ANDROID_HOME` and the two folders in Windows environment variables. `adb devices` should list the emulator as `device` before you build or press `a`.
## Push notifications (Android)

The app asks for notification permission on first connect and sends its Expo push token to the session (`pushToken.register`). Reminders and routine notices then arrive when the app is closed. Expo Go cannot receive native push, so test this only in a development or preview build.

Expo sends Android pushes through Firebase Cloud Messaging, so the native build needs a Firebase project. One time, by the owner:

1. In the Firebase console, create a project and add an Android app with the package name `com.mots.app`.
2. Download `google-services.json` into `apps/mobile` and set `"googleServicesFile": "./google-services.json"` under `android` in `app.json`. The file holds public client settings, not secrets, so it is committed with the app.
3. In the Firebase project settings, create a service account key for FCM (HTTP v1). Upload it to Expo with `bunx eas-cli@latest credentials` (Android, Google Service Account), so Expo's push service can send through FCM.
4. Build the `development` profile again. The token is only issued by a build that contains step 2.

Until those steps are done, the app has no push token, so it gets no push notifications.

## Scripts

| Script | What it does |
| --- | --- |
| `bun run start` (`dev:mobile` from the root) | Starts Expo. |
| `bun run web` (`dev:web` from the root) | Starts the web preview. |
| `bun run export` (`build:mobile` from the root) | Android Metro export, `expo export --platform android`. |
| `bun run typecheck` | Type checks the app. |
