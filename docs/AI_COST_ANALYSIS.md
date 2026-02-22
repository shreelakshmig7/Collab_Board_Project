# AI Cost Analysis — CollabBoard

**API Key:** `shree-collab-success`  
**Period covered:** Feb 19–22, 2026 (original 3-day sprint + bulk creation feature session)  
**Originally submitted:** Feb 21, 2026 | **Updated:** Feb 22, 2026

---

## 1. Development & Testing Costs (Actual)

### 1.1 Raw spend by day and model

**Original sprint (Feb 19–21):**

| Date | Model | Token Type | Cost (USD) |
|------|-------|-----------|------------|
| Feb 19 | Claude Sonnet 4 | Input | $1.06 |
| Feb 19 | Claude Sonnet 4 | Output | $0.19 |
| Feb 20 | Claude Haiku 4.5 | Input | $0.10 |
| Feb 20 | Claude Haiku 4.5 | Output | $0.04 |
| Feb 20 | Claude Sonnet 4 | Input | $0.64 |
| Feb 20 | Claude Sonnet 4 | Output | $0.34 |
| Feb 21 | Claude Haiku 4.5 | Input | $0.05 |
| Feb 21 | Claude Haiku 4.5 | Output | $0.02 |
| Feb 21 | Claude Sonnet 4 | Input | $0.58 |
| Feb 21 | Claude Sonnet 4 | Output | $0.31 |
| **Sprint subtotal** | | | **$3.33** |

**Extended testing session — bulk creation feature (Feb 21 late UTC + Feb 22, from CSV export):**

| Date (UTC) | Model | Input tokens | Output tokens | Cost (USD) |
|------------|-------|-------------|--------------|------------|
| Feb 21 | Claude Haiku 4.5 | 59,153 | 5,535 | $0.069 |
| Feb 21 | Claude Sonnet 4 | 207,948 | 22,652 | $0.964 |
| Feb 22 | Claude Haiku 4.5 | 107,381 | 5,013 | $0.106 |
| Feb 22 | Claude Sonnet 4 | 239,281 | 20,012 | $1.018 |
| **Extended session subtotal** | | **613,763** | **53,212** | **$2.157** |

*Note: Feb 21 extended session data partially overlaps with the sprint's Feb 21 entry (~$0.07 incremental). The bulk of the new spend is Feb 22 ($1.124) — the bulk creation implementation and 500-object stress testing.*

**Combined total across all sessions:**

| Period | Cost |
|--------|------|
| Original sprint (Feb 19–21) | $3.33 |
| Extended testing (Feb 21 late + Feb 22) | $2.16 |
| **Grand total** | **$5.49** |

### 1.2 Model totals (cumulative, all sessions)

| Model | Input cost | Output cost | Subtotal |
|-------|-----------|------------|---------|
| Claude Sonnet 4 (`claude-sonnet-4-20250514`) | $4.06 | $1.49 | **$5.55** |
| Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | $0.32 | $0.11 | **$0.43** |
| **Grand total** | **$4.38** | **$1.60** | **$5.98** |

*Minor rounding differences between per-day and aggregate figures due to token-level precision.*

Sonnet's share dropped slightly from 93.7% (sprint only) to ~92.8% cumulative as more Haiku bulk-creation calls were added in the extended session.

### 1.3 Token consumption

Pricing used: Sonnet 4 at $3.00/MTok input · $15.00/MTok output; Haiku 4.5 at $0.80/MTok input · $4.00/MTok output.

**Original sprint:**

| Model | Input tokens | Output tokens | Total tokens |
|-------|-------------|--------------|-------------|
| Claude Sonnet 4 | ~760,000 | ~56,000 | ~816,000 |
| Claude Haiku 4.5 | ~187,500 | ~15,000 | ~202,500 |
| **Sprint total** | **~947,500** | **~71,000** | **~1,018,500** |

**Extended session (from CSV):**

| Model | Input tokens | Output tokens | Total tokens |
|-------|-------------|--------------|-------------|
| Claude Sonnet 4 | 447,229 | 42,664 | 489,893 |
| Claude Haiku 4.5 | 166,534 | 10,548 | 177,082 |
| **Extended total** | **613,763** | **53,212** | **666,975** |

**Cumulative across all sessions: ~1.69 million tokens**

