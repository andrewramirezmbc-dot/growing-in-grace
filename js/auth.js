/* ============================================
   Growing in Grace — Supabase Auth + Progress Module
   Dr. Andrew T. Burggraff · Shepherds Press
   ============================================ */

// --- Supabase Client Init ---
// Config loaded from supabase-config.js (must be included before this file)
let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;
  if (
    typeof SUPABASE_URL === "undefined" ||
    SUPABASE_URL.includes("YOUR-PROJECT")
  ) {
    console.warn(
      "Growing in Grace: Supabase not configured. Running in demo mode.",
    );
    return null;
  }
  _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _supabase;
}

// =============================================
// AUTH FUNCTIONS
// =============================================

/**
 * Get the current logged-in user. Returns null if not logged in.
 */
async function getCurrentUser() {
  const sb = getSupabase();
  if (!sb) return _getDemoUser();
  try {
    const {
      data: { user },
    } = await sb.auth.getUser();
    return user;
  } catch (e) {
    return null;
  }
}

/**
 * Sign up a new user with email + password.
 * first_name is stored in user_metadata and auto-copied to profiles table via DB trigger.
 */
async function signUp(email, password, firstName) {
  const sb = getSupabase();
  if (!sb) return { error: { message: "Supabase not configured." } };

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName },
    },
  });
  return { data, error };
}

/**
 * Sign in an existing user with email + password.
 */
async function signIn(email, password) {
  const sb = getSupabase();
  if (!sb) return { error: { message: "Supabase not configured." } };

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  return { data, error };
}

/**
 * Send a password reset email.
 */
async function resetPassword(email) {
  const sb = getSupabase();
  if (!sb) return { error: { message: "Supabase not configured." } };

  // Use current origin so it works on any deploy URL
  const { data, error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/growing-in-grace.html",
  });
  return { data, error };
}

/**
 * Update the user's password (used after clicking reset link).
 */
async function updatePassword(newPassword) {
  const sb = getSupabase();
  if (!sb) return { error: { message: "Supabase not configured." } };

  const { data, error } = await sb.auth.updateUser({ password: newPassword });
  return { data, error };
}

/**
 * Check if this is a password recovery redirect and show reset form.
 * Uses multiple strategies: onAuthStateChange + manual hash detection as fallback.
 * Returns a Promise that resolves to true if recovery mode, false otherwise.
 */
function checkPasswordRecovery() {
  return new Promise((resolve) => {
    // Check both hash and query params — Supabase may use either
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const fullUrl = window.location.href;

    const isRecovery =
      hash.includes("type=recovery") ||
      search.includes("type=recovery") ||
      fullUrl.includes("type=recovery");

    if (!isRecovery) {
      resolve(false);
      return;
    }

    const sb = getSupabase();
    if (!sb) {
      resolve(false);
      return;
    }

    // Strategy 1: Listen for Supabase PASSWORD_RECOVERY event
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // Strategy 2: Fallback — if event didn't fire but URL has recovery type,
        // show the reset form anyway (Supabase may have already processed tokens)
        console.log("Growing in Grace: Recovery timeout — using fallback");
        _showResetPasswordForm();
        setTimeout(() => {
          const card = document.querySelector(".signup-card");
          if (card)
            card.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 200);
        resolve(true);
      }
    }, 3000);

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          subscription.unsubscribe();
          _showResetPasswordForm();
          setTimeout(() => {
            const card = document.querySelector(".signup-card");
            if (card)
              card.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 200);
          resolve(true);
        }
      }
    });
  });
}

/**
 * Display the password reset form UI.
 */
