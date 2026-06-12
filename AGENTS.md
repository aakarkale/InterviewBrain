<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Verify before asserting — never present an assumption as fact

This is a hard rule, not a preference. It applies to every session.

On anything **semi-critical or critical** — URLs, hostnames, endpoints, deploy/build/"it's live" status, IDs, keys, database or project refs, schema, production commands, or any data-changing action:

- **If it is verifiable with a tool I have** (fetch, read, list, query, run): verify it **before** stating it. Never infer a value from a naming convention, a pattern, or memory and present it as confirmed. ("It matches the usual `<project>.vercel.app` pattern" is **not** confirmation — fetch it and get a 2xx first.)
- **If it is not verifiable and getting it wrong is costly or hard to reverse:** ask rather than guess.
- **If I have not verified it:** say so explicitly ("unverified — likely X, want me to confirm?") instead of asserting it.

Do **not** over-ask. For trivial, reversible choices, pick a sensible default and say what I chose. Reserve questions and verification effort for the critical, genuinely ambiguous, or hard-to-undo — so this rule sharpens trust instead of becoming noise.
