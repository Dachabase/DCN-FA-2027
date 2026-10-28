/**
 * BlastExams Student Features: Gamification, Daily Quests, Spaced Repetition,
 * Exam Intelligence, and Modular Lessons UI Controller.
 */
(function () {
  console.log("⚡ [BlastExams] Initializing Student Features System...");

  let currentUserGamification = null;
  let currentReviewQueue = null;

  // 1. Initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  async function init() {
    createModalMounts();
    await checkUserAndLoadGamification();
    setupCourseHubExtensions();
  }

  function createModalMounts() {
    if (!document.getElementById("blast-gamification-overlay")) {
      const gOverlay = document.createElement("div");
      gOverlay.id = "blast-gamification-overlay";
      gOverlay.style.display = "none";
      document.body.appendChild(gOverlay);
    }
    if (!document.getElementById("blast-review-overlay")) {
      const rOverlay = document.createElement("div");
      rOverlay.id = "blast-review-overlay";
      rOverlay.style.display = "none";
      document.body.appendChild(rOverlay);
    }
  }

  /**
   * Loads Gamification profile and Spaced Repetition queue if user is logged in
   */
  async function checkUserAndLoadGamification() {
    try {
      const res = await fetch("/api/gamification/me", { credentials: "include" });
      if (!res.ok) return; // not logged in or guest

      const json = await res.json();
      if (json.success && json.data) {
        currentUserGamification = json.data;
        renderHeaderGamificationWidget(json.data);
      }

      // Check Review Queue
      const revRes = await fetch("/api/review/queue", { credentials: "include" });
      if (revRes.ok) {
        const revJson = await revRes.json();
        if (revJson.success && revJson.data) {
          currentReviewQueue = revJson.data;
          renderReviewPill(revJson.data);
        }
      }
    } catch (err) {
      console.log("[BlastExams] Guest mode active:", err.message);
    }
  }

  /**
   * Renders compact Hunter Rank badge in header
   */
  function renderHeaderGamificationWidget(data) {
    const headerProfile = document.getElementById("header-user-profile");
    if (!headerProfile) return;

    let widget = document.getElementById("header-gamification-badge");
    if (!widget) {
      widget = document.createElement("div");
      widget.id = "header-gamification-badge";
      widget.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.35rem 0.75rem;
        background: rgba(16, 185, 129, 0.12);
        border: 1px solid rgba(16, 185, 129, 0.3);
        border-radius: 9999px;
        color: #10B981;
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
        margin-right: 0.5rem;
        transition: transform 0.15s, background 0.15s;
      `;
      widget.title = "View Daily Quests, Streaks & Leaderboard";
      widget.onclick = openGamificationModal;
      headerProfile.parentNode.insertBefore(widget, headerProfile);
    }

    const { profile, levelInfo } = data;
    widget.innerHTML = `
      <span style="background: #10B981; color: #0B0F17; border-radius: 4px; padding: 0.1rem 0.35rem; font-weight: 900; font-size: 0.72rem;">${escapeHtml(profile.hunterRank || 'E')}</span>
      <span>Lv.${levelInfo.level}</span>
      <span style="color: #64748B;">•</span>
      <span>🔥 ${profile.currentStreak || 0}d</span>
    `;
  }

  /**
   * Renders Spaced Review reminder pill if cards are due
   */
  function renderReviewPill(queue) {
    if (!queue || queue.dueTodayCount === 0) return;

    let pill = document.getElementById("header-review-due-pill");
    if (!pill) {
      pill = document.createElement("div");
      pill.id = "header-review-due-pill";
      pill.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.75rem;
        background: rgba(245, 158, 11, 0.12);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 9999px;
        color: #F59E0B;
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
        margin-right: 0.5rem;
      `;
      pill.title = "Start Daily Spaced Repetition Review";
      pill.onclick = openReviewModal;

      const headerProfile = document.getElementById("header-user-profile");
      if (headerProfile) {
        headerProfile.parentNode.insertBefore(pill, headerProfile);
      }
    }

    pill.innerHTML = `
      <span>🔁 ${queue.dueTodayCount} Due</span>
    `;
  }

  /**
   * Opens Gamification, Daily Quests & Leaderboard Modal
   */
  window.openGamificationModal = async function () {
    const overlay = document.getElementById("blast-gamification-overlay");
    if (!overlay) return;

    overlay.style.display = "block";
    overlay.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(11,15,23,0.85); backdrop-filter: blur(8px); z-index: 10001; overflow-y: auto; padding: 2rem 1rem;">
        <div style="max-width: 640px; margin: 0 auto; background: #151D2A; border: 1px solid #243247; border-radius: 20px; color: #F1F5F9; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden;">
          <div style="padding: 1.5rem 1.75rem; border-bottom: 1px solid #243247; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <span style="background: #10B981; color: #0B0F17; border-radius: 6px; padding: 0.2rem 0.5rem; font-weight: 900; font-size: 0.85rem;">UI SCHOLAR</span>
              <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0;">Academic Progress &amp; Quests</h2>
            </div>
            <button onclick="document.getElementById('blast-gamification-overlay').style.display='none'" style="background: none; border: none; color: #94A3B8; font-size: 1.25rem; cursor: pointer;">✕</button>
          </div>
          <div id="gamification-modal-body" style="padding: 1.75rem;">
            <div style="text-align: center; color: #94A3B8; padding: 2rem;">Loading academic profile...</div>
          </div>
        </div>
      </div>
    `;

    try {
      const [meRes, questRes, boardRes] = await Promise.all([
        fetch("/api/gamification/me", { credentials: "include" }),
        fetch("/api/gamification/quest/today", { credentials: "include" }),
        fetch("/api/gamification/leaderboard?period=TODAY", { credentials: "include" }),
      ]);

      const me = (await meRes.json()).data;
      const quest = (await questRes.json()).data;
      const board = (await boardRes.json()).data;

      renderGamificationModalContent(me, quest, board);
    } catch (e) {
      document.getElementById("gamification-modal-body").innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #EF4444;">
          Please sign in to track XP, daily quests, and compete on the UI Leaderboard.
        </div>
      `;
    }
  };

  function renderGamificationModalContent(me, quest, board) {
    const body = document.getElementById("gamification-modal-body");
    if (!body) return;

    const { profile, levelInfo } = me;
    const progress = Math.min(100, Math.round((quest.completedAnswers / Math.max(1, quest.targetAnswers)) * 100));

    body.innerHTML = `
      <!-- Rank & Level Banner -->
      <div style="background: #0B0F17; border: 1px solid #243247; border-radius: 14px; padding: 1.25rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 0.8rem; color: #10B981; font-weight: 800; text-transform: uppercase;">Rank ${profile.hunterRank} • ${escapeHtml(profile.academicTier)}</div>
          <div style="font-size: 1.5rem; font-weight: 900; color: #FFFFFF;">Level ${levelInfo.level}</div>
          <div style="font-size: 0.8rem; color: #94A3B8;">${profile.totalXp.toLocaleString()} Total XP • Next Level at ${levelInfo.nextLevelXp.toLocaleString()} XP</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.75rem; font-weight: 900; color: #F59E0B;">🔥 ${profile.currentStreak}d</div>
          <div style="font-size: 0.75rem; color: #94A3B8;">Current Streak</div>
        </div>
      </div>

      <!-- Daily Quest Card -->
      <div style="background: #0B0F17; border: 1px solid #243247; border-radius: 14px; padding: 1.25rem; margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <div style="font-weight: 800; font-size: 0.95rem;">🎯 Today's Daily Target</div>
          <div style="background: rgba(16,185,129,0.2); color: #10B981; font-weight: 900; font-size: 0.85rem; padding: 0.2rem 0.5rem; border-radius: 6px;">
            Grade: ${quest.grade}
          </div>
        </div>
        <div style="background: #151D2A; border-radius: 9999px; height: 10px; overflow: hidden; margin-bottom: 0.65rem;">
          <div style="background: #10B981; height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #94A3B8;">
          <span>${quest.completedAnswers} / ${quest.targetAnswers} answers completed</span>
          <span>${quest.isCompleted ? "✅ Goal Completed! (+50 XP Bonus)" : `${quest.targetAnswers - quest.completedAnswers} more to goal`}</span>
        </div>
      </div>

      <!-- Leaderboard Ladder -->
      <div>
        <h4 style="font-size: 0.95rem; font-weight: 800; margin-bottom: 0.75rem; color: #F1F5F9;">🏆 University of Ibadan Leaderboard (Today)</h4>
        <div style="background: #0B0F17; border: 1px solid #243247; border-radius: 12px; overflow: hidden; max-height: 220px; overflow-y: auto;">
          ${(board.rankings || []).map((r) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 1rem; border-bottom: 1px solid #1E293B; font-size: 0.85rem; ${r.isCurrentUser ? 'background: rgba(16,185,129,0.1); font-weight: 800;' : ''}">
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <span style="color: ${r.rank <= 3 ? '#F59E0B' : '#64748B'}; font-weight: 800; width: 20px;">#${r.rank}</span>
                <span>${escapeHtml(r.displayName)}</span>
              </div>
              <div style="color: #10B981; font-weight: 700;">+${r.xp} XP</div>
            </div>
          `).join("") || '<div style="padding: 1.5rem; text-align: center; color: #64748B;">No answers recorded yet today. Be the first!</div>'}
        </div>
      </div>
    `;
  }

  /**
   * Opens Spaced Repetition Review Modal
   */
  window.openReviewModal = async function () {
    const overlay = document.getElementById("blast-review-overlay");
    if (!overlay) return;

    overlay.style.display = "block";
    overlay.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(11,15,23,0.85); backdrop-filter: blur(8px); z-index: 10001; overflow-y: auto; padding: 2rem 1rem;">
        <div style="max-width: 680px; margin: 0 auto; background: #151D2A; border: 1px solid #243247; border-radius: 20px; color: #F1F5F9; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden;">
          <div style="padding: 1.5rem 1.75rem; border-bottom: 1px solid #243247; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <span style="background: #F59E0B; color: #0B0F17; border-radius: 6px; padding: 0.2rem 0.5rem; font-weight: 900; font-size: 0.85rem;">SM-2 ENGINE</span>
              <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0;">Spaced Repetition Recall</h2>
            </div>
            <button onclick="document.getElementById('blast-review-overlay').style.display='none'" style="background: none; border: none; color: #94A3B8; font-size: 1.25rem; cursor: pointer;">✕</button>
          </div>
          <div id="review-modal-body" style="padding: 1.75rem;">
            <div style="text-align: center; color: #94A3B8; padding: 2rem;">Loading due cards...</div>
          </div>
        </div>
      </div>
    `;

    try {
      const res = await fetch("/api/review/queue", { credentials: "include" });
      const json = await res.json();
      if (!json.success || !json.data.dueCards || json.data.dueCards.length === 0) {
        document.getElementById("review-modal-body").innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem;">
            <div style="font-size: 2.5rem; margin-bottom: 1rem;">🎉</div>
            <h3 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 0.5rem;">Review Queue Cleared!</h3>
            <p style="color: #94A3B8; font-size: 0.95rem; margin-bottom: 1.5rem;">
              You have no questions due for spaced recall right now. Practice more questions or explore syllabus lessons!
            </p>
            <button onclick="document.getElementById('blast-review-overlay').style.display='none'" style="background: #10B981; color: #0B0F17; border: none; font-weight: 700; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer;">Done</button>
          </div>
        `;
        return;
      }

      runReviewCardSession(json.data.dueCards);
    } catch (e) {
      document.getElementById("review-modal-body").innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #EF4444;">Failed to load spaced review queue.</div>
      `;
    }
  };

  function runReviewCardSession(cards) {
    let cardIdx = 0;

    function renderCard() {
      const body = document.getElementById("review-modal-body");
      if (!body) return;

      if (cardIdx >= cards.length) {
        body.innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem;">
            <div style="font-size: 2.5rem; margin-bottom: 1rem;">🏆</div>
            <h3 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 0.5rem;">Drill Complete!</h3>
            <p style="color: #94A3B8; font-size: 0.95rem; margin-bottom: 1.5rem;">
              You reviewed ${cards.length} due cards. Intervals expanded by SuperMemo-2 for long-term memory consolidation.
            </p>
            <button onclick="document.getElementById('blast-review-overlay').style.display='none'; checkUserAndLoadGamification();" style="background: #10B981; color: #0B0F17; border: none; font-weight: 700; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer;">Return to App</button>
          </div>
        `;
        return;
      }

      const item = cards[cardIdx];
      const q = item.question;

      body.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #94A3B8; margin-bottom: 1rem;">
          <span>Card ${cardIdx + 1} of ${cards.length}</span>
          <span>${escapeHtml(q.courseCode || '')} • ${escapeHtml(q.topic || 'General')}</span>
        </div>

        <div style="font-size: 1.05rem; font-weight: 700; line-height: 1.6; margin-bottom: 1.5rem;">
          ${escapeHtml(q.questionText)}
        </div>

        <div id="review-solution-block" style="display: none; background: #0B0F17; border: 1px solid #243247; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;">
          <div style="font-weight: 800; color: #10B981; margin-bottom: 0.35rem;">Correct Answer: ${escapeHtml(q.correctAnswer)}</div>
          <div style="font-size: 0.9rem; color: #CBD5E1; line-height: 1.5;">${escapeHtml(q.explanation)}</div>
        </div>

        <div id="review-action-btns">
          <button id="show-review-ans-btn" style="width: 100%; background: #243247; color: #FFF; font-weight: 700; padding: 0.85rem; border: none; border-radius: 10px; cursor: pointer;">
            Show Answer &amp; Explanation
          </button>
          <div id="review-grade-btns" style="display: none; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
            <button onclick="resolveCurrentCard(false, 1)" style="background: #EF4444; color: #FFF; border: none; padding: 0.85rem; border-radius: 10px; font-weight: 700; cursor: pointer;">Hard / Failed (1d)</button>
            <button onclick="resolveCurrentCard(true, 2)" style="background: #F59E0B; color: #0B0F17; border: none; padding: 0.85rem; border-radius: 10px; font-weight: 700; cursor: pointer;">Good (Expanded)</button>
            <button onclick="resolveCurrentCard(true, 3)" style="background: #10B981; color: #0B0F17; border: none; padding: 0.85rem; border-radius: 10px; font-weight: 700; cursor: pointer;">Mastered (Long)</button>
          </div>
        </div>
      `;

      document.getElementById("show-review-ans-btn").onclick = () => {
        document.getElementById("review-solution-block").style.display = "block";
        document.getElementById("show-review-ans-btn").style.display = "none";
        document.getElementById("review-grade-btns").style.display = "grid";
      };
    }

    window.resolveCurrentCard = async function (isCorrect, confidence) {
      const q = cards[cardIdx].question;
      try {
        await fetch(`/api/review/${q.id}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isCorrect, confidence }),
          credentials: "include",
        });
      } catch (e) {
        console.error("Resolve error:", e);
      }
      cardIdx++;
      renderCard();
    };

    renderCard();
  }

  /**
   * Hooks into UI100L Course Hub to add Exam Intelligence & Lessons tabs
   */
  function setupCourseHubExtensions() {
    if (!window.UI100L) {
      setTimeout(setupCourseHubExtensions, 500);
      return;
    }

    const origRenderTabBody = window.UI100L.switchCourseTab;
    // We enhance UI100L Course Tab Rendering by listening to active tab
    const checkModal = setInterval(() => {
      const tabStrip = document.querySelector("#course-hub-overlay .filter-chip");
      if (tabStrip && !document.getElementById("btn-tab-intel")) {
        injectCourseHubTabs();
      }
    }, 400);
  }

  function injectCourseHubTabs() {
    const parentStrip = document.querySelector("#course-hub-overlay [style*='overflow-x: auto']");
    if (!parentStrip || document.getElementById("btn-tab-intel")) return;

    const intelBtn = document.createElement("button");
    intelBtn.id = "btn-tab-intel";
    intelBtn.className = "filter-chip";
    intelBtn.innerHTML = "📊 Exam Intelligence";
    intelBtn.onclick = () => loadAndRenderExamIntelTab();
    parentStrip.appendChild(intelBtn);

    const lessonsBtn = document.createElement("button");
    intelBtn.id = "btn-tab-lessons";
    lessonsBtn.className = "filter-chip";
    lessonsBtn.innerHTML = "📖 Syllabus Lessons";
    lessonsBtn.onclick = () => loadAndRenderLessonsTab();
    parentStrip.appendChild(lessonsBtn);
  }

  async function loadAndRenderExamIntelTab() {
    const c = window.UI100L && window.UI100L.getCourses ? window.UI100L.getCourses()[0] : null;
    const body = document.querySelector("#course-hub-overlay [style*='min-height: 400px']");
    if (!body) return;

    // Highlight active chip
    document.querySelectorAll("#course-hub-overlay .filter-chip").forEach((btn) => btn.classList.remove("active"));
    const meBtn = document.getElementById("btn-tab-intel");
    if (meBtn) meBtn.classList.add("active");

    body.innerHTML = `<div style="text-align: center; padding: 4rem; color: #64748B;">Analyzing past examination papers &amp; computing topic likelihood rings...</div>`;

    try {
      const activeCourseCode = document.querySelector("#course-hub-overlay h1")?.textContent?.trim() || "GES 107";
      const code = activeCourseCode.split(" ")[0] + " " + (activeCourseCode.split(" ")[1] || "");
      const res = await fetch(`/api/intel/courses/${encodeURIComponent(code)}`, { credentials: "include" });
      const json = await res.json();
      if (!json.success || !json.data) throw new Error("No intel");

      const intel = json.data;
      body.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
          <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.35rem; font-weight: 800; color: #0F172A; margin-bottom: 0.35rem;">Exam Intelligence &amp; Topic Likelihood</h3>
          <p style="color: #64748B; font-size: 0.9rem; margin: 0;">Statistical recurrence models derived from ${intel.summary.totalPastPapers} examination papers and ${intel.summary.totalQuestions} verified questions.</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
          ${intel.allTopics.map((t) => `
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 1.25rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span style="background: ${t.isHighYield ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.1)'}; color: ${t.isHighYield ? '#059669' : '#64748B'}; font-weight: 800; font-size: 0.72rem; padding: 0.2rem 0.5rem; border-radius: 6px;">
                  ${t.isHighYield ? 'HIGH-YIELD HERO' : 'STANDARD'}
                </span>
                <span style="font-size: 1rem; font-weight: 900; color: ${t.examAppearanceLikelihood >= 75 ? '#059669' : '#D97706'};">
                  ${t.examAppearanceLikelihood}% Likelihood
                </span>
              </div>
              <h4 style="font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 800; color: #0F172A; margin: 0 0 0.5rem 0;">${escapeHtml(t.topicName)}</h4>
              <div style="font-size: 0.8rem; color: #64748B; margin-bottom: 1rem;">${t.questionCount} questions available in bank</div>
              <button onclick="UI100L.startCbt('${escapeHtml(intel.course.code)}', 'TOPIC', { topic: '${escapeHtml(t.topicName)}' })" style="width: 100%; background: #0F172A; color: #FFF; border: none; font-size: 0.82rem; font-weight: 700; padding: 0.55rem; border-radius: 8px; cursor: pointer;">
                ⚡ Drill This Topic →
              </button>
            </div>
          `).join("")}
        </div>
      `;
    } catch (e) {
      body.innerHTML = `<div style="text-align: center; padding: 3rem; color: #64748B;">Intelligence models are currently indexing past questions for this course.</div>`;
    }
  }

  async function loadAndRenderLessonsTab() {
    const body = document.querySelector("#course-hub-overlay [style*='min-height: 400px']");
    if (!body) return;

    document.querySelectorAll("#course-hub-overlay .filter-chip").forEach((btn) => btn.classList.remove("active"));
    const meBtn = document.getElementById("btn-tab-lessons");
    if (meBtn) meBtn.classList.add("active");

    body.innerHTML = `<div style="text-align: center; padding: 4rem; color: #64748B;">Loading syllabus lesson monographs...</div>`;

    try {
      const activeCourseCode = document.querySelector("#course-hub-overlay h1")?.textContent?.trim() || "GES 107";
      const code = activeCourseCode.split(" ")[0] + " " + (activeCourseCode.split(" ")[1] || "");
      const res = await fetch(`/api/lessons/course/${encodeURIComponent(code)}`, { credentials: "include" });
      const json = await res.json();
      if (!json.success || !json.data || json.data.length === 0) {
        body.innerHTML = `<div style="text-align: center; padding: 3rem; color: #64748B;">No syllabus lesson guides available for this course yet.</div>`;
        return;
      }

      body.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
          <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.35rem; font-weight: 800; color: #0F172A; margin-bottom: 0.35rem;">Course Syllabus Reading Guides</h3>
          <p style="color: #64748B; font-size: 0.9rem; margin: 0;">Step-by-step monographs with embedded CBT check questions. Earn +20 XP on completion.</p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${json.data.map((l) => `
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 1.25rem; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem;">
                  <span style="font-size: 0.72rem; font-weight: 800; background: #E2E8F0; color: #475569; padding: 0.15rem 0.45rem; border-radius: 4px;">${escapeHtml(l.topicName)}</span>
                  <span style="font-size: 0.75rem; color: #64748B;">⏱️ ${l.readTimeMin} min read</span>
                  ${l.isCompleted ? '<span style="font-size: 0.75rem; color: #059669; font-weight: 700;">✅ Completed (+20 XP)</span>' : ''}
                </div>
                <h4 style="font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 0 0 0.35rem 0;">${escapeHtml(l.title)}</h4>
                <p style="font-size: 0.85rem; color: #64748B; margin: 0;">${escapeHtml(l.summary || '')}</p>
              </div>
              <button onclick="readSingleLesson('${l.id}')" style="background: var(--ps-purple-primary); color: #FFF; border: none; font-weight: 700; font-size: 0.85rem; padding: 0.65rem 1.25rem; border-radius: 8px; cursor: pointer; white-space: nowrap;">
                Read Guide →
              </button>
            </div>
          `).join("")}
        </div>
      `;
    } catch (e) {
      body.innerHTML = `<div style="text-align: center; padding: 3rem; color: #64748B;">Failed to load syllabus lessons.</div>`;
    }
  }

  window.readSingleLesson = async function (lessonId) {
    const body = document.querySelector("#course-hub-overlay [style*='min-height: 400px']");
    if (!body) return;

    body.innerHTML = `<div style="text-align: center; padding: 4rem; color: #64748B;">Loading lesson content...</div>`;

    try {
      const res = await fetch(`/api/lessons/${lessonId}`, { credentials: "include" });
      const json = await res.json();
      const l = json.data;

      body.innerHTML = `
        <button onclick="loadAndRenderLessonsTab()" style="background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; font-weight: 700; font-size: 0.8rem; padding: 0.4rem 0.75rem; border-radius: 6px; cursor: pointer; margin-bottom: 1.5rem;">
          ← Back to All Guides
        </button>

        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
          <span style="font-size: 0.78rem; font-weight: 800; background: #E0E7FF; color: #4338CA; padding: 0.2rem 0.5rem; border-radius: 6px;">${escapeHtml(l.topic.name)}</span>
          <span style="font-size: 0.78rem; color: #64748B;">⏱️ ${l.readTimeMin} min read</span>
        </div>

        <h2 style="font-family: 'Outfit', sans-serif; font-size: 1.65rem; font-weight: 900; color: #0F172A; margin: 0 0 1rem 0;">${escapeHtml(l.title)}</h2>

        <div style="font-size: 0.98rem; line-height: 1.8; color: #334155; white-space: pre-wrap; margin-bottom: 2rem; background: #F8FAFC; border: 1px solid #E2E8F0; padding: 1.5rem; border-radius: 12px;">
          ${escapeHtml(l.content)}
        </div>

        <div style="text-align: right;">
          <button onclick="finishLesson('${l.id}')" style="background: #10B981; color: #0B0F17; border: none; font-weight: 800; font-size: 0.95rem; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer;">
            Mark Complete &amp; Earn +20 XP →
          </button>
        </div>
      `;
    } catch (e) {
      body.innerHTML = `<div style="text-align: center; padding: 3rem; color: #EF4444;">Failed to load lesson.</div>`;
    }
  };

  window.finishLesson = async function (lessonId) {
    try {
      const res = await fetch(`/api/lessons/${lessonId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const json = await res.json();
      alert(json.message || "Lesson completed! +20 XP awarded.");
      loadAndRenderLessonsTab();
      checkUserAndLoadGamification();
    } catch (e) {
      alert("Please sign in to earn XP for reading lessons.");
    }
  };

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