function _showResetPasswordForm() {
  const signupForm = document.getElementById("signupForm");
  const signinForm = document.getElementById("signinForm");
  const authError = document.getElementById("authError");
  if (signupForm) signupForm.style.display = "none";
  if (signinForm) signinForm.style.display = "none";
  if (authError) authError.style.display = "none";

  if (document.getElementById("resetPasswordForm")) return;

  const form = document.createElement("form");
  form.id = "resetPasswordForm";
  form.className = "signup-form";
  form.innerHTML =
    "<h2>Set Your New Password</h2>" +
    '<p class="signup-form__intro">Enter your new password below.</p>' +
    '<div class="signup-form__group">' +
    '<label for="newPassword">New Password</label>' +
    '<input type="password" id="newPassword" placeholder="At least 6 characters" minlength="6" required>' +
    "</div>" +
    '<div class="signup-form__group">' +
    '<label for="confirmPassword">Confirm Password</label>' +
    '<input type="password" id="confirmPassword" placeholder="Re-enter your password" minlength="6" required>' +
    "</div>" +
    '<button type="submit" class="btn btn--primary btn--lg signup-form__btn">Update Password</button>';

  const card = document.querySelector(".signup-card");
  if (card) card.appendChild(form);

  _initPasswordToggles();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPass = document.getElementById("newPassword").value;
    const confirmPass = document.getElementById("confirmPassword").value;
    const btn = form.querySelector('button[type="submit"]');

    if (newPass.length < 6) {
      _showAuthError("Password must be at least 6 characters.");
      return;
    }
    if (newPass !== confirmPass) {
      _showAuthError("Passwords do not match.");
      return;
    }

    btn.textContent = "Updating...";
    btn.disabled = true;

    const { error } = await updatePassword(newPass);

    if (error) {
      btn.textContent = "Update Password";
      btn.disabled = false;
      _showAuthError(error.message);
    } else {
      form.innerHTML =
        "<h2>Password Updated!</h2>" +
        '<p class="signup-form__intro">Your password has been changed successfully.</p>' +
        '<a href="growing-in-grace-dashboard.html" class="btn btn--primary btn--lg signup-form__btn">Go to Dashboard &rarr;</a>';
      history.replaceState(null, "", window.location.pathname);
    }
  });
}

/**
 * Show a change password modal for already-logged-in users.
 * Called from the dashboard page.
 */
function showChangePasswordModal() {
  // Remove existing if any
  const existing = document.getElementById("changePasswordModal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "changePasswordModal";
  overlay.className = "email-popup-overlay";

  const popup = document.createElement("div");
  popup.className = "email-popup";
  popup.style.maxWidth = "420px";

  popup.innerHTML =
    '<h3 class="email-popup__title" style="margin-bottom: 0.5rem;">Change Password</h3>' +
    '<p class="email-popup__message" style="margin-bottom: 1.5rem;">Enter your new password below.</p>' +
    '<form id="changePasswordFormInner" style="width: 100%;">' +
    '<div class="signup-form__group" style="margin-bottom: 1rem;">' +
    '<label for="cpNewPassword" style="display:block; margin-bottom:0.25rem; font-weight:600; font-size:0.9rem;">New Password</label>' +
    '<input type="password" id="cpNewPassword" placeholder="At least 6 characters" minlength="6" required style="width:100%; padding:0.75rem; border:1px solid #ccc; border-radius:6px; font-size:1rem;">' +
    "</div>" +
    '<div class="signup-form__group" style="margin-bottom: 1rem;">' +
    '<label for="cpConfirmPassword" style="display:block; margin-bottom:0.25rem; font-weight:600; font-size:0.9rem;">Confirm Password</label>' +
    '<input type="password" id="cpConfirmPassword" placeholder="Re-enter your password" minlength="6" required style="width:100%; padding:0.75rem; border:1px solid #ccc; border-radius:6px; font-size:1rem;">' +
    "</div>" +
    '<div id="cpError" style="display:none; color:#c0392b; font-size:0.85rem; margin-bottom:0.75rem;"></div>' +
    '<button type="submit" class="btn btn--primary" style="width:100%; margin-bottom:0.5rem;">Update Password</button>' +
    "</form>" +
    '<button type="button" class="btn btn--outline email-popup__close" style="width:100%; margin-top:0.25rem;">Cancel</button>';

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  // Init password toggles for the new fields
  _initPasswordToggles();

  // Close handler
  popup
    .querySelector(".email-popup__close")
    .addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Submit handler
  document
    .getElementById("changePasswordFormInner")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const newPass = document.getElementById("cpNewPassword").value;
      const confirmPass = document.getElementById("cpConfirmPassword").value;
      const errEl = document.getElementById("cpError");
      const btn = e.target.querySelector('button[type="submit"]');

      errEl.style.display = "none";

      if (newPass.length < 6) {
        errEl.textContent = "Password must be at least 6 characters.";
        errEl.style.display = "block";
        return;
      }
      if (newPass !== confirmPass) {
        errEl.textContent = "Passwords do not match.";
        errEl.style.display = "block";
        return;
      }

      btn.textContent = "Updating...";
      btn.disabled = true;

      const { error } = await updatePassword(newPass);

      if (error) {
        btn.textContent = "Update Password";
        btn.disabled = false;
        errEl.textContent = error.message;
        errEl.style.display = "block";
      } else {
        popup.innerHTML =
          '<div style="text-align:center; padding: 1.5rem 0;">' +
          '<h3 class="email-popup__title">Password Updated!</h3>' +
          '<p class="email-popup__message">Your password has been changed successfully.</p>' +
          '<button type="button" class="btn btn--primary email-popup__close" style="margin-top:1rem;">Done</button>' +
          "</div>";
        popup
          .querySelector(".email-popup__close")
          .addEventListener("click", () => overlay.remove());
      }
    });
}

