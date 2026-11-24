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

Visit `http://localhost:3000`. To try it from another device on the same Wi-Fi, run `npm run dev -- --hostname 0.0.0.0` and visit `http://YOUR-COMPUTER-LAN-IP:3000` on that device. Do not expose this development server to the public internet.

## Gemini 4 setup

Cosmo sends Gemini requests to Google's Interactions API, which is the API surface for Gemini 4 Neon/Hydrogen; these models are not called through the older `generateContent` URL. The default model is `gemini-4-neon`. To use Hydrogen, set `GEMINI_MODEL=gemini-4-hydrogen` in `.env.local` or in Vercel.

Create an API key in Google AI Studio and make sure the selected Google Cloud project has the Gemini API enabled and the API access/quota/billing required for that model. A Google AI Pro subscription for the Gemini app does not itself guarantee Gemini API access, quota, or billing. Keep the key server-side as `GEMINI_API_KEY`; do not use a `NEXT_PUBLIC_` prefix. In Vercel, add it (and optionally `GEMINI_MODEL`) for Production and redeploy after changes.

## Deploy to Vercel

Import the repository into Vercel and use the default Next.js framework preset and `npm run build` command. The app requires Node.js 20.9 or newer; set the Vercel Node.js version to 20.x or newer if needed.

## Checks

```bash
npm run typecheck
npm run build
```

## Chat API

`POST /api/chat` accepts `message`, optional `provider` (`openai`, `gemini`, or `anthropic`), optional browser `language`, and up to 12 prior messages. Requests are validated and provider calls have a timeout.
