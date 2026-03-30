# Black Bear Dojo - Kyokushinkai Karate Club

This is a full-stack web application for the Black Bear Dojo karate club. It includes a landing page, a CRM for managing leads and participants, and an AI-powered sales assistant.

## Features

- **Landing Page**: Modern, responsive design with information about locations, coaches, and schedules.
- **AI Sales Assistant**: Integrated chat powered by Gemini to answer questions and capture leads.
- **CRM System**: Admin panel to manage leads, participants, attendance, and site content.
- **Parent Portal**: Login for parents to track their child's progress and attendance.
- **Notifications**: Telegram integration for new lead alerts.

## Tech Stack

- **Frontend**: React, Tailwind CSS, Motion (Framer Motion), Lucide React.
- **Backend**: Node.js, Express, PostgreSQL (Neon Database).
- **AI**: Google Gemini API (@google/genai).
- **Database**: PostgreSQL with `pg` and `@neondatabase/serverless`.

## Setup Instructions

### 1. Prerequisites

- Node.js (>= 18.0.0)
- A PostgreSQL database (e.g., [Neon.tech](https://neon.tech))
- Google Gemini API Key

### 2. Environment Variables

Create a `.env` file in the root directory and fill in the following variables (see `.env.example`):

```env
DATABASE_URL=your_postgresql_connection_string
SESSION_SECRET=a_secure_random_string
ADMIN_LOGIN=your_admin_username
ADMIN_PASSWORD=your_admin_password
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
GEMINI_API_KEY=your_gemini_api_key

# Optional: Meta Pixel
META_PIXEL_ID=your_pixel_id
META_ACCESS_TOKEN=your_access_token
```

### 3. Installation

```bash
npm install
```

### 4. Development

```bash
npm run dev
```

### 5. Build for Production

```bash
npm run build
npm start
```

## Deployment

The app is designed to be deployed on platforms like Vercel or Cloud Run. Ensure all environment variables are set in your deployment platform's settings.

## License

MIT
