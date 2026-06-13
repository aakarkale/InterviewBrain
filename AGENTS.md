<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Demo account — keep it current with production (standing rule)

A shared demo user exists so the owner can review production without signing up: `e2e.verifybot@ibtest.dev` (Supabase project `interviewbrain`, tagged `is_demo: true` in `raw_user_meta_data`). Its password lives in chat only — never in the repo, env files, or commits.

- **After every merge to `main` that ships or changes a user-facing feature:** make sure the demo account exercises it on production — seed realistic, lived-in data for any new surface (respect free-tier caps, e.g. 3 active applications), then spot-check the deployed page.
- **Rotate the password every ~3 days** (first active session after expiry, or immediately on request): update `auth.users.encrypted_password` with `crypt(<new>, gen_salt('bf'))`, stamp `last_rotated_at` in `raw_user_meta_data`, verify end-to-end with a real password-grant call against Supabase auth before sharing, and announce the new password in chat.
- Demo data should cover what the UI can render (all document types, round outcomes, insight types, a scored session) and read like a real PM's prep, not lorem ipsum.

# Verify before asserting — never present an assumption as fact

This is a hard rule, not a preference. It applies to every session.

On anything **semi-critical or critical** — URLs, hostnames, endpoints, deploy/build/"it's live" status, IDs, keys, database or project refs, schema, production commands, or any data-changing action:

- **If it is verifiable with a tool I have** (fetch, read, list, query, run): verify it **before** stating it. Never infer a value from a naming convention, a pattern, or memory and present it as confirmed. ("It matches the usual `<project>.vercel.app` pattern" is **not** confirmation — fetch it and get a 2xx first.)
- **If it is not verifiable and getting it wrong is costly or hard to reverse:** ask rather than guess.
- **If I have not verified it:** say so explicitly ("unverified — likely X, want me to confirm?") instead of asserting it.

Do **not** over-ask. For trivial, reversible choices, pick a sensible default and say what I chose. Reserve questions and verification effort for the critical, genuinely ambiguous, or hard-to-undo — so this rule sharpens trust instead of becoming noise.