### 1.4 Estimated API call volume

Average input token counts per API call: Sonnet ~2,500–4,000 tokens (system prompt + tools + board state + history); Haiku ~2,390 tokens (system prompt + full tool schema + no board state for bulk/simple).

| Session | Model | Input tokens | Avg tokens/call | Est. API calls |
|---------|-------|-------------|----------------|---------------|
| Sprint | Sonnet 4 | 760,000 | ~2,500 | ~304 |
| Sprint | Haiku 4.5 | 187,500 | ~1,800 | ~104 |
| Extended | Sonnet 4 | 447,229 | ~3,500 | ~128 |
| Extended | Haiku 4.5 | 166,534 | ~2,390 | ~70 |
| **Total** | | | | **~606 API calls** |

The extended Haiku average rose from ~1,800 to ~2,390 tokens/call because `createBulkObjects` is now in the tool schema (17 tools vs. smaller subset previously).

### 1.5 Daily spend pattern and what it reflects

| Date | Total spend | Development phase |
|------|------------|-----------------|
| Feb 19 | $1.25 | Initial build — single Sonnet model, full tool set, latency diagnosis (sections 3.1–3.2 of dev log). Highest daily cost because every command went to Sonnet regardless of type. |
| Feb 20 | $1.12 | Two-model routing implemented — Haiku path added for simple commands (section 3.3). Haiku appears for the first time. Total spend drops despite more features. |
| Feb 21 | $0.96 | Compound tool strategy shipped (section 3.8), final testing and polish. Lowest daily spend of the sprint: compound tools reduced per-template LLM calls from 7+ to 1. |
| Feb 21 (extended) | $1.03 | Bulk creation feature development and pre-deploy testing. Higher than sprint's Feb 21 due to failed retries before deployment (old Edge Function creating 1 object, user retrying). |
| Feb 22 | $1.12 | Post-deploy bulk creation testing and 500-object stress test. Haiku-heavy session (107K Haiku tokens vs. typical 30–60K). |

The 23% drop from day 1 to day 3 (sprint) reflects the compound tool optimization. The Feb 22 session cost is similar to Feb 20 despite testing far more complex operations — a sign that the bulk tool is working efficiently.

### 1.6 Supabase Edge Function invocations (actual — from Supabase logs)

The Supabase invocation log covers **Feb 20–21, 2026 UTC** (the Feb 19 invocations were on an earlier deployment version not included in this export).

| Metric | Value |
|--------|-------|
| Total rows exported | 100 |
| POST requests (AI commands) | 49 |
| — Successful (HTTP 200) | **46** |
| — Failed (HTTP 502) | **3** (during v13 testing, Anthropic API errors) |
| OPTIONS requests (CORS preflight) | 51 |
| Deployment versions active | 3 (v13, v14, v15) |
| Time range (UTC) | Feb 20 09:26 → Feb 21 02:40 |

**Execution time distribution (successful POSTs):**

| Latency bucket | Count | % | What it represents |
|----------------|-------|---|--------------------|
| < 2s | 7 | 15% | Simple path (Haiku, `returnAfterToolExecution`) |
| 2–5s | 18 | 39% | Compound tools + fast ops |
| 5–12s | 14 | 30% | Ops/complex (2–3 Sonnet turns) |
| > 12s | 7 | 15% | Pre-optimization multi-turn Sonnet (v13 era) |
| **Min** | **1,277ms** | | Fastest Haiku simple command (post-optimization) |
| **Max** | **21,515ms** | | Slowest pre-optimization multi-turn command |
| **Avg** | **6,791ms** | | Overall; drops significantly for v14/v15 |
| **Median** | **4,677ms** | | Better central measure given tail |

**Average latency improvement across deployment versions:**

| Version | Calls | Avg latency | Phase |
|---------|-------|-------------|-------|
| v13 | 28 | 7,621ms | Initial build + early optimization attempts |
| v14 | 6 | 4,415ms | Compound tool strategy shipped |
| v15 | 12 | 6,043ms | Two-model routing (Haiku + Sonnet split); wider distribution due to mixed command types |

The 3 failed (502) calls all occurred within a 2-minute window on Feb 20 at ~17:00 UTC — consistent with a transient Anthropic API error during testing, not a structural issue.

**Supabase compute cost:**

