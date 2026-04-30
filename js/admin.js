/* ============================================
   Growing in Grace — Admin Queries
   Dr. Andrew T. Burggraff · Shepherds Press

   Renders two tables on admin.html:
   1. User list — email, name, signup, last active, completions
   2. Lesson completion stats — per-lesson completions + %

   Access control (defense in depth):
   - Client-side: initAdmin() checks profile.is_admin; redirects non-admins
   - Server-side: Supabase RLS policies gate admin SELECT queries
     (see supabase/migrations/001_initial_schema.sql)

   When new lessons are added to gig-lessons.json, the LESSON_TITLES
   map below MUST be updated to match. V2 could load from the JSON
   directly via fetch().
   ============================================ */

const LESSON_TITLES = {
  "lesson-01": "What Should Christian Life Look Like?",
  "lesson-02": "Sin: Origin, Reality, & Consequences",
  "lesson-03": "The Truth About What Really Saves You",
  "lesson-04": "What Repentance Actually Means",
  "lesson-05": "The Life-Changing Gift of Eternal Life",
  "lesson-06": "Can You Lose Your Salvation?",
  "lesson-07": "Does Grace Give You a License to Sin?",
  "lesson-08": "How Can God Be One… and Three?",
  "lesson-09": "The Unity and Distinction Within the Trinity",
  "lesson-10": "Jesus Explained: God in Human Form",
  "lesson-11": "Jesus Did This For You",
  "lesson-12": "3 Ways Your Life Should Change After Meeting Jesus",
  "lesson-13":
    "Who Is the Holy Spirit? (Most Misunderstood Person of the Trinity)",
  "lesson-14": "What Does the Holy Spirit Actually Do?",
  "lesson-15": "The Holy Spirit's Role in Your Spiritual Growth",
  "lesson-16": "Does Baptism Save You? The Truth from Scripture",
  "lesson-17": "The Who, How, and Why of Baptism",
  "lesson-18": "What the Bible Actually Does in Your Life",
  "lesson-19": "Doctrine, Reproof, Correction, Training—What It All Means",
  "lesson-20": "Learn to Study the Bible Like a Pro",
};

const PUBLISHED_LESSON_SLUGS = Object.keys(LESSON_TITLES);

// =============================================
// INIT
// =============================================

async function initAdmin() {
  // Show loading state
  _showAdminLoading();

  // Gate 1: must be authenticated
  const user = await requireAuth();
  if (!user) return;

  // Demo mode banner
  const sb = getSupabase();
  if (!sb) {
    _showAdminDemoBanner();
    return;
  }

  // Gate 2: must be admin
  const profile = await getProfile();
  if (!profile || !profile.is_admin) {
    // Silent redirect — non-admins shouldn't know the admin page exists
    window.location.href = "/growing-in-grace-dashboard.html";
    return;
  }

  // Load data in parallel
  const [profiles, progress] = await Promise.all([
    _fetchAllProfiles(sb),
    _fetchAllProgress(sb),
  ]);

  _renderUserList(profiles, progress);
  _renderCompletionStats(profiles, progress);
}

// =============================================
// QUERIES
// =============================================

async function _fetchAllProfiles(sb) {
  const { data, error } = await sb
    .from("profiles")
    .select("id, email, first_name, enrolled_at, last_active_at, is_admin")
    .order("enrolled_at", { ascending: false });

  if (error) {
    console.error("Admin: failed to fetch profiles", error);
    return [];
  }
  return data || [];
}

async function _fetchAllProgress(sb) {
  const { data, error } = await sb
    .from("lesson_progress")
    .select("user_id, lesson_slug, started_at, completed_at");

  if (error) {
    console.error("Admin: failed to fetch progress", error);
    return [];
  }
  return data || [];
}

// =============================================
// USER LIST TABLE
// =============================================

