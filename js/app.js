/* LOOPLY — application logic (Stage 1)
 * Built features: sign up / log in, profiles, posts, likes, discovery.
 * Stage 2 features (groups, messages, skill exchange) show an honest
 * "not built yet" page for now.
 */
(() => {
  "use strict";

  /* ---------- Setup ---------- */
  const cfg = window.LOOPLY_CONFIG || {};
  const isConfigured =
    !!cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR-PROJECT-ID") &&
    !!cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR-ANON");
  const sb = isConfigured && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  /* ---------- Helpers ---------- */
  const $ = (sel) => document.querySelector(sel);
  const main = () => $("#main");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const COLORS = ["#7C3AED", "#14B8A6", "#F59E0B", "#EC4899", "#3B82F6", "#22C55E"];
  const colorFor = (s) => COLORS[[...String(s || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  const initials = (p) => (p.display_name || p.username || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const avatar = (p) => `<span class="avatar" style="background:${colorFor(p.username)}">${esc(initials(p))}</span>`;
  const chips = (arr) => (arr && arr.length)
    ? arr.map((t) => `<span class="chip">${esc(t)}</span>`).join("")
    : `<span class="muted small">None yet</span>`;
  const setMsg = (el, text, kind = "") => { if (el) { el.textContent = text; el.className = "msg " + kind; } };
  const parseList = (s) => [...new Set(String(s || "").split(",")
    .map((x) => x.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean))].slice(0, 15);
  const sanitizeSearch = (q) => q.replace(/[^\p{L}\p{N}_ -]/gu, "").trim().slice(0, 40);
  const timeAgo = (iso) => {
    const s = Math.max(1, Math.floor((Date.now() - new Date(iso)) / 1000));
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString();
  };
  const friendly = (err) => {
    const m = (err && err.message) || "Something went wrong. Please try again.";
    if (/Invalid login/i.test(m)) return "Email or password is incorrect.";
    if (/already registered/i.test(m)) return "That email already has an account. Try logging in.";
    if (/Database error/i.test(m)) return "Couldn't create your profile. That username may already be taken.";
    if (/Email not confirmed/i.test(m)) return "Please confirm your email first. Check your inbox.";
    return m;
  };

  /* ---------- State ---------- */
  let me = null;          // the logged-in user's profile row
  let authMode = "login";

  /* ---------- Auth screens ---------- */
  function setAuthMode(mode) {
    authMode = mode;
    $("#tab-login").classList.toggle("active", mode === "login");
    $("#tab-signup").classList.toggle("active", mode === "signup");
    $("#signup-only").classList.toggle("hidden", mode !== "signup");
    $("#auth-submit").textContent = mode === "signup" ? "Create account" : "Log in";
    $("#forgot-password").classList.toggle("hidden", mode !== "login");
  }

  function showAuth() {
    $("#auth-view").classList.remove("hidden");
    $("#reset-view").classList.add("hidden");
    $("#app-view").classList.add("hidden");
  }

  function showReset() {
    $("#auth-view").classList.add("hidden");
    $("#reset-view").classList.remove("hidden");
    $("#app-view").classList.add("hidden");
  }

  function showApp() {
    $("#auth-view").classList.add("hidden");
    $("#reset-view").classList.add("hidden");
    $("#app-view").classList.remove("hidden");
  }

  $("#tab-login").addEventListener("click", () => setAuthMode("login"));
  $("#tab-signup").addEventListener("click", () => setAuthMode("signup"));

  // Password reset: send a secure Supabase recovery email to the entered address.
  $("#forgot-password").addEventListener("click", async () => {
    const email = $("#auth-form").elements.email.value.trim();
    const msg = $("#auth-msg");
    if (!email) return setMsg(msg, "Enter your email address first, then tap Forgot password?", "err");
    const btn = $("#forgot-password");
    btn.disabled = true;
    setMsg(msg, "Sending password-reset email…");
    try {
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setMsg(msg, "If an account exists for this email, a password-reset link has been sent. Check your inbox and spam folder.", "ok");
    } catch (err) {
      setMsg(msg, friendly(err), "err");
    } finally {
      btn.disabled = false;
    }
  });

  // The recovery link returns here; Supabase signals PASSWORD_RECOVERY.
  $("#reset-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const msg = $("#reset-msg");
    const password = f.new_password.value;
    const confirm = f.confirm_password.value;
    if (password.length < 8) return setMsg(msg, "Use at least 8 characters for your new password.", "err");
    if (password !== confirm) return setMsg(msg, "The passwords do not match.", "err");
    const btn = f.querySelector("button[type='submit']");
    btn.disabled = true;
    setMsg(msg, "Updating your password…");
    try {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      await sb.auth.signOut();
      showAuth();
      setAuthMode("login");
      setMsg($("#auth-msg"), "Password updated successfully. You can now log in with your new password.", "ok");
      f.reset();
    } catch (err) {
      setMsg(msg, friendly(err), "err");
    } finally {
      btn.disabled = false;
    }
  });

  $("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const msg = $("#auth-msg");
    const btn = $("#auth-submit");
    const email = f.email.value.trim();
    const password = f.password.value;
    if (!email || password.length < 8) {
      return setMsg(msg, "Enter an email and a password of at least 8 characters.", "err");
    }
    btn.disabled = true;
    try {
      if (authMode === "signup") {
        const username = f.username.value.trim().toLowerCase();
        const displayName = f.display_name.value.trim();
        if (!/^[a-z0-9_]{3,20}$/.test(username)) {
          throw new Error("Username must be 3–20 characters: letters, numbers or underscores.");
        }
        if (!displayName) throw new Error("Please enter a display name.");
        setMsg(msg, "Creating your account…");
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { username, display_name: displayName } }
        });
        if (error) throw error;
        if (!data.session) {
          setAuthMode("login");
          return setMsg(msg, "Almost there! Check your email to confirm your account, then log in.", "ok");
        }
      } else {
        setMsg(msg, "Logging in…");
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      setMsg(msg, "");
    } catch (err) {
      setMsg(msg, friendly(err), "err");
    } finally {
      btn.disabled = false;
    }
  });

  $("#logout-btn").addEventListener("click", async () => {
    await sb.auth.signOut();
  });

  async function loadMe(user) {
    const { data, error } = await sb.from("profiles").select("*").eq("id", user.id).single();
    if (error) throw error;
    me = data;
  }

  /* ---------- Router ---------- */
  const COMING = {
    communities: { title: "Groups & Communities", text: "Create interest-based communities, join existing ones and post inside them." },
    messages: { title: "Private messages", text: "One-to-one conversations with real-time delivery." },
    skills: { title: "Skill exchange", text: "Send learning-partner requests, accept them and track each skill swap." }
  };

  function renderComingSoon(key) {
    const c = COMING[key];
    main().innerHTML = `
      <section class="card coming">
        <div class="icon">🚧</div>
        <h2>${esc(c.title)}</h2>
        <p class="muted">${esc(c.text)}</p>
        <span class="pill">Stage 2: not built yet</span>
        <p class="small muted">The database tables for this feature already exist in supabase/schema.sql, so Stage 2 can build directly on them.</p>
      </section>`;
  }

  const ROUTES = {
    feed: () => renderFeed(),
    discover: () => renderDiscover(),
    me: () => renderMe(),
    communities: () => renderComingSoon("communities"),
    messages: () => renderComingSoon("messages"),
    skills: () => renderComingSoon("skills")
  };

  function route() {
    if (!me) return;
    const hash = location.hash.replace(/^#/, "") || "feed";
    const [name, arg] = hash.split("/");
    const navKey = name === "u" ? "discover" : name;
    document.querySelectorAll(".bottomnav a").forEach((a) =>
      a.classList.toggle("active", a.dataset.route === navKey));
    window.scrollTo(0, 0);
    if (name === "u") return renderUser(decodeURIComponent(arg || ""));
    (ROUTES[name] || ROUTES.feed)();
  }

  window.addEventListener("hashchange", route);

  /* ---------- Feed & posts ---------- */
  async function renderFeed() {
    main().innerHTML = `
      <section class="card composer">
        <div class="row" style="align-items:flex-start">
          ${avatar(me)}
          <form id="post-form" class="grow">
            <textarea name="body" maxlength="500" rows="3" placeholder="Share an idea, a win or a question…"></textarea>
            <div class="row between" style="margin-top:8px">
              <span class="muted small" id="count">0/500</span>
              <button class="btn primary" type="submit">Post</button>
            </div>
            <p class="msg" id="post-msg"></p>
          </form>
        </div>
      </section>
      <h3 class="section-title">Latest posts</h3>
      <div id="feed-list" class="stack"><p class="muted center">Loading posts…</p></div>`;

    const form = $("#post-form");
    form.addEventListener("submit", createPost);
    form.body.addEventListener("input", (e) => {
      $("#count").textContent = `${e.target.value.length}/500`;
    });
    await loadPosts($("#feed-list"));
  }

  async function createPost(e) {
    e.preventDefault();
    const ta = e.target.body;
    const body = ta.value.trim();
    const msg = $("#post-msg");
    if (!body) return setMsg(msg, "Write something first.", "err");
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    const { error } = await sb.from("posts").insert({ author_id: me.id, body });
    btn.disabled = false;
    if (error) return setMsg(msg, error.message, "err");
    ta.value = "";
    $("#count").textContent = "0/500";
    setMsg(msg, "");
    await loadPosts($("#feed-list"));
  }

  async function loadPosts(container, { authorId = null } = {}) {
    if (!container) return;
    let q = sb.from("posts")
      .select("id, body, created_at, author_id, profiles(username, display_name), likes(user_id)")
      .order("created_at", { ascending: false })
      .limit(30);
    if (authorId) q = q.eq("author_id", authorId);
    const { data, error } = await q;
    if (error) { container.innerHTML = `<p class="err center">${esc(error.message)}</p>`; return; }
    if (!data.length) {
      container.innerHTML = `<p class="muted center">No posts yet. Be the first to share something!</p>`;
      return;
    }
    container.innerHTML = data.map(postCard).join("");
    container.querySelectorAll("[data-like]").forEach((b) => (b.onclick = () => toggleLike(b)));
    container.querySelectorAll("[data-delete]").forEach((b) => (b.onclick = () => deletePost(b)));
  }

  function postCard(p) {
    const author = p.profiles || { username: "unknown", display_name: "Unknown member" };
    const likes = p.likes || [];
    const liked = likes.some((l) => l.user_id === me.id);
    const mine = p.author_id === me.id;
    return `
      <article class="card post">
        <a class="row" href="#u/${encodeURIComponent(author.username)}">
          ${avatar(author)}
          <div>
            <strong>${esc(author.display_name || author.username)}</strong>
            <div class="muted small">@${esc(author.username)} · ${timeAgo(p.created_at)}</div>
          </div>
        </a>
        <p class="body">${esc(p.body)}</p>
        <footer class="row">
          <button class="btn ghost small ${liked ? "liked" : ""}" data-like="${esc(p.id)}" data-liked="${liked}">♥ ${likes.length}</button>
          ${mine ? `<button class="btn ghost small danger" data-delete="${esc(p.id)}">Delete</button>` : ""}
        </footer>
      </article>`;
  }

  async function toggleLike(btn) {
    const postId = btn.dataset.like;
    const liked = btn.dataset.liked === "true";
    btn.disabled = true;
    const res = liked
      ? await sb.from("likes").delete().eq("post_id", postId).eq("user_id", me.id)
      : await sb.from("likes").insert({ post_id: postId, user_id: me.id });
    btn.disabled = false;
    if (res.error) return alert(res.error.message);
    const count = parseInt(btn.textContent.replace(/\D/g, ""), 10) || 0;
    const nowLiked = !liked;
    btn.dataset.liked = String(nowLiked);
    btn.classList.toggle("liked", nowLiked);
    btn.textContent = `♥ ${Math.max(0, count + (nowLiked ? 1 : -1))}`;
  }

  async function deletePost(btn) {
    if (!confirm("Delete this post?")) return;
    btn.disabled = true;
    const { error } = await sb.from("posts").delete().eq("id", btn.dataset.delete);
    if (error) { btn.disabled = false; return alert(error.message); }
    btn.closest("article").remove();
  }

  /* ---------- Discover ---------- */
  const PERSON_COLS = "id, username, display_name, bio, location, interests, skills_offer";

  function personCard(p, shared = 0) {
    return `
      <a class="card person" href="#u/${encodeURIComponent(p.username)}">
        ${avatar(p)}
        <div class="grow">
          <strong>${esc(p.display_name || p.username)}</strong>
          <div class="muted small">@${esc(p.username)}${p.location ? " · " + esc(p.location) : ""}</div>
          ${p.bio ? `<div class="small">${esc(p.bio.slice(0, 90))}</div>` : ""}
          ${shared ? `<div class="small accent">${shared} shared interest${shared > 1 ? "s" : ""}</div>` : ""}
        </div>
      </a>`;
  }

  function renderPeople(box, rows, emptyText) {
    if (!box) return;
    if (!rows.length) { box.innerHTML = `<p class="muted center">${esc(emptyText)}</p>`; return; }
    box.innerHTML = rows.map((p) => {
      const shared = (p.interests || []).filter((i) => me.interests.includes(i)).length;
      return { p, shared };
    }).sort((a, b) => b.shared - a.shared)
      .map(({ p, shared }) => personCard(p, shared)).join("");
  }

  async function renderDiscover() {
    main().innerHTML = `
      <h2 class="page-title">Discover people</h2>
      <form id="search-form" class="row search">
        <input name="q" maxlength="40" placeholder="Search by name or username">
        <button class="btn primary" type="submit">Search</button>
      </form>
      <h3 class="section-title">${me.interests.length ? "People who share your interests" : "New to LOOPLY"}</h3>
      <div id="people" class="stack"><p class="muted center">Loading…</p></div>`;

    $("#search-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = sanitizeSearch(e.target.q.value);
      if (q) searchPeople(q); else loadSuggested();
    });
    loadSuggested();
  }

  async function loadSuggested() {
    let q = sb.from("profiles").select(PERSON_COLS).neq("id", me.id).limit(30);
    q = me.interests.length
      ? q.overlaps("interests", me.interests)
      : q.order("created_at", { ascending: false });
    const { data, error } = await q;
    if (error) return ($("#people").innerHTML = `<p class="err center">${esc(error.message)}</p>`);
    renderPeople($("#people"), data,
      me.interests.length
        ? "No matches yet. Add more interests on your profile to find more people."
        : "No other members yet. Invite a friend!");
  }

  async function searchPeople(q) {
    const box = $("#people");
    box.innerHTML = `<p class="muted center">Searching…</p>`;
    const { data, error } = await sb.from("profiles").select(PERSON_COLS)
      .neq("id", me.id)
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(30);
    if (error) return (box.innerHTML = `<p class="err center">${esc(error.message)}</p>`);
    renderPeople(box, data, `No one found for “${q}”.`);
  }

  /* ---------- Profiles ---------- */
  function profileHeader(p) {
    return `
      <section class="card profile-hero">
        <div class="hero-avatar">${avatar(p)}</div>
        <h2>${esc(p.display_name || p.username)}</h2>
        <p class="muted">@${esc(p.username)}${p.location ? " · " + esc(p.location) : ""}</p>
        ${p.bio ? `<p>${esc(p.bio)}</p>` : ""}
        <div class="label">Interests</div>
        <div class="chips">${chips(p.interests)}</div>
        <div class="label">Can teach</div>
        <div class="chips">${chips(p.skills_offer)}</div>
        <div class="label">Wants to learn</div>
        <div class="chips">${chips(p.skills_seek)}</div>
      </section>`;
  }

  async function renderUser(username) {
    main().innerHTML = `<p class="muted center">Loading profile…</p>`;
    const { data: p, error } = await sb.from("profiles").select("*")
      .eq("username", username.toLowerCase()).maybeSingle();
    if (error || !p) {
      main().innerHTML = `<p class="center">Profile not found.</p>`;
      return;
    }
    main().innerHTML = profileHeader(p) +
      `<h3 class="section-title">Posts</h3><div id="user-posts" class="stack"></div>`;
    await loadPosts($("#user-posts"), { authorId: p.id });
  }

  function renderMe() {
    main().innerHTML = `
      <h2 class="page-title">Your profile</h2>
      ${profileHeader(me)}
      <section class="card" style="margin-top:14px">
        <h3 class="section-title" style="margin-top:0">Edit profile</h3>
        <form id="profile-form">
          <label>Display name
            <input name="display_name" maxlength="40" value="${esc(me.display_name)}">
          </label>
          <label>Bio
            <textarea name="bio" maxlength="300" rows="3">${esc(me.bio)}</textarea>
          </label>
          <label>Location
            <input name="location" maxlength="60" value="${esc(me.location)}" placeholder="City, Country">
          </label>
          <label>Interests <span class="small">(comma separated)</span>
            <input name="interests" value="${esc(me.interests.join(", "))}" placeholder="photography, coding, chess">
          </label>
          <label>Skills I can teach <span class="small">(comma separated)</span>
            <input name="skills_offer" value="${esc(me.skills_offer.join(", "))}" placeholder="Spanish, guitar">
          </label>
          <label>Skills I want to learn <span class="small">(comma separated)</span>
            <input name="skills_seek" value="${esc(me.skills_seek.join(", "))}" placeholder="UX design">
          </label>
          <button class="btn primary block" type="submit">Save profile</button>
          <p class="msg" id="profile-msg"></p>
        </form>
      </section>
      <p class="center" style="margin-top:16px">
        <a class="accent" href="#u/${encodeURIComponent(me.username)}">View my public profile and posts</a>
      </p>`;
    $("#profile-form").addEventListener("submit", saveProfile);
  }

  async function saveProfile(e) {
    e.preventDefault();
    const f = e.target;
    const msg = $("#profile-msg");
    const updates = {
      display_name: f.display_name.value.trim().slice(0, 40),
      bio: f.bio.value.trim().slice(0, 300),
      location: f.location.value.trim().slice(0, 60),
      interests: parseList(f.interests.value),
      skills_offer: parseList(f.skills_offer.value),
      skills_seek: parseList(f.skills_seek.value)
    };
    if (!updates.display_name) return setMsg(msg, "Display name can't be empty.", "err");
    const { data, error } = await sb.from("profiles").update(updates).eq("id", me.id).select().single();
    if (error) return setMsg(msg, error.message, "err");
    me = data;
    renderMe();
    setMsg($("#profile-msg"), "Saved ✓", "ok");
  }

  /* ---------- Boot ---------- */
  function boot() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service worker:", err));
    }

    if (!sb) {
      $("#config-missing").classList.remove("hidden");
      $("#auth-view").classList.add("hidden");
      return;
    }

    setAuthMode("login");

    sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        showReset();
        return;
      }
      // Defer to avoid calling Supabase from inside its own auth callback.
      setTimeout(async () => {
        if (session?.user) {
          if (me && me.id === session.user.id) { showApp(); return; }
          try {
            await loadMe(session.user);
            showApp();
            route();
          } catch (err) {
            console.error(err);
            await sb.auth.signOut();
            showAuth();
            setMsg($("#auth-msg"), "Your profile could not be loaded. Please log in again.", "err");
          }
        } else {
          me = null;
          showAuth();
        }
      }, 0);
    });
  }

  boot();
})();
