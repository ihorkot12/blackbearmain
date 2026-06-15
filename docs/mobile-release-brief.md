# Black Bear Admin Release Brief

## App identity

- App name: Black Bear Admin
- Bundle ID / App ID: `ua.kyiv.shinkarate.admin`
- Primary URL: `https://shin-karate.kyiv.ua/admin`
- Production domain: `shin-karate.kyiv.ua`
- App type: private/club admin app shell for iOS and Android

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
