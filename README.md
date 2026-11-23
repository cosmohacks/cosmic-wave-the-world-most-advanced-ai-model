# Cosmo

Cosmo is a multilingual AI chat application that supports OpenAI, Google Gemini, and Anthropic Claude through a provider-neutral API.

## Features

- Multilingual chat in the browser
- Provider selection: OpenAI, Gemini, or Claude
- Automatic fallback to the next configured provider
- Conversation context
- Responsive cosmic interface
- API keys remain on the server

## Run locally

```bash
npm install
cp .env.example .env.local
```

Add at least one API key to `.env.local`, then run:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deploy

Deploy to Vercel or any Node.js host. Configure the provider API keys as server-side environment variables.

## API

`POST /api/chat`

```json
{
  "message": "Hello",
  "provider": "openai",
  "language": "en",
  "history": []
}
```
