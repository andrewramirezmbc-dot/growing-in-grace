# Growing in Grace — Launch Checklist

Track of every remaining TODO before public launch. Items are grouped by owner. Each section flags **blocking** vs. **nice-to-have**.

---

## 🧑‍💻 Andrew (developer / operator)

### 🔴 Blocking — must complete before launch

- [x] ~~**Supabase credentials included in deploys** — `js/supabase-config.js` now ships with the browser-safe anon key.~~
- [ ] **Restore or replace the Supabase project** — `knxiaqztwpcyatlzwdon.supabase.co` currently returns DNS `NXDOMAIN`. Auth and progress tracking cannot work until that project is reachable or the config is updated to a new project.
- [ ] **Run migration** — paste `supabase/migrations/001_initial_schema.sql` into Supabase Studio SQL Editor and execute. Verify both `profiles` and `lesson_progress` tables exist with RLS enabled.
- [ ] **Set yourself as admin** — after your first signup, open Supabase Studio → Table Editor → `profiles` → your row → set `is_admin = true`. This is how you access `/admin.html`.
- [x] ~~**Netlify site setup** — connected to `main` and live at `https://thegrowingdisciple.org`.~~
- [ ] **Netlify environment variables** — if you prefer to inject Supabase credentials via env instead of committing them, adjust `js/supabase-config.js` to read from `window.ENV` and add a Netlify build plugin or snippet injection. _(V2 improvement — for v1, committing the anon key is acceptable since RLS is the real security layer.)_
- [ ] **Custom domain decision** — the Netlify URL is launch-ready; update canonical URLs, sitemap, and robots again if a custom domain is connected.
- [x] ~~**Update sitemap.xml + robots.txt domain** — both now point to the live Netlify URL.~~

### 🟡 Blocking for polished launch

- [x] ~~**OG image** — `/assets/og-image.jpg` is 1200×630 and linked with absolute URLs from all 4 public pages.~~
- [x] ~~**Local hero image** — the homepage uses the production Growing in Grace hero asset; no remote hero dependency remains on the live page.~~
- [x] ~~**_Discipleship Today_ cover image** — placed at `/assets/discipleship-today-cover.jpg`, referenced from homepage "Latest Resource" section.~~
- [x] ~~**Raster favicons** — `/favicon.ico` and `/apple-touch-icon.png` are included.~~

### 🟢 Nice-to-have

- [ ] **Password policy hardening** — current min is 6 chars. Consider raising to 8-10.
- [ ] **Email confirmation settings** — in Supabase → Auth → Email, decide whether to require email confirmation before signin.
- [ ] **Content-Security-Policy header** — v2 polish. Requires tuning against Supabase CDN, YouTube embeds, Google Fonts. Deferred.
- [ ] **Click-outside-to-close hamburger** — v2 UX polish. Currently requires tapping the hamburger button again.
- [ ] **Session-aware video links on `/videos`** — spec Section 7.6 mentions swapping YouTube watch URLs → internal lesson pages for authenticated users. Videos page was deleted; if reinstated later, wire this in.

---

## 👨‍🏫 Dr. Burggraff (content)

### 🔴 Blocking — visible placeholder content

- [ ] **Professional headshot** — replaces "ATB" initials placeholder on 2 pages:
  - Homepage `/index.html` (About strip)
  - `/about.html` (reading panel)
- [ ] **Bio paragraphs** (3) — replaces Lorem ipsum on `/about.html`. Covers vocation, publications, ministry focus.
- [ ] **Credentials list** — 4 items currently stubbed on `/about.html`:
  - Ph.D. (degree + institution)
  - Faculty position (likely Shepherds Theological Seminary — confirm exact title)
  - Author of _Growing in Grace_ (2025)
  - Author of _Discipleship Today_
- [ ] **Teaching philosophy quote** — the italic pull-quote in the teal section of `/about.html`. One-sentence quote that captures your approach to discipleship.

### ✅ Per-lesson content — shipped with manual-derived descriptions

All 28 published lessons now ship with real content drawn from Dr. Burggraff's curriculum:

- [x] ~~**Placeholder warning banners removed** — no lesson page shows the "Placeholder content" banner anymore.~~
- [x] ~~**Per-lesson description** — each lesson has a 2-4 sentence intro drawn from the corresponding manual subsection.~~
- [x] ~~**Per-lesson Scripture Focus** — each lesson lists 2-5 key verses tied to its specific subtopic (not generic section-level placeholders).~~
- [x] ~~**Key Terms section removed** — was a placeholder structure; dropped per simplification.~~
- [x] ~~**Discussion Questions section removed** — was a placeholder structure; dropped per simplification.~~
- [x] ~~**Resources/Handout section removed** — the `alert('Handout coming soon')` stub was deleted.~~