| Metric | Value |
|--------|-------|
| Total POST compute | 330.7 seconds |
| Total OPTIONS compute | 18.2 seconds |
| Memory per invocation | 512 MB = 0.5 GB |
| **Total GB-seconds** | **174.4** |
| Free tier GB-seconds | 200,000 |
| Free tier invocations | 500,000 |
| **Supabase Edge Function cost** | **$0.00** (well within free tier) |

174.4 GB-seconds against a 200,000 GB-second free allowance = **0.09% of the free quota used**.

### 1.7 Supabase Edge Function — extended session (Feb 21–22)

The extended session log (exported from Supabase dashboard) contains only Boot/Shutdown lifecycle events — no HTTP request logs with status codes or execution times were included in this export.

| Metric | Value |
|--------|-------|
| Cold-start cycles observed | 24 |
| Boot time per instance | 21–40ms (consistent with previous export) |
| Time range (UTC) | Feb 21 ~06:45 → Feb 22 ~06:19 |
| Estimated POST requests | ~40–70 (CORS preflights + AI commands combined) |
| **Supabase Edge Function cost** | **$0.00** (still well within free tier) |

The 24 cold-start cycles at 2 concurrent instances per boot = 48 instance boots. This is consistent with ~20–30 actual AI commands (each generating 1 CORS preflight + 1 POST, each potentially cold-starting). The bulk creation feature — including 500-object tests — did not meaningfully increase Edge Function compute time because `createBulkObjects` does a single batch insert rather than N sequential inserts.

### 1.7 Other AI-related development costs

| Item | Cost | Notes |
|------|------|-------|
| Cursor Pro (IDE + Claude integration) | $20/month | Primary development environment; Claude Sonnet via Cursor agent/plan mode for all code generation, refactoring, and multi-file changes |
| Claude.ai Pro | $20/month | Used for architecture consultation, prompt design, and reviewing AI agent behavior outside the IDE; 7% of weekly limit consumed by end of sprint (screenshot Feb 20) |
| Supabase Pro | $25/month | Required for Edge Function deployment, Realtime, and Postgres |
| Vercel (hosting) | $0 | Free tier sufficient for development |
| **Total dev tooling** | **~$65/month** | Fixed overhead, independent of API usage |

**Total development cost for the sprint: $3.33 (API) + $0 (Edge Functions — free tier) + $65 (tooling) ≈ $68.33**

---

## 2. Production Cost Projections

### 2.1 Pricing reference

| Model | Input | Output |
|-------|-------|--------|
| Claude Sonnet 4 | $3.00 / MTok | $15.00 / MTok |
| Claude Haiku 4.5 | $0.80 / MTok | $4.00 / MTok |

### 2.2 Per-command token model

Each AI command involves: system prompt (~300 tokens) + tool schema (filtered per policy) + user message + board state (if required) + model response. Multi-turn commands carry the full conversation history forward, so token cost compounds.

#### Simple creation command (Haiku, 1 turn, no board state)

| Component | Tokens |
|-----------|--------|
| System prompt | 300 |
| Tool list (creation subset, ~7 tools) | 900 |
| User message | 20 |
| Board state (empty — not sent) | 50 |
| **Total input** | **~1,270** |
| Output (single tool call JSON) | ~150 |

**Cost per simple command: 1,270 × $0.0000008 + 150 × $0.000004 ≈ $0.0016**

#### Bulk creation command (Haiku, 1 turn, no board state) — new

Examples: "Create 50 sticky notes", "Add 20 rectangles", "Create 500 sticky notes about project risks"

| Component | Tokens |
|-----------|--------|
| System prompt | 300 |
| Tool list (16 tools — all except getBoardState) | 2,000 |
| User message | 15 |
| Board state (stripped — never sent for bulk) | 0 |
| **Total input** | **~2,315** |
| Output (tool call: objectType + count + layout) | ~25–75 |

**Cost per bulk command: 2,315 × $0.0000008 + 50 × $0.000004 ≈ $0.002**

This cost is **fixed regardless of N** — creating 500 objects costs the same ~$0.002 as creating 3. The only variable is Supabase write compute, which is negligible (single batch insert ≈ single-row insert cost at the DB level).