/**
 * Resend the sign-up confirmation email.
 */
async function resendConfirmation(email) {
  const sb = getSupabase();
  if (!sb) return { error: { message: "Supabase not configured." } };

  const { data, error } = await sb.auth.resend({
    type: "signup",
    email,
  });
  return { data, error };
}

/**
 * Sign out the current user.
 */
async function signOut() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
  window.location.href = _getBasePath() + "growing-in-grace.html";
}

/**
 * Redirect unenrolled/unauthenticated users to the signup page.
 * Call this at the top of protected pages (dashboard, lessons).
 */
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    const path = window.location.pathname;
    if (path.includes("/lessons/") || path.includes("\\lessons\\")) {
      window.location.href = "../growing-in-grace.html";
    } else {
      window.location.href = "growing-in-grace.html";
    }
  }
  return user;
}

// =============================================
// PROGRESS TRACKING
// =============================================

/**
 * Get all lesson progress for the current user.
 * Returns array of { lesson_slug, started_at, completed_at }
 */
async function getProgress() {
  const sb = getSupabase();
  if (!sb) return _getDemoProgress();

  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await sb
    .from("lesson_progress")
    .select("lesson_slug, started_at, completed_at")
    .eq("user_id", user.id);

  return error ? [] : data;
}

/**
 * Get the user's profile (first_name, last_lesson, enrolled_at).
 */
async function getProfile() {
  const sb = getSupabase();
  if (!sb) {
    const demoName = localStorage.getItem("gig_name") || "Friend";
    return { first_name: demoName, last_lesson: null, enrolled_at: null };
  }

  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await sb
    .from("profiles")
    .select("first_name, last_lesson, enrolled_at")
    .eq("id", user.id)
    .single();

  return error ? null : data;
}

/**
 * Record that a lesson was started (opened).
 * If already started, does nothing (UPSERT on conflict).
 */
async function recordLessonStart(lessonSlug) {
  const sb = getSupabase();
  if (!sb) return;

  const user = await getCurrentUser();
  if (!user) return;

  // Upsert — insert if new, do nothing if exists
  await sb.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_slug: lessonSlug,
      started_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_slug", ignoreDuplicates: true },
  );

  // Update last_lesson and last_active_at in profile
  await sb
    .from("profiles")
    .update({
      last_lesson: lessonSlug,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", user.id);
}

/**
 * Mark a lesson as completed.
 */
async function markLessonComplete(lessonSlug) {
  const sb = getSupabase();
  if (!sb) return;

  const user = await getCurrentUser();
  if (!user) return;

  await sb.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_slug: lessonSlug,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_slug" },
  );
}

/**
 * Check if a specific lesson is completed.
 */
async function isLessonComplete(lessonSlug) {
  const progress = await getProgress();
  const lesson = progress.find((p) => p.lesson_slug === lessonSlug);
  return lesson ? !!lesson.completed_at : false;
}

// =============================================
// DEMO MODE (when Supabase isn't configured yet)
// =============================================

function _getDemoUser() {
  try {
    return localStorage.getItem("gig_enrolled") === "true"
      ? { id: "demo", email: "demo@example.com" }
      : null;
  } catch (e) {
    return null;
  }
}

