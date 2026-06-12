# InterviewBrain

One vault per application. One brain across all of them. Text mock interviews
built from your actual resume, JD, and research — with feedback that learns
your weak spots across every company you're talking to.

See `SPEC.md` (project source of truth) for scope, data model, and build order.

## Stack

- **Next.js 16** (App Router, TypeScript) on **Vercel**
- **Tailwind v4** + vendored **shadcn/ui** primitives, all reading the
  three-layer vanilla CSS token system: `src/styles/tokens.css` →
  `app.css` → `sections.css`
- **Supabase** (Postgres, Auth, RLS on every table)
- **GSAP 3 + ScrollTrigger + Lenis** on the landing page only — Lenis never
  ships behind auth
- Fonts: **Unbounded** (landing display) + **Geist** (app UI). No others.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in values (see below)
pnpm dev
```

### Environment variables

| Variable | Where to find it | Needed for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API | everything |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same place (anon/publishable key) | everything |
| `SUPABASE_SERVICE_ROLE_KEY` | same place — **server-side only** | Phase 2 (AI pipelines) |
| `ANTHROPIC_API_KEY` | console.anthropic.com — server-side only | Phase 2 (interviewer, scoring, brain) |
| `RESEND_API_KEY` | resend.com | custom auth-email SMTP (optional) |

Never commit `.env` files. Production values live in the Vercel dashboard.

## Database workflow

All schema changes go through SQL files in `supabase/migrations/` — **never**
the dashboard editor. The committed files mirror the project's recorded
migration history one-to-one.

After any schema change, regenerate types and commit them:

```bash
supabase gen types typescript --project-id <project-ref> --schema public \
  > src/lib/supabase/database.types.ts
```

(or the Supabase MCP `generate_typescript_types` tool from a Claude Code
session.)

RLS: every table is owner-scoped; `competencies` is read-only seed data for
authenticated users. The competency slugs are load-bearing rubric keys —
never rename or delete them, only add.

## Auth

Email + password works out of the box (Supabase built-in mailer; swap in
Resend SMTP for production). Google OAuth requires one-time setup:

1. Google Cloud Console → create an OAuth client (web application)
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Supabase dashboard → Authentication → Sign In / Providers → Google → paste
   client ID + secret
4. Supabase dashboard → Authentication → URL Configuration → set Site URL and
   add your domains to Redirect URLs

For nicer confirmation emails across browsers, point the email template's
confirmation URL at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
(the `/auth/confirm` route is already implemented).

## Design system

`tokens.css` is the single source of truth: colors (OKLab `color-mix`
tints), radii, shadows, motion durations/eases, and the per-element knobs
(`--accent`, `--mx`/`--my` glow tracking). Dark is the default theme;
light is the brutalist variant (hard offset shadows) via
`[data-theme="light"]`. Tailwind consumes the same tokens through
`@theme inline` in `src/app/globals.css`. `prefers-reduced-motion` is
respected in CSS and in every JS motion path.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | dev server |
| `pnpm build` | production build |
| `pnpm start` | serve the production build |
| `pnpm lint` | ESLint |
