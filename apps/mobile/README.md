# Preview build

`eas.json` defines two EAS Build profiles: `preview`, described here, and `development`, for fast iteration on Android (see [Development build](#development-build)). `preview` produces an internal iOS build (an ad hoc `.ipa` for registered devices) and an Android `.apk`. Run EAS from this directory, after the credentials below exist. The Android build needs only an Expo account:

```bash
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview
```

The first run links an Expo project and can write `extra.eas.projectId` into `app.json`. CI does not call EAS, and this profile does not submit to TestFlight or the App Store.

Android Metro export stays in `package.json` as `export`. From the repo root, `bun run build:mobile` still runs `expo export --platform android`.

The preview profile pins Bun `1.4.4`, the same version as CI, so EAS installs this workspace from the root `bun.lock`.

`ios/` and `android/` are prebuild output. This directory's `.gitignore` ignores both, plus `*.mobileprovision`, `*.p12`, `*.p8`, `*.cer`, `*.key`, `*.pem`, `*.jks`, and `credentials.json`. Leave generated native projects and signing files out of git.

## Apple credentials

The bundle id is `com.mots.app` (`app.json`).

Create these on the Apple Developer team that will sign Mots, then store them with EAS (`npx eas-cli@latest credentials` from this directory). EAS can generate the certificate and the ad hoc profile on that run.

Who can create them:

- Individual account: the Account Holder.
- Organization: the Account Holder or an Admin. An App Manager can, when App Store Connect has **Access to Certificates, Identifiers & Profiles** turned on for that user.

What to create:

1. **Apple Developer Program membership** for that team.

2. **App ID** `com.mots.app`, under Certificates, Identifiers & Profiles. EAS can register it when the Apple user above runs `eas credentials`.

3. **Apple Distribution certificate.** One certificate covers the team. If you export it yourself, upload the `.p12` and its password through `eas credentials`. Keep the file out of the repo.

4. **Ad hoc provisioning profile** for `com.mots.app`, signed by that certificate, listing each iPhone that will install the preview. Register a device with `npx eas-cli@latest device:create` before the build. A phone added later needs a new profile, or `eas build:resign` on an existing build. Keep the `.mobileprovision` out of git.

5. **App Store Connect API key** (Admin), so EAS can create and refresh the certificate and profile without an interactive Apple ID password. This is required for a federated Apple account, which cannot sign in through the CLI.
   - App Store Connect → Users and Access → Integrations → App Store Connect API.
   - Download the `.p8` once. Keep the Key ID and the Issuer ID with it.
   - Upload the key, Key ID, and Issuer ID through `eas credentials` or the EAS project credentials page.
   - Keep the `.p8` out of git, `eas.json`, and CI.

This preview has no push entitlement. Skip the Apple Push Notification key until a later change adds push.

Prefer EAS-hosted credentials. `credentials.json` is only for a local copy. If a download writes that file, leave it untracked.

## Public env for a device build

A phone cannot reach `http://localhost:8787`. Set `EXPO_PUBLIC_MOTS_API_URL` on the preview build to the Worker URL. When that Worker requires `MOTS_CREATE_TOKEN`, set `EXPO_PUBLIC_MOTS_CREATE_TOKEN` as well. Expo inlines both into the binary. The create token is the app-wide gate, and anyone with the app can read it.

Use EAS environment variables for the preview environment. Leave the values out of `eas.json` and out of git. The `preview` profile sets `"environment": "preview"`, so EAS loads only the variables created for that environment. Create them once from this directory:

```bash
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_MOTS_API_URL --value https://mots.<tuo-sottodominio>.workers.dev --visibility plaintext
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_MOTS_CREATE_TOKEN --value <the MOTS_CREATE_TOKEN set on the Worker> --visibility plaintext
```

`EXPO_PUBLIC_*` values are compiled into the JavaScript, so they are stored as plain text. Use the same token the Worker checks. A different one makes the app fail with `401` when it creates a space.

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