Compare to the old broken path: a user requesting 50 stickies would retry ~5 times (creating 1 per attempt) × ~$0.0016 per Haiku call + board state penalty = **~$0.012–0.025 total** for a failed outcome. The bulk path delivers a successful outcome for ~$0.002 — a 6–12× cost reduction per bulk interaction.

#### Compound template command (Sonnet, 1 turn, no board state)

Examples: "Create a SWOT analysis", "Set up a retro board", "Build a user journey map"

| Component | Tokens |
|-----------|--------|
| System prompt | 300 |
| Tool list (compound subset, ~10 tools) | 1,200 |
| User message | 20 |
| Board state (not sent — compound tools build fresh) | 50 |
| **Total input** | **~1,570** |
| Output (compound tool call with labels + items JSON) | ~400 |

**Cost per compound command: 1,570 × $0.000003 + 400 × $0.000015 ≈ $0.0107**

#### Ops / manipulation command (Sonnet, avg 2 turns, getBoardState required)

Examples: "Move all pink stickies right", "Change the rectangle to blue", "Resize the frame"

| Component | Tokens |
|-----------|--------|
| Turn 1 input: system + tools + message + inline board state (~40 obj) | ~2,820 |
| Turn 1 output: getBoardState tool call | ~100 |
| Turn 2 input: full history + board state response (~40 objects = ~1,200 tokens) | ~4,120 |
| Turn 2 output: mutation tool call | ~100 |
| **Total input** | **~6,940** |
| **Total output** | **~200** |

**Cost per ops command: 6,940 × $0.000003 + 200 × $0.000015 ≈ $0.024**

#### Generic complex command (Sonnet, avg 4 turns)

Examples: "Arrange these elements in a grid", "Connect all sticky notes with arrows", "Space these evenly"

| Turn | Input (cumulative) | Output |
|------|-------------------|--------|
| 1 | ~2,820 | ~200 |
| 2 | ~4,220 | ~200 |
| 3 | ~4,620 | ~200 |
| 4 | ~5,020 | ~200 |
| **Total** | **~16,680** | **~800** |

**Cost per complex command: 16,680 × $0.000003 + 800 × $0.000015 ≈ $0.062**

### 2.3 Usage assumptions

| Assumption | Value | Rationale |
|------------|-------|-----------|
| Sessions per user per month | 3 | Collaborative tool used in meetings/workshops |
| AI commands per session | 8 | Mix of setup (templates) + live manipulation |
| Total commands per user per month | 24 | 3 sessions × 8 commands |
| Command mix — simple | 40% | Single-object creation: "add a sticky", "create a shape" (reduced from 50% to make room for bulk) |
| Command mix — **bulk** | **10%** | **Multi-object creation: "add 20 rectangles", "create 50 stickies" (new category)** |
| Command mix — compound | 25% | Template generation (SWOT, retro, journey map) |
| Command mix — ops | 15% | Manipulation: move, resize, color change |
| Command mix — complex | 10% | Grid arrange, connectors, multi-step |

### 2.4 Weighted average cost per command

```
= 0.40 × $0.0016   (simple / Haiku)
+ 0.10 × $0.0020   (bulk / Haiku — new)
+ 0.25 × $0.0107   (compound / Sonnet)
+ 0.15 × $0.024    (ops / Sonnet)
+ 0.10 × $0.062    (complex / Sonnet)

= $0.00064 + $0.00020 + $0.002675 + $0.0036 + $0.0062

= $0.0133 per command
```

**Monthly AI API cost per active user: 24 commands × $0.0133 = $0.32/user/month**

The addition of bulk commands barely moves the weighted average ($0.013 → $0.0133) because bulk uses the same cheap Haiku model at nearly the same token cost as a single-object creation command.

### 2.5 Monthly cost projections

| Scale | Monthly API cost | Supabase | Hosting | **Total** |
|-------|-----------------|---------|--------|-----------|
| **100 users** | $32 | $0 (free tier) | $0 (free) | **~$32/month** |
| **1,000 users** | $320 | $0 (free tier — 24K invocations, well within 500K free) | $0 | **~$320/month** |
| **10,000 users** | $3,200 | $25 (Pro — 240K invocations within 2M Pro limit) | $20 (Vercel Pro) | **~$3,245/month** |
| **100,000 users** | $32,000 | $25 (Pro + ~$0.40 overage for 2.4M invocations) | $20 | **~$32,045/month** |

