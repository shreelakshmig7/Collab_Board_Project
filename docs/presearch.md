# CollabBoard – Pre-Search Decisions

Source: **CollabBoard_Presearch_Document_Shreelakshmi_Gopinatharao**.

## Stack (locked in)

| Area | Decision | Rationale |
|------|----------|-----------|
| **Hosting** | Vercel (serverless/edge) | Managed infra, CI/CD, rapid iteration |
| **Auth** | Firebase Auth / SSO (social login) | Frictionless entry; multi-tenant board isolation via RBAC |
| **Database** | Hybrid Firebase | Firestore = board objects (persistent); Realtime DB = cursors (high-frequency). High-write optimized. |
| **Frontend** | React SPA + Konva.js | 60 FPS @ 500+ objects; react-konva integration |
| **AI Agent** | Claude 4.5 Sonnet | Multi-step reasoning, tool-calling; <2s latency; same cost as 3.5, better function-calling |
| **Backend** | Serverless | Monolith-first for 7-day sprint; REST for AI, Firebase for sync |

## Key trade-offs accepted

- **Firebase vs custom WebSocket:** Accept ~600ms vs 50ms latency to save 10–18 hours backend dev.
- **Konva vs PixiJS:** Accept 2.6x slower (still exceeds 60 FPS @ 500 objects) for 6–8 hour savings via high-level API.
- **Claude 4.5 vs 3.5:** Accept ~0.5s slower response for better tool orchestration; both under 2s, same cost.

## Cost analysis (for submission)

| Component | 100 Users | 1K Users | 10K Users | 100K Users |
|-----------|-----------|----------|-----------|------------|
| AI API (Claude) | $11/mo | $108/mo | $1,080/mo | $10,800/mo |
| Firebase (Firestore + Realtime) | $0 | $12/mo | $85/mo | $850/mo |
| Cloud Functions | $0 | $3/mo | $20/mo | $180/mo |
| Hosting + CDN | $0 | $0 | $20/mo | $200/mo |
| **TOTAL** | **$11/mo** | **$123/mo** | **$1,205/mo** | **$12,030/mo** |

## Phase 1 constraints (summary)

- Scale: 5+ launch, 100k+ at 6 months; spiky traffic; <50ms cursor, <100ms object sync.
- Budget: Pay-per-use / free dev tier.
- Time: 24h MVP gate, 7-day final delivery.
- Team: Solo; AI-first (Cursor, MCPs) for velocity.

## Phase 3 refinements

- **Security:** Input sanitization for editable fields (XSS); DB-level rules for isolation.
- **Project:** Feature-based structure; ESLint/Prettier; E2E (Playwright) for multiplayer; Cursor + MCPs.
- **Optional later:** Text + vector storage for AI “board memory”.
