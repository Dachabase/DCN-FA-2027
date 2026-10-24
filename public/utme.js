/**
 * =========================================================
 * UTME PREPARATION & MOCK EXAMINATION ENGINE
 * Official Joint Admissions and Matriculation Board Simulation
 * BlastExams Platform Integration
 * =========================================================
 */

(function () {
  const state = {
    currentView: "SELECT", // SELECT | INSTRUCTIONS | EXAM | RESULTS | REVIEW | ADMIN
    activeTab: "SIMULATION", // SIMULATION | FLEXIBLE | DRILL | FLASHCARDS | PROGRESS
    courses: [],
    subjects: [],
    filteredCourses: [],
    selectedCourse: null,
    selectedMode: "FULL_UTME_SIMULATION", // FULL_UTME_SIMULATION | PRACTICE_MODE
    customSubjects: ["ENG", "BIO", "CHM", "PHY"],
    searchQuery: "",
    selectedFaculty: "ALL",

    // Flexible Exam Mode Configuration
    flexibleConfig: {
      subjectCode: "ENG",
      durationMinutes: 30,
      questionCount: 20,
    },

    // Quick Drill Mode Configuration
    drillConfig: {
      subjectCode: "ENG",
      topic: "ALL",
      durationMinutes: 15,
      questionCount: 10,
      isInstantFeedback: true,
    },

    // Flashcards Study Deck State
    flashcardConfig: {
      subjectCode: "ENG",
      topic: "ALL",
      filterMode: "ALL", // ALL | NEEDS_REVISION | KNOWN
    },
    flashcardsDeck: [],
    currentCardIndex: 0,
    isCardFlipped: false,
    flashcardStats: null,
    isFlashcardsLoading: false,

    // Progress Dashboard State
    progressData: null,
    isProgressLoading: false,

    // Active Examination
    activeAttemptId: localStorage.getItem("utme_active_attempt_id") || null,
    examData: null,
    currentQuestionIndex: 0,
    currentSubjectCode: "ENG",
    paletteSubjectCode: "ENG",
    isMobilePaletteOpen: false,
    responses: {}, // questionId -> { selectedOption, isMarkedForReview }
    remainingSeconds: 0,
    timerInterval: null,
    autoSaveNoticeTimeout: null,

    // Results & Review
    resultsData: null,
    reviewData: null,
    reviewFilter: "ALL",
    reviewSubject: "ALL",

    // Admin
    adminStats: null,

    // On-Screen JAMB Calculator (Simplified basic arithmetic)
    calc: {
      isOpen: false,
      display: "0",
      prevOperand: null,
      operation: null,
      subDisplay: "",
      shouldResetDisplay: false,
    },
  };

  // =========================================================
  // INITIALIZATION
  // =========================================================
  async function init() {
    const container = document.getElementById("utme-app-root");
    if (!container) return;

    try {
      await Promise.all([loadCourses(), loadSubjects()]);
      
      // Check if candidate had an ongoing active exam
      if (state.activeAttemptId) {
        await tryRestoreActiveExam();
      } else {
        render();
      }
    } catch (err) {
      console.error("UTME platform init error:", err);
      container.innerHTML = `
        <div style="padding: 2rem; text-align: center; background: #FFF; border-radius: 12px; border: 1px solid #E2E8F0;">
          <h3 style="color: #EF4444; margin-bottom: 0.5rem;">Failed to load examination bank</h3>
          <p style="color: #64748B; margin-bottom: 1rem;">Please check your connection and reload the page.</p>
          <button onclick="window.UTME.init()" class="action-btn" style="padding: 0.6rem 1.2rem;">Retry Connection</button>
        </div>
      `;
    }
  }

  // =========================================================
  // DATA FETCHING
  // =========================================================
  async function loadCourses() {
    const res = await fetch("/api/utme/courses");
    const json = await res.json();
    if (json.success) {
      state.courses = json.data;
      state.filteredCourses = json.data;
      if (state.courses.length > 0 && !state.selectedCourse) {
        state.selectedCourse = state.courses[0]; // Default Medicine & Surgery
      }
    }
  }

  async function loadSubjects() {
    const res = await fetch("/api/utme/subjects");
    const json = await res.json();
    if (json.success) {
      state.subjects = json.data;
    }
  }

  function saveCurrentPosition(idx) {
    if (!state.activeAttemptId) return;
    fetch(`/api/utme/exam/${state.activeAttemptId}/position`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentQuestionIndex: idx }),
    }).catch(() => {});
  }

  async function tryRestoreActiveExam() {
    try {
      const res = await fetch(`/api/utme/exam/${state.activeAttemptId}/state`);
      const json = await res.json();
      if (json.success && json.data.status === "IN_PROGRESS" && json.data.remainingSeconds > 0) {
        state.examData = json.data;
        state.remainingSeconds = json.data.remainingSeconds;
        state.responses = json.data.savedResponses || {};
        state.currentQuestionIndex = typeof json.data.currentQuestionIndex === "number" ? json.data.currentQuestionIndex : 0;
        const currentQ = json.data.questions?.[state.currentQuestionIndex];
        state.currentSubjectCode = currentQ ? currentQ.subjectCode : (json.data.subjectCodes[0] || "ENG");
        state.paletteSubjectCode = state.currentSubjectCode;
        state.currentView = "EXAM";
        startCountdownTimer();
        render();
        return;
      }
    } catch (e) {
      // Discard invalid attempt
      localStorage.removeItem("utme_active_attempt_id");
      state.activeAttemptId = null;
    }
    render();
  }

  // =========================================================
  // VIEW ROUTER / RENDER CONTROLLER
  // =========================================================
  function render() {
    const container = document.getElementById("utme-app-root");
    if (!container) return;

    // Distraction-free mobile & desktop exam mode
    if (document.body) {
      document.body.classList.toggle("utme-in-exam", state.currentView === "EXAM");
    }

    switch (state.currentView) {
      case "SELECT":
        container.innerHTML = renderCourseSelectView();
        attachCourseSelectEvents();
        break;
      case "INSTRUCTIONS":
        container.innerHTML = renderInstructionsView();
        break;
      case "EXAM":
        container.innerHTML = renderExamHallView();
        attachExamHallEvents();
        break;
      case "RESULTS":
        container.innerHTML = renderResultsView();
        break;
      case "REVIEW":
        container.innerHTML = renderReviewView();
        break;
      case "ADMIN":
        container.innerHTML = renderAdminDashboardView();
        loadAdminStats();
        break;
    }
  }

  // =========================================================
  // VIEW 1: COURSE & SUBJECT SELECTION
  // =========================================================
  // =========================================================
  // VIEW 1: PREPARATION HUB (TABS: SIMULATION | FLEXIBLE | DRILL | FLASHCARDS | PROGRESS)
  // =========================================================
  function renderCourseSelectView() {
    const totalQ = state.subjects.reduce((sum, s) => sum + (s.availableQuestionsCount || 0), 0);

    return `
      <div class="utme-container">
        <!-- Hero Header -->
        <div class="utme-hero-banner">
          <div class="utme-badge-tag">
            <span><svg class="utme-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.4rem;" aria-hidden="true"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>Official Joint Admissions and Matriculation Board (JAMB) Standards</span>
          </div>
          <h1 class="utme-hero-title">UTME CBT Mock Examination Simulator</h1>
          <p class="utme-hero-desc">
            Choose your intended course of study, verify your official 4-subject combination, take a realistic timed examination, and master step-by-step educational explanations for every question.
          </p>

          <div class="utme-stats-ribbon">
            <div class="utme-stat-pill">
              <span class="utme-stat-num">${totalQ.toLocaleString()}+</span>
              <span>Past Questions in Database</span>
            </div>
            <div class="utme-stat-pill">
              <span class="utme-stat-num">${state.subjects.length}</span>
              <span>Accredited UTME Subjects</span>
            </div>
            <div class="utme-stat-pill">
              <span class="utme-stat-num">${state.courses.length}</span>
              <span>Degree Programmes Supported</span>
            </div>
            <div class="utme-stat-pill" style="margin-left: auto;">
              <button onclick="window.UTME.openAdmin()" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #FFF; padding: 0.35rem 0.85rem; border-radius: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer;">
                <svg class="utme-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>Content Admin & Audit Bank
              </button>
            </div>
          </div>
        </div>

        <!-- Mode & Feature Navigation Tabs -->
        <div class="utme-main-nav-tabs">
          <button class="utme-nav-tab-btn ${state.activeTab === 'SIMULATION' ? 'active' : ''}" onclick="window.UTME.switchFeatureTab('SIMULATION')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m10 15 5-3-5-3v6Z"/></svg>
            Full UTME Simulation
          </button>
          <button class="utme-nav-tab-btn ${state.activeTab === 'FLEXIBLE' ? 'active' : ''}" onclick="window.UTME.switchFeatureTab('FLEXIBLE')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Flexible Practice
          </button>
          <button class="utme-nav-tab-btn ${state.activeTab === 'DRILL' ? 'active' : ''}" onclick="window.UTME.switchFeatureTab('DRILL')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Quick Drill
          </button>
          <button class="utme-nav-tab-btn ${state.activeTab === 'FLASHCARDS' ? 'active' : ''}" onclick="window.UTME.switchFeatureTab('FLASHCARDS')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            Flashcards
          </button>
          <button class="utme-nav-tab-btn ${state.activeTab === 'PROGRESS' ? 'active' : ''}" onclick="window.UTME.switchFeatureTab('PROGRESS')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            Progress Dashboard
          </button>
        </div>

        ${state.activeTab === 'FLEXIBLE' ? renderFlexiblePracticeView() : 
          (state.activeTab === 'DRILL' ? renderQuickDrillView() : 
          (state.activeTab === 'FLASHCARDS' ? renderFlashcardsView() : 
          (state.activeTab === 'PROGRESS' ? renderProgressDashboardView() : 
          renderSimulationCourseView())))}
      </div>
    `;
  }

  function renderSimulationCourseView() {
    const faculties = ["ALL", "Clinical Sciences", "Computing", "Technology", "Law", "Economics and Management Sciences", "The Social Sciences", "Arts", "Basic Medical Sciences", "Agriculture", "Environmental Design and Management"];

    return `
      <!-- Mode Toggle -->
      <div class="utme-config-box">
        <div class="utme-config-title">1. Select Your Examination Mode</div>
        <p style="color: var(--ps-text-gray); font-size: 0.92rem;">Experience real examination conditions matching official JAMB timing or quick topic revision.</p>

        <div class="utme-mode-selector">
          <div class="utme-mode-card ${state.selectedMode === 'FULL_UTME_SIMULATION' ? 'active' : ''}" onclick="window.UTME.setMode('FULL_UTME_SIMULATION')">
            <div class="utme-mode-header">
              <span class="utme-mode-name">Full UTME Exam Simulation</span>
              <span style="background: #10B981; color: #FFF; font-size: 0.75rem; font-weight: 800; padding: 0.15rem 0.5rem; border-radius: 6px;">RECOMMENDED</span>
            </div>
            <div class="utme-mode-details">
              <strong>4 Subjects • 180 Questions • 120 Minutes</strong><br>
              Use of English (60 Questions) + 3 Departmental Subjects (40 Questions each). Scaled out of 400 marks.
            </div>
          </div>

          <div class="utme-mode-card ${state.selectedMode === 'PRACTICE_MODE' ? 'active' : ''}" onclick="window.UTME.setMode('PRACTICE_MODE')">
            <div class="utme-mode-header">
              <span class="utme-mode-name">Express Practice Session</span>
              <span style="background: var(--ps-purple-soft); color: var(--ps-purple-hover); font-size: 0.75rem; font-weight: 800; padding: 0.15rem 0.5rem; border-radius: 6px;">QUICK DRILL</span>
            </div>
            <div class="utme-mode-details">
              <strong>4 Subjects • 45 Questions • 35 Minutes</strong><br>
              Fast-paced revision drill for mobile study and quick conceptual checkups.
            </div>
          </div>
        </div>

        <div class="utme-config-title" style="margin-top: 2rem;">2. Choose Your Desired Course of Study</div>
        <p style="color: var(--ps-text-gray); font-size: 0.92rem; margin-bottom: 1.25rem;">
          Select your course to automatically configure your officially required 4 UTME subjects based on the Joint Admissions and Matriculation Board brochure.
        </p>

        <!-- Search & Filter Bar -->
        <div class="utme-search-wrap">
          <div class="utme-search-input-box">
            <svg class="utme-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" id="utme-course-search" class="utme-search-input" placeholder="Search course (e.g. Medicine, Computer Science, Law, Accounting, Nursing)..." value="${escapeHtml(state.searchQuery)}">
          </div>

          <div class="utme-filter-chips">
            ${faculties.map(f => `
              <button class="utme-chip ${state.selectedFaculty === f ? 'active' : ''}" onclick="window.UTME.filterFaculty('${f}')">${f === 'ALL' ? 'All Faculties' : f}</button>
            `).join('')}
          </div>
        </div>

        <!-- Courses Grid -->
        <div class="utme-courses-grid">
          ${state.filteredCourses.map(c => `
            <div class="utme-course-card ${state.selectedCourse?.slug === c.slug ? 'selected' : ''}" onclick="window.UTME.selectCourse('${c.slug}')">
              <div>
                <div class="utme-course-header">
                  <h3 class="utme-course-title">${escapeHtml(c.courseName)}</h3>
                  <span class="utme-degree-badge">${escapeHtml(c.degreeType)}</span>
                </div>
                <div class="utme-faculty-label">Faculty of ${escapeHtml(c.facultyName)}</div>

                <div class="utme-subjects-pills-label">Required UTME Subjects (4):</div>
                <div class="utme-subject-pills">
                  ${c.compulsorySubjects.map((s, idx) => `
                    <span class="utme-subject-pill ${idx === 0 ? 'compulsory' : ''}">
                      ${idx === 0 ? '<svg class="utme-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" style="vertical-align:-0.1em;margin-right:0.25rem;" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : ''}${escapeHtml(s)}
                    </span>
                  `).join('')}
                </div>

                ${c.institutionNotes ? `
                  <div class="utme-course-notes">
                    <strong><svg class="utme-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>Institution Note:</strong> ${escapeHtml(c.institutionNotes)}
                  </div>
                ` : ''}

                <div class="utme-source-citation">
                  <span><svg class="utme-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>${escapeHtml(c.officialSource)}</span>
                </div>
              </div>

              <button class="utme-course-action-btn" onclick="window.UTME.proceedToInstructions('${c.slug}', event)">
                <span>Start Mock Exam for ${escapeHtml(c.courseName)} →</span>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // =========================================================
  // VIEW 1B: FLEXIBLE PRACTICE CONFIGURATION
  // =========================================================
  function renderFlexiblePracticeView() {
    const curSub = state.subjects.find(s => s.code === state.flexibleConfig.subjectCode) || state.subjects[0] || { name: 'Use of English', code: 'ENG' };

    return `
      <div class="utme-config-box">
        <div class="utme-config-title">⏱ Configure Flexible Practice Exam</div>
        <p style="color: var(--ps-text-gray); font-size: 0.92rem; margin-bottom: 1.5rem;">
          Customize your examination duration and question count to match your study schedule without compromising question quality.
        </p>

        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; font-weight: 700; color: #1E293B; margin-bottom: 0.5rem;">1. Select Subject:</label>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${state.subjects.map(s => `
              <button class="utme-chip ${state.flexibleConfig.subjectCode === s.code ? 'active' : ''}" onclick="window.UTME.setFlexibleSubject('${s.code}')">
                ${escapeHtml(s.name)} (${s.code})
              </button>
            `).join('')}
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; font-weight: 700; color: #1E293B; margin-bottom: 0.5rem;">2. Select Duration:</label>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${[15, 30, 45, 60].map(mins => `
              <button class="utme-chip ${state.flexibleConfig.durationMinutes === mins ? 'active' : ''}" onclick="window.UTME.setFlexibleDuration(${mins})">
                ${mins} Minutes
              </button>
            `).join('')}
            <button class="utme-chip ${state.flexibleConfig.durationMinutes === 120 ? 'active' : ''}" onclick="window.UTME.setFlexibleDuration(120)">
              Full-Length (120 Mins)
            </button>
          </div>
        </div>

        <div style="margin-bottom: 1.75rem;">
          <label style="display: block; font-weight: 700; color: #1E293B; margin-bottom: 0.5rem;">3. Number of Questions:</label>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${[10, 15, 20, 30, 40, 50].map(cnt => `
              <button class="utme-chip ${state.flexibleConfig.questionCount === cnt ? 'active' : ''}" onclick="window.UTME.setFlexibleQuestionCount(${cnt})">
                ${cnt} Questions
              </button>
            `).join('')}
          </div>
        </div>

        <div style="background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="font-weight: 800; color: #0F172A; font-size: 1.05rem;">
              ${escapeHtml(curSub.name)} Practice Session
            </div>
            <div style="color: #64748B; font-size: 0.88rem; margin-top: 0.2rem;">
              ${state.flexibleConfig.questionCount} Questions • ${state.flexibleConfig.durationMinutes} Minutes • Verified Question Bank
            </div>
          </div>
          <button onclick="window.UTME.startFlexibleExam()" class="action-btn" style="background: #7C3AED; color: #FFF; font-weight: 800; padding: 0.75rem 1.75rem; border-radius: 10px; border: none; cursor: pointer; font-size: 1rem; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.3);">
            Start Practice Session →
          </button>
        </div>
      </div>
    `;
  }

  // =========================================================
  // VIEW 1C: QUICK DRILL CONFIGURATION
  // =========================================================
  function renderQuickDrillView() {
    return `
      <div class="utme-config-box">
        <div class="utme-config-title">⚡ Quick Drill Revision Hub</div>
        <p style="color: var(--ps-text-gray); font-size: 0.92rem; margin-bottom: 1.5rem;">
          Target specific subjects with rapid, high-yield practice and optional instant step-by-step educational explanations.
        </p>

        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; font-weight: 700; color: #1E293B; margin-bottom: 0.5rem;">1. Choose Subject:</label>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${state.subjects.map(s => `
              <button class="utme-chip ${state.drillConfig.subjectCode === s.code ? 'active' : ''}" onclick="window.UTME.setDrillSubject('${s.code}')">
                ${escapeHtml(s.name)}
              </button>
            `).join('')}
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; font-weight: 700; color: #1E293B; margin-bottom: 0.5rem;">2. Number of Questions (Presets):</label>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${[5, 10, 20, 30, 50].map(cnt => `
              <button class="utme-chip ${state.drillConfig.questionCount === cnt ? 'active' : ''}" onclick="window.UTME.setDrillQuestionCount(${cnt})">
                ${cnt} Questions
              </button>
            `).join('')}
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; font-weight: 700; color: #1E293B; margin-bottom: 0.5rem;">3. Time Available (Presets):</label>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${[5, 10, 15, 20, 30].map(mins => `
              <button class="utme-chip ${state.drillConfig.durationMinutes === mins ? 'active' : ''}" onclick="window.UTME.setDrillDuration(${mins})">
                ${mins} Minutes
              </button>
            `).join('')}
          </div>
        </div>

        <div style="margin-bottom: 1.75rem;">
          <label style="display: block; font-weight: 700; color: #1E293B; margin-bottom: 0.5rem;">4. Explanation Mode:</label>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <div class="utme-mode-card ${state.drillConfig.isInstantFeedback ? 'active' : ''}" onclick="window.UTME.setDrillFeedback(true)" style="flex: 1; min-width: 240px; cursor: pointer; padding: 1rem; border-radius: 10px;">
              <div style="font-weight: 800; color: #10B981; font-size: 0.95rem; margin-bottom: 0.25rem;">✓ Instant Feedback (Recommended)</div>
              <div style="font-size: 0.85rem; color: #64748B;">Reveals the verified solution and educational explanation immediately after selecting an option.</div>
            </div>
            <div class="utme-mode-card ${!state.drillConfig.isInstantFeedback ? 'active' : ''}" onclick="window.UTME.setDrillFeedback(false)" style="flex: 1; min-width: 240px; cursor: pointer; padding: 1rem; border-radius: 10px;">
              <div style="font-weight: 800; color: #7C3AED; font-size: 0.95rem; margin-bottom: 0.25rem;">📋 End-of-Drill Review</div>
              <div style="font-size: 0.85rem; color: #64748B;">Take the drill uninterrupted and review all scores and explanations on final submission.</div>
            </div>
          </div>
        </div>

        <div style="text-align: right;">
          <button onclick="window.UTME.startQuickDrill()" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFF; font-weight: 800; padding: 0.85rem 2rem; border-radius: 10px; border: none; cursor: pointer; font-size: 1.05rem; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);">
            Launch Quick Drill (${state.drillConfig.questionCount} Qs in ${state.drillConfig.durationMinutes} Mins) →
          </button>
        </div>
      </div>
    `;
  }

  // =========================================================
  // VIEW 1D: ACTIVE RECALL FLASHCARDS
  // =========================================================
  function renderFlashcardsView() {
    return `
      <div class="utme-config-box">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <div class="utme-config-title">🗂 Active Recall Flashcard Decks</div>
            <p style="color: var(--ps-text-gray); font-size: 0.92rem; margin-top: 0.2rem;">
              Master key definitions, formulas, and verified past questions with active recall.
            </p>
          </div>
          ${state.flashcardStats ? `
            <div style="display: flex; gap: 0.75rem;">
              <span style="background: #D1FAE5; color: #065F46; padding: 0.35rem 0.75rem; border-radius: 8px; font-weight: 700; font-size: 0.85rem;">
                ✓ ${state.flashcardStats.knownCards} Mastered
              </span>
              <span style="background: #FEE2E2; color: #991B1B; padding: 0.35rem 0.75rem; border-radius: 8px; font-weight: 700; font-size: 0.85rem;">
                ⚠️ ${state.flashcardStats.needsRevisionCards} Needs Revision
              </span>
            </div>
          ` : ''}
        </div>

        <!-- Subject Filter Chips -->
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.25rem;">
          ${state.subjects.map(s => `
            <button class="utme-chip ${state.flashcardConfig.subjectCode === s.code ? 'active' : ''}" onclick="window.UTME.setFlashcardSubject('${s.code}')">
              ${escapeHtml(s.name)}
            </button>
          `).join('')}
        </div>

        <!-- Deck Filter Mode: All / Needs Revision / Mastered -->
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid #E2E8F0; padding-bottom: 1rem;">
          <button class="utme-chip ${state.flashcardConfig.filterMode === 'ALL' ? 'active' : ''}" onclick="window.UTME.setFlashcardFilter('ALL')">
            All Cards
          </button>
          <button class="utme-chip ${state.flashcardConfig.filterMode === 'NEEDS_REVISION' ? 'active' : ''}" onclick="window.UTME.setFlashcardFilter('NEEDS_REVISION')">
            Needs Revision
          </button>
          <button class="utme-chip ${state.flashcardConfig.filterMode === 'KNOWN' ? 'active' : ''}" onclick="window.UTME.setFlashcardFilter('KNOWN')">
            Mastered
          </button>
          <button onclick="window.UTME.shuffleFlashcards()" style="margin-left: auto; background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; padding: 0.4rem 0.85rem; border-radius: 8px; font-weight: 700; font-size: 0.82rem; cursor: pointer;">
            🔀 Shuffle Deck
          </button>
        </div>

        ${state.isFlashcardsLoading ? `
          <div style="text-align: center; padding: 3rem; color: #64748B;">Loading study deck...</div>
        ` : (state.flashcardsDeck.length === 0 ? `
          <div style="text-align: center; padding: 3rem; background: #F8FAFC; border-radius: 12px; border: 1px dashed #CBD5E1;">
            <h3 style="color: #475569; margin-bottom: 0.5rem;">No flashcards found for this selection</h3>
            <p style="color: #64748B; margin-bottom: 1rem;">Try switching to "All Cards" or selecting another subject.</p>
            <button onclick="window.UTME.setFlashcardFilter('ALL')" class="action-btn" style="padding: 0.5rem 1.25rem;">View All Cards</button>
          </div>
        ` : `
          <!-- Interactive 3D Flip Card -->
          <div class="utme-flashcard-wrap" onclick="window.UTME.flipFlashcard()">
            <div class="utme-flashcard ${state.isCardFlipped ? 'flipped' : ''}">
              <!-- FRONT -->
              <div class="utme-flashcard-front">
                <div class="utme-flashcard-header">
                  <span style="font-weight: 800; font-size: 0.85rem; color: #7C3AED; background: #EDE9FE; padding: 0.2rem 0.6rem; border-radius: 6px;">
                    ${escapeHtml(state.flashcardsDeck[state.currentCardIndex]?.subjectName || 'Question')} • Card ${state.currentCardIndex + 1}/${state.flashcardsDeck.length}
                  </span>
                  <span style="font-size: 0.8rem; color: #64748B; font-weight: 600;">
                    ${state.flashcardsDeck[state.currentCardIndex]?.userStatus === 'KNOWN' ? '<span style="color:#059669;font-weight:800;">✓ Mastered</span>' : (state.flashcardsDeck[state.currentCardIndex]?.userStatus === 'NEEDS_REVISION' ? '<span style="color:#DC2626;font-weight:800;">⚠️ Needs Revision</span>' : 'Unrated')}
                  </span>
                </div>

                <div class="utme-flashcard-prompt">
                  ${escapeHtml(state.flashcardsDeck[state.currentCardIndex]?.frontPrompt || '')}
                </div>

                <div class="utme-flashcard-hint">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-0.15em;margin-right:0.35rem;"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
                  Click or tap card to reveal verified answer & educational explanation
                </div>
              </div>

              <!-- BACK -->
              <div class="utme-flashcard-back">
                <div class="utme-flashcard-header">
                  <span style="font-weight: 800; font-size: 0.85rem; color: #059669; background: #D1FAE5; padding: 0.2rem 0.6rem; border-radius: 6px;">
                    Verified Solution
                  </span>
                  <span style="font-size: 0.8rem; color: #64748B;">Card ${state.currentCardIndex + 1} of ${state.flashcardsDeck.length}</span>
                </div>

                <div class="utme-flashcard-answer">
                  Option (${escapeHtml(state.flashcardsDeck[state.currentCardIndex]?.correctAnswer || '')}): ${escapeHtml(state.flashcardsDeck[state.currentCardIndex]?.correctOptionText || '')}
                </div>

                <div class="utme-flashcard-expl">
                  ${escapeHtml(state.flashcardsDeck[state.currentCardIndex]?.backExplanation || '')}
                </div>

                <div class="utme-flashcard-hint" style="color: #6D28D9;">
                  Tap card again to flip back
                </div>
              </div>
            </div>
          </div>

          <!-- Rating & Deck Navigation Controls -->
          <div class="utme-flashcard-controls">
            <button class="utme-nav-prev-btn" onclick="event.stopPropagation(); window.UTME.prevFlashcard();" ${state.currentCardIndex === 0 ? 'disabled style="opacity: 0.4;"' : ''}>
              ← Prev Card
            </button>

            <button class="utme-card-rate-btn needs-rev" onclick="event.stopPropagation(); window.UTME.rateCurrentCard('NEEDS_REVISION');">
              ⚠️ Needs Revision
            </button>

            <button class="utme-card-rate-btn mastered" onclick="event.stopPropagation(); window.UTME.rateCurrentCard('KNOWN');">
              ✓ Mastered
            </button>

            <button class="utme-nav-next-btn" onclick="event.stopPropagation(); window.UTME.nextFlashcard();" ${state.currentCardIndex === state.flashcardsDeck.length - 1 ? 'disabled style="opacity: 0.4;"' : ''}>
              Next Card →
            </button>
          </div>
        `)}
      </div>
    `;
  }

  // =========================================================
  // VIEW 1E: PROGRESS DASHBOARD
  // =========================================================
  function renderProgressDashboardView() {
    return `
      <div class="utme-config-box">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <div class="utme-config-title">📈 Your UTME Performance & Progress Dashboard</div>
            <p style="color: var(--ps-text-gray); font-size: 0.92rem; margin-top: 0.2rem;">
              Track your improvement, subject mastery, diagnostic accuracy, and detailed historical examination reviews.
            </p>
          </div>
          <button onclick="window.UTME.loadProgressDashboard()" style="background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; padding: 0.45rem 0.95rem; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer;">
            ↻ Refresh Metrics
          </button>
        </div>

        ${state.isProgressLoading ? `
          <div style="text-align: center; padding: 3rem; color: #64748B;">Analyzing performance records...</div>
        ` : (!state.progressData ? `
          <div style="text-align: center; padding: 3rem; color: #64748B;">Click refresh to load your performance data.</div>
        ` : `
          <!-- High-level Metric Cards -->
          <div class="utme-dash-stats-grid">
            <div class="utme-dash-stat-card">
              <div style="font-size: 0.82rem; font-weight: 800; color: #64748B; text-transform: uppercase;">Overall Accuracy</div>
              <div class="utme-dash-stat-val" style="color: #10B981;">${state.progressData.overallAccuracy}%</div>
              <div style="font-size: 0.8rem; color: #64748B; margin-top: 0.2rem;">Across all attempts</div>
            </div>
            <div class="utme-dash-stat-card">
              <div style="font-size: 0.82rem; font-weight: 800; color: #64748B; text-transform: uppercase;">Total Questions Solved</div>
              <div class="utme-dash-stat-val" style="color: #7C3AED;">${state.progressData.totalQuestionsAnswered}</div>
              <div style="font-size: 0.8rem; color: #64748B; margin-top: 0.2rem;">${state.progressData.totalCorrect} Correct Answers</div>
            </div>
            <div class="utme-dash-stat-card">
              <div style="font-size: 0.82rem; font-weight: 800; color: #64748B; text-transform: uppercase;">Exams & Drills Completed</div>
              <div class="utme-dash-stat-val" style="color: #0F172A;">${state.progressData.totalAttempts}</div>
              <div style="font-size: 0.8rem; color: #64748B; margin-top: 0.2rem;">Stored in performance history</div>
            </div>
            <div class="utme-dash-stat-card">
              <div style="font-size: 0.82rem; font-weight: 800; color: #64748B; text-transform: uppercase;">Highest Mock Score</div>
              <div class="utme-dash-stat-val" style="color: #F59E0B;">${state.progressData.highestScore} <span style="font-size: 1.1rem; color: #94A3B8;">/ 400</span></div>
              <div style="font-size: 0.8rem; color: #64748B; margin-top: 0.2rem;">Personal Best</div>
            </div>
          </div>

          <!-- Subject Breakdown & Diagnostic Insights Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
            <!-- Subject Mastery -->
            <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1.5rem;">
              <h3 style="font-size: 1.15rem; font-weight: 800; color: #0F172A; margin-bottom: 1rem;">Subject Performance Breakdown</h3>
              ${(state.progressData.subjectBreakdown || []).map(sb => `
                <div style="margin-bottom: 1rem;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.88rem; font-weight: 700; color: #1E293B; margin-bottom: 0.35rem;">
                    <span>${escapeHtml(sb.subjectName)}</span>
                    <span>${sb.accuracy}% (${sb.correct}/${sb.total})</span>
                  </div>
                  <div class="utme-progress-bar-bg">
                    <div class="utme-progress-bar-fill" style="width: ${sb.accuracy}%; background: ${sb.accuracy >= 70 ? '#10B981' : (sb.accuracy >= 50 ? '#F59E0B' : '#EF4444')};"></div>
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Diagnostic Strengths & Growth Areas -->
            <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1.5rem;">
              <h3 style="font-size: 1.15rem; font-weight: 800; color: #0F172A; margin-bottom: 1rem;">Diagnostic Insights</h3>
              <div style="margin-bottom: 1.25rem;">
                <div style="font-size: 0.85rem; font-weight: 800; color: #065F46; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
                  ✓ Proven Strengths:
                </div>
                <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                  ${(state.progressData.strengths || []).map(st => `
                    <span style="background: #D1FAE5; color: #065F46; padding: 0.3rem 0.65rem; border-radius: 6px; font-weight: 700; font-size: 0.8rem;">
                      ${escapeHtml(st)}
                    </span>
                  `).join('')}
                </div>
              </div>

              <div>
                <div style="font-size: 0.85rem; font-weight: 800; color: #991B1B; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
                  ⚠️ Focus & Improvement Areas:
                </div>
                <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                  ${(state.progressData.weaknesses || []).map(wk => `
                    <span style="background: #FEE2E2; color: #991B1B; padding: 0.3rem 0.65rem; border-radius: 6px; font-weight: 700; font-size: 0.8rem;">
                      ${escapeHtml(wk)}
                    </span>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- Attempt History Table -->
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1.5rem; overflow-x: auto;">
            <h3 style="font-size: 1.15rem; font-weight: 800; color: #0F172A; margin-bottom: 1rem;">Historical Examination & Drill Attempts</h3>
            <table class="utme-dash-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Subjects / Course</th>
                  <th>Score</th>
                  <th>Accuracy</th>
                  <th>Duration</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${(state.progressData.attempts || []).map(att => `
                  <tr>
                    <td>${new Date(att.completedAt).toLocaleDateString()} ${new Date(att.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span style="font-weight: 700; font-size: 0.8rem; background: #F1F5F9; padding: 0.2rem 0.5rem; border-radius: 4px;">${escapeHtml(att.examType || att.mode)}</span></td>
                    <td>${escapeHtml(att.courseName)}</td>
                    <td><strong>${att.score} / ${att.totalQuestions * 2.22 > 100 ? 400 : att.totalQuestions}</strong></td>
                    <td><span style="color: ${att.accuracy >= 65 ? '#10B981' : '#EF4444'}; font-weight: 700;">${att.accuracy}%</span></td>
                    <td>${Math.round(att.durationMinutes)} mins</td>
                    <td>
                      <button onclick="window.UTME.openReview('${att.id}')" style="background: #EDE9FE; border: 1px solid #C4B5FD; color: #6D28D9; padding: 0.35rem 0.75rem; border-radius: 6px; font-weight: 700; font-size: 0.82rem; cursor: pointer;">
                        Review Solutions →
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `)}
      </div>
    `;
  }
  function attachCourseSelectEvents() {
    const searchInput = document.getElementById("utme-course-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        applyCourseFilters();
      });
    }
  }

  function applyCourseFilters() {
    state.filteredCourses = state.courses.filter(c => {
      const matchSearch = !state.searchQuery ||
        c.courseName.toLowerCase().includes(state.searchQuery) ||
        c.facultyName.toLowerCase().includes(state.searchQuery) ||
        c.compulsorySubjects.some(s => s.toLowerCase().includes(state.searchQuery));
      
      const matchFaculty = state.selectedFaculty === "ALL" || c.facultyName.toLowerCase().includes(state.selectedFaculty.toLowerCase());
      return matchSearch && matchFaculty;
    });
    render();
  }

  // =========================================================
  // VIEW 2: PRE-EXAM INSTRUCTIONS
  // =========================================================
  function renderInstructionsView() {
    const c = state.selectedCourse;
    const isFull = state.selectedMode === "FULL_UTME_SIMULATION";
    const totalQ = isFull ? 180 : 45;
    const duration = isFull ? 120 : 35;

    return `
      <div class="utme-container" style="max-width: 860px;">
        <div class="utme-instructions-card" style="background: #FFFFFF; border: 1px solid var(--ps-border-light); border-radius: var(--radius-lg); padding: 2.5rem; box-shadow: var(--shadow-card-light);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 1px solid #E2E8F0; padding-bottom: 1.25rem;">
            <div>
              <span class="utme-badge-tag" style="margin-bottom: 0.5rem;">CANDIDATE ADMITTANCE CARD</span>
              <h2 style="font-family: 'Outfit', sans-serif; font-size: 1.85rem; font-weight: 800; color: #0F172A; margin: 0;">
                ${escapeHtml(c.courseName)}
              </h2>
            </div>
            <button onclick="window.UTME.setView('SELECT')" style="background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 700; cursor: pointer;">
              ← Change Course
            </button>
          </div>

          <div class="utme-instructions-stats-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 1rem; text-align: center;">
              <div style="font-size: 0.75rem; font-weight: 800; color: #64748B; text-transform: uppercase;">Duration</div>
              <div style="font-family: 'Outfit', sans-serif; font-size: 1.4rem; font-weight: 800; color: var(--ps-purple-hover);">${duration} Minutes</div>
            </div>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 1rem; text-align: center;">
              <div style="font-size: 0.75rem; font-weight: 800; color: #64748B; text-transform: uppercase;">Total Questions</div>
              <div style="font-family: 'Outfit', sans-serif; font-size: 1.4rem; font-weight: 800; color: var(--ps-purple-hover);">${totalQ} Questions</div>
            </div>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 1rem; text-align: center;">
              <div style="font-size: 0.75rem; font-weight: 800; color: #64748B; text-transform: uppercase;">Max Aggregate</div>
              <div style="font-family: 'Outfit', sans-serif; font-size: 1.4rem; font-weight: 800; color: #10B981;">400 Marks</div>
            </div>
          </div>

          <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 800; margin-bottom: 0.75rem;">Assigned Subject Sections:</h3>
          <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 2rem;">
            ${c.compulsorySubjects.map((s, idx) => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0;">
                <span style="font-weight: 700; color: #1E293B;">
                  ${idx + 1}. ${escapeHtml(s)} ${idx === 0 ? '<span style="color: #6D28D9; font-size: 0.8rem; font-weight: 800;">(Compulsory)</span>' : ''}
                </span>
                <span style="font-size: 0.85rem; color: #64748B; font-weight: 600;">
                  ${isFull ? (idx === 0 ? '60 Questions' : '40 Questions') : (idx === 0 ? '15 Questions' : '10 Questions')}
                </span>
              </div>
            `).join('')}
          </div>

          <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 800; margin-bottom: 0.75rem;">Official CBT Examination Rules:</h3>
          <ul style="color: #475569; font-size: 0.95rem; line-height: 1.7; padding-left: 1.25rem; margin-bottom: 2.25rem;">
            <li><strong>Timer Security:</strong> The official countdown timer is strictly enforced on the server. If the timer reaches 00:00:00, your exam will be automatically submitted.</li>
            <li><strong>Navigation:</strong> You can move freely between questions and subject sections at any time before submission.</li>
            <li><strong>Flagging:</strong> Use the <em>"Mark for Review"</em> button on any question you are uncertain about to easily revisit it from the Question Palette.</li>
            <li><strong>Automatic Saving:</strong> Every response is securely saved to the database in real-time. If your browser reloads or your connection drops, your answers and remaining time are preserved.</li>
            <li><strong>No Negative Marking:</strong> There is no penalty for guessing. Attempt every question before final submission!</li>
          </ul>

          <div style="display: flex; gap: 1rem;">
            <button onclick="window.UTME.startExamAction()" class="utme-course-action-btn" style="padding: 1rem; font-size: 1.05rem;">
              <span>Begin Examination Now (Start Timer) <svg class="utme-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-left:0.35rem;" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================
  // VIEW 3: LIVE EXAMINATION ROOM
  // =========================================================
  function renderExamHallView() {
    if (!state.examData) return `<div>Loading exam room...</div>`;

    const questions = state.examData.questions || [];
    const currentQ = questions[state.currentQuestionIndex];
    if (!currentQ) return `<div>Error loading question index.</div>`;

    const savedResp = state.responses[currentQ.id] || { selectedOption: null, isMarkedForReview: false };
    const currentSubjectCode = currentQ.subjectCode;
    const subjectQuestions = questions.filter(q => q.subjectCode === currentSubjectCode);
    const subjectQIndex = subjectQuestions.findIndex(q => q.id === currentQ.id) + 1;

    // Timer format
    const m = Math.floor(state.remainingSeconds / 60);
    const s = state.remainingSeconds % 60;
    const timeFormatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    const timerClass = state.remainingSeconds < 300 ? "danger" : (state.remainingSeconds < 600 ? "warning" : "");

    // Palette counts
    const answeredCount = Object.values(state.responses).filter(r => r.selectedOption !== null && r.selectedOption !== "").length;
    const flaggedCount = Object.values(state.responses).filter(r => r.isMarkedForReview).length;
    const totalQ = questions.length;

    return `
      <div class="utme-container" style="max-width: 1300px; padding: 0;">
        <div class="utme-exam-hall">
          <!-- Top Bar -->
          <div class="utme-exam-topbar">
            <div class="utme-topbar-row-1">
              <div class="utme-topbar-left">
                <div class="utme-exam-course-title">
                  ${escapeHtml(state.examData.courseName)} • ${state.examData.mode === 'FULL_UTME_SIMULATION' ? 'Full Simulation' : 'Practice Drill'}
                </div>
              </div>

              <!-- Timer, Palette & Actions -->
              <div class="utme-topbar-right">
                <button class="utme-calc-toggle-btn" onclick="window.UTME.toggleCalculator()" aria-label="Open Official Calculator">
                  <span class="utme-btn-icon" style="display:inline-flex;align-items:center;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg></span> <span>Calculator</span>
                </button>

                <button class="utme-mobile-palette-toggle-btn" onclick="window.UTME.toggleMobilePalette()" aria-label="Open Question Palette">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>Palette (${answeredCount}/${totalQ})
                </button>

                <div id="utme-timer-el" class="utme-timer-badge ${timerClass}">
                  <span style="display:inline-flex;align-items:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
                  <span>${timeFormatted}</span>
                </div>

                <button class="utme-topbar-submit-btn" onclick="window.UTME.promptSubmit()">
                  Submit <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-left:0.35rem;" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
              </div>
            </div>

            <div class="utme-topbar-row-2">
              <div class="utme-exam-subject-tabs">
                ${state.examData.subjectCodes.map(code => {
                  const subCount = questions.filter(q => q.subjectCode === code).length;
                  const subAns = questions.filter(q => q.subjectCode === code && state.responses[q.id]?.selectedOption).length;
                  const isActive = currentSubjectCode === code;
                  return `
                    <button class="utme-exam-subject-tab ${isActive ? 'active' : ''}" onclick="window.UTME.jumpToSubject('${code}')">
                      ${code} (${subAns}/${subCount})
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <!-- Split Body -->
          <div class="utme-exam-body">
            <!-- Left Pane: Question Area -->
            <div class="utme-question-pane">
              <div>
                <div class="utme-q-meta">
                  <span class="utme-q-number">
                    ${escapeHtml(currentQ.subjectName)}: Question ${subjectQIndex} of ${subjectQuestions.length}
                    <span style="font-size: 0.85rem; color: #64748B; font-weight: 600;">(Overall ${state.currentQuestionIndex + 1}/${totalQ})</span>
                  </span>
                  <span class="utme-topic-tag">${escapeHtml(currentQ.topic || 'General')}</span>
                </div>

                ${(currentQ.sectionName || currentQ.skillTag) ? `
                  <div class="utme-eng-section-badge">
                    <span class="utme-badge-label">English Language</span>
                    <span class="utme-badge-sep">•</span>
                    <span class="utme-badge-sec">${escapeHtml(currentQ.sectionName || 'Section')}</span>
                    ${currentQ.skillTag ? `
                      <span class="utme-badge-sep">•</span>
                      <span class="utme-badge-skill">${escapeHtml(currentQ.skillTag)}</span>
                    ` : ''}
                  </div>
                ` : ''}

                ${currentQ.passage ? `
                  <div class="utme-passage-card">
                    <div class="utme-passage-header">
                      <div class="utme-passage-title-row">
                        <span style="display:inline-flex;align-items:center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg></span>
                        <span class="utme-passage-title">${escapeHtml(currentQ.sectionName || 'Reading Passage / Context')}</span>
                      </div>
                      <span style="font-size: 0.75rem; color: #64748B; font-weight: 700;">Read carefully to answer question</span>
                    </div>
                    <div class="utme-passage-body">${escapeHtml(currentQ.passage)}</div>
                  </div>
                ` : ''}

                <div class="utme-q-text">
                  ${escapeHtml(currentQ.questionText)}
                </div>

                ${currentQ.imageUrl ? `
                  <div class="utme-diagram-wrap">
                    <div class="utme-diagram-header">
                      <span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>Examination Figure / Diagram</span>
                      <a href="${currentQ.imageUrl}" target="_blank" rel="noopener noreferrer" class="utme-diagram-zoom-link">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>Enlarge Diagram
                      </a>
                    </div>
                    <img src="${currentQ.imageUrl}" alt="Official Examination Figure" class="utme-q-diagram-img" loading="lazy" />
                  </div>
                ` : ''}

                <!-- Options List -->
                <div class="utme-options-list">
                  ${(currentQ.options || []).map((opt) => {
                    const letter = opt.substring(0, 1).toUpperCase();
                    const text = opt.substring(3).trim();
                    const isSelected = savedResp.selectedOption === letter;

                    const isInstant = !!state.examData?.isInstantFeedback;
                    const hasAnswered = !!savedResp.selectedOption;
                    let revealClass = "";
                    if (isInstant && hasAnswered) {
                      if (letter === currentQ.correctAnswer) {
                        revealClass = "is-correct-reveal";
                      } else if (isSelected && letter !== currentQ.correctAnswer) {
                        revealClass = "is-incorrect-reveal";
                      }
                    }

                    return `
                      <button class="utme-option-btn ${isSelected ? 'selected' : ''} ${revealClass}" onclick="window.UTME.selectOption('${letter}')">
                        <span class="utme-option-letter">${letter}</span>
                        <span>${escapeHtml(text)}</span>
                      </button>
                    `;
                  }).join('')}
                </div>

                <!-- Instant Feedback Card for Quick Drill -->
                ${(state.examData?.isInstantFeedback && savedResp.selectedOption) ? `
                  <div class="utme-instant-feedback-card ${savedResp.selectedOption === currentQ.correctAnswer ? 'correct' : 'incorrect'}">
                    <div class="utme-feedback-title">
                      ${savedResp.selectedOption === currentQ.correctAnswer 
                        ? '<span style="color:#059669;font-weight:800;display:flex;align-items:center;gap:0.4rem;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Correct! Well done.</span>' 
                        : `<span style="color:#DC2626;font-weight:800;display:flex;align-items:center;gap:0.4rem;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Incorrect. The verified correct option is <strong>(${escapeHtml(currentQ.correctAnswer || 'A')})</strong>.</span>`}
                    </div>
                    ${currentQ.explanation ? `
                      <div class="utme-feedback-body">
                        <strong>Educational Solution:</strong><br>${escapeHtml(currentQ.explanation)}
                      </div>
                    ` : ''}
                  </div>
                ` : ''}
              </div>

              <!-- Navigation Bar (Sticky Thumb Controls on Mobile) -->
              <div class="utme-exam-nav-bar">
                <div class="utme-nav-left">
                  <button class="utme-nav-prev-btn" onclick="window.UTME.prevQuestion()" ${state.currentQuestionIndex === 0 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}>
                    ← Prev
                  </button>
                  <button class="utme-flag-btn ${savedResp.isMarkedForReview ? 'flagged' : ''}" onclick="window.UTME.toggleReviewFlag()">
                    <span>${savedResp.isMarkedForReview ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>Marked' : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>Mark'}</span>
                  </button>
                  ${savedResp.selectedOption ? `
                    <button id="utme-clear-choice-btn" class="utme-clear-btn" onclick="window.UTME.clearOption()">
                      Clear
                    </button>
                  ` : ''}
                </div>

                <div class="utme-nav-center">
                  <button class="utme-mobile-nav-palette-btn" onclick="window.UTME.toggleMobilePalette()" aria-label="Open Question Palette">
                    <span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg></span> <span>${answeredCount}/${totalQ}</span>
                  </button>
                </div>

                <div class="utme-nav-right">
                  ${state.currentQuestionIndex === totalQ - 1 ? `
                    <button class="utme-nav-submit-btn" onclick="window.UTME.promptSubmit()" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFF; font-weight: 800; padding: 0.65rem 1.15rem; border-radius: 8px; border: none; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);">
                      Review & Submit Exam ✓
                    </button>
                  ` : `
                    <button class="utme-nav-next-btn" onclick="window.UTME.nextQuestion()">
                      Next →
                    </button>
                  `}
                </div>
              </div>
            </div>

            <!-- Right Pane: Question Palette (Desktop >= 900px) -->
            <div class="utme-palette-pane">
              <div class="utme-palette-title">
                <span>Question Palette</span>
                <span style="font-size: 0.82rem; color: #64748B;">${answeredCount}/${totalQ} Answered</span>
              </div>

              <div class="utme-palette-legend">
                <div class="utme-legend-item">
                  <div class="utme-legend-dot" style="background: #10B981;"></div>
                  <span>Answered (${answeredCount})</span>
                </div>
                <div class="utme-legend-item">
                  <div class="utme-legend-dot" style="background: #F59E0B;"></div>
                  <span>Flagged (${flaggedCount})</span>
                </div>
                <div class="utme-legend-item">
                  <div class="utme-legend-dot" style="background: #FFFFFF; border: 1px solid #CBD5E1;"></div>
                  <span>Unanswered (${totalQ - answeredCount})</span>
                </div>
              </div>

              <!-- Palette Grid for Current Subject -->
              <div style="font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 0.5rem;">
                ${escapeHtml(currentQ.subjectName)} Section:
              </div>
              <div class="utme-palette-grid">
                ${subjectQuestions.map((q, sIdx) => {
                  const overallIdx = questions.findIndex(item => item.id === q.id);
                  const isCurrent = overallIdx === state.currentQuestionIndex;
                  const resp = state.responses[q.id];
                  const isAns = resp && resp.selectedOption !== null && resp.selectedOption !== "";
                  const isFlg = resp && resp.isMarkedForReview;

                  let cls = "utme-pal-btn";
                  if (isCurrent) cls += " current";
                  if (isAns) cls += " answered";
                  if (isFlg) cls += " flagged";

                  return `
                    <button class="${cls}" onclick="window.UTME.jumpToQuestion(${overallIdx})">
                      ${sIdx + 1}
                    </button>
                  `;
                }).join('')}
              </div>

              <button class="utme-submit-trigger-btn" onclick="window.UTME.promptSubmit()">
                Submit Complete Exam <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-left:0.4rem;" aria-hidden="true"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>

          <!-- Mobile Question Palette Drawer Bottom Sheet (Mobile <= 900px) -->
          <div id="utme-mobile-palette-backdrop" class="utme-mobile-palette-backdrop ${state.isMobilePaletteOpen ? 'open' : ''}" onclick="window.UTME.closeMobilePalette()"></div>
          <div id="utme-mobile-palette-drawer" class="utme-mobile-palette-drawer ${state.isMobilePaletteOpen ? 'open' : ''}">
            <div class="utme-drawer-header">
              <div>
                <div class="utme-drawer-title">Question Palette</div>
                <div style="font-size: 0.8rem; color: #64748B; font-weight: 700;">
                  ${answeredCount} of ${totalQ} Answered • ${totalQ - answeredCount} Remaining
                </div>
              </div>
              <button class="utme-drawer-close-btn" onclick="window.UTME.closeMobilePalette()" aria-label="Close Palette">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Close
              </button>
            </div>

            <!-- Drawer Subject Tabs -->
            <div class="utme-drawer-subject-tabs">
              ${state.examData.subjectCodes.map(code => {
                const activePaletteCode = state.paletteSubjectCode || currentSubjectCode;
                const subQs = questions.filter(q => q.subjectCode === code);
                const subAns = subQs.filter(q => state.responses[q.id]?.selectedOption).length;
                const isAct = activePaletteCode === code;
                return `
                  <button class="utme-drawer-sub-tab ${isAct ? 'active' : ''}" onclick="window.UTME.setPaletteSubject('${code}')">
                    ${code} (${subAns}/${subQs.length})
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Drawer Legend -->
            <div class="utme-palette-legend" style="margin-bottom: 0.75rem;">
              <div class="utme-legend-item">
                <div class="utme-legend-dot" style="background: #10B981;"></div>
                <span>Answered (${answeredCount})</span>
              </div>
              <div class="utme-legend-item">
                <div class="utme-legend-dot" style="background: #F59E0B;"></div>
                <span>Flagged (${flaggedCount})</span>
              </div>
              <div class="utme-legend-item">
                <div class="utme-legend-dot" style="background: #FFFFFF; border: 1px solid #CBD5E1;"></div>
                <span>Unanswered (${totalQ - answeredCount})</span>
              </div>
            </div>

            <!-- Drawer Scrollable Grid -->
            <div class="utme-drawer-scroll-body">
              <div class="utme-drawer-grid">
                ${(() => {
                  const activePaletteCode = state.paletteSubjectCode || currentSubjectCode;
                  const palQuestions = questions.filter(q => q.subjectCode === activePaletteCode);
                  return palQuestions.map((q, sIdx) => {
                    const overallIdx = questions.findIndex(item => item.id === q.id);
                    const isCurrent = overallIdx === state.currentQuestionIndex;
                    const resp = state.responses[q.id];
                    const isAns = resp && resp.selectedOption !== null && resp.selectedOption !== "";
                    const isFlg = resp && resp.isMarkedForReview;

                    let cls = "utme-pal-btn";
                    if (isCurrent) cls += " current";
                    if (isAns) cls += " answered";
                    if (isFlg) cls += " flagged";

                    return `
                      <button class="${cls}" onclick="window.UTME.jumpToQuestion(${overallIdx})">
                        ${sIdx + 1}
                      </button>
                    `;
                  }).join('');
                })()}
              </div>
            </div>

            <!-- Drawer Submit Complete Exam -->
            <div style="padding-top: 0.75rem; border-top: 1px solid #E2E8F0;">
              <button class="utme-submit-trigger-btn" onclick="window.UTME.promptSubmit()">
                Submit Complete Exam <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-left:0.4rem;" aria-hidden="true"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- On-Screen Calculator Widget & Modal (Problem 4) -->
        <div id="utme-calc-backdrop" class="utme-calc-modal-backdrop ${state.calc.isOpen ? 'open' : ''}" onclick="window.UTME.toggleCalculator(false)"></div>
        <div id="utme-calc-widget" class="utme-calc-widget ${state.calc.isOpen ? 'open' : ''}" role="dialog" aria-label="JAMB Examination Calculator">
          <div class="utme-calc-header">
            <div class="utme-calc-title">
              <span style="display:inline-flex;align-items:center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg></span>
              <span>JAMB Calculator</span>
              <span class="utme-calc-badge">OFFICIAL 8-DIGIT STANDARD</span>
            </div>
            <button class="utme-calc-close-btn" onclick="window.UTME.toggleCalculator(false)" aria-label="Close Calculator"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="utme-calc-display-box">
            <div id="utme-calc-sub" class="utme-calc-subdisplay">${escapeHtml(state.calc.subDisplay)}</div>
            <div id="utme-calc-main" class="utme-calc-maindisplay">${escapeHtml(state.calc.display)}</div>
          </div>
          <div class="utme-calc-keypad">
            <!-- Row 1 -->
            <button class="utme-calc-btn action" onclick="window.UTME.calcAction('C')" aria-label="Clear">C</button>
            <button class="utme-calc-btn action" onclick="window.UTME.calcAction('BACKSPACE')" aria-label="Backspace">⌫</button>
            <button class="utme-calc-btn action" onclick="window.UTME.calcAction('SIGN')" aria-label="Toggle Sign">±</button>
            <button class="utme-calc-btn op" onclick="window.UTME.calcAction('/')" aria-label="Divide">÷</button>

            <!-- Row 2 -->
            <button class="utme-calc-btn" onclick="window.UTME.calcDigit('7')">7</button>
            <button class="utme-calc-btn" onclick="window.UTME.calcDigit('8')">8</button>
            <button class="utme-calc-btn" onclick="window.UTME.calcDigit('9')">9</button>
            <button class="utme-calc-btn op" onclick="window.UTME.calcAction('*')" aria-label="Multiply">×</button>

            <!-- Row 3 -->
            <button class="utme-calc-btn" onclick="window.UTME.calcDigit('4')">4</button>
            <button class="utme-calc-btn" onclick="window.UTME.calcDigit('5')">5</button>
            <button class="utme-calc-btn" onclick="window.UTME.calcDigit('6')">6</button>
            <button class="utme-calc-btn op" onclick="window.UTME.calcAction('-')" aria-label="Subtract">−</button>

            <!-- Row 4 -->
            <button class="utme-calc-btn" onclick="window.UTME.calcDigit('1')">1</button>
            <button class="utme-calc-btn" onclick="window.UTME.calcDigit('2')">2</button>
            <button class="utme-calc-btn" onclick="window.UTME.calcDigit('3')">3</button>
            <button class="utme-calc-btn op" onclick="window.UTME.calcAction('+')" aria-label="Add">+</button>

            <!-- Row 5 -->
            <button class="utme-calc-btn" onclick="window.UTME.calcDigit('0')" style="grid-column: span 2;">0</button>
            <button class="utme-calc-btn" onclick="window.UTME.calcDecimal()">.</button>
            <button class="utme-calc-btn equals" onclick="window.UTME.calcAction('=')" aria-label="Equals">=</button>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================
  // ON-SCREEN CALCULATOR LOGIC (Problem 4)
  // Complies with official Joint Admissions and Matriculation Board (JAMB) CBT rules
  // 8-digit basic arithmetic, percentage, square root, no eval/CAS
  // =========================================================
  function calcInputDigit(digit) {
    if (state.calc.display === "Error" || state.calc.shouldResetDisplay) {
      state.calc.display = String(digit);
      state.calc.shouldResetDisplay = false;
    } else {
      if (state.calc.display === "0") {
        state.calc.display = String(digit);
      } else if (state.calc.display.length < 12) {
        state.calc.display += String(digit);
      }
    }
    updateCalcUI();
  }

  function calcInputDecimal() {
    if (state.calc.display === "Error" || state.calc.shouldResetDisplay) {
      state.calc.display = "0.";
      state.calc.shouldResetDisplay = false;
    } else if (!state.calc.display.includes(".")) {
      state.calc.display += ".";
    }
    updateCalcUI();
  }

  function calcInputOperator(op) {
    if (state.calc.display === "Error") return;
    if (state.calc.prevOperand !== null && state.calc.operation && !state.calc.shouldResetDisplay) {
      calcCompute();
    } else {
      state.calc.prevOperand = parseFloat(state.calc.display) || 0;
    }
    state.calc.operation = op;
    const symbolMap = { "+": "+", "-": "−", "*": "×", "/": "÷" };
    state.calc.subDisplay = `${state.calc.prevOperand} ${symbolMap[op] || op}`;
    state.calc.shouldResetDisplay = true;
    updateCalcUI();
  }

  function calcCompute() {
    if (state.calc.prevOperand === null || !state.calc.operation) return;
    const prev = state.calc.prevOperand;
    const current = parseFloat(state.calc.display) || 0;
    let res = 0;

    if (state.calc.operation === "+") {
      res = prev + current;
    } else if (state.calc.operation === "-") {
      res = prev - current;
    } else if (state.calc.operation === "*") {
      res = prev * current;
    } else if (state.calc.operation === "/") {
      if (current === 0) {
        state.calc.display = "Error";
        state.calc.subDisplay = "Cannot divide by zero";
        state.calc.prevOperand = null;
        state.calc.operation = null;
        state.calc.shouldResetDisplay = true;
        updateCalcUI();
        return;
      }
      res = prev / current;
    }

    // Standard precision trimming (avoid float 0.1+0.2=0.30000000000000004)
    res = Math.round(res * 100000000) / 100000000;
    const symbolMap = { "+": "+", "-": "−", "*": "×", "/": "÷" };
    state.calc.subDisplay = `${prev} ${symbolMap[state.calc.operation] || state.calc.operation} ${current} =`;
    state.calc.display = String(res);
    state.calc.prevOperand = res;
    state.calc.operation = null;
    state.calc.shouldResetDisplay = true;
    updateCalcUI();
  }

  function calcToggleSign() {
    if (state.calc.display === "Error" || state.calc.display === "0") return;
    if (state.calc.display.startsWith("-")) {
      state.calc.display = state.calc.display.substring(1);
    } else {
      state.calc.display = "-" + state.calc.display;
    }
    updateCalcUI();
  }

  function calcClear() {
    state.calc.display = "0";
    state.calc.subDisplay = "";
    state.calc.prevOperand = null;
    state.calc.operation = null;
    state.calc.shouldResetDisplay = false;
    updateCalcUI();
  }

  function calcBackspace() {
    if (state.calc.display === "Error" || state.calc.shouldResetDisplay) {
      state.calc.display = "0";
      state.calc.shouldResetDisplay = false;
    } else {
      if (state.calc.display.length > 1) {
        state.calc.display = state.calc.display.slice(0, -1);
      } else {
        state.calc.display = "0";
      }
    }
    updateCalcUI();
  }

  function updateCalcUI() {
    const main = document.getElementById("utme-calc-main");
    const sub = document.getElementById("utme-calc-sub");
    if (main) main.textContent = state.calc.display;
    if (sub) sub.textContent = state.calc.subDisplay;
  }

  function attachExamHallEvents() {
    // Controlled keyboard input (Desktop accessibility & non-interfering shortcuts)
    window.onkeydown = (e) => {
      if (state.currentView !== "EXAM") return;
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // When calculator is open, route numbers and math operators directly to calculator
      if (state.calc.isOpen) {
        if (e.key >= "0" && e.key <= "9") {
          e.preventDefault();
          window.UTME.calcDigit(e.key);
          return;
        }
        if (e.key === ".") {
          e.preventDefault();
          window.UTME.calcDecimal();
          return;
        }
        if (["+", "-", "*", "/"].includes(e.key)) {
          e.preventDefault();
          window.UTME.calcAction(e.key);
          return;
        }
        if (e.key === "Enter" || e.key === "=") {
          e.preventDefault();
          window.UTME.calcAction("=");
          return;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          window.UTME.calcAction("BACKSPACE");
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          window.UTME.toggleCalculator(false);
          return;
        }
      }

      if (e.repeat) return; // Prevent key hold repetition

      const key = e.key.toUpperCase();
      if (["A", "B", "C", "D"].includes(key)) {
        window.UTME.selectOption(key);
        return;
      }
      if (e.key === "ArrowLeft" || key === "P") {
        e.preventDefault();
        window.UTME.prevQuestion();
        return;
      }
      if (e.key === "ArrowRight" || key === "N" || e.key === " ") {
        e.preventDefault();
        window.UTME.nextQuestion();
        return;
      }
      if (key === "F") {
        e.preventDefault();
        window.UTME.toggleReviewFlag();
        return;
      }
    };
  }

  function startCountdownTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);

    state.timerInterval = setInterval(async () => {
      state.remainingSeconds -= 1;

      // Update timer element directly without full re-render for smooth 60fps
      const timerEl = document.getElementById("utme-timer-el");
      if (timerEl) {
        const m = Math.floor(state.remainingSeconds / 60);
        const s = state.remainingSeconds % 60;
        timerEl.innerHTML = `<span style="display:inline-flex;align-items:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span><span>${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}</span>`;

        if (state.remainingSeconds < 300) {
          timerEl.className = "utme-timer-badge danger";
        } else if (state.remainingSeconds < 600) {
          timerEl.className = "utme-timer-badge warning";
        }
      }

      // Auto submit upon expiration
      if (state.remainingSeconds <= 0) {
        clearInterval(state.timerInterval);
        alert("Time has officially expired! Your examination is being submitted for scoring.");
        await executeExamSubmit();
      }
    }, 1000);
  }

  // =========================================================
  // VIEW 4: RESULTS & PERFORMANCE SUMMARY
  // =========================================================
  function renderResultsView() {
    const res = state.resultsData;
    if (!res) return `<div>No results available.</div>`;

    const aggScore = res.aggregateScore || 0;
    const maxScore = res.maxScore || 400;
    const accuracy = res.accuracyPercentage || 0;

    let tierLabel = "Admission Ready";
    let tierColor = "#10B981";
    if (aggScore >= 280) {
      tierLabel = "Exceptional Performance (Top 5% Admission Tier)";
    } else if (aggScore >= 230) {
      tierLabel = "Competitive Cutoff Threshold";
    } else {
      tierLabel = "Needs Intensive Revision";
      tierColor = "#F59E0B";
    }

    const subScores = res.subjectScores || {};

    return `
      <div class="utme-container" style="max-width: 980px;">
        <!-- Banner -->
        <div class="utme-results-banner">
          <span class="utme-badge-tag">OFFICIAL RESULT NOTIFICATION</span>
          <div style="font-size: 1.15rem; color: #CBD5E1; margin-top: 0.25rem;">
            ${escapeHtml(res.courseName)} • ${escapeHtml(res.institutionName || 'University of Ibadan')}
          </div>

          <div class="utme-results-score-display">
            ${aggScore} <span style="font-size: 2rem; color: #94A3B8;">/ ${maxScore}</span>
          </div>

          <div class="utme-results-tier-badge" style="color: ${tierColor}; border-color: ${tierColor};">
            ${tierLabel}
          </div>

          <!-- Quick Stats Ribbon -->
          <div class="utme-results-quick-stats" style="display: flex; justify-content: center; flex-wrap: wrap; gap: 2rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
            <div>
              <div style="font-size: 0.8rem; color: #94A3B8; text-transform: uppercase;">Accuracy</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #FFF;">${accuracy}%</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: #94A3B8; text-transform: uppercase;">Correct Answers</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #34D399;">${res.correctCount} / ${res.totalQuestions}</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: #94A3B8; text-transform: uppercase;">Incorrect</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #F87171;">${res.incorrectCount}</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: #94A3B8; text-transform: uppercase;">Unanswered</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #CBD5E1;">${res.unansweredCount}</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: #94A3B8; text-transform: uppercase;">Time Used</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #38BDF8;">${escapeHtml(res.timeSpentFormatted)}</div>
            </div>
          </div>
        </div>

        <!-- Subject Breakdown Cards -->
        <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.35rem; font-weight: 800; margin-bottom: 1rem;">
          Subject Breakdown (Scaled to 100 Marks Each):
        </h3>
        <div class="utme-subject-score-cards">
          ${Object.keys(subScores).map(code => {
            const s = subScores[code];
            return `
              <div class="utme-sub-card">
                <div class="utme-sub-card-title">${escapeHtml(s.subjectName)}</div>
                <div style="font-size: 0.82rem; color: #64748B; margin-bottom: 0.5rem;">
                  ${s.correct} of ${s.total} questions answered correctly
                </div>
                <div class="utme-sub-card-score">${s.scaledScore} <span style="font-size: 0.95rem; color: #94A3B8;">/ 100</span></div>
              </div>
            `;
          }).join('')}
        </div>

        ${res.englishAnalytics ? `
          <div class="utme-eng-analytics-card">
            <div class="utme-eng-analytics-header">
              <div>
                <div class="utme-eng-analytics-title" style="display:flex;align-items:center;gap:0.5rem;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg> English Language Section & Skill Performance</div>
                <div style="font-size: 0.85rem; color: #64748B; margin-top: 0.2rem;">
                  Diagnostic performance analysis across syllabus sections and assessed skill areas.
                </div>
              </div>
              <span class="utme-badge-tag" style="background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE;">
                Total English Questions: ${res.englishAnalytics.totalQuestions || 60}
              </span>
            </div>

            <div class="utme-eng-grid">
              ${(res.englishAnalytics.sections || []).map(sec => {
                const pct = sec.percentage || 0;
                const color = pct >= 70 ? '#10B981' : (pct >= 50 ? '#3B82F6' : '#EF4444');
                return `
                  <div class="utme-eng-section-item">
                    <div class="utme-eng-sec-title">${escapeHtml(sec.sectionName)}</div>
                    <div class="utme-eng-sec-stats">
                      <span>${sec.correct} / ${sec.total} Correct</span>
                      <strong style="color: ${color};">${pct}%</strong>
                    </div>
                    <div class="utme-progress-bar-bg">
                      <div class="utme-progress-bar-fill" style="width: ${pct}%; background: ${color};"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            ${(res.englishAnalytics.skills && res.englishAnalytics.skills.length > 0) ? `
              <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px dashed #E2E8F0;">
                <div style="font-size: 0.82rem; font-weight: 800; text-transform: uppercase; color: #475569; margin-bottom: 0.65rem;">
                  Specific Assessed Skill Areas:
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                  ${res.englishAnalytics.skills.map(sk => {
                    const pct = sk.percentage || 0;
                    const badgeBg = pct >= 70 ? '#ECFDF5' : (pct >= 50 ? '#EFF6FF' : '#FEF2F2');
                    const badgeBorder = pct >= 70 ? '#10B981' : (pct >= 50 ? '#3B82F6' : '#EF4444');
                    const badgeColor = pct >= 70 ? '#065F46' : (pct >= 50 ? '#1E40AF' : '#991B1B');
                    return `
                      <div style="background: ${badgeBg}; border: 1px solid ${badgeBorder}; color: ${badgeColor}; border-radius: 6px; padding: 0.3rem 0.6rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.4rem;">
                        <span style="font-weight: 700;">${escapeHtml(sk.skillTag)}:</span>
                        <span>${sk.correct}/${sk.total} (${pct}%)</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Action Buttons -->
        <div class="utme-results-actions" style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 2rem;">
          <button onclick="window.UTME.loadReview()" class="utme-course-action-btn" style="flex: 1; padding: 1rem; font-size: 1.05rem;">
            <span style="display:inline-flex;align-items:center;gap:0.4rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg> Review All Answers & Step-by-Step Explanations →</span>
          </button>
          <button onclick="window.UTME.startAnotherExam()" style="background: #FFFFFF; border: 2px solid var(--ps-border-light); color: #1E293B; font-weight: 800; padding: 1rem 1.5rem; border-radius: var(--radius-sm); cursor: pointer;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>Retake Another Mock Exam
          </button>
        </div>
      </div>
    `;
  }

  // =========================================================
  // VIEW 5: DEEP STEP-BY-STEP EDUCATIONAL REVIEW
  // =========================================================
  function renderReviewView() {
    const rev = state.reviewData;
    if (!rev) return `<div>Loading review...</div>`;

    const questions = rev.questions || [];

    return `
      <div class="utme-container" style="max-width: 980px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-family: 'Outfit', sans-serif; font-size: 1.85rem; font-weight: 800; color: #0F172A; margin: 0;">
              Examination Review & Solutions
            </h2>
            <p style="color: #64748B; font-size: 0.92rem; margin-top: 0.25rem;">
              Master every concept with step-by-step reasoning and distractor analysis.
            </p>
          </div>
          <button onclick="window.UTME.setView('RESULTS')" style="background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 700; cursor: pointer;">
            ← Back to Results
          </button>
        </div>

        <!-- Filter Bar -->
        <div class="utme-filter-chips" style="margin-bottom: 1.75rem;">
          <button class="utme-chip ${state.reviewFilter === 'ALL' ? 'active' : ''}" onclick="window.UTME.filterReviewAction('ALL')">All Questions (${questions.length})</button>
          <button class="utme-chip ${state.reviewFilter === 'INCORRECT' ? 'active' : ''}" onclick="window.UTME.filterReviewAction('INCORRECT')">Incorrect Answers</button>
          <button class="utme-chip ${state.reviewFilter === 'CORRECT' ? 'active' : ''}" onclick="window.UTME.filterReviewAction('CORRECT')">Correct Answers</button>
          <button class="utme-chip ${state.reviewFilter === 'UNANSWERED' ? 'active' : ''}" onclick="window.UTME.filterReviewAction('UNANSWERED')">Unanswered Questions</button>
        </div>

        <!-- Questions List -->
        <div>
          ${questions.map((q, idx) => {
            const statusClass = q.isCorrect ? "is-correct" : (q.isUnanswered ? "is-unanswered" : "is-incorrect");
            const statusBadge = q.isCorrect
              ? `<span style="background: #D1FAE5; color: #065F46; font-weight: 800; font-size: 0.8rem; padding: 0.2rem 0.6rem; border-radius: 6px;" style="display:inline-flex;align-items:center;gap:0.3rem;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>Correct</span>`
              : (q.isUnanswered
                ? `<span style="background: #F1F5F9; color: #475569; font-weight: 800; font-size: 0.8rem; padding: 0.2rem 0.6rem; border-radius: 6px;">○ Unanswered</span>`
                : `<span style="background: #FEE2E2; color: #991B1B; font-weight: 800; font-size: 0.8rem; padding: 0.2rem 0.6rem; border-radius: 6px;" style="display:inline-flex;align-items:center;gap:0.3rem;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Incorrect</span>`);

            return `
              <div class="utme-review-item ${statusClass}">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem;">
                  <span style="font-family: 'Outfit', sans-serif; font-weight: 800; color: #334155;">
                    ${escapeHtml(q.subjectName)} • Question ${idx + 1} (${escapeHtml(q.sourceDocument || 'Past Paper')})
                  </span>
                  ${statusBadge}
                </div>

                ${(q.sectionName || q.skillTag) ? `
                  <div class="utme-eng-section-badge" style="margin-bottom: 0.75rem;">
                    <span class="utme-badge-label">English Language</span>
                    <span class="utme-badge-sep">•</span>
                    <span class="utme-badge-sec">${escapeHtml(q.sectionName || 'Section')}</span>
                    ${q.skillTag ? `
                      <span class="utme-badge-sep">•</span>
                      <span class="utme-badge-skill">${escapeHtml(q.skillTag)}</span>
                    ` : ''}
                  </div>
                ` : ''}

                ${q.passage ? `
                  <div class="utme-passage-card" style="margin-bottom: 1rem;">
                    <div class="utme-passage-header">
                      <div class="utme-passage-title-row">
                        <span style="display:inline-flex;align-items:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg></span>
                        <span class="utme-passage-title">${escapeHtml(q.sectionName || 'Reading Passage / Context')}</span>
                      </div>
                    </div>
                    <div class="utme-passage-body">${escapeHtml(q.passage)}</div>
                  </div>
                ` : ''}

                <div style="font-size: 1.1rem; font-weight: 600; color: #0F172A; line-height: 1.5; margin-bottom: 1rem;">
                  ${escapeHtml(q.questionText)}
                </div>

                ${q.imageUrl ? `
                  <div class="utme-diagram-wrap" style="margin-bottom: 1.25rem;">
                    <div class="utme-diagram-header">
                      <span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>Examination Figure / Diagram</span>
                      <a href="${q.imageUrl}" target="_blank" rel="noopener noreferrer" class="utme-diagram-zoom-link">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>Enlarge Diagram
                      </a>
                    </div>
                    <img src="${q.imageUrl}" alt="Official Examination Figure" class="utme-q-diagram-img" loading="lazy" />
                  </div>
                ` : ''}

                <!-- Options -->
                <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem;">
                  ${(q.options || []).map(opt => {
                    const letter = opt.substring(0, 1).toUpperCase();
                    const text = opt.substring(3).trim();
                    const isCorrectOpt = q.correctAnswer === letter;
                    const isStudentOpt = q.studentAnswer === letter;

                    let bg = "#F8FAFC";
                    let border = "#E2E8F0";
                    let color = "#334155";

                    if (isCorrectOpt) {
                      bg = "#ECFDF5";
                      border = "#10B981";
                      color = "#065F46";
                    } else if (isStudentOpt && !isCorrectOpt) {
                      bg = "#FEF2F2";
                      border = "#EF4444";
                      color = "#991B1B";
                    }

                    return `
                      <div style="padding: 0.65rem 1rem; border-radius: 8px; border: 1.5px solid ${border}; background: ${bg}; color: ${color}; font-weight: ${isCorrectOpt || isStudentOpt ? '700' : '500'}; display: flex; align-items: center; justify-content: space-between;">
                        <span><strong>${letter}.</strong> ${escapeHtml(text)}</span>
                        ${isCorrectOpt ? '<span style="font-size: 0.8rem; font-weight: 800;" style="display:inline-flex;align-items:center;gap:0.35rem;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>Correct Answer</span>' : (isStudentOpt ? '<span style="font-size: 0.8rem; font-weight: 800;">Your Choice</span>' : '')}
                      </div>
                    `;
                  }).join('')}
                </div>

                <!-- Step-by-Step Educational Explanation -->
                <div class="utme-explanation-box">
                  <div class="utme-explanation-header">
                    <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>Step-by-Step Educational Explanation:</span>
                  </div>
                  <div style="margin-bottom: 0.75rem;">
                    ${escapeHtml(q.explanation)}
                  </div>

                  ${q.whyOthersIncorrect ? `
                    <div style="font-size: 0.88rem; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 0.5rem;">
                      <strong>Why other options are incorrect:</strong> ${escapeHtml(q.whyOthersIncorrect)}
                    </div>
                  ` : ''}

                  <div style="display: flex; gap: 1rem; font-size: 0.78rem; color: #94A3B8; margin-top: 0.75rem;">
                    <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>Syllabus Topic: <strong>${escapeHtml(q.topic)}</strong></span>
                    <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>Source: Page ${q.sourcePage || 1}, Q${q.originalQuestionNumber || idx + 1}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // =========================================================
  // VIEW 6: ADMIN DASHBOARD & QUESTION AUDIT
  // =========================================================
  function renderAdminDashboardView() {
    return `
      <div class="utme-container">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-family: 'Outfit', sans-serif; font-size: 1.85rem; font-weight: 800;">
              <svg class="utme-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>Question Bank Administration & Audit Dashboard
            </h2>
            <p style="color: #64748B;">Inspect all imported questions, verification metrics, and document provenance.</p>
          </div>
          <button onclick="window.UTME.setView('SELECT')" style="background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 700; cursor: pointer;">
            ← Exit Admin
          </button>
        </div>

        <div id="utme-admin-stats-box" style="padding: 2rem; background: #FFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: var(--shadow-card-light);">
          Loading question bank statistics...
        </div>
      </div>
    `;
  }

  async function loadAdminStats() {
    const el = document.getElementById("utme-admin-stats-box");
    if (!el) return;

    try {
      const res = await fetch("/api/utme/admin/stats");
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        el.innerHTML = `
          <div class="utme-admin-stats-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
            <div style="background: #F8FAFC; padding: 1.25rem; border-radius: 8px; text-align: center; border: 1px solid #E2E8F0;">
              <div style="font-size: 0.75rem; font-weight: 800; color: #64748B; text-transform: uppercase;">Total Questions</div>
              <div style="font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 900; color: var(--ps-purple-hover);">${d.totalQuestions.toLocaleString()}</div>
            </div>
            <div style="background: #F8FAFC; padding: 1.25rem; border-radius: 8px; text-align: center; border: 1px solid #E2E8F0;">
              <div style="font-size: 0.75rem; font-weight: 800; color: #64748B; text-transform: uppercase;">Accredited Subjects</div>
              <div style="font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 900; color: #10B981;">${d.totalSubjects}</div>
            </div>
            <div style="background: #F8FAFC; padding: 1.25rem; border-radius: 8px; text-align: center; border: 1px solid #E2E8F0;">
              <div style="font-size: 0.75rem; font-weight: 800; color: #64748B; text-transform: uppercase;">Course Combinations</div>
              <div style="font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 900; color: #3B82F6;">${d.totalCourseCombinations}</div>
            </div>
            <div style="background: #F8FAFC; padding: 1.25rem; border-radius: 8px; text-align: center; border: 1px solid #E2E8F0;">
              <div style="font-size: 0.75rem; font-weight: 800; color: #64748B; text-transform: uppercase;">Completed Attempts</div>
              <div style="font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 900; color: #F59E0B;">${d.completedAttempts}</div>
            </div>
          </div>

          <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 800; margin-bottom: 1rem;">Subject Question Bank Breakdown:</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.85rem;">
            ${(d.subjectsBreakdown || []).map(s => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0;">
                <span style="font-weight: 700; color: #1E293B;">${s.code} - ${s.name}</span>
                <span style="font-weight: 800; color: var(--ps-purple-hover);">${s.count.toLocaleString()} questions</span>
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch (e) {
      el.innerHTML = `<div>Error loading admin statistics.</div>`;
    }
  }

  // =========================================================
  // ACTIONS & HANDLERS
  // =========================================================
  window.UTME = {
    init,
    setView(v) {
      if (v !== "EXAM") {
        state.isMobilePaletteOpen = false;
        if (document.body) {
          document.body.style.overflow = "";
          document.body.classList.remove("utme-in-exam");
        }
      }
      state.currentView = v;
      render();
    },
    setMode(m) {
      state.selectedMode = m;
      render();
    },
    filterFaculty(f) {
      state.selectedFaculty = f;
      applyCourseFilters();
    },
    selectCourse(slug) {
      state.selectedCourse = state.courses.find(c => c.slug === slug);
      render();
    },
    proceedToInstructions(slug, event) {
      if (event) event.stopPropagation();
      this.selectCourse(slug);
      this.setView("INSTRUCTIONS");
    },
    async startExamAction() {
      if (!state.selectedCourse) return;

      const payload = {
        courseSlug: state.selectedCourse.slug,
        mode: state.selectedMode,
        institutionName: "University of Ibadan (UI)",
      };

      try {
        const res = await fetch("/api/utme/exam/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success) {
          state.examData = json.data;
          state.activeAttemptId = json.data.attemptId;
          localStorage.setItem("utme_active_attempt_id", json.data.attemptId);
          state.responses = {};
          state.currentQuestionIndex = 0;
          state.currentSubjectCode = json.data.subjectCodes[0];
          state.paletteSubjectCode = json.data.subjectCodes[0];
          state.isMobilePaletteOpen = false;
          state.remainingSeconds = json.data.durationMinutes * 60;
          state.currentView = "EXAM";
          startCountdownTimer();
          render();
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          alert(json.error || "Failed to initialize examination.");
        }
      } catch (e) {
        alert("Network error starting examination.");
      }
    },
    toggleMobilePalette() {
      state.isMobilePaletteOpen = !state.isMobilePaletteOpen;
      const drawer = document.getElementById("utme-mobile-palette-drawer");
      const backdrop = document.getElementById("utme-mobile-palette-backdrop");
      if (drawer && backdrop) {
        if (state.isMobilePaletteOpen) {
          drawer.classList.add("open");
          backdrop.classList.add("open");
          document.body.style.overflow = "hidden";
        } else {
          drawer.classList.remove("open");
          backdrop.classList.remove("open");
          document.body.style.overflow = "";
        }
      } else {
        render();
      }
    },
    closeMobilePalette() {
      state.isMobilePaletteOpen = false;
      const drawer = document.getElementById("utme-mobile-palette-drawer");
      const backdrop = document.getElementById("utme-mobile-palette-backdrop");
      if (drawer) drawer.classList.remove("open");
      if (backdrop) backdrop.classList.remove("open");
      document.body.style.overflow = "";
    },
    setPaletteSubject(code) {
      state.paletteSubjectCode = code;
      render();
      const drawer = document.getElementById("utme-mobile-palette-drawer");
      const backdrop = document.getElementById("utme-mobile-palette-backdrop");
      if (drawer && backdrop) {
        drawer.classList.add("open");
        backdrop.classList.add("open");
        document.body.style.overflow = "hidden";
      }
    },
    jumpToQuestion(idx) {
      this.closeMobilePalette();
      state.currentQuestionIndex = idx;
      saveCurrentPosition(idx);
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    jumpToSubject(code) {
      this.closeMobilePalette();
      const qIdx = state.examData.questions.findIndex(q => q.subjectCode === code);
      if (qIdx !== -1) {
        state.currentQuestionIndex = qIdx;
        state.paletteSubjectCode = code;
        saveCurrentPosition(qIdx);
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    prevQuestion() {
      if (state.currentQuestionIndex > 0) {
        state.currentQuestionIndex -= 1;
        saveCurrentPosition(state.currentQuestionIndex);
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    nextQuestion() {
      if (state.currentQuestionIndex < state.examData.questions.length - 1) {
        state.currentQuestionIndex += 1;
        saveCurrentPosition(state.currentQuestionIndex);
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (state.currentQuestionIndex === state.examData.questions.length - 1) {
        this.promptSubmit();
      }
    },
    async selectOption(letter) {
      const q = state.examData?.questions?.[state.currentQuestionIndex];
      if (!q) return;

      const currentResp = state.responses[q.id] || { selectedOption: null, isMarkedForReview: false };
      currentResp.selectedOption = letter;
      state.responses[q.id] = currentResp;

      this.syncResponse(q.id, letter, currentResp.isMarkedForReview);

      // If instant feedback mode is active, re-render immediately to reveal verified answer status and explanation card
      if (state.examData?.isInstantFeedback) {
        render();
        return;
      }

      // Update option button styles in-place without full re-render
      const optButtons = document.querySelectorAll(".utme-option-btn");
      optButtons.forEach(btn => {
        const lSpan = btn.querySelector(".utme-option-letter");
        if (lSpan && lSpan.textContent.trim().toUpperCase() === letter) {
          btn.classList.add("selected");
        } else {
          btn.classList.remove("selected");
        }
      });

      // Update current palette button in-place across desktop sidebar and mobile drawer
      document.querySelectorAll(".utme-pal-btn.current").forEach(btn => btn.classList.add("answered"));

      // Update answered counters in palette legend and toggle buttons
      const answeredCount = Object.values(state.responses).filter(r => r.selectedOption !== null && r.selectedOption !== "").length;
      const totalQ = state.examData.questions.length;
      document.querySelectorAll(".utme-palette-title span:last-child").forEach(el => el.textContent = `${answeredCount}/${totalQ} Answered`);
      document.querySelectorAll(".utme-mobile-palette-toggle-btn").forEach(el => el.textContent = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>Palette (${answeredCount}/${totalQ})`);
      const palBadge = document.querySelector(".utme-mobile-nav-palette-btn span:last-child");
      if (palBadge) palBadge.textContent = `${answeredCount}/${totalQ}`;

      // Show clear choice button dynamically if needed
      const navBarLeft = document.querySelector(".utme-nav-left");
      if (navBarLeft && !document.getElementById("utme-clear-choice-btn")) {
        const clearBtn = document.createElement("button");
        clearBtn.id = "utme-clear-choice-btn";
        clearBtn.className = "utme-clear-btn";
        clearBtn.textContent = "Clear";
        clearBtn.onclick = () => window.UTME.clearOption();
        navBarLeft.appendChild(clearBtn);
      }

      await this.saveAnswer(q.id, letter, currentResp.isMarkedForReview);
    },
    async clearOption() {
      const q = state.examData?.questions?.[state.currentQuestionIndex];
      if (!q) return;

      const currentResp = state.responses[q.id] || { selectedOption: null, isMarkedForReview: false };
      currentResp.selectedOption = null;
      state.responses[q.id] = currentResp;

      // Remove selected class in-place
      document.querySelectorAll(".utme-option-btn").forEach(btn => btn.classList.remove("selected"));

      // Update current palette button in-place across desktop sidebar and mobile drawer
      document.querySelectorAll(".utme-pal-btn.current").forEach(btn => btn.classList.remove("answered"));

      // Update answered counters in palette legend and toggle buttons
      const answeredCount = Object.values(state.responses).filter(r => r.selectedOption !== null && r.selectedOption !== "").length;
      const totalQ = state.examData.questions.length;
      document.querySelectorAll(".utme-palette-title span:last-child").forEach(el => el.textContent = `${answeredCount}/${totalQ} Answered`);
      document.querySelectorAll(".utme-mobile-palette-toggle-btn").forEach(el => el.textContent = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>Palette (${answeredCount}/${totalQ})`);
      const palBadge = document.querySelector(".utme-mobile-nav-palette-btn span:last-child");
      if (palBadge) palBadge.textContent = `${answeredCount}/${totalQ}`;

      const clearBtn = document.getElementById("utme-clear-choice-btn");
      if (clearBtn) clearBtn.remove();

      await this.saveAnswer(q.id, null, currentResp.isMarkedForReview);
    },
    async toggleReviewFlag() {
      const q = state.examData?.questions?.[state.currentQuestionIndex];
      if (!q) return;

      const currentResp = state.responses[q.id] || { selectedOption: null, isMarkedForReview: false };
      currentResp.isMarkedForReview = !currentResp.isMarkedForReview;
      state.responses[q.id] = currentResp;

      // Update flag button in-place
      const flagBtn = document.querySelector(".utme-flag-btn");
      if (flagBtn) {
        if (currentResp.isMarkedForReview) {
          flagBtn.classList.add("flagged");
          flagBtn.innerHTML = `<span><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>Marked</span>`;
        } else {
          flagBtn.classList.remove("flagged");
          flagBtn.innerHTML = `<span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;margin-right:0.35rem;" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>Mark</span>`;
        }
      }

      // Update palette button in-place across desktop sidebar and mobile drawer
      document.querySelectorAll(".utme-pal-btn.current").forEach(btn => {
        if (currentResp.isMarkedForReview) {
          btn.classList.add("flagged");
        } else {
          btn.classList.remove("flagged");
        }
      });

      await this.saveAnswer(q.id, currentResp.selectedOption, currentResp.isMarkedForReview);
    },
    async saveAnswer(questionId, selectedOption, isMarkedForReview) {
      if (!state.activeAttemptId) return;

      try {
        await fetch(`/api/utme/exam/${state.activeAttemptId}/save-answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, selectedOption, isMarkedForReview }),
        });
      } catch (err) {
        console.warn("Background auto-save network sync retry queued.");
      }
    },
    promptSubmit() {
      const totalQ = state.examData.questions.length;
      const answered = Object.values(state.responses).filter(r => r.selectedOption !== null && r.selectedOption !== "").length;
      const unanswered = totalQ - answered;

      let msg = `Are you sure you want to finalize and submit your UTME Mock Examination?\n\n• Answered: ${answered} of ${totalQ}\n• Unanswered: ${unanswered}`;
      if (unanswered > 0) {
        msg += `\n\nWarning: You have ${unanswered} unanswered questions!`;
      }

      if (typeof window !== "undefined" && typeof window.confirm === "function") {
        if (window.confirm(msg)) {
          executeExamSubmit();
        }
      } else {
        executeExamSubmit();
      }
    },
    async loadReview() {
      const attemptId = state.activeAttemptId || state.resultsData?.attemptId;
      if (!attemptId) return;
      try {
        const res = await fetch(`/api/utme/exam/${attemptId}/review?filter=${state.reviewFilter}`);
        const json = await res.json();
        if (json.success) {
          state.reviewData = json.data;
          state.currentView = "REVIEW";
          render();
        }
      } catch (e) {
        alert("Error loading answer explanations.");
      }
    },
    filterReviewAction(filterType) {
      state.reviewFilter = filterType;
      this.loadReview();
    },
    startAnotherExam() {
      state.isMobilePaletteOpen = false;
      if (document.body) {
        document.body.style.overflow = "";
        document.body.classList.remove("utme-in-exam");
      }
      localStorage.removeItem("utme_active_attempt_id");
      state.activeAttemptId = null;
      state.examData = null;
      state.responses = {};
      state.currentView = "SELECT";
      render();
    },
    openAdmin() {
      state.isMobilePaletteOpen = false;
      if (document.body) {
        document.body.style.overflow = "";
        document.body.classList.remove("utme-in-exam");
      }
      state.currentView = "ADMIN";
      render();
    },
    toggleCalculator(forcedState) {
      if (typeof forcedState === "boolean") {
        state.calc.isOpen = forcedState;
      } else {
        state.calc.isOpen = !state.calc.isOpen;
      }
      const backdrop = document.getElementById("utme-calc-backdrop");
      const widget = document.getElementById("utme-calc-widget");
      if (backdrop) backdrop.classList.toggle("open", state.calc.isOpen);
      if (widget) widget.classList.toggle("open", state.calc.isOpen);
    },
    calcDigit(digit) {
      calcInputDigit(digit);
    },
    calcDecimal() {
      calcInputDecimal();
    },
    switchFeatureTab(tab) {
      state.activeTab = tab;
      if (tab === 'FLASHCARDS' && state.flashcardsDeck.length === 0) {
        this.loadFlashcardsDeck();
      } else if (tab === 'PROGRESS' && !state.progressData) {
        this.loadProgressDashboard();
      } else {
        render();
      }
    },
    setFlexibleSubject(code) {
      state.flexibleConfig.subjectCode = code;
      render();
    },
    setFlexibleDuration(mins) {
      state.flexibleConfig.durationMinutes = mins;
      render();
    },
    setFlexibleQuestionCount(cnt) {
      state.flexibleConfig.questionCount = cnt;
      render();
    },
    async startFlexibleExam() {
      const subCode = state.flexibleConfig.subjectCode;
      const sub = state.subjects.find(s => s.code === subCode) || state.subjects[0];
      const payload = {
        customSubjectCodes: [subCode],
        courseSlug: "flexible-practice",
        mode: "FLEXIBLE_PRACTICE",
        examType: "FLEXIBLE_PRACTICE",
        durationMinutes: Number(state.flexibleConfig.durationMinutes) || 30,
        questionCount: Number(state.flexibleConfig.questionCount) || 20,
        isInstantFeedback: false,
        institutionName: "University of Ibadan (UI) - Practice",
      };
      await launchExamWithPayload(payload);
    },
    setDrillSubject(code) {
      state.drillConfig.subjectCode = code;
      render();
    },
    setDrillQuestionCount(cnt) {
      state.drillConfig.questionCount = cnt;
      render();
    },
    setDrillDuration(mins) {
      state.drillConfig.durationMinutes = mins;
      render();
    },
    setDrillFeedback(isInstant) {
      state.drillConfig.isInstantFeedback = isInstant;
      render();
    },
    async startQuickDrill() {
      const subCode = state.drillConfig.subjectCode;
      const payload = {
        customSubjectCodes: [subCode],
        courseSlug: "quick-drill",
        mode: "QUICK_DRILL",
        examType: "QUICK_DRILL",
        durationMinutes: Number(state.drillConfig.durationMinutes) || 15,
        questionCount: Number(state.drillConfig.questionCount) || 10,
        isInstantFeedback: !!state.drillConfig.isInstantFeedback,
        institutionName: "JAMB Quick Drill Session",
      };
      await launchExamWithPayload(payload);
    },
    setFlashcardSubject(code) {
      state.flashcardConfig.subjectCode = code;
      this.loadFlashcardsDeck();
    },
    setFlashcardFilter(filter) {
      state.flashcardConfig.filterMode = filter;
      this.loadFlashcardsDeck();
    },
    flipFlashcard() {
      state.isCardFlipped = !state.isCardFlipped;
      render();
    },
    nextFlashcard() {
      if (state.currentCardIndex < state.flashcardsDeck.length - 1) {
        state.currentCardIndex++;
        state.isCardFlipped = false;
        render();
      }
    },
    prevFlashcard() {
      if (state.currentCardIndex > 0) {
        state.currentCardIndex--;
        state.isCardFlipped = false;
        render();
      }
    },
    shuffleFlashcards() {
      state.flashcardsDeck.sort(() => Math.random() - 0.5);
      state.currentCardIndex = 0;
      state.isCardFlipped = false;
      render();
    },
    async rateCurrentCard(rating) {
      const card = state.flashcardsDeck[state.currentCardIndex];
      if (!card) return;
      try {
        await fetch("/api/utme/flashcards/rate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: card.id, rating }),
        });
        card.userStatus = rating;
        if (state.flashcardStats) {
          if (rating === "KNOWN") state.flashcardStats.knownCards++;
          else state.flashcardStats.needsRevisionCards++;
        }
        if (state.currentCardIndex < state.flashcardsDeck.length - 1) {
          state.currentCardIndex++;
          state.isCardFlipped = false;
        }
        render();
      } catch (e) {
        console.error("Error rating flashcard:", e);
      }
    },
    async loadFlashcardsDeck() {
      state.isFlashcardsLoading = true;
      state.currentCardIndex = 0;
      state.isCardFlipped = false;
      render();
      try {
        const topicParam = state.flashcardConfig.topic !== 'ALL' ? `&topic=${encodeURIComponent(state.flashcardConfig.topic)}` : '';
        const filterParam = state.flashcardConfig.filterMode !== 'ALL' ? `&filterMode=${encodeURIComponent(state.flashcardConfig.filterMode)}` : '';
        const res = await fetch(`/api/utme/flashcards/deck?subjectCode=${encodeURIComponent(state.flashcardConfig.subjectCode)}${topicParam}${filterParam}&limit=40`);
        const json = await res.json();
        if (json.success) {
          state.flashcardsDeck = json.data.cards || [];
          state.flashcardStats = json.data.stats || null;
        }
      } catch (e) {
        console.error("Error loading flashcards:", e);
      } finally {
        state.isFlashcardsLoading = false;
        render();
      }
    },
    async loadProgressDashboard() {
      state.isProgressLoading = true;
      render();
      try {
        const res = await fetch("/api/utme/progress/dashboard");
        const json = await res.json();
        if (json.success) {
          state.progressData = json.data;
        }
      } catch (e) {
        console.error("Error loading progress dashboard:", e);
      } finally {
        state.isProgressLoading = false;
        render();
      }
    },
    async openReview(attemptId) {
      if (!attemptId) return;
      try {
        const res = await fetch(`/api/utme/exam/${attemptId}/review?filter=ALL`);
        const json = await res.json();
        if (json.success) {
          state.reviewData = json.data;
          state.reviewFilter = "ALL";
          state.currentView = "REVIEW";
          render();
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          alert("Could not load review for this attempt.");
        }
      } catch (e) {
        alert("Error loading attempt review.");
      }
    },

    calcAction(act) {
      if (act === "C") calcClear();
      else if (act === "BACKSPACE") calcBackspace();
      else if (act === "SIGN") calcToggleSign();
      else if (["+", "-", "*", "/"].includes(act)) calcInputOperator(act);
      else if (act === "=") calcCompute();
    }
  };

  
  async function launchExamWithPayload(payload) {
    try {
      const res = await fetch("/api/utme/exam/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        state.examData = json.data;
        state.activeAttemptId = json.data.attemptId;
        localStorage.setItem("utme_active_attempt_id", json.data.attemptId);
        state.responses = {};
        state.currentQuestionIndex = 0;
        state.currentSubjectCode = json.data.subjectCodes[0];
        state.paletteSubjectCode = json.data.subjectCodes[0];
        state.isMobilePaletteOpen = false;
        state.remainingSeconds = json.data.durationMinutes * 60;
        state.currentView = "EXAM";
        startCountdownTimer();
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        alert(json.error || "Failed to initialize examination.");
      }
    } catch (e) {
      alert("Network error starting examination.");
    }
  }

  async function executeExamSubmit() {
    if (state.timerInterval) clearInterval(state.timerInterval);

    try {
      const res = await fetch(`/api/utme/exam/${state.activeAttemptId}/submit`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        state.isMobilePaletteOpen = false;
        if (document.body) {
          document.body.style.overflow = "";
          document.body.classList.remove("utme-in-exam");
        }
        localStorage.removeItem("utme_active_attempt_id");
        state.resultsData = json.data;
        state.currentView = "RESULTS";
        render();
      } else {
        alert(json.error || "Submission error.");
      }
    } catch (e) {
      alert("Submission error. Please check your connection.");
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Auto initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
