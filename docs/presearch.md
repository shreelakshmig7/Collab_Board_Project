# CollabBoard: Strategic Pre-Search & Requirements Master Document

## 1. Project Vision & Overview

CollabBoard is a production-scale, real-time collaborative workspace designed to solve the technical friction of remote brainstorming. The project focuses on building a low-latency infrastructure capable of supporting multiple concurrent users with a seamless infinite-canvas experience. Beyond traditional whiteboard tools, CollabBoard integrates a sophisticated AI Board Agent that interprets natural language to perform complex layout tasks, such as generating SWOT templates, organizing notes into grids, and creating user journey maps.

This project adheres to an AI-first development methodology. By leveraging coding agents (Cursor), Model Context Protocols (MCPs), and structured AI workflows, the build process is optimized for speed and reliability — moving from a 24-hour MVP to a fully polished production-grade delivery in seven days.

---

## 2. Phase 1: Strategic Constraints

| Checklist Item | Strategic Decision | Operational Context |
|---|---|---|
| Scale & Load Profile | 5+ Launch / 100k+ (6 months) | Optimizing for spiky traffic typical of team workshops. WebSockets ensure <50ms cursor latency and <100ms object sync. Low tolerance for cold starts. |
| Budget & Cost Ceiling | Pay-per-use / Free Dev Tier | Leveraging serverless free tiers for development. Architecture trades a small API budget for shipping speed, with costs scaling linearly with user growth. |
| Time to Ship | 24h MVP / 7d Final Delivery | The Tuesday MVP gate is a hard requirement for core sync. Iteration cadence is daily, focusing on infrastructure first, then shifting to feature polish by Friday. |
| Compliance & Regulatory | Basic Auth / SOC 2 Ready | Implementing robust user authentication for public deployment. Data residency optimized for lowest latency for launch users. |
| Team & Skill Constraints | Solo Developer | Utilizing a stack that maximizes development velocity. AI agents bridge skill gaps to maintain high productivity during the sprint. |

---

## 3. Phase 2: Architecture Discovery & Functional Mapping

| Functionality | Technology Choice | Architectural Reasoning |
|---|---|---|
| Hosting & Deployment | Serverless / Edge (Vercel) | Managed infrastructure eliminates DevOps overhead and enables automated CI/CD for rapid iteration. |
| Auth & Authorization | Supabase Auth + RLS | Row Level Security policies provide fine-grained access control at the database level. Social login (Google) and email/password built-in. PostgreSQL-native security is more powerful and auditable than Firebase rules. |
| Database & Data Layer | Supabase (PostgreSQL + Realtime) | Supabase Broadcast for drag moves (<6ms latency); `postgres_changes` for board object persistence. Superior latency vs Firebase (6ms vs 600ms). PostgreSQL enables complex SQL queries and proper relational schema. Official MCP server enables AI-first development workflows. |
| Real-time Sync | Supabase Realtime (Broadcast + postgres_changes) | Broadcast used for high-frequency drag events (fire-and-forget, no DB write). `postgres_changes` used for persistent object mutations (INSERT/UPDATE/DELETE). Cursors use polling + `postgres_changes`. |
| Backend Architecture | Serverless Functions (Supabase Edge Functions) | Monolith-first approach simplifies state management for a 7-day sprint. REST used for AI agent proxy; Supabase Realtime for sync. Claude API key is server-side only in Edge Function env vars, never in client code. |
| Frontend & Rendering | React (SPA) + Konva.js | Canvas engine achieves 60 FPS for 500+ objects. `react-konva` provides seamless React integration. |
| AI Agent | Claude 4.5 Sonnet | Selected for superior multi-step reasoning and complex tool-calling (SWOT, grid layouts) where logical precision is prioritized. |
| Third-Party Integrations | Anthropic Claude API, Supabase, Vercel | Claude API pricing: $3/$15 per 1M tokens (input/output); rate limit mitigated by routing simple commands to Haiku ($0.80/$4 per 1M tokens). Vendor lock-in risk is low and incremental: Supabase Realtime can be swapped for Liveblocks or PartyKit; Edge Functions can move to Railway/Fly.io containers; Vercel can be replaced by any static host. No payments, email, or analytics services required for MVP. |