function _renderUserList(profiles, progress) {
  const tbody = document.getElementById("adminUserTableBody");
  const countEl = document.getElementById("adminUserCount");
  if (!tbody) return;

  if (countEl) countEl.textContent = profiles.length.toString();

  if (profiles.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="admin-empty">No users yet.</td></tr>';
    return;
  }

  // Build user_id -> completed count map
  const completedByUser = new Map();
  for (const row of progress) {
    if (row.completed_at) {
      completedByUser.set(
        row.user_id,
        (completedByUser.get(row.user_id) || 0) + 1,
      );
    }
  }

  const rows = profiles
    .map((p) => {
      const email = _escapeHtml(p.email || "—");
      const firstName = _escapeHtml(p.first_name || "—");
      const signedUp = _formatDate(p.enrolled_at);
      const lastActive = _formatDate(p.last_active_at);
      const completed = completedByUser.get(p.id) || 0;
      const adminBadge = p.is_admin
        ? ' <span class="admin-badge">admin</span>'
        : "";

      return (
        "<tr>" +
        '<td data-label="Email">' +
        email +
        adminBadge +
        "</td>" +
        '<td data-label="First Name">' +
        firstName +
        "</td>" +
        '<td data-label="Signed Up">' +
        signedUp +
        "</td>" +
        '<td data-label="Last Active">' +
        lastActive +
        "</td>" +
        '<td data-label="Lessons Complete"><strong>' +
        completed +
        "</strong> / " +
        PUBLISHED_LESSON_SLUGS.length +
        "</td>" +
        "</tr>"
      );
    })
    .join("");

  tbody.innerHTML = rows;
}

// =============================================
// LESSON COMPLETION STATS TABLE
// =============================================

function _renderCompletionStats(profiles, progress) {
  const tbody = document.getElementById("adminLessonTableBody");
  const lessonCountEl = document.getElementById("adminLessonCount");
  if (!tbody) return;

  if (lessonCountEl)
    lessonCountEl.textContent = PUBLISHED_LESSON_SLUGS.length.toString();

  const totalUsers = profiles.length;

  // Build slug -> distinct user count map (only rows with completed_at)
  const completedBySlug = new Map();
  for (const slug of PUBLISHED_LESSON_SLUGS) {
    completedBySlug.set(slug, new Set());
  }
  for (const row of progress) {
    if (row.completed_at && completedBySlug.has(row.lesson_slug)) {
      completedBySlug.get(row.lesson_slug).add(row.user_id);
    }
  }

  const rows = PUBLISHED_LESSON_SLUGS.map((slug) => {
    const title = _escapeHtml(LESSON_TITLES[slug] || "—");
    const completions = completedBySlug.get(slug).size;
    const percent =
      totalUsers > 0 ? Math.round((completions / totalUsers) * 100) : 0;
    const lessonNum = slug.replace("lesson-", "");

    return (
      "<tr>" +
      '<td data-label="Slug"><strong>' +
      _escapeHtml(slug) +
      "</strong></td>" +
      '<td class="admin-lesson-title" data-label="Title">' +
      title +
      "</td>" +
      '<td data-label="Completions">' +
      completions +
      "</td>" +
      '<td data-label="Completion %"><div class="admin-bar-wrap"><div class="admin-bar"><div class="admin-bar__fill" style="width: ' +
      percent +
      '%"></div></div><span class="admin-bar__label">' +
      percent +
      "%</span></div></td>" +
      "</tr>"
    );
  }).join("");

  tbody.innerHTML = rows;
}

// =============================================
// UI STATES
// =============================================

function _showAdminLoading() {
  const userTbody = document.getElementById("adminUserTableBody");
  const lessonTbody = document.getElementById("adminLessonTableBody");
  if (userTbody)
    userTbody.innerHTML =
      '<tr><td colspan="5" class="admin-empty">Loading users…</td></tr>';
  if (lessonTbody)
    lessonTbody.innerHTML =
      '<tr><td colspan="4" class="admin-empty">Loading lesson stats…</td></tr>';
}

function _showAdminDemoBanner() {
  const banner = document.getElementById("adminDemoBanner");
  if (banner) banner.style.display = "block";

  const userTbody = document.getElementById("adminUserTableBody");
  const lessonTbody = document.getElementById("adminLessonTableBody");
  if (userTbody)
    userTbody.innerHTML =
      '<tr><td colspan="5" class="admin-empty">Demo mode — no data.</td></tr>';
  if (lessonTbody)
    lessonTbody.innerHTML =
      '<tr><td colspan="4" class="admin-empty">Demo mode — no data.</td></tr>';
}

// =============================================
// UTILITIES
// =============================================

function _formatDate(isoString) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return "—";
  }
}

function _escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
