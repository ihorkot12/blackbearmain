# Codex Notes

- For browser work, use only the user's current Chrome session. Do not switch to a separate in-app browser for Railway, Vercel, Telegram Web, or portal checks.
- For Vercel work, prefer the Vercel plugin/tools when available; use the browser only when dashboard interaction is required.
- Keep Telegram bot tokens and other secrets only in platform/project secrets. Never commit real secret values.
- Keep the notifier bot, parent bot, Railway bot, and coach portal bot as separate concerns unless the user explicitly asks to merge them.