### Key Trade-off Decisions

**Canvas Rendering: Konva.js vs PixiJS vs Fabric.js**

**DECISION: Konva.js** — Optimal balance for 24-hour MVP. High-level API (shapes, layers, transforms built-in) saves 6–8 hours vs PixiJS low-level WebGL. Performance: exceeds the 60 FPS @ 500-object requirement. PixiJS is faster but requires manual event handling. Fabric.js too slow at scale. `react-konva` provides seamless integration.

**AI Model: Claude 4.5 Sonnet vs 3.5 Sonnet**

**DECISION: Claude 4.5 Sonnet** — Both models cost identical pricing ($3 input / $15 output per 1M tokens). Claude 3.5 is faster (1.0s) vs 4.5 (1.5s), but 4.5 offers superior tool orchestration for complex multi-step commands like "Create SWOT analysis". Since latency requirement is <2s (both meet it) and cost is identical, the model with better function-calling reliability was chosen.

**Why Supabase Over Firebase**

Firebase payment integration was blocked during the project sprint. Supabase was selected as the BaaS solution with the following technical advantages discovered during pre-search:

- **Supabase Broadcast:** 6ms median latency vs Firebase Realtime DB 600ms — 100× faster for drag/cursor sync
- **PostgreSQL:** Proper relational schema and SQL queries vs Firebase NoSQL limitations
- **Official MCP server:** Claude/Cursor can directly query the database during AI-assisted development
- **RLS policies:** Database-level security that clients cannot bypass

Trade-offs accepted: 4–6 hour setup vs Firebase 2–3 hours. Supabase `postgres_changes` limited to 64 writes/sec per table (mitigated by using Broadcast for high-frequency drag updates, only writing to DB on drag end). Required learning SQL and Row Level Security policies.

---

## 4. Phase 3: Post-Stack Refinement

| Refinement Category | Implementation Detail |
|---|---|
| Security Vulnerabilities | Input sanitization for all editable fields to prevent XSS. RLS policies enforced at the database level for board isolation. Claude API key is server-side only (Edge Function), never in client bundle. |
| Project Organization | Feature-based monorepo (`auth/`, `board/`, `canvas/`, `ai/`, `supabase/`). Optimized for AI agent navigation and shared context across the full stack. |
| Naming & Code Style | Standardized ESLint and Prettier configuration. PascalCase for components, camelCase for functions/variables, UPPER_SNAKE for constants. |
| Testing Strategy | Vitest + Testing Library for unit/integration tests. Playwright for E2E multiplayer stress tests. Mock Service Workers (`msw`) simulate AI responses during development. |
| Tooling & DX | Cursor (AI-first IDE) + Supabase MCP for direct DB access during development. Supabase local CLI for schema management. |

---

## 5. Cost Analysis

### 24-Hour MVP Build Strategy

**Critical path: Real-time sync is the hardest technical challenge and must be prioritized.**

- Hours 0–1: Pre-Search (this document)
- Hours 1–4: Canvas setup (Konva + pan/zoom + basic shapes)
- Hours 4–8: Supabase Auth + basic object storage (PostgreSQL schema, RLS)
- Hours 8–16: **CRITICAL** — Real-time sync (cursors + objects + presence via Supabase Realtime)
- Hours 16–20: Polish + disconnect handling
- Hours 20–24: Deploy + test with 5+ users

### Production Cost Projections

| Component | 100 Users | 1K Users | 10K Users | 100K Users |
|---|---|---|---|---|
| AI API (Claude 4.5 Sonnet) | $11/mo | $108/mo | $1,080/mo | $10,800/mo |
| Supabase (DB + Realtime + Auth) | $0 (Free tier) | $25/mo (Pro plan) | $25/mo (Pro plan) | $100/mo (Team plan) |
| Supabase Edge Functions | $0 | $3/mo | $20/mo | $180/mo |
| Hosting + CDN (Vercel) | $0 | $0 | $20/mo | $200/mo |
| **TOTAL** | **$11/mo** | **$123/mo** | **$1,205/mo** | **$12,030/mo** |

*Assumptions: 10 AI commands/user/session, 3 sessions/user/month, ~500 tokens/command (input + output).*

---

