# Black Bear Admin Mobile App

This project includes a Capacitor app shell for iOS and Android.

## Current test mode

The app loads the live admin panel:

```text
https://shin-karate.kyiv.ua/admin
```

This keeps all admin functions in one place: participants, attendance, payments, achievements, CRM, imports, leads, and settings stay synced with the deployed website.

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

## Store note

For internal testing, the live web admin shell is the fastest path.

For App Store / Google Play submission, review risk is lower if the app includes native app polish: branded icon, splash screen, offline screen, biometric lock, push notifications, and app-specific navigation. Median can be used later if we want managed builds and publishing support.