### 🟢 Nice-to-have (Dr. Burggraff content refinements)

Dr. Burggraff can refine any per-lesson content by editing `/lessons/lesson-XX.html` directly, or by sending revisions to apply. Areas a content pass could polish:

- [ ] **Tightened descriptions** — if any of the 20 lesson descriptions read awkwardly, Dr. Burggraff can provide a rewritten version.
- [ ] **Additional verse references** — some lessons list 2-3 verses, others 4-5. Dr. Burggraff can add or swap verses if he prefers different passages for a given lesson.
- [ ] **Lesson 19 note** — lesson 19's content ("Doctrine, Reproof, Correction, Training") technically lives in Section 7 of the manual (_How is Scripture Beneficial_), but the video is grouped under Section 8 in the curriculum. If Dr. Burggraff wants the dashboard/curriculum to relocate it to Section 7, that's a `gig-lessons.json` change.

### 📋 Pattern for future lessons (Sections 9–12)

When Dr. Burggraff records videos for the remaining sections (_Necessity of Prayer, Stewardship and Service, Victory over Sin, Sharing the Faith_), follow the same pattern:

1. Identify which **manual subsection** the video covers.
2. Write a **2-4 sentence description** summarizing the subsection's key points (in the lesson's voice, not a direct quote from the manual).
3. Select **3-5 key verses** referenced in that specific subsection.
4. Update `gig-lessons.json` with the lesson object (`lesson_number`, `slug`, `title`, `youtube_video_id`, `youtube_url`).
5. Update `TOTAL_LESSONS` in `js/auth.js` to match the new count.
6. Update the `LESSON_TITLES` map in `js/admin.js`.
7. Add a new module block on `growing-in-grace-dashboard.html` (or expand an existing one).
8. Update the `section-card` block on `curriculum.html` to un-dim the now-published section.

### 🟢 Nice-to-have (non-content polish)

- [x] ~~**PDF handouts** — all 28 lessons include a downloadable two-page handout on both the lesson page and dashboard.~~
- [ ] **Endorsement quote for workbook** — italic pull-quote on workbook section (if workbook page is ever reinstated).

---

## 🌐 External dependencies

### 🔴 Blocking

- [x] ~~**Amazon URL — Growing in Grace workbook** — 3 locations (homepage flagship, about, curriculum) now wired to `https://www.amazon.com/dp/1959454110`.~~
- [x] ~~**YouTube channel URL** — footer links point to Shepherds Theological Seminary, and the homepage video CTA points to the Growing in Grace playlist.~~

### 🟡 Nice-to-have

- [x] ~~**Amazon URL — _Discipleship Today_ book** — homepage "Latest Resource" section now wired to `https://www.amazon.com/dp/195945403X`.~~
- [ ] **Amazon Associates affiliate tag** — URLs are currently canonical Amazon links WITHOUT affiliate tracking. Once an Amazon Associates account is set up, append `?tag=yourname-20` to all 4 occurrences:
  - `index.html` line ~315 (workbook)
  - `index.html` line ~437 (Discipleship Today)
  - `about.html` (workbook)
  - `curriculum.html` (workbook)
- [ ] **YouTube playlist ID** — referenced in `gig-lessons.json` meta. Not currently embedded anywhere since the `/videos` page was deleted, but if reinstated, swap placeholder into the playlist iframe.

---

## 🚀 Launch day checklist

Final verification once all blocking items are complete:

- [x] All 28 lessons have real content and no placeholder warning banners
- [ ] About page has real bio, headshot, credentials, quote
- [x] Homepage shows the local production hero image
- [x] Raster and SVG favicon assets resolve
- [x] OG image exists and public page metadata points to its absolute URL
- [ ] Sign up flow works end-to-end on the real domain
- [ ] Admin dashboard loads for admin users, redirects non-admins
- [ ] Mobile nav (all 26 pages) — hamburger opens, all links tappable, Sign In / Sign Out / Dashboard CTAs visible inside menu
- [ ] Lesson completion persists across sessions
- [ ] 404 page renders for invalid URLs (Netlify's `[[redirects]]` rule is configured)
- [x] robots.txt and sitemap.xml point at the live Netlify URL
- [ ] Google Search Console verification added (not covered in codebase — do this after DNS is live)

---

_This checklist is meant to be pruned as items complete. Last updated when the polish pass was committed._