function _getDemoProgress() {
  try {
    const raw = localStorage.getItem("gig_progress");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function _saveDemoProgress(lessonSlug, completed) {
  try {
    const progress = _getDemoProgress();
    const existing = progress.find((p) => p.lesson_slug === lessonSlug);
    if (existing) {
      if (completed) existing.completed_at = new Date().toISOString();
    } else {
      progress.push({
        lesson_slug: lessonSlug,
        started_at: new Date().toISOString(),
        completed_at: completed ? new Date().toISOString() : null,
      });
    }
    localStorage.setItem("gig_progress", JSON.stringify(progress));
  } catch (e) {}
}

// =============================================
// UI HELPERS
// =============================================

/**
 * Get the base path for redirects (handles /lessons/ subdirectory).
 */
function _getBasePath() {
  const path = window.location.pathname;
  return path.includes("/lessons/") || path.includes("\\lessons\\")
    ? "../"
    : "";
}

/**
 * Initialize the sign-up / sign-in form on growing-in-grace.html.
 */
function initAuthForm() {
  const signupForm = document.getElementById("signupForm");
  const signinForm = document.getElementById("signinForm");
  const toggleToSignin = document.getElementById("toggleToSignin");
  const toggleToSignup = document.getElementById("toggleToSignup");
  const authError = document.getElementById("authError");

  if (!signupForm) return;

  // Initialize password visibility toggles
  _initPasswordToggles();

  // Toggle between sign-up and sign-in
  if (toggleToSignin) {
    toggleToSignin.addEventListener("click", (e) => {
      e.preventDefault();
      signupForm.style.display = "none";
      signinForm.style.display = "block";
      if (authError) authError.style.display = "none";
    });
  }
  if (toggleToSignup) {
    toggleToSignup.addEventListener("click", (e) => {
      e.preventDefault();
      signinForm.style.display = "none";
      signupForm.style.display = "block";
      if (authError) authError.style.display = "none";
    });
  }

  // Sign Up handler
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = signupForm.querySelector('button[type="submit"]');
    const name = signupForm.querySelector("#signupName").value.trim();
    const email = signupForm.querySelector("#signupEmail").value.trim();
    const password = signupForm.querySelector("#signupPassword").value;

    if (!name || !email || !password) {
      _showAuthError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      _showAuthError("Password must be at least 6 characters.");
      return;
    }

    btn.textContent = "Creating account...";
    btn.disabled = true;

    const sb = getSupabase();
    if (!sb) {
      // Demo mode fallback
      try {
        localStorage.setItem("gig_enrolled", "true");
        localStorage.setItem("gig_name", name);
      } catch (e) {}
      window.location.href = "growing-in-grace-dashboard.html";
      return;
    }

    const { data, error } = await signUp(email, password, name);

    if (error) {
      btn.textContent = "Start Learning →";
      btn.disabled = false;
      _showAuthError(error.message);
      return;
    }

    // If email confirmation is disabled, user is logged in immediately
    if (data.session) {
      window.location.href = "growing-in-grace-dashboard.html";
    } else {
      // Email confirmation required — show popup
      _showEmailSentPopup(email);
    }
  });

  // Sign In handler
  if (signinForm) {
    signinForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = signinForm.querySelector('button[type="submit"]');
      const email = signinForm.querySelector("#signinEmail").value.trim();
      const password = signinForm.querySelector("#signinPassword").value;

      if (!email || !password) {
        _showAuthError("Please fill in all fields.");
        return;
      }

      btn.textContent = "Signing in...";
      btn.disabled = true;

      const { data, error } = await signIn(email, password);

      if (error) {
        btn.textContent = "Sign In →";
        btn.disabled = false;
        _showAuthError(error.message);
        return;
      }

      window.location.href = "growing-in-grace-dashboard.html";
    });
  }

  // Forgot Password handler
  const forgotLink = document.getElementById("forgotPassword");
  if (forgotLink) {
    forgotLink.addEventListener("click", async (e) => {
      e.preventDefault();
      const emailInput = signinForm.querySelector("#signinEmail");
      const email = emailInput ? emailInput.value.trim() : "";

      if (!email) {
        _showAuthError(
          'Please enter your email address first, then click "Forgot password?"',
        );
        return;
      }

      forgotLink.textContent = "Sending...";

      const { error } = await resetPassword(email);

      if (error) {
        forgotLink.textContent = "Forgot password?";
        _showAuthError(error.message);
      } else {
        forgotLink.textContent = "Forgot password?";
        _showAuthError("Password reset link sent! Check your email.", true);
      }
    });
  }
}

