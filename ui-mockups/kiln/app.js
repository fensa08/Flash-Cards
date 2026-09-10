(() => {
  "use strict";

  const nav = document.getElementById("nav");
  const views = document.querySelectorAll(".view");
  const topbar = document.getElementById("topbar");
  const topbarTitle = document.getElementById("topbarTitle");
  const topbarSub = document.getElementById("topbarSub");

  function activateView(viewId) {
    views.forEach((v) => v.classList.toggle("active", v.id === "view-" + viewId));

    // Sync sidebar active states
    document.querySelectorAll(".nav-item[data-view]").forEach((el) => {
      el.dataset.active = String(el.dataset.view === viewId);
    });
    document.querySelectorAll(".nav-child[data-view]").forEach((el) => {
      el.dataset.active = String(el.dataset.view === viewId);
    });

    // If the active view is nested in a group, make sure that group is open
    const activeChild = document.querySelector('.nav-child[data-view="' + viewId + '"]');
    if (activeChild) {
      const group = activeChild.closest(".nav-group");
      if (group) group.dataset.open = "true";
    }

    // Topbar: read per-view data attributes, or hide entirely (voice mode)
    const activeView = document.getElementById("view-" + viewId);
    const hideTopbar = activeView && activeView.dataset.hideTopbar === "true";
    topbar.style.display = hideTopbar ? "none" : "flex";
    if (!hideTopbar && activeView) {
      topbarTitle.textContent = activeView.dataset.topbarTitle || "";
      topbarSub.textContent = activeView.dataset.topbarSub || "";
    }

    activeView && activeView.scrollTo({ top: 0 });
  }

  // Top-level + nested nav item clicks
  nav.addEventListener("click", (e) => {
    const toggleBtn = e.target.closest("[data-toggle]");
    if (toggleBtn) {
      const group = toggleBtn.closest(".nav-group");
      const isOpen = group.dataset.open === "true";
      group.dataset.open = String(!isOpen);
      return;
    }
    const viewBtn = e.target.closest("[data-view]");
    if (viewBtn) activateView(viewBtn.dataset.view);
  });

  // Any element anywhere with data-view-link acts as a cross-link (e.g. "Open AI Mentor")
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-view-link]");
    if (link) activateView(link.dataset.viewLink);
  });

  // --- Course Builder > Generate: pill + toggle interactions (visual only) ---
  document.querySelectorAll(".pill-group").forEach((group) => {
    group.addEventListener("click", (e) => {
      const pill = e.target.closest(".pill-option");
      if (!pill) return;
      group.querySelectorAll(".pill-option").forEach((p) => (p.dataset.active = "false"));
      pill.dataset.active = "true";
    });
  });

  document.querySelectorAll(".tag-filter").forEach((tag) => {
    tag.addEventListener("click", () => {
      const row = tag.closest(".filter-row");
      row.querySelectorAll(".tag-filter").forEach((t) => (t.dataset.active = "false"));
      tag.dataset.active = "true";
    });
  });

  document.querySelectorAll(".switch").forEach((sw) => {
    sw.addEventListener("click", () => sw.classList.toggle("is-off"));
  });

  // --- Notes preview: clicking a TOC entry highlights it (visual only) ---
  document.querySelectorAll(".toc-item").forEach((item) => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".toc-item").forEach((t) => (t.dataset.active = "false"));
      item.dataset.active = "true";
    });
  });

  // --- AI Mentor: mute + captions toggles, drifting status text ---
  const muteBtn = document.getElementById("muteBtn");
  const ccBtn = document.getElementById("ccBtn");
  const mentorStatus = document.getElementById("mentorStatus");
  const mentorOrb = document.getElementById("mentorOrb");

  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      const nowMuted = muteBtn.classList.toggle("is-on");
      mentorStatus.textContent = nowMuted ? "Muted" : "Listening";
      mentorOrb.style.animationPlayState = nowMuted ? "paused" : "running";
    });
  }
  if (ccBtn) {
    ccBtn.addEventListener("click", () => ccBtn.classList.toggle("is-on"));
  }

  const statusCycle = ["Listening", "Thinking", "Speaking"];
  let statusIdx = 0;
  setInterval(() => {
    if (!document.getElementById("view-mentor").classList.contains("active")) return;
    if (muteBtn && muteBtn.classList.contains("is-on")) return;
    statusIdx = (statusIdx + 1) % statusCycle.length;
    mentorStatus.textContent = statusCycle[statusIdx];
  }, 3600);

  // Init
  activateView("overview");
})();
