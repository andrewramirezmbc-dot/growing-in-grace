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
      "The Growing Disciple: Supabase not configured. Running in demo mode.",
    );
    return null;
  }
  _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _supabase;
}

// =============================================
// PRIVACY-CONSCIOUS ANALYTICS
// =============================================

function _analyticsSessionId() {
  const key = "gig_analytics_session";
  try {
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID();
      sessionStorage.setItem(key, value);
    }
    return value;
  } catch (_) {
    return crypto.randomUUID();
  }
}

function _analyticsLessonSlug() {
  const match = window.location.pathname.match(/\/(lesson-\d{2})(?:\.html)?$/);
  return match ? match[1] : null;
}

function _analyticsReferrerHost() {
  if (!document.referrer) return null;
  try {
    const host = new URL(document.referrer).hostname;
    return host === window.location.hostname ? null : host;
  } catch (_) {
    return null;
  }
}

async function trackAnalyticsEvent(eventName, overrides = {}) {
  if (
    window.location.protocol !== "https:" ||
    ["/admin.html", "/analytics.html"].includes(window.location.pathname)
  ) {
    return;
  }

  const sb = getSupabase();
  if (!sb) return;

  try {
    await sb.rpc("track_analytics_event", {
      p_event_name: eventName,
      p_page_path: window.location.pathname.slice(0, 300) || "/",
      p_lesson_slug: overrides.lessonSlug ?? _analyticsLessonSlug(),
      p_session_id: _analyticsSessionId(),
      p_referrer_host: _analyticsReferrerHost(),
    });
  } catch (_) {
    // Analytics must never interrupt navigation, authentication, or lessons.
  }
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
  if (!error) trackAnalyticsEvent("signup_complete");
  return { data, error };
}

/**
 * Sign in an existing user with email + password.
 */
async function signIn(email, password) {
  const sb = getSupabase();
  if (!sb) return { error: { message: "Supabase not configured." } };

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (!error) trackAnalyticsEvent("signin_complete");
  return { data, error };
}

/**
 * Complete Google Identity Services sign-in with Supabase.
 */
async function signInWithGoogleIdToken(token, nonce) {
  const sb = getSupabase();
  if (!sb) return { error: { message: "Supabase not configured." } };

  const { data, error } = await sb.auth.signInWithIdToken({
    provider: "google",
    token,
    nonce,
  });
  if (!error) trackAnalyticsEvent("signin_complete");
  return { data, error };
}

let _googleNonce = null;

function _waitForGoogleIdentity() {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (window.google?.accounts?.id) {
        resolve(window.google.accounts.id);
        return;
      }
      if (Date.now() - startedAt > 10000) {
        reject(new Error("Google sign-in could not be loaded. Please try again."));
        return;
      }
      window.setTimeout(check, 100);
    };
    check();
  });
}

async function _createGoogleNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = btoa(String.fromCharCode(...bytes));
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(nonce),
  );
  const hashedNonce = Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return { nonce, hashedNonce };
}

async function _initGoogleSignIn() {
  const hosts = Array.from(document.querySelectorAll("[data-google-signin]"));
  if (!hosts.length) return;

  try {
    if (typeof GOOGLE_CLIENT_ID === "undefined" || !GOOGLE_CLIENT_ID) {
      throw new Error("Google sign-in is not configured.");
    }

    const googleIdentity = await _waitForGoogleIdentity();
    const noncePair = await _createGoogleNonce();
    _googleNonce = noncePair.nonce;

    googleIdentity.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce: noncePair.hashedNonce,
      ux_mode: "popup",
      callback: async (response) => {
        hosts.forEach((host) => host.setAttribute("aria-busy", "true"));
        const { error } = await signInWithGoogleIdToken(
          response.credential,
          _googleNonce,
        );

        if (error) {
          hosts.forEach((host) => host.removeAttribute("aria-busy"));
          _showAuthError(error.message);
          return;
        }

        window.location.href =
          window.location.origin + "/growing-in-grace-dashboard.html";
      },
    });

    const visibleHost = hosts.find((host) => host.getBoundingClientRect().width);
    const buttonWidth = Math.min(
      400,
      Math.floor(visibleHost?.getBoundingClientRect().width || 400),
    );

    hosts.forEach((host) => {
      googleIdentity.renderButton(host, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: buttonWidth,
      });
    });
  } catch (error) {
    hosts.forEach((host) => {
      host.innerHTML =
        '<p class="google-signin-error">Google sign-in is temporarily unavailable.</p>';
    });
    console.error("The Growing Disciple Google sign-in:", error);
  }
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
 * Get the user's profile (first_name, last_lesson, enrolled_at, is_admin).
 * is_admin defaults to false in demo mode.
 */