function _showAuthError(message, isInfo) {
  const el = document.getElementById("authError");
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
  el.className = isInfo
    ? "auth-message auth-message--info"
    : "auth-message auth-message--error";
}

/**
 * Add show/hide toggle buttons to all password fields.
 */
function _initPasswordToggles() {
  document.querySelectorAll('input[type="password"]').forEach((input) => {
    const wrapper = document.createElement("div");
    wrapper.className = "password-wrapper";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "password-toggle";
    toggle.setAttribute("aria-label", "Show password");
    toggle.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    wrapper.appendChild(toggle);

    toggle.addEventListener("click", () => {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      toggle.setAttribute(
        "aria-label",
        isPassword ? "Hide password" : "Show password",
      );
      toggle.innerHTML = isPassword
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    });
  });
}

/**
 * Show the "Email Sent" popup with a "Send Again" button.
 */
function _showEmailSentPopup(email) {
  // Remove existing popup if any
  const existing = document.getElementById("emailSentPopup");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "emailSentPopup";
  overlay.className = "email-popup-overlay";

  const popup = document.createElement("div");
  popup.className = "email-popup";

  const icon = document.createElement("div");
  icon.className = "email-popup__icon";
  icon.innerHTML =
    '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--brand-teal, #199FA2)" stroke-width="2"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  const title = document.createElement("h3");
  title.className = "email-popup__title";
  title.textContent = "Email Sent!";

  const msg = document.createElement("p");
  msg.className = "email-popup__message";
  msg.textContent =
    "We sent a confirmation link to " +
    email +
    ". Check your inbox and click the link to access the course.";

  const sendAgain = document.createElement("button");
  sendAgain.type = "button";
  sendAgain.className = "btn btn--outline email-popup__resend";
  sendAgain.textContent = "Send Again";
  sendAgain.addEventListener("click", async () => {
    sendAgain.textContent = "Sending...";
    sendAgain.disabled = true;
    const { error } = await resendConfirmation(email);
    if (error) {
      sendAgain.textContent = "Send Again";
      sendAgain.disabled = false;
      msg.textContent = error.message;
    } else {
      sendAgain.textContent = "Sent!";
      setTimeout(() => {
        sendAgain.textContent = "Send Again";
        sendAgain.disabled = false;
      }, 3000);
    }
  });

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "btn btn--primary email-popup__close";
  closeBtn.textContent = "Got it";
  closeBtn.addEventListener("click", () => overlay.remove());

  popup.appendChild(icon);
  popup.appendChild(title);
  popup.appendChild(msg);
  popup.appendChild(sendAgain);
  popup.appendChild(closeBtn);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
}

/**
 * Initialize the dashboard page — load progress and render.
 */
async function initDashboard() {
  const user = await requireAuth();
  if (!user) return;

  const profile = await getProfile();
  const progress = await getProgress();

  // Set welcome name
  const welcomeEl = document.getElementById("welcomeName");
  if (welcomeEl && profile) {
    welcomeEl.textContent = profile.first_name || "Friend";
  }

  // TOTAL_LESSONS: must match the count of published lessons in
  // gig-lessons.json. Update both files together when adding new
  // lessons. V2 could derive this programmatically.
  const TOTAL_LESSONS = 20;
  const completed = progress.filter((p) => p.completed_at).length;
  const percent = Math.round((completed / TOTAL_LESSONS) * 100);

  // Render progress bar
  const progressBar = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  if (progressBar) progressBar.style.width = percent + "%";
  if (progressText)
    progressText.textContent =
      completed + " of " + TOTAL_LESSONS + " lessons complete";

  // Mark completed lessons
  const completedSlugs = new Set(
    progress.filter((p) => p.completed_at).map((p) => p.lesson_slug),
  );
  const startedSlugs = new Set(progress.map((p) => p.lesson_slug));

  document.querySelectorAll(".lesson-item").forEach((item) => {
    const href = item.getAttribute("href") || "";
    const slug = _slugFromHref(href);
    if (completedSlugs.has(slug)) {
      item.classList.add("is-completed");
    } else if (startedSlugs.has(slug)) {
      item.classList.add("is-started");
    }
  });

  // Continue where you left off
  const continueBtn = document.getElementById("continueBtn");
  if (continueBtn && profile && profile.last_lesson) {
    const href = _hrefFromSlug(profile.last_lesson);
    continueBtn.href = href;
    continueBtn.style.display = "inline-flex";
  }

  // Show email in account settings
  const emailEl = document.getElementById("accountEmail");
  if (emailEl && user) {
    emailEl.textContent = user.email;
  }

  // Update nav for logged-in state
  _updateNavAuth(user, profile);
}

