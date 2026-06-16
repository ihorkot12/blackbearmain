# Black Bear Admin App Store / Median Pack

## Current Verified State

- Production URL: `https://shin-karate.kyiv.ua/admin`
- Privacy policy: `https://shin-karate.kyiv.ua/privacy`
- App name: `Black Bear Admin`
- Bundle ID: `ua.kyiv.shinkarate.admin`
- Latest verified iOS cloud build: GitHub Actions `iOS Cloud Build`, simulator-check, success
- Latest verified CI: GitHub Actions `CI/CD Pipeline`, success on Node 20 and Node 22
- Latest verified Vercel production: ready

## Median Setup Values

Use these values when creating the app in Median App Studio:

```text
App name: Black Bear Admin
Start URL: https://shin-karate.kyiv.ua/admin
Allowed domain: shin-karate.kyiv.ua
Bundle ID / App ID: ua.kyiv.shinkarate.admin
Privacy policy URL: https://shin-karate.kyiv.ua/privacy
Support URL: https://shin-karate.kyiv.ua/
Theme/background: #050505
Status bar: black / translucent where supported
Orientation: portrait
```

Important Median instruction:

```text
Create a native iOS and Android webview app from the existing Black Bear Admin website.
The app must open https://shin-karate.kyiv.ua/admin.
Keep the existing backend, database, CRM, roles, Telegram notifications, attendance,
payments, rankings, achievements, parent portal, and coach/admin login behavior.
Do not rebuild business logic natively and do not create a second database.
```

## Store Listing Draft

Short description:

```text
Club admin app for Black Bear Dojo coaches and administrators.
```

Full description:

```text
Black Bear Admin is the internal club administration app for Black Bear Dojo.

The app helps authorized administrators and coaches manage students, groups,
attendance, payments, rankings, achievements, parent communication, and CRM
metrics from one secure system.

Access is restricted to club staff and authorized parent accounts.
```

Keywords:

```text
karate, dojo, club, admin, attendance, payments, students, coach
```

Category:

```text
Business or Productivity
```

Content rights:

```text
The app uses Black Bear Dojo owned branding, site content, CRM screens, and club data.
```

## App Review Notes Template

Do not commit real credentials. Add the real demo credentials only inside App Store Connect,
Google Play Console, or Median publishing forms.

```text
This app is for Black Bear Dojo club administration.

It provides authenticated access for club admins, coaches, and authorized parent accounts
to manage or view students, groups, attendance, payments, rankings, achievements,
parent communication, and CRM metrics.

The app uses the existing secure production backend:
https://shin-karate.kyiv.ua

Demo credentials for review:
Login: [enter only in store console]
Password: [enter only in store console]

Please use the demo account only for app review.
```

## Privacy Labels To Review

Expected App Store privacy categories:

- Contact Info: parent/lead names and phone numbers
- User Content: messages, notes, achievements
- Identifiers: admin/coach/parent account identifiers
- Financial Info: club payment records entered by admins/coaches
- Usage Data / Diagnostics: only if analytics or error tracking is enabled in production

Purpose:

- App functionality
- Club administration
- Parent communication
- Payment and attendance management

The iOS project sets `ITSAppUsesNonExemptEncryption` to `false` because the app uses standard HTTPS and does not implement custom non-exempt encryption.

## Required Final External Step

Choose one of these:

1. Median path: create the app in Median App Studio with the values above, generate iOS test build, then publish through Median or your Apple Developer account.
2. Apple signing path: add Apple Developer and App Store Connect secrets to GitHub Actions, then run `iOS Cloud Build` with `signed-archive`.

The repository is ready for both paths, but a real IPA/TestFlight build requires one of those external signing/publishing steps.