async function getProfile() {
  const sb = getSupabase();
  if (!sb) {
    const demoName = localStorage.getItem("gig_name") || "Friend";
    return {
      first_name: demoName,
      last_lesson: null,
      enrolled_at: null,
      is_admin: false,
    };
  }

  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await sb
    .from("profiles")
    .select("first_name, last_lesson, enrolled_at, is_admin")
    .eq("id", user.id)
    .single();

  if (error) return null;

  if (data && !data.first_name) {
    const firstName = _firstNameFromUser(user);
    if (firstName !== "Friend") {
      const { error: updateError } = await sb
        .from("profiles")
        .update({ first_name: firstName })
        .eq("id", user.id);
      if (!updateError) data.first_name = firstName;
    }
  }

  return data;
}

function _firstNameFromUser(user) {
  const metadata = (user && user.user_metadata) || {};
  const explicitName = metadata.first_name || metadata.given_name;
  if (explicitName && explicitName.trim()) return explicitName.trim();

  const fullName = metadata.full_name || metadata.name || "";
  return fullName.trim().split(/\s+/)[0] || "Friend";
}

async function _ensureProfile(user) {
  const sb = getSupabase();
  if (!sb || !user) return;

  const { data: existing, error: selectError } = await sb
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  _throwSupabaseError("Profile lookup failed", selectError);
  if (existing) return;

  const firstName = _firstNameFromUser(user);
  const { error: insertError } = await sb.from("profiles").insert({
    id: user.id,
    email: user.email || "",
    first_name: firstName,
  });

  _throwSupabaseError("Profile creation failed", insertError);
}

