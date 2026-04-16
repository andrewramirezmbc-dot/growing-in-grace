# Growing in Grace

A discipleship platform for Dr. Andrew T. Burggraff, built around his curriculum _Growing in Grace: A Discipleship Manual for New Believers_ (Shepherds Press, 2025).

## Stack

- Plain HTML + CSS + vanilla JavaScript
- No build step, no bundler, no framework
- [Supabase](https://supabase.com) for authentication and progress tracking
- [Netlify](https://netlify.com) for hosting

## Local Development

1. Clone this repo
2. Copy `js/supabase-config.js.example` values into `js/supabase-config.js` (gitignored) with your Supabase credentials — or leave placeholders for demo mode
3. Open `index.html` in a browser, or use any local HTTP server:
   ```bash
   python3 -m http.server 8000
   ```
4. Visit `http://localhost:8000`

## Database Setup

See [SUPABASE-SETUP.md](SUPABASE-SETUP.md) for the full schema, RLS policies, and migration instructions.

## File Structure

```
growing-in-grace/
├── index.html                      Public homepage
├── about.html                      About Dr. Burggraff
├── articles.html                   Articles index
├── articles/                       Individual article pages
├── curriculum.html                 Curriculum overview
├── workbook.html                   Workbook → Amazon
├── videos.html                     YouTube video hub
├── growing-in-grace.html           Course landing + auth forms
├── growing-in-grace-dashboard.html Authenticated dashboard
├── lessons/
│   └── lesson-01.html ... lesson-20.html
├── admin.html                      Admin stats (is_admin only)
├── 404.html                        Not found
├── css/
│   └── style.css
├── js/
│   ├── supabase-config.js          Credentials (gitignored)
│   ├── auth.js                     Auth + progress + UI logic
│   └── admin.js                    Admin queries
├── images/
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── netlify.toml
├── SUPABASE-SETUP.md
└── README.md
```
