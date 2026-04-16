# Growing in Grace — Supabase Schema Documentation

## Overview

Growing in Grace uses Supabase for two things:

1. **Authentication** — email/password signup and signin
2. **Progress tracking** — recording which lessons each user has started and completed

All database queries run from the browser via the Supabase JS client and the anon key. **Row Level Security (RLS) is the only thing protecting data.** Never rely on hiding fields in client code.

## Tables

### `profiles`

Extends `auth.users` with application-specific fields. One row per user, auto-created by the `handle_new_user()` trigger on signup.

| Column           | Type        | Default | Description                                                  |
| ---------------- | ----------- | ------- | ------------------------------------------------------------ |
| `id`             | UUID (PK)   | —       | References `auth.users(id)`, cascade delete                  |
| `email`          | TEXT        | —       | Denormalized from auth for admin query performance           |
| `first_name`     | TEXT        | `''`    | From signup metadata (`raw_user_meta_data.first_name`)       |
| `is_admin`       | BOOLEAN     | `false` | Toggle manually in Supabase Studio                           |
| `enrolled_at`    | TIMESTAMPTZ | `now()` | When the user signed up                                      |
| `last_lesson`    | TEXT        | `NULL`  | Slug of the most recently visited lesson (e.g., `lesson-05`) |
| `last_active_at` | TIMESTAMPTZ | `now()` | Updated on each `recordLessonStart()` call                   |

### `lesson_progress`

One row per user per lesson. Tracks start and completion timestamps.

| Column         | Type        | Default             | Description                               |
| -------------- | ----------- | ------------------- | ----------------------------------------- |
| `id`           | UUID (PK)   | `gen_random_uuid()` | Auto-generated                            |
| `user_id`      | UUID (FK)   | —                   | References `profiles(id)`, cascade delete |
| `lesson_slug`  | TEXT        | —                   | e.g., `lesson-01`, `lesson-20`            |
| `started_at`   | TIMESTAMPTZ | `now()`             | When user first opened the lesson         |
| `completed_at` | TIMESTAMPTZ | `NULL`              | When user clicked "Mark Complete"         |

**Unique constraint:** `(user_id, lesson_slug)` — enables upsert on lesson start.

**Indexes:**

- `idx_lesson_progress_user` on `(user_id)` — fast per-user progress lookups
- `idx_lesson_progress_slug` on `(user_id, lesson_slug)` — fast single-lesson checks

## RLS Policies

### Profiles (6 policies)

| Policy                             | Operation | Rule                                 |
| ---------------------------------- | --------- | ------------------------------------ |
| Users can view their own profile   | SELECT    | `auth.uid() = id`                    |
| Users can update their own profile | UPDATE    | `auth.uid() = id`                    |
| Users can insert their own profile | INSERT    | `auth.uid() = id`                    |
| Admins can view all profiles       | SELECT    | Subquery: caller's `is_admin = true` |

### Lesson Progress (4 policies)

| Policy                              | Operation | Rule                                 |
| ----------------------------------- | --------- | ------------------------------------ |
| Users can view their own progress   | SELECT    | `auth.uid() = user_id`               |
| Users can insert their own progress | INSERT    | `auth.uid() = user_id`               |
| Users can update their own progress | UPDATE    | `auth.uid() = user_id`               |
| Admins can view all progress        | SELECT    | Subquery: caller's `is_admin = true` |

**Admin subquery pattern:** Both admin policies check `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)`. This runs against the `profiles` table itself, which works correctly with Supabase RLS. Admin role changes take effect on the next query.

## Trigger: `handle_new_user()`

Fires `AFTER INSERT ON auth.users`. Creates a `profiles` row with:

- `id` = the new auth user's UUID
- `email` = the new auth user's email
- `first_name` = extracted from `raw_user_meta_data->>'first_name'` (set during signup)

Runs as `SECURITY DEFINER` so it can insert into `profiles` regardless of RLS.

## Admin Access

There is no admin invite UI. To make a user an admin:

1. Open Supabase Studio → Table Editor → `profiles`
2. Find the user's row
3. Set `is_admin` to `true`
4. Save

Admin status is checked client-side in `admin.html` (redirect if not admin) and enforced server-side by RLS policies (admin SELECT policies on both tables).

## Demo Mode

When `SUPABASE_URL` contains the string `YOUR-PROJECT`, `auth.js` skips all Supabase calls and falls back to localStorage with these keys:

- `gig_enrolled` — whether the user has "signed up"
- `gig_progress` — JSON array of progress objects
- `gig_name` — user's first name

This allows local development and testing without a Supabase project configured.

## Running the Migration

1. Create a new Supabase project
2. Go to SQL Editor in Supabase Studio
3. Paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Run the query
5. Verify: Table Editor should show `profiles` and `lesson_progress` tables with RLS enabled
6. Copy your Project URL and anon key from Settings → API
7. Update your local `js/supabase-config.js` with the real values
