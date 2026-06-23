# Telegram parent bot

Production webhook:

```text
https://shin-karate.kyiv.ua/api/telegram/parent-webhook
```

Required Vercel environment variables:

```text
TELEGRAM_PARENT_BOT_TOKEN
TELEGRAM_PARENT_BOT_USERNAME=karate_kyiv_bot
```

Optional hardening variables:

```text
TELEGRAM_PARENT_WEBHOOK_SECRET
CRON_SECRET
CLUB_INSTAGRAM_URL
CLUB_FACEBOOK_URL
```

The bot must be connected only from the parent or participant cabinet. The cabinet calls `/api/parent/telegram-link`, receives a short one-time start token, and opens Telegram with that token. The webhook consumes the token once and binds the Telegram chat to the correct participant access.

The public Telegram routes are routed through the existing `api/mono-parent-status.ts` function with explicit modes. This keeps the production deployment within the existing Vercel serverless function footprint while adding the parent bot endpoints.

The notification dispatcher runs through Vercel Cron at `/api/telegram/dispatch`. It sends only important notification types: homework, homework review, payment, coach/admin messages, announcements, absences, birthdays, and personal events. Attendance marks and small point changes are not sent.