/* ============================================
   Growing in Grace - Private admin analytics
   ============================================ */

async function initAnalytics() {
  const user = await requireAuth();
  if (!user) return;

  const sb = getSupabase();
  if (!sb) {
    _showAnalyticsNotice("Analytics requires the live Supabase connection.");
    return;
  }

  const profile = await getProfile();
  if (!profile || !profile.is_admin) {
    window.location.href = "/growing-in-grace-dashboard.html";
    return;
  }

  const range = document.getElementById("analyticsRange");
  const refresh = document.getElementById("analyticsRefresh");
  range.addEventListener("change", () => _loadAnalytics(sb, Number(range.value)));
  refresh.addEventListener("click", () => _loadAnalytics(sb, Number(range.value)));
  await _loadAnalytics(sb, Number(range.value));
}

async function _loadAnalytics(sb, days) {
  const refresh = document.getElementById("analyticsRefresh");
  refresh.disabled = true;
  refresh.textContent = "Loading...";
  _showAnalyticsNotice("");

  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [eventsResult, profilesResult, progressResult] = await Promise.all([
    sb
      .from("analytics_events")
      .select("event_name,page_path,lesson_slug,session_id,referrer_host,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(10000),
    sb
      .from("profiles")
      .select("id,email,first_name,enrolled_at,last_active_at,is_admin")
      .order("enrolled_at", { ascending: false }),
    sb
      .from("lesson_progress")
      .select("user_id,completed_at"),
  ]);

  refresh.disabled = false;
  refresh.textContent = "Refresh";

  if (eventsResult.error) {
    _showAnalyticsNotice(
      eventsResult.error.code === "42P01"
        ? "Analytics storage is not installed yet. Run Supabase migration 003_admin_analytics.sql."
        : "Analytics could not be loaded. Please refresh or check Supabase.",
    );
    _renderAnalytics([], days, profilesResult.data || [], progressResult.data || []);
    return;
  }

  if (profilesResult.error || progressResult.error) {
    _showAnalyticsNotice("Account information could not be loaded. Please refresh or check Supabase.");
  }

  _renderAnalytics(
    eventsResult.data || [],
    days,
    profilesResult.data || [],
    progressResult.data || [],
  );
}

function _renderAnalytics(events, days, profiles, progress) {
  const count = (name) => events.filter((event) => event.event_name === name).length;
  const sessions = new Set(events.map((event) => event.session_id).filter(Boolean));
  const pageViews = count("page_view");
  const cutoff = Date.now() - days * 86400000;
  const signups = profiles.filter((profile) =>
    profile.enrolled_at && new Date(profile.enrolled_at).getTime() >= cutoff,
  ).length;

  _setMetric("metricVisitors", sessions.size);
  _setMetric("metricPageViews", pageViews);
  _setMetric("metricLessonViews", count("lesson_view"));
  _setMetric("metricDownloads", count("handout_download"));
  _setMetric("metricSignups", signups);
  _setMetric(
    "metricConversion",
    sessions.size
      ? `${Math.min(100, (signups / sessions.size) * 100).toFixed(1)}%`
      : "0%",
  );

  _renderDailyChart(events, days);
  _renderTopPages(events);
  _renderSources(events);
  _renderAccounts(profiles, progress);
  _renderLessonAnalytics(events);
}

function _renderAccounts(profiles, progress) {
  const tbody = document.getElementById("analyticsAccounts");
  const count = document.getElementById("analyticsAccountCount");
  if (count) count.textContent = profiles.length.toLocaleString();

  const completedByUser = new Map();
  progress.forEach((row) => {
    if (!row.completed_at) return;
    completedByUser.set(row.user_id, (completedByUser.get(row.user_id) || 0) + 1);
  });

  tbody.innerHTML = profiles.length
    ? profiles.slice(0, 25).map((profile) =>
        `<tr><td data-label="Email">${_escapeHtml(profile.email || "—")}` +
        `${profile.is_admin ? ' <span class="admin-badge">admin</span>' : ""}</td>` +
        `<td data-label="Name">${_escapeHtml(profile.first_name || "—")}</td>` +
        `<td data-label="Signed up">${_formatDate(profile.enrolled_at)}</td>` +
        `<td data-label="Last active">${_formatDate(profile.last_active_at)}</td>` +
        `<td data-label="Lessons complete"><strong>${completedByUser.get(profile.id) || 0}</strong> / ${PUBLISHED_LESSON_SLUGS.length}</td></tr>`,
      ).join("")
    : '<tr><td colspan="5" class="admin-empty">No accounts yet.</td></tr>';
}

function _renderDailyChart(events, days) {
  const chart = document.getElementById("analyticsChart");
  const visibleDays = Math.min(days, 30);
  const buckets = [];
  for (let offset = visibleDays - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    buckets.push({
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      views: 0,
    });
  }

  const byDate = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  events.forEach((event) => {
    if (!["page_view", "lesson_view"].includes(event.event_name)) return;
    const bucket = byDate.get(event.created_at.slice(0, 10));
    if (bucket) bucket.views += 1;
  });

  const max = Math.max(1, ...buckets.map((bucket) => bucket.views));
  chart.innerHTML = buckets.map((bucket) =>
    `<div class="analytics-chart__day" title="${_escapeHtml(bucket.label)}: ${bucket.views} views">` +
      `<span class="analytics-chart__value">${bucket.views || ""}</span>` +
      `<span class="analytics-chart__bar" style="height:${Math.max(2, (bucket.views / max) * 100)}%"></span>` +
      `<span class="analytics-chart__label">${_escapeHtml(bucket.label)}</span>` +
    `</div>`,
  ).join("");
}

function _renderTopPages(events) {
  const counts = new Map();
  events.filter((event) => event.event_name === "page_view").forEach((event) => {
    counts.set(event.page_path, (counts.get(event.page_path) || 0) + 1);
  });
  _renderCountTable("analyticsPages", counts, "Page", 10);
}

function _renderSources(events) {
  const sourceBySession = new Map();
  events.forEach((event) => {
    if (!event.session_id) return;
    const current = sourceBySession.get(event.session_id);
    if (!current || (current === "Direct / unknown" && event.referrer_host)) {
      sourceBySession.set(
        event.session_id,
        event.referrer_host || "Direct / unknown",
      );
    }
  });

  const sessionsBySource = new Map();
  sourceBySession.forEach((source, sessionId) => {
    if (!sessionsBySource.has(source)) sessionsBySource.set(source, new Set());
    sessionsBySource.get(source).add(sessionId);
  });
  const counts = new Map(
    [...sessionsBySource].map(([source, sessions]) => [source, sessions.size]),
  );
  _renderCountTable("analyticsSources", counts, "Source", 10);
}

function _renderLessonAnalytics(events) {
  const tbody = document.getElementById("analyticsLessons");
  const activity = new Map(PUBLISHED_LESSON_SLUGS.map((slug) => [slug, { views: 0, downloads: 0 }]));
  events.forEach((event) => {
    if (!event.lesson_slug || !activity.has(event.lesson_slug)) return;
    if (event.event_name === "lesson_view") activity.get(event.lesson_slug).views += 1;
    if (event.event_name === "handout_download") activity.get(event.lesson_slug).downloads += 1;
  });

  tbody.innerHTML = [...activity]
    .sort((a, b) => b[1].views - a[1].views || b[1].downloads - a[1].downloads)
    .map(([slug, metrics]) =>
      `<tr><td data-label="Lesson"><strong>${_escapeHtml(slug)}</strong></td>` +
      `<td class="admin-lesson-title" data-label="Title">${_escapeHtml(LESSON_TITLES[slug])}</td>` +
      `<td data-label="Views">${metrics.views}</td>` +
      `<td data-label="Downloads">${metrics.downloads}</td></tr>`,
    ).join("");
}

function _renderCountTable(id, counts, label, limit) {
  const tbody = document.getElementById(id);
  const rows = [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit);
  tbody.innerHTML = rows.length
    ? rows.map(([name, value]) =>
        `<tr><td data-label="${label}">${_escapeHtml(name)}</td>` +
        `<td data-label="Count"><strong>${value}</strong></td></tr>`,
      ).join("")
    : '<tr><td colspan="2" class="admin-empty">No activity in this period.</td></tr>';
}

function _setMetric(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = typeof value === "number" ? value.toLocaleString() : value;
}

function _showAnalyticsNotice(message) {
  const notice = document.getElementById("analyticsNotice");
  notice.hidden = !message;
  notice.textContent = message;
}
