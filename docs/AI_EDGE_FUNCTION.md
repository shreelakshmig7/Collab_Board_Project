# AI Edge Function Setup

The AI agent uses a **Supabase Edge Function** (`ai-command`) to keep your Anthropic API key server-side. The browser never receives or stores the key.

## 1. Deploy the Edge Function

```bash
supabase functions deploy ai-command
```

(Requires [Supabase CLI](https://supabase.com/docs/guides/cli) and `supabase login`.)

## 2. Set the API Key (Server-Side Secret)

Set your Anthropic API key as a Supabase secret:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get your key from [console.anthropic.com](https://console.anthropic.com) → API Keys.

## 3. Remove Client-Side Key

You can **remove** `VITE_ANTHROPIC_API_KEY` from your `.env` file. It is no longer used.

## 4. Local Development

To test the Edge Function locally:

```bash
supabase functions serve ai-command
```

Then point your app at local functions (or use the deployed URL). For local serve, set secrets via:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

## Auth Flow

1. User signs in → Supabase returns a JWT
2. User runs AI command → client sends JWT in `Authorization` header
3. Edge Function validates JWT → rejects if invalid/expired
4. Edge Function calls Claude with API key → executes tools → returns result