function _throwSupabaseError(context, error) {
  if (!error) return;
  const message = error.message || error.details || JSON.stringify(error);
  throw new Error(context + ": " + message);
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

  const startedAt = new Date().toISOString();
  const { error: insertError } = await sb.from("lesson_progress").insert({
    user_id: user.id,
    lesson_slug: lessonSlug,
    started_at: startedAt,
  });

  if (insertError && insertError.code !== "23505") {
    _throwSupabaseError("Lesson progress start insert failed", insertError);
  }

  if (insertError && insertError.code === "23505") {
    const { error: updateError } = await sb
      .from("lesson_progress")
      .update({ started_at: startedAt })
      .eq("user_id", user.id)
      .eq("lesson_slug", lessonSlug);

    _throwSupabaseError("Lesson progress start update failed", updateError);
  }

  // Update last_lesson and last_active_at in profile
  await sb
    .from("profiles")
    .update({
      last_lesson: lessonSlug,
      last_active_at: startedAt,
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

  const completedAt = new Date().toISOString();
  const { error: insertError } = await sb.from("lesson_progress").insert({
    user_id: user.id,
    lesson_slug: lessonSlug,
    started_at: completedAt,
    completed_at: completedAt,
  });

  if (insertError && insertError.code !== "23505") {
    _throwSupabaseError("Lesson completion insert failed", insertError);
  }

  if (insertError && insertError.code === "23505") {
    const { error: updateError } = await sb
      .from("lesson_progress")
      .update({ completed_at: completedAt })
      .eq("user_id", user.id)
      .eq("lesson_slug", lessonSlug);

    _throwSupabaseError("Lesson completion update failed", updateError);
  }

  await sb
    .from("profiles")
    .update({
      last_lesson: lessonSlug,
      last_active_at: completedAt,
    })
    .eq("id", user.id);
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

  _initGoogleSignIn();

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
  el.textContent = _friendlyAuthMessage(message);
  el.style.display = "block";
  el.className = isInfo
    ? "auth-message auth-message--info"
    : "auth-message auth-message--error";
}

function _friendlyAuthMessage(message) {
  if (!message) return "Something went wrong. Please try again.";
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Could not reach the authentication server. Check that js/supabase-config.js has the current Supabase Project URL and anon key.";
  }
  return message;
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

  // Update last_active_at on dashboard load so the admin "Last active"
  // column captures dashboard visits too, not just lesson starts.
  const sb = getSupabase();
  if (sb && user) {
    sb.from("profiles")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", user.id)
      .then(() => {});
  }

  // Reveal the Admin link in the nav only if the user is an admin.
  // Security note: this is UI discoverability only. RLS policies enforce
  // actual admin access at the database layer. Non-admins never see the
  // link even briefly because the HTML ships with style="display:none".
  if (profile && profile.is_admin) {
    const adminLink = document.getElementById("adminNavLink");
    if (adminLink) adminLink.style.display = "";
  }

  // Set welcome name
  const welcomeEl = document.getElementById("welcomeName");
  if (welcomeEl && profile) {
    welcomeEl.textContent = profile.first_name || "Friend";
  }

  // TOTAL_LESSONS: must match the count of published lessons in
  // gig-lessons.json. Update both files together when adding new
  // lessons. V2 could derive this programmatically.
  const TOTAL_LESSONS = 28;
  const completed = progress.filter((p) => p.completed_at).length;
  const percent = Math.round((completed / TOTAL_LESSONS) * 100);

  // Render progress bar
  const progressBar = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  const progressPercent = document.getElementById("progressPercent");
  if (progressBar) progressBar.style.width = percent + "%";
  if (progressPercent) progressPercent.textContent = percent + "%";
  if (progressText)
    progressText.textContent =
      completed +
      " of " +
      TOTAL_LESSONS +
      " lessons complete";

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

  _addDashboardHandoutLinks();

  // Keep the progress card and CTA aligned with the learner's actual state.
  const lessonItems = Array.from(document.querySelectorAll(".lesson-item"));
  const lastLessonItem =
    profile && profile.last_lesson
      ? lessonItems.find(
          (item) =>
            _slugFromHref(item.getAttribute("href") || "") ===
            profile.last_lesson,
        )
      : null;
  const nextIncompleteItem = lessonItems.find(
    (item) =>
      !completedSlugs.has(_slugFromHref(item.getAttribute("href") || "")),
  );
  const targetItem =
    lastLessonItem &&
    !completedSlugs.has(
      _slugFromHref(lastLessonItem.getAttribute("href") || ""),
    )
      ? lastLessonItem
      : nextIncompleteItem;

  const upNextLabel = document.getElementById("upNextLabel");
  const upNextTitle = document.getElementById("upNextTitle");
  const upNextDescription = document.getElementById("upNextDescription");

  if (targetItem) {
    const lessonLabel = targetItem.querySelector(".lesson-item__week");
    const lessonTitle = targetItem.querySelector(".lesson-item__title");
    if (upNextLabel) {
      upNextLabel.textContent =
        "Up Next · " + (lessonLabel ? lessonLabel.textContent.trim() : "Lesson");
    }
    if (upNextTitle && lessonTitle) {
      upNextTitle.textContent = lessonTitle.textContent.trim();
    }
    if (upNextDescription) {
      upNextDescription.textContent =
        "Continue with the next lesson in your discipleship path.";
    }
  } else {
    if (upNextLabel) upNextLabel.textContent = "Curriculum Complete";
    if (upNextTitle) upNextTitle.textContent = "You completed all 28 lessons.";
    if (upNextDescription) {
      upNextDescription.textContent =
        "Return anytime to review a lesson or download its handout.";
    }
  }

  const continueBtn = document.getElementById("continueBtn");
  if (continueBtn) {
    continueBtn.href = targetItem
      ? targetItem.getAttribute("href")
      : "lessons/lesson-01.html";
    continueBtn.textContent = targetItem
      ? "Continue Learning →"
      : "Review the Curriculum →";
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

function _addDashboardHandoutLinks() {
  document.querySelectorAll(".lesson-item").forEach((item) => {
    if (item.parentElement.classList.contains("lesson-item-row")) {
      return;
    }

    const slug = _slugFromHref(item.getAttribute("href") || "");
    const match = slug.match(/^lesson-(\d{2})$/);
    if (!match) return;

    const row = document.createElement("div");
    row.className = "lesson-item-row";
    item.parentNode.insertBefore(row, item);
    row.appendChild(item);

    const link = document.createElement("a");
    link.className = "lesson-handout-link";
    link.href = "/handouts/growing-in-grace/" + slug + "-handout.pdf";
    link.target = "_blank";
    link.rel = "noopener";
    link.setAttribute(
      "aria-label",
      "Download Lesson " + Number(match[1]) + " handout PDF",
    );
    link.title = "Download handout PDF";
    link.textContent = "↓";
    row.appendChild(link);
  });
}

/**
 * Initialize a lesson page — record start, show completion state.
 */
async function initLessonPage(lessonSlug) {
  _enhanceLessonPageV2(lessonSlug);

  const user = await requireAuth();
  if (!user) return;

  // Record lesson start
  const sb = getSupabase();
  if (sb) {
    try {
      await recordLessonStart(lessonSlug);
    } catch (e) {
      console.warn(
        e && e.message
          ? "The Growing Disciple: unable to record lesson start - " + e.message
          : "The Growing Disciple: unable to record lesson start",
      );
    }
  } else {
    _saveDemoProgress(lessonSlug, false);
  }

  // Check if already completed
  const completed = await isLessonComplete(lessonSlug);
  const completeBtn = document.getElementById("markCompleteBtn");
  const proxyBtn = document.querySelector(".lesson-complete-proxy");

  const setCompleteState = (isCompleted) => {
    if (completeBtn) {
      completeBtn.textContent = isCompleted
        ? "Completed"
        : "Mark Lesson as Complete";
      completeBtn.classList.toggle("is-completed", isCompleted);
      completeBtn.disabled = isCompleted;
    }
    _syncLessonCompleteProxy(isCompleted);
  };

  const completeLesson = async () => {
    if (completeBtn) {
      completeBtn.textContent = "Saving...";
      completeBtn.disabled = true;
    }
    if (proxyBtn) {
      _setLessonCompleteProxyLabel(proxyBtn, "Saving...", false);
      proxyBtn.disabled = true;
    }

    try {
      if (sb) {
        await markLessonComplete(lessonSlug);
      } else {
        _saveDemoProgress(lessonSlug, true);
      }

      setCompleteState(true);
    } catch (e) {
      setCompleteState(false);
      console.error(
        e && e.message
          ? "The Growing Disciple: unable to mark lesson complete - " + e.message
          : "The Growing Disciple: unable to mark lesson complete",
      );
    }
  };

  if (completeBtn) {
    if (completed) {
      setCompleteState(true);
    } else {
      setCompleteState(false);
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest(
      "#markCompleteBtn, .lesson-complete-proxy",
    );
    if (!target || target.disabled) return;
    event.preventDefault();
    completeLesson();
  });

  if (proxyBtn && completed) {
    _syncLessonCompleteProxy(true);
  }

  // Update nav for logged-in state
  const profile = await getProfile();
  _updateNavAuth(user, profile);
}

/**
 * Add V2 lesson presentation blocks without replacing the real lesson content,
 * video embed, progress state, or completion behavior already present in HTML.
 */
function _enhanceLessonPageV2(lessonSlug) {
  document.body.classList.add("lesson-page-v2");

  const header = document.querySelector(".lesson-header");
  const title = header ? header.querySelector("h1") : null;
  const intro = header ? header.querySelector("p") : null;
  const lessonNumber = (lessonSlug || "").replace("lesson-", "");
  const formattedLesson = lessonNumber ? "Lesson " + lessonNumber : "Lesson";
  const handoutHref = lessonNumber
    ? "/handouts/growing-in-grace/lesson-" + lessonNumber + "-handout.pdf"
    : "/handouts/growing-in-grace/";

  if (intro) intro.classList.add("lesson-hero__intro");
  if (title && title.textContent.includes("Look Like?") && !title.querySelector("em")) {
    title.innerHTML = title.innerHTML.replace("Look Like?", "<em>Look Like?</em>");
  }

  if (header && !header.querySelector(".lesson-progress-nav")) {
    const progressNav = document.createElement("nav");
    progressNav.className = "lesson-progress-nav";
    progressNav.setAttribute("aria-label", "Lesson sections");
    progressNav.innerHTML =
      '<a href="#watch">Watch</a>' +
      '<a href="#scripture-focus">Read</a>' +
      '<a href="#review">Review</a>' +
      '<a href="#complete">Complete</a>';
    const container = header.querySelector(".container");
    if (container) container.appendChild(progressNav);
  }

  const embed = document.querySelector(".embed-block");
  if (embed) {
    embed.id = "watch";
    const embedLabel = embed.querySelector(".embed-block__label");
    if (embedLabel) {
      embedLabel.insertAdjacentHTML(
        "beforebegin",
        _lessonMediaMeta(lessonNumber, handoutHref),
      );
      embedLabel.innerHTML =
        '<span class="lesson-watch-pill"><span aria-hidden="true">&#9654;</span> Watch Lesson</span>' +
        '<div class="lesson-watch-copy"><span class="embed-block__subtitle">Clear, accessible teaching at your own pace</span></div>';
    }
  }

  const scriptureSection = document.querySelector(".lesson-section");
  if (scriptureSection) scriptureSection.classList.add("lesson-section--source");

  const complete = document.querySelector(".lesson-complete");
  if (complete) complete.classList.add("lesson-complete--source");

  if (!scriptureSection || document.querySelector(".lesson-v2-generated")) {
    _labelNextLessonCard();
    return;
  }

  const introText = intro ? intro.textContent.trim() : "";
  const scriptureRefs = Array.from(document.querySelectorAll(".scripture-tag"))
    .map((tag) => tag.textContent.trim())
    .filter(Boolean);
  const conceptSentences = _splitSentences(introText);
  const nextLink = document.querySelector(".lesson-nav__link--next");
  const nextHref = nextLink
    ? nextLink.getAttribute("href") || "#"
    : "/growing-in-grace-dashboard.html";
  const nextTitleEl = nextLink ? nextLink.querySelector(".lesson-nav__title") : null;
  const nextTitle = nextTitleEl
    ? nextTitleEl.textContent.trim()
    : "You’ve reached the end of Growing in Grace";
  const nextEyebrow = nextLink ? "Up Next" : "Curriculum Complete";
  const nextDescription = nextLink
    ? "Continue your curriculum with the next lesson."
    : "Return to your dashboard to review your progress and revisit any lesson.";
  const nextAction = nextLink ? "Start Lesson" : "Return to Dashboard";
  const lessonNavOverview = document.querySelector(".lesson-nav__overview");
  const lessonNav = document.querySelector(".lesson-nav");
  if (lessonNavOverview) lessonNavOverview.classList.add("lesson-nav__overview--source");
  if (lessonNav) lessonNav.classList.add("lesson-nav--source");

  const generated = document.createElement("div");
  generated.className = "lesson-v2-generated";
  generated.innerHTML =
    '<section class="lesson-section lesson-section--concepts">' +
    _lessonEditorialHeading("Section 01", "Key", "Concepts") +
    '<div class="key-concept-list">' +
    _conceptRow("01", "Key Idea", "Central Truth", conceptSentences[0] || (title ? title.textContent.trim() : "The main teaching of this lesson.")) +
    _conceptRow("02", "Key Insight", "Scripture Lens", scriptureRefs.length ? "Read the lesson through " + scriptureRefs.join(", ") + "." : "Read the lesson through the passages listed above.") +
    _conceptRow("03", "Key Takeaway", "Discipleship Response", conceptSentences[1] || "Consider how this doctrine shapes worship, obedience, and steady growth in Christ.") +
    "</div>" +
    "</section>" +
    '<section class="lesson-section lesson-section--scripture-repeat" id="scripture-focus">' +
    _lessonEditorialHeading("Section 02", "Scripture", "Focus") +
    '<p class="lesson-section__lead">Anchor passages for this lesson — read these closely.</p>' +
    '<div class="scripture-list scripture-list--large">' +
    scriptureRefs.map((ref) => '<span class="scripture-tag">' + _escapeInlineHtml(ref) + "</span>").join("") +
    "</div></section>" +
    '<section class="lesson-section lesson-section--outcomes" id="review">' +
    _lessonEditorialHeading("Section 03", "By the End,", "You Will...") +
    '<div class="outcome-grid">' +
    _outcomeCard("A", "Understand", "Name the primary biblical truth taught in " + formattedLesson + ".") +
    _outcomeCard("B", "Connect", "Connect the Scripture focus to everyday discipleship.") +
    _outcomeCard("C", "Respond", "Identify one faithful next step for growth in grace and knowledge.") +
    "</div>" +
    "</section>" +
    '<section class="lesson-section lesson-section--resource">' +
    _lessonEditorialHeading("Section 04", "Take It", "With You") +
    '<div class="resource-download-card">' +
    '<div class="resource-download-card__icon" aria-hidden="true">PDF</div>' +
    '<div><h3>Lesson Handout (PDF)</h3>' +
    '<p>Key terms, concepts, and review prompts for offline study.</p></div>' +
    '<a class="resource-download-card__link" href="' + handoutHref + '" target="_blank" rel="noopener">Download &rarr;</a>' +
    "</div>" +
    "</section>" +
    '<section class="lesson-bottom-complete" id="complete">' +
    '<h2>Complete this lesson<br><em>and continue growing.</em></h2>' +
    "<p>You've watched, read, and reviewed the lesson. Mark it complete and keep moving through the course.</p>" +
    '<button type="button" class="lesson-complete-proxy"><span class="lesson-complete-proxy__indicator" aria-hidden="true"></span><span>Mark Lesson Complete</span></button>' +
    "</section>" +
    '<a class="lesson-bottom-next" href="' +
    _escapeInlineHtml(nextHref) +
    '">' +
    '<div class="lesson-bottom-next__copy"><span>' +
    _escapeInlineHtml(nextEyebrow) +
    '</span><h2>' +
    _escapeInlineHtml(nextTitle) +
    '</h2><p>' +
    _escapeInlineHtml(nextDescription) +
    '</p></div><strong>' +
    _escapeInlineHtml(nextAction) +
    ' <span aria-hidden="true">&rarr;</span></strong></a>';

  if (lessonNav) {
    lessonNav.insertAdjacentElement("afterend", generated);
  } else {
    scriptureSection.insertAdjacentElement("afterend", generated);
  }
  _labelNextLessonCard();
}

function _syncLessonCompleteProxy(completed) {
  const proxy = document.querySelector(".lesson-complete-proxy");
  if (!proxy) return;
  _setLessonCompleteProxyLabel(
    proxy,
    completed ? "Completed" : "Mark Lesson Complete",
    completed,
  );
  proxy.classList.toggle("is-completed", completed);
  proxy.disabled = completed;
}

function _setLessonCompleteProxyLabel(proxy, label, completed) {
  proxy.innerHTML =
    '<span class="lesson-complete-proxy__indicator" aria-hidden="true"></span><span>' +
    _escapeInlineHtml(label) +
    "</span>";
  proxy.classList.toggle("is-completed", !!completed);
}

function _splitSentences(text) {
  if (!text) return [];
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function _lessonEditorialHeading(section, first, accent) {
  return (
    '<div class="lesson-editorial-heading"><span>' +
    _escapeInlineHtml(section) +
    '</span><i></i></div><h2 class="lesson-section__heading">' +
    _escapeInlineHtml(first) +
    " <em>" +
    _escapeInlineHtml(accent) +
    "</em></h2>"
  );
}

function _lessonMediaMeta(lessonNumber, handoutHref) {
  const runtimes = [
    12, 10, 8, 8, 11, 8, 12, 15, 13, 13, 17, 14, 10, 15,
    12, 12, 13, 15, 12, 18, 16, 20, 12, 16, 15, 17, 17, 21,
  ];
  const lessonIndex = Number(lessonNumber) - 1;
  const minutes = runtimes[lessonIndex] || 15;

  return (
    '<div class="lesson-media-meta" aria-label="Lesson details">' +
    '<div class="lesson-media-meta__item">' + _lessonMetaIcon("clock") +
    '<span><strong>~' + minutes + ' min</strong><small>video lesson</small></span></div>' +
    '<div class="lesson-media-meta__item">' + _lessonMetaIcon("play") +
    '<span><strong>Lesson video</strong><small>watch at your pace</small></span></div>' +
    '<a class="lesson-media-meta__item" href="' + _escapeInlineHtml(handoutHref) + '" target="_blank" rel="noopener">' +
    _lessonMetaIcon("file") +
    '<span><strong>Companion PDF</strong><small>included with lesson</small></span></a>' +
    '<div class="lesson-media-meta__item lesson-media-meta__item--teacher">' + _lessonMetaIcon("user") +
    '<span><small>Taught by</small><strong>Dr. Andrew T. Burggraff</strong></span></div>' +
    '</div>'
  );
}

function _lessonMetaIcon(name) {
  const paths = {
    clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
    play: '<path d="m7 4 12 8-12 8V4Z"></path>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path><path d="M8 15h8M8 18h6"></path>',
    user: '<circle cx="12" cy="7" r="4"></circle><path d="M4 22v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"></path>',
  };
  return (
    '<svg class="lesson-media-meta__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    (paths[name] || paths.file) +
    '</svg>'
  );
}

function _conceptRow(number, label, title, text) {
  return (
    '<article class="key-concept">' +
    '<div class="key-concept__marker"><span class="key-concept__number">' +
    number +
    '</span><span class="key-concept__label">' +
    _escapeInlineHtml(label) +
    "</span></div>" +
    '<div><h3>' +
    _escapeInlineHtml(title) +
    "</h3><p>" +
    _escapeInlineHtml(text) +
    "</p></div></article>"
  );
}

function _outcomeCard(letter, title, text) {
  return (
    '<article class="outcome-card"><span>' +
    _escapeInlineHtml(letter) +
    "</span><p><strong>" +
    _escapeInlineHtml(title) +
    "</strong> — " +
    _escapeInlineHtml(text) +
    "</p></article>"
  );
}

function _escapeInlineHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function _labelNextLessonCard() {
  const next = document.querySelector(".lesson-nav__link--next");
  if (next && !next.querySelector(".lesson-nav__eyebrow")) {
    const eyebrow = document.createElement("span");
    eyebrow.className = "lesson-nav__eyebrow";
    eyebrow.textContent = "Up Next";
    next.insertBefore(eyebrow, next.firstChild);
  }
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

  // Single CTA (lesson pages): update to "Dashboard →".
  // The dashboard page itself has a static "Sign Out" CTA — never overwrite it.
  // Guard 1: URL check. Guard 2: text check (belt-and-suspenders in case of
  // future path changes or unexpected callers).
  const path = window.location.pathname;
  if (path.includes("growing-in-grace-dashboard")) return;

  const navCta = document.querySelector(".nav__cta");
  if (navCta && user) {
    const currentText = (navCta.textContent || "").trim();
    if (currentText === "Sign Out") return;
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

/**
 * Add ESV passage previews to Scripture references across the course area.
 * The official tool scans the completed page and linkifies recognized refs.
 */
function initEsvCrossReferences() {
  const path = window.location.pathname;
  const isCoursePage =
    path.includes("growing-in-grace-dashboard") || path.includes("/lessons/");

  if (!isCoursePage || document.getElementById("esv-crossref-script")) return;

  window.ESV_CROSSREF_OPTIONS = {
    border_color: "BFD8D4",
    border_radius: 8,
    header_font_color: "FFF9EE",
    body_font_color: "123F40",
    footer_font_color: "617375",
    header_background_color: "084B4D",
    body_background_color: "FFFDF8",
    footer_background_color: "EFF7F5",
    header_font_size: 16,
    body_font_size: 15,
    footer_font_size: 12,
    header_font_family: "Georgia",
    body_font_family: "Arial",
    footer_font_family: "Arial",
  };

  const script = document.createElement("script");
  script.id = "esv-crossref-script";
  script.src = "https://static.esvmedia.org/crossref/crossref.min.js";
  script.async = true;
  script.onload = () => {
    window.dispatchEvent(new Event("esv-crossref.trigger-linkify"));
  };
  document.body.appendChild(script);
}

function initAnalyticsTracking() {
  if (window.location.protocol !== "https:") return;

  trackAnalyticsEvent("page_view");
  const lessonSlug = _analyticsLessonSlug();
  if (lessonSlug) trackAnalyticsEvent("lesson_view", { lessonSlug });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;

    const href = link.getAttribute("href") || "";
    const text = (link.textContent || "").trim().toLowerCase();
    if (/\/handouts\/growing-in-grace\/lesson-\d{2}-handout\.pdf/i.test(href)) {
      const match = href.match(/(lesson-\d{2})-handout/i);
      trackAnalyticsEvent("handout_download", {
        lessonSlug: match ? match[1].toLowerCase() : lessonSlug,
      });
    } else if (/youtu(?:\.be|be\.com)/i.test(href)) {
      trackAnalyticsEvent("video_click", { lessonSlug });
    } else if (
      text.includes("start the curriculum") ||
      text.includes("start learning")
    ) {
      trackAnalyticsEvent("curriculum_start");
    }
  });
}

// Auto-init common features when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  initModuleAccordions();
  initEsvCrossReferences();
  initAnalyticsTracking();
});
