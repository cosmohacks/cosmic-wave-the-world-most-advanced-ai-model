# Cosmo

Cosmo is an early multilingual AI chat MVP built with Next.js. It can connect to OpenAI, Google Gemini, or Anthropic Claude using server-side API keys. It is not yet a production-ready public AI service: it does not include user accounts, persistent chat history, current-news search/citations, billing controls, or production rate limiting/abuse monitoring.

## Run on your computer

You need Node.js 20.9 or newer and an API key from at least one supported provider.

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

## Deploy to Vercel

Import the repository into Vercel and use the default Next.js framework preset and `npm run build` command. In **Project → Settings → Environment Variables**, add `GEMINI_API_KEY` (or another provider key) for the Production environment. Do not add a `NEXT_PUBLIC_` prefix. Redeploy after setting or changing environment variables. The app requires Node.js 20.9 or newer; set the Vercel Node.js Version to 20.x or newer in project settings if needed.

## Checks

```bash
npm run typecheck
npm run build
```

## Chat API

`POST /api/chat` accepts a JSON body with `message`, optional `provider` (`openai`, `gemini`, or `anthropic`), optional browser `language`, and up to 12 prior messages. Requests are validated and provider calls have a timeout.
