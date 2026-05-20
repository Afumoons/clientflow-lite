# ClientFlow Lite

A zero-initial-investment SaaS MVP for freelance developers and micro-agencies who want a clean client portal instead of scattered project chats.

## Stack

- React + TypeScript + Vite
- Supabase Auth + Postgres + RLS
- Vercel deployment

## MVP Scope

- Passwordless magic-link login
- Auto-created workspace after signup
- Project portal dashboard
- Milestones, tasks, approvals, and manual invoice/payment status
- Global-first landing page positioning

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required env:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Database

Initial schema lives in:

```text
supabase/migrations/20260520201000_initial_clientflow.sql
```

It creates RLS-protected workspaces, projects, milestones, tasks, approvals, and invoices.
