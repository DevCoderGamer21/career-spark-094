# AI Resume Intelligence Platform — Build Plan

Enterprise Deep Blue theme. Full-stack on TanStack Start + Lovable Cloud (Postgres/auth/storage) + Lovable AI Gateway (Gemini for parsing/matching/chat).

Given the size, I'll deliver in **3 phases**. Phase 1 goes in this build; phases 2 & 3 follow after you review.

---

## Phase 1 — Foundation + Candidate Core (this build)

**Design system**
- Enterprise Deep Blue tokens in `src/styles.css` (navy `#0A1929`, electric blue `#1976D2`, sky `#66B2FF`)
- Gradients, elegant shadows, glow accents; Inter for body, tight display font for headings
- Reusable component variants (hero button, glass card, score ring)

**Auth & data model (Lovable Cloud)**
- Email/password + Google sign-in
- `profiles` (id, full_name, avatar_url, headline, phone, linkedin, github, college, graduation_year)
- `user_roles` enum: `admin | candidate | recruiter | placement_officer` + `has_role()` security-definer fn
- `resumes` (id, user_id, file_path, filename, parsed_json, ats_score, ats_breakdown, created_at)
- `job_descriptions` (recruiter uploads — schema only in phase 1)
- Storage bucket `resumes` (private, owner-scoped RLS)
- RLS + `GRANT`s on every public table

**Public marketing site**
- Landing page (hero, features, how-it-works, testimonials, CTA) — its own route
- `/features`, `/pricing`, `/about` — separate crawlable routes with unique OG metadata
- Sitemap.xml + robots.txt

**Candidate app (`/_authenticated/`)**
- Dashboard shell with sidebar nav + role-aware routing
- **Upload resume** (drag/drop PDF/DOCX → Storage → server fn parses with Gemini → structured JSON persisted)
- **Resume analysis page**: ATS score ring (0–100), sub-scores (formatting, keywords, skills, experience, education, grammar, achievements, ATS-compat), parsed entity view
- **JD matcher**: paste JD → similarity %, matched vs missing skills, learning suggestions
- **AI improvement suggestions**: actionable rewrite tips + achievement quantification
- **Career advisor chat** (streaming, Gemini via AI Gateway)
- Resume history list

**AI server functions**
- `parseResume` — PDF/DOCX → structured JSON (Gemini file input)
- `scoreResume` — ATS score + breakdown (structured output)
- `matchJobDescription` — similarity + skill gaps
- `improveResume` — bullet-level suggestions
- `/api/chat` streaming route for advisor

---

## Phase 2 — Resume Builder + Recruiter

- Resume builder wizard (5 sections) + ATS-friendly PDF export (client-side)
- Templates: ATS, Modern, Minimal
- Recruiter role: upload JD, browse & rank candidates, side-by-side compare, shortlist, AI interview questions

## Phase 3 — Placement Officer + Admin

- Placement officer dashboard: batch analytics, skill distribution, readiness heatmap
- Admin: user management, role assignment, resume analytics, audit logs
- Reports export (PDF/CSV)

---

## Technical notes

- Frontend: React 19 + TanStack Start + Tailwind v4 + shadcn (customized)
- Charts: Recharts for score trends & skill distribution
- Backend: `createServerFn` for app logic; `/api/chat` server route for streaming
- AI: Lovable AI Gateway, default model `google/gemini-3-flash-preview` (fast + supports file input for direct PDF parsing — no separate Python parser needed)
- File parsing: send PDF/DOCX bytes to Gemini directly; fallback text extraction with `pdfjs-dist`/`mammoth` if needed
- Security: RLS everywhere, roles in `user_roles` table (never on profile), server-side role checks with `has_role()`

Reply "go" to build Phase 1, or tell me what to change.