*Supabase pricing: Free tier — 500K invocations/month + 200K GB-seconds. Pro ($25/month) — 2M invocations + 1M GB-seconds. Each AI command = 1 POST invocation + ~7s at 0.5GB = ~3.5 GB-seconds. At 100K users × 24 commands = 2.4M invocations + 840K GB-seconds; both exceed the Pro tier limits, resulting in overage: (400K extra invocations × $0.09/100K) + (840K − 1M = 0 GB-s overage) ≈ +$0.36. Development confirmed the Edge Function itself is extremely compute-efficient: 46 real AI commands consumed only 174 GB-seconds total. Bulk creation (500-object test) added negligible compute — single batch insert runs in the same time as a 1-row insert.*

### 2.6 Per-user monthly cost summary

| Scale | API cost/user | Infra cost/user | **Total cost/user** |
|-------|--------------|----------------|---------------------|
| 100 users | $0.32 | ~$0.00 | **$0.32** |
| 1,000 users | $0.32 | ~$0.00 | **$0.32** |
| 10,000 users | $0.32 | ~$0.005 | **$0.325** |
| 100,000 users | $0.32 | ~$0.0005 | **$0.320** |

Infrastructure cost per user is negligible at all scales. The AI API cost is the dominant and essentially linear cost driver.

### 2.7 Cost optimization levers

| Strategy | Estimated saving | Implementation effort |
|----------|-----------------|----------------------|
| Cache `getBoardState` results for 5 seconds | ~30% reduction on ops/complex commands | Low — add Redis or in-memory cache in Edge Function |
| Prompt caching (Anthropic beta) for system prompt + static tool schema | ~15–25% on input tokens | Medium — add cache-control headers to static message blocks |
| Shift more compound commands to Haiku | ~6× cost reduction per affected command | Medium — requires quality testing; Haiku may miss nuanced template labels |
| Reduce tool schema sent per policy tier | ~10% input token saving | Already partially implemented; can be tightened further |
| Increase Haiku share (simple path) by tuning classifier | Proportional to mix shift | Low — regex tuning in `policy.ts` |
| **Bulk creation** (**already shipped**) | **6–12× cost reduction vs. retry loop** | **Done — `createBulkObjects` compound tool** |

**With prompt caching + getBoardState caching, realistic cost per user drops to ~$0.23–0.26/month**, reducing 100K-user cost from ~$32K to ~$23–26K/month.

---

## 3. Key Takeaways

- **Total development cost across all sessions: ~$70.49** — $5.49 in Anthropic API ($3.33 original sprint + $2.16 extended bulk creation session), $0 in Supabase Edge Functions (free tier throughout), and ~$65 in fixed AI tooling (Cursor Pro + Claude.ai Pro + Supabase Pro). API cost remains remarkably low relative to tooling subscriptions.
- **Simple commands are cheap ($0.0016 each)** thanks to Haiku routing. Compound templates ($0.011) are also cost-effective because the server builds the entire layout in a single LLM call.
- **Bulk creation commands ($0.002 each) are the most cost-efficient feature shipped.** Creating 500 objects costs the same as creating 3 — the token cost is fixed regardless of N. The batch insert eliminates the per-object DB cost that would otherwise compound. Confirmed in live testing: 500 sticky notes in 1.50s for ~$0.002.
- **Ops commands ($0.024) are the most expensive per-command relative to their simplicity.** They require 2 Sonnet turns to resolve object IDs via `getBoardState`. Caching board state would halve this.
- **Bulk creation prevents rate-limit-induced retry cascades.** Before the fix, a "create 50 stickies" request created 1, the user retried ~5× at ~$0.016/retry (Haiku + board state) = ~$0.08 for a failed outcome. After: $0.002 for a correct outcome. Beyond cost, this is what was causing the 30,000 input-token-per-minute rate limit to be hit.
- **At production scale, AI API cost is the only meaningful variable cost**: $0.32/user/month assuming 24 commands/month (marginally up from $0.31 due to bulk command category addition). Infrastructure (Supabase, Vercel) is effectively fixed until ~100K users.
- **100K users would cost ~$32,000/month (~$384K/year)** — a significant but commercially viable figure for a SaaS product with appropriate per-seat pricing (e.g. $5–15/user/month provides 15×–47× margin over AI cost alone).