## 6. Risk Assessment

### Key Trade-offs Accepted

| Trade-off | Decision |
|---|---|
| Supabase vs Custom WebSocket | Accepting managed infrastructure constraints (64 writes/sec for `postgres_changes`) to save 10–18 hours of backend development. Mitigated by using Broadcast for high-frequency updates. |
| Konva vs PixiJS | Accepting 2.6× slower peak performance (still exceeds all requirements) for 6–8 hours of dev time savings via high-level API. |
| Claude 4.5 vs 3.5 Sonnet | Accepting 0.5s slower responses for better multi-step tool orchestration. Both are under the 2s requirement at identical cost. |

### Why This Stack Wins

React + Konva + Supabase + Claude 4.5 is optimized for both 24-hour MVP and long-term performance:

- **Supabase:** 6ms realtime latency (100× faster than Firebase Realtime DB) with full PostgreSQL power
- **Konva:** 6–8 hours saved vs PixiJS low-level API while exceeding the 60 FPS @ 500-object requirement
- **React:** Largest ecosystem, `react-konva` integration, familiar patterns
- **Claude 4.5:** Best function calling for complex commands, same cost as alternatives
- **Total time saved:** 16–26 hours — the difference between passing and failing the MVP gate

### Scaling Bottlenecks & Migration Paths

| Bottleneck | Threshold | Migration Path |
|---|---|---|
| Supabase `postgres_changes` write throughput | ~64 writes/sec per table | Batch writes, throttle updates client-side, or migrate high-frequency updates to a dedicated Broadcast channel (already done for drag moves) |
| Supabase Realtime concurrent connections | ~200K connections (Pro plan) | Upgrade to Team plan or migrate real-time layer to a dedicated WebSocket service (Liveblocks, PartyKit, or self-hosted Socket.io + Redis) |
| Claude API cost linearity | ~$1,200/mo @ 10K users | Introduce tiered limits (free: 5 AI commands/session, pro: unlimited). Route simple commands to Claude Haiku ($1 input vs $3), keeping Sonnet only for complex multi-step operations. |
| Vercel serverless cold starts | Noticeable >500 concurrent requests | Move AI proxy Edge Function to a dedicated always-on container (Railway, Fly.io) at ~$7/mo to eliminate cold start latency on AI commands. |

Key architectural decision at 10K+ users: Supabase remains viable as the persistence layer. The real-time layer should migrate to a dedicated WebSocket service. This hybrid keeps migration incremental — swap one layer at a time rather than a full rewrite.

---

## 7. Security

### Supabase Row Level Security (RLS)

RLS policies are PostgreSQL-native security rules that execute at the database level. Clients cannot bypass them even with direct database credentials.

```sql
-- Board access: users can only see and manage boards they created
CREATE POLICY "Users can read own boards"
  ON boards FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own boards"
  ON boards FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Presence: users can only update their own presence row
CREATE POLICY "Users can manage own presence"
  ON presence FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Known Vulnerability Mitigations

| Vulnerability | Risk | Mitigation |
|---|---|---|
| JWT token not validated server-side before AI command execution | Unauthenticated users could trigger costly Claude API calls | Supabase Edge Function verifies the JWT via `supabase.auth.getUser()` before forwarding to Claude. Rate-limit enforced per `uid`. |
| Insecure Direct Object Reference (IDOR) — guessing board IDs | User accesses boards they were not invited to | Board IDs are UUID v4 (auto-generated by PostgreSQL `gen_random_uuid()`). RLS policies enforce `user_id` check on every read and write. |
| Prompt injection via board object text fields | Malicious sticky note text manipulates AI agent behavior | Board state passed to Claude is JSON-serialised and clearly delimited from the system prompt. User content is never concatenated raw into instructions. |
| XSS via editable text fields rendered as innerHTML | Script injection through sticky note content | All text content rendered via React (`textContent` / `innerText`, never `innerHTML`). Konva text nodes are not HTML. |
| Supabase anon key exposed in client bundle | Key harvesting and quota abuse | The anon key is public by design and is restricted by RLS policies — it cannot access data the authenticated user is not authorized to see. Sensitive keys (Claude API) are server-side only in Edge Function environment variables, never in client code. |