/**
 * Initialize a lesson page — record start, show completion state.
 */
async function initLessonPage(lessonSlug) {
  const user = await requireAuth();
  if (!user) return;

  // Record lesson start
  const sb = getSupabase();
  if (sb) {
    await recordLessonStart(lessonSlug);
  } else {
    _saveDemoProgress(lessonSlug, false);
  }

  // Check if already completed
  const completed = await isLessonComplete(lessonSlug);
  const completeBtn = document.getElementById("markCompleteBtn");

  if (completeBtn) {
    if (completed) {
      completeBtn.textContent = "✓ Completed";
      completeBtn.classList.add("is-completed");
      completeBtn.disabled = true;
    } else {
      completeBtn.addEventListener("click", async () => {
        completeBtn.textContent = "Saving...";
        completeBtn.disabled = true;

        if (sb) {
          await markLessonComplete(lessonSlug);
        } else {
          _saveDemoProgress(lessonSlug, true);
        }

        completeBtn.textContent = "✓ Completed";
        completeBtn.classList.add("is-completed");
      });
    }
  }

  // Update nav for logged-in state
  const profile = await getProfile();
  _updateNavAuth(user, profile);
}

/**
 * Update the navigation bar to show logged-in state.
 * Homepage: shows "Sign In" for guests, "My Dashboard" for logged-in users
 * Other pages: shows "Dashboard →" for logged-in users
 */
function _updateNavAuth(user, profile) {
  const basePath = _getBasePath();

  // Pages with multiple CTA buttons (homepage, growing-in-grace.html)
  const signinBtn = document.querySelector(".nav__cta--signin");
  const dashboardBtn = document.querySelector(".nav__cta--dashboard");

  if (signinBtn || dashboardBtn) {
    if (user) {
      // Logged in: show "My Dashboard", hide "Sign In"
      if (signinBtn) signinBtn.style.display = "none";
      if (dashboardBtn) {
        dashboardBtn.style.display = "";
        dashboardBtn.href = basePath + "growing-in-grace-dashboard.html";
      }
    } else {
      // Guest: show "Sign In", hide "My Dashboard"
      if (signinBtn) signinBtn.style.display = "";
      if (dashboardBtn) dashboardBtn.style.display = "none";
    }
    return;
  }

  // Single CTA (lesson pages, dashboard)
  const navCta = document.querySelector(".nav__cta");
  if (navCta && user) {
    navCta.textContent = "Dashboard →";
    navCta.href = basePath + "growing-in-grace-dashboard.html";
  }
}

// =============================================
// UTILITY
// =============================================

function _slugFromHref(href) {
  // "/lessons/lesson-01" → "lesson-01"  (Netlify pretty URLs on dashboard)
  // "lessons/lesson-01.html" → "lesson-01"  (lesson-page refs)
  const match = href.match(/(?:lessons\/)?([^/.]+?)(?:\.html)?$/);
  return match ? match[1] : "";
}

// Returns .html paths — Netlify resolves both /lessons/lesson-01
// and /lessons/lesson-01.html, so this works with or without .html.
function _hrefFromSlug(slug) {
  return "lessons/" + slug + ".html";
}

// =============================================
// UI FEATURES (non-auth)
// =============================================

/**
 * Toggle mobile navigation menu.
 */
function initMobileNav() {
  const hamburger = document.querySelector(".nav__hamburger");
  const links = document.querySelector(".nav__links");
  if (hamburger && links && !hamburger._mobileNavBound) {
    hamburger._mobileNavBound = true;
    hamburger.addEventListener("click", () => {
      links.classList.toggle("is-open");
    });
    // Close menu when a link is tapped
    links.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        links.classList.remove("is-open");
      });
    });
  }
}

/**
 * Toggle module accordion sections.
 */
function initModuleAccordions() {
  document.querySelectorAll(".module__header").forEach((header) => {
    header.addEventListener("click", () => {
      const module = header.closest(".module");
      module.classList.toggle("is-open");
    });
  });
}

// Auto-init common features when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  initModuleAccordions();
});
