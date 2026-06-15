# Black Bear Admin Mobile App

This project includes a Capacitor app shell for iOS and Android.

## Current test mode

The app loads the live admin panel:

```text
https://shin-karate.kyiv.ua/admin
```

This keeps all admin functions in one place: participants, attendance, payments, achievements, CRM, imports, leads, and settings stay synced with the deployed website.

## Recommended path

Use Capacitor as the main path. The app shell is already in the repo and points to the live admin panel, so the website, admin, parent portal, Telegram notifications, CRM, payments, attendance, achievements, and database stay in one system.

Use Median only as a paid fallback if we need iOS publishing without a Mac/Xcode machine or want managed App Store / Google Play help. Do not build a separate native app from scratch now; that would duplicate logic and create two products to maintain.

## Fast iPhone test path

The site is also configured as an installable web app:

- manifest start URL: `/admin`
- iPhone home-screen title: `Black Bear Admin`
- iPhone icon: `/apple-touch-icon.png`
- Android/PWA icon: `/icon-192.png` and `/icon-512.png`
- standalone display mode
- iPhone safe-area viewport enabled

On an iPhone, open `https://shin-karate.kyiv.ua/admin` in Safari, tap Share, then Add to Home Screen. This gives an app-like icon immediately while the native IPA/App Store route is prepared.

## Current preflight status

Checked on Windows:

```text
OK  Capacitor config
OK  Android project
OK  iOS project
OK  Web build output
NO  Java runtime
NO  Java compiler
NO  Android SDK
SKIP Xcode
```

Capacitor sync passed:

```bash
node_modules\.bin\cap.cmd sync
```

That means the iOS and Android projects are synced with the latest web build, but local Android builds need JDK 17+ and Android SDK, and local iOS builds require macOS with Xcode.

## Commands

```bash
npm run mobile:preflight
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

`mobile:android` opens Android Studio after syncing.

`mobile:ios` opens Xcode after syncing. Building iOS requires macOS with Xcode or a cloud build/publishing service.

## Preflight before building

`npm run mobile:sync` must pass first. It builds the web app and copies the current admin shell into both native projects.

Run this first:

```bash
npm run mobile:preflight
```

Android local build requirements:

```powershell
java -version
$env:JAVA_HOME
cd android
.\gradlew.bat assembleDebug
```

Use JDK 17+ and Android Studio/SDK. If `JAVA_HOME` is missing, Gradle stops before it can test the project.

iOS local build requirements:

```bash
npm run mobile:sync
npm run mobile:ios
```

iOS packaging requires macOS with Xcode. On Windows, use Median or another cloud build service if we want to publish without a Mac.

## GitHub Actions iOS cloud build

Manual workflow:

```text
.github/workflows/ios-cloud-build.yml
```

Use `simulator-check` first. It runs on a GitHub macOS runner, builds the web app, syncs Capacitor, and compiles the iOS simulator app without Apple signing.

Use `signed-archive` only after adding Apple Developer / App Store Connect secrets to GitHub:

```text
APPLE_TEAM_ID
IOS_DISTRIBUTION_CERTIFICATE_BASE64
IOS_DISTRIBUTION_CERTIFICATE_PASSWORD
IOS_PROVISIONING_PROFILE_BASE64
APP_STORE_CONNECT_KEY_ID
APP_STORE_CONNECT_ISSUER_ID
APP_STORE_CONNECT_PRIVATE_KEY
IOS_BUILD_KEYCHAIN_PASSWORD
```

The signed workflow exports an IPA and uploads it to TestFlight. Do not commit real Apple keys, certificates, provisioning profiles, passwords, or demo account credentials.

## Store note

For internal testing, the live web admin shell is the fastest path.

For App Store / Google Play submission, review risk is lower if the app includes native app polish: branded icon, splash screen, offline screen, biometric lock, push notifications, and app-specific navigation. Median can be used later if we want managed builds and publishing support.

## AI Studio commands

Use these exact prompts when asking AI Studio to help with design or mobile polish:

```text
Ти дизайнер Black Bear Dojo Admin. Не змінюй архітектуру, базу, API, логіку ролей, авторизацію, CRM, платежі, відвідування, рейтинги, досягнення і Telegram-сповіщення. Працюй тільки з UX/UI поліруванням адмінки й мобільної оболонки.

Задача: перевірити адмінку як mobile-first app screen для тренера/адміна. Зберегти чорний/червоний стиль Black Bear, не робити landing page, не додавати зайві тексти. Покращити тільки дрібні речі: читабельність, кнопки, відступи, стани loading/error/empty, щоб усе нормально влазило на iPhone.

Обов'язково не ламати: /admin login, швидкі дії, учасники, групи, відвідування, платежі, рейтинги, досягнення, повідомлення батьків, імпорт учнів, кнопка "Повідомити про баг".
```

```text
Підготуй Black Bear Admin як webview mobile app через Capacitor. Зберегти одну базу і живий бекенд https://shin-karate.kyiv.ua. Додаток має відкривати /admin, не дублювати логіку нативно. Перевірити конфіг iOS/Android, app name, app id, splash/background, safe-area на iPhone, viewport, touch targets. Не переписувати сайт з нуля.
```
