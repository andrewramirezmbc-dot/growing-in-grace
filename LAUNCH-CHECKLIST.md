# Growing in Grace — Launch Checklist

Track of every remaining TODO before public launch. Items are grouped by owner. Each section flags **blocking** vs. **nice-to-have**.

---

## 🧑‍💻 Andrew (developer / operator)

### 🔴 Blocking — must complete before launch

- [ ] **Supabase credentials** — swap placeholders in `js/supabase-config.js` with real `SUPABASE_URL` and `SUPABASE_ANON_KEY` from your Supabase project Settings → API. Without this, auth falls back to localStorage demo mode.
- [ ] **Run migration** — paste `supabase/migrations/001_initial_schema.sql` into Supabase Studio SQL Editor and execute. Verify both `profiles` and `lesson_progress` tables exist with RLS enabled.
- [ ] **Set yourself as admin** — after your first signup, open Supabase Studio → Table Editor → `profiles` → your row → set `is_admin = true`. This is how you access `/admin.html`.
- [ ] **Netlify site setup** — create a new Netlify site connected to this GitHub repo. Set build to auto-deploy from `main`. No build command needed (publish dir = root).
- [ ] **Netlify environment variables** — if you prefer to inject Supabase credentials via env instead of committing them, adjust `js/supabase-config.js` to read from `window.ENV` and add a Netlify build plugin or snippet injection. _(V2 improvement — for v1, committing the anon key is acceptable since RLS is the real security layer.)_
- [ ] **Domain decision** — pick between `growingingrace.app` vs `growingingrace.org`, register, point DNS to Netlify. Current deploy URL: TBD.
- [ ] **Update sitemap.xml + robots.txt domain** — replace `https://growingingrace.org` placeholder URLs in `sitemap.xml` and the `Sitemap:` line in `robots.txt` with your real domain.

### 🟡 Blocking for polished launch

- [ ] **OG image** — create `/assets/og-image.jpg` (1200×630). Branded hero with "Growing in Grace" wordmark. Linked from all 4 public pages' `<meta property="og:image">`. Without it, link previews on Slack/Twitter/iMessage will fail to render.
- [ ] **Hero image download** — replace Unsplash hotlink on homepage. Download the photo currently at `https://images.unsplash.com/photo-1510797215324-95aa89f43c33` and save to `/assets/hero-bg.jpg`. Then update the CSS `.hero--home { background-image: url() }` rule in `css/style.css`. Hotlinking Unsplash in production is fragile.
- [ ] **Raster favicons** — SVG favicon works in modern browsers. Create `/favicon.ico` (16×16/32×32 multi-size) and `/apple-touch-icon.png` (180×180) for older browsers and iOS home-screen icons. Can generate from `favicon.svg` using a converter like RealFaviconGenerator.

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

### 🟡 Blocking for each lesson launched

Every lesson at `/lessons/lesson-XX.html` currently ships with placeholder content flagged by a visible lime warning banner:

> ⚠️ Placeholder content — final lesson materials will be provided by Dr. Burggraff

For each of the 20 lessons, provide:

- [ ] **Lesson 1** — What Should Christian Life Look Like?
- [ ] **Lesson 2** — Sin: Origin, Reality, & Consequences
- [ ] **Lesson 3** — The Truth About What REALLY Saves You
- [ ] **Lesson 4** — What Repentance ACTUALLY Means
- [ ] **Lesson 5** — The LIFE CHANGING Gift of Eternal Life
- [ ] **Lesson 6** — Can You Lose Your Salvation?
- [ ] **Lesson 7** — Does Grace Give You a License to Sin?
- [ ] **Lesson 8** — How Can God Be One… and Three?
- [ ] **Lesson 9** — The Unity and Distinction Within the Trinity
- [ ] **Lesson 10** — Jesus Explained: God in Human Form
- [ ] **Lesson 11** — Jesus Did This For You
- [ ] **Lesson 12** — 3 Ways Your Life Should Change After Meeting Jesus
- [ ] **Lesson 13** — Who Is the Holy Spirit?
- [ ] **Lesson 14** — What Does the Holy Spirit Actually Do?
- [ ] **Lesson 15** — The Holy Spirit's Role in Your Spiritual Growth
- [ ] **Lesson 16** — Does Baptism Save You?
- [ ] **Lesson 17** — The Who, How, and Why of Baptism
- [ ] **Lesson 18** — What the Bible Actually Does in Your Life
- [ ] **Lesson 19** — Doctrine, Reproof, Correction, Training
- [ ] **Lesson 20** — Learn to Study the Bible Like a Pro

For each lesson, four content blocks are needed:

- **Intro paragraph** — 2-3 sentences below the H1 (currently a generic placeholder)
- **Key Terms** — 3-5 term/definition pairs
- **Scripture Focus** — 3-5 scripture references (tags like "2 Peter 3:18", "John 3:16")
- **Discussion Questions** — 3-5 questions for group or individual study

Can be rolled out incrementally — strip the placeholder banner from each lesson as content is finalized.

### 🟢 Nice-to-have

- [ ] **PDF handouts** — 20 lesson PDFs that the "Download Lesson Handout (PDF)" button could link to. Currently stubbed with `alert('Handout coming soon.')`.
- [ ] **Endorsement quote for workbook** — italic pull-quote on workbook section (if workbook page is ever reinstated).

---

## 🌐 External dependencies

### 🔴 Blocking

- [ ] **Amazon affiliate URL — Growing in Grace workbook** — 3 stubs in codebase (`#` href): homepage flagship section, about page, curriculum page. Swap all to real URL.
- [ ] **YouTube channel URL** — 4 footer stubs across the site. Swap to real channel URL.

### 🟡 Nice-to-have

- [ ] **Amazon affiliate URL — _Discipleship Today_ book** — 1 stub on homepage "Latest Resource" section.
- [ ] **YouTube playlist ID** — referenced in `gig-lessons.json` meta. Not currently embedded anywhere since the `/videos` page was deleted, but if reinstated, swap placeholder into the playlist iframe.
- [ ] **Book cover image for _Discipleship Today_** — currently hotlinks to Amazon (`m.media-amazon.com`). Download to `/assets/discipleship-today-cover.jpg` for stability.

---

## 🚀 Launch day checklist

Final verification once all blocking items are complete:

- [ ] All 20 lessons have real content and no placeholder warning banners
- [ ] About page has real bio, headshot, credentials, quote
- [ ] Homepage shows real hero image (not Unsplash hotlink)
- [ ] Favicons render correctly on desktop Chrome, Safari, iOS home screen
- [ ] OG image renders correctly when a homepage/curriculum URL is shared in Slack or iMessage
- [ ] Sign up flow works end-to-end on the real domain
- [ ] Admin dashboard loads for admin users, redirects non-admins
- [ ] Mobile nav (all 26 pages) — hamburger opens, all links tappable, Sign In / Sign Out / Dashboard CTAs visible inside menu
- [ ] Lesson completion persists across sessions
- [ ] 404 page renders for invalid URLs (Netlify's `[[redirects]]` rule is configured)
- [ ] robots.txt and sitemap.xml point at the real domain (not the `growingingrace.org` placeholder)
- [ ] Google Search Console verification added (not covered in codebase — do this after DNS is live)

---

_This checklist is meant to be pruned as items complete. Last updated when the polish pass was committed._
