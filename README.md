# Cosmo

Cosmo is an early multilingual AI chat MVP built with Next.js. It can connect to OpenAI, Google Gemini, or Anthropic Claude using server-side API keys. It is not yet a production-ready public AI service: it does not include user accounts, persistent chat history, current-news search/citations, billing controls, or production rate limiting/abuse monitoring.

## Run on your computer

You need Node.js 20 or newer and an API key from at least one supported provider.

```bash
npm install
cp .env.example .env.local
```

Open `.env.local`, add one or more API keys, and save it. Never commit `.env.local` or put provider keys in browser code. Then start the app:

```bash
npm run dev
```

Visit `http://localhost:3000` on your computer. To try it from another device on the same Wi-Fi, run `npm run dev -- --hostname 0.0.0.0` and open `http://YOUR-COMPUTER-LAN-IP:3000` on that device. Do not expose this development server to the public internet.

## Provider keys

```dotenv
OPENAI_API_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
```

Optional model overrides are shown in `.env.example`. The default model names may change or become unavailable; check your provider's current model documentation if a provider returns an error.

## Deploy a preview

Import the repository into Vercel (or another Next.js host), configure the provider key(s) as encrypted server-side environment variables, and deploy. Use a preview deployment for testing. Before a public production launch, add and verify authentication, persistent storage, rate limits and spending limits, monitoring, privacy/retention policies, and a real web-search integration for current events. API provider keys and usage incur charges.

## Checks

```bash
npm run typecheck
npm run build
```

## Chat API

`POST /api/chat` accepts a JSON body with `message`, optional `provider` (`openai`, `gemini`, or `anthropic`), optional browser `language`, and up to 12 prior messages. Requests are validated and provider calls have a timeout.
