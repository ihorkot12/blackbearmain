# Black Bear Admin Release Brief

## App identity

- App name: Black Bear Admin
- Bundle ID / App ID: `ua.kyiv.shinkarate.admin`
- Primary URL: `https://shin-karate.kyiv.ua/admin`
- Privacy policy URL: `https://shin-karate.kyiv.ua/privacy`
- Production domain: `shin-karate.kyiv.ua`
- App type: private/club admin app shell for iOS and Android

## Release package files

- `docs/median-app-config.json` contains copy-ready Median/App Studio configuration.
- `docs/app-store-submission-pack.md` contains store listing text, review notes template, privacy labels, and final signing/publishing steps.

## Product scope

The mobile app must use the existing live website and backend. Do not create a second database, second CRM, or duplicated native logic.

Core screens:

- Admin login
- Coach login
- Dashboard
- Participants
- Groups and locations
- Attendance
- Payments and CRM finance
- Rankings and achievements
- Parent messages
- Bug report button

## Median / cloud builder setup

Use this setup if publishing iOS without a Mac/Xcode machine:

```text
Create an iOS and Android app from the existing website.

App name: Black Bear Admin
Bundle ID: ua.kyiv.shinkarate.admin
Start URL: https://shin-karate.kyiv.ua/admin
Allowed domain: shin-karate.kyiv.ua
Theme/background: #050505
Splash/background: black, Black Bear Admin branding

Important:
- Keep the app as a webview shell over the live admin.
- Do not rebuild CRM, attendance, payments, messages, rankings, or Telegram logic natively.
- Preserve the current login and role behavior.
- Confirm iPhone safe-area works: notch, status bar, home indicator, bottom floating bug button, modal bottom padding.
```

## Immediate iPhone web-app install

Before paying for a native wrapper, test the admin as an iPhone home-screen app:

1. Open `https://shin-karate.kyiv.ua/admin` in Safari on iPhone.
2. Tap Share.
3. Tap Add to Home Screen.
4. Keep the name `Black Bear Admin`.
5. Launch from the new icon and test admin/coach/parent flows.

This uses the same production backend and does not create a second database. It is the quickest no-cost test while IPA/TestFlight signing is being prepared.

## GitHub Actions iOS build path

The repo includes `.github/workflows/ios-cloud-build.yml`.

Run `simulator-check` first to prove the iOS project compiles on GitHub's macOS runner without Apple signing.

Run `signed-archive` only after Apple Developer signing secrets are added in GitHub repository settings. Required secrets:

- `APPLE_TEAM_ID`
- `IOS_DISTRIBUTION_CERTIFICATE_BASE64`
- `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`
- `IOS_PROVISIONING_PROFILE_BASE64`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY`
- `IOS_BUILD_KEYCHAIN_PASSWORD`

The signed path exports an IPA and uploads it to TestFlight.

## App review notes template

Do not commit real passwords here. Put the real demo account only inside App Store Connect / Google Play Console review notes.

```text
This app is for Black Bear Dojo club administration.

It provides authenticated access for club admins and coaches to manage students, groups, attendance, payments, rankings, achievements, parent communication, and CRM metrics.

The app uses the existing secure production backend at https://shin-karate.kyiv.ua.

Demo credentials for review:
Login: [provide in store console only]
Password: [provide in store console only]

Please use the demo account only for app review.
```

## App Store privacy labels

Fill App Store Connect privacy labels truthfully. The native shell does not add a second database, but the admin web app works with club CRM data through the production backend.

Expected privacy categories to review in App Store Connect:

- Contact Info: parent/lead names and phone numbers
- User Content: parent-coach messages, notes, achievements
- Identifiers: admin/coach/parent account identifiers
- Financial Info: club payment records entered by admins/coaches
- Usage Data / Diagnostics: only if analytics or error tracking are enabled in production

Purpose:

- App functionality
- Club administration
- Parent communication
- Payment and attendance management

The iOS project sets `ITSAppUsesNonExemptEncryption` to `false`, because the app uses standard HTTPS and does not implement custom non-exempt encryption.

## Local build status

Capacitor web sync passes.

Current Windows machine is missing:

- JDK 17+
- Android SDK / Android Studio
- macOS + Xcode for iOS local build

Next build route:

1. Android local: install JDK 17+ and Android Studio, then run `npm run mobile:android`.
2. iOS local: open this repo on a Mac, then run `npm run mobile:ios`.
3. iOS without Mac: use Median or another cloud build/publishing service with the setup above.
