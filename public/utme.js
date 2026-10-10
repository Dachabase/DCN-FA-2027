/**
 * =========================================================
 * UTME PREPARATION & MOCK EXAMINATION ENGINE
 * Official Joint Admissions and Matriculation Board Simulation
 * UI Freshers Companion Integration
 * =========================================================
 */

(function () {
  const state = {
    currentView: "SELECT", // SELECT | INSTRUCTIONS | EXAM | RESULTS | REVIEW | ADMIN
    courses: [],
    subjects: [],
    filteredCourses: [],
    selectedCourse: null,
    selectedMode: "FULL_UTME_SIMULATION", // FULL_UTME_SIMULATION | PRACTICE_MODE
    customSubjects: ["ENG", "BIO", "CHM", "PHY"],
    searchQuery: "",
    selectedFaculty: "ALL",

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

  async function tryRestoreActiveExam() {
    try {
      const res = await fetch(`/api/utme/exam/${state.activeAttemptId}/state`);
      const json = await res.json();
      if (json.success && json.data.status === "IN_PROGRESS" && json.data.remainingSeconds > 0) {
        state.examData = json.data;
        state.remainingSeconds = json.data.remainingSeconds;
        state.responses = json.data.savedResponses || {};
        state.currentQuestionIndex = 0;
        state.currentSubjectCode = json.data.subjectCodes[0] || "ENG";
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
  function renderCourseSelectView() {
    const totalQ = state.subjects.reduce((sum, s) => sum + (s.availableQuestionsCount || 0), 0);
    const faculties = ["ALL", "Clinical Sciences", "Computing", "Technology", "Law", "Economics and Management Sciences", "The Social Sciences", "Arts", "Basic Medical Sciences", "Agriculture", "Environmental Design and Management"];

    return `
      <div class="utme-container">
        <!-- Hero Header -->
        <div class="utme-hero-banner">
          <div class="utme-badge-tag">
            <span>🏛️ Official Joint Admissions and Matriculation Board (JAMB) Standards</span>
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
                ⚙️ Content Admin & Audit Bank
              </button>
            </div>
          </div>
        </div>

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
                        ${idx === 0 ? '★ ' : ''}${escapeHtml(s)}
                      </span>
                    `).join('')}
                  </div>

                  ${c.institutionNotes ? `
                    <div class="utme-course-notes">
                      <strong>🏛️ Institution Note:</strong> ${escapeHtml(c.institutionNotes)}
                    </div>
                  ` : ''}

                  <div class="utme-source-citation">
                    <span>📜 ${escapeHtml(c.officialSource)}</span>
                  </div>
                </div>

                <button class="utme-course-action-btn" onclick="window.UTME.proceedToInstructions('${c.slug}', event)">
                  <span>Start Mock Exam for ${escapeHtml(c.courseName)} →</span>
                </button>
              </div>
            `).join('')}
          </div>
        </div>
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
              <span>Begin Examination Now (Start Timer) ⚡</span>
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
                <button class="utme-mobile-palette-toggle-btn" onclick="window.UTME.toggleMobilePalette()" aria-label="Open Question Palette">
                  📋 Palette (${answeredCount}/${totalQ})
                </button>

                <div id="utme-timer-el" class="utme-timer-badge ${timerClass}">
                  <span>⏱</span>
                  <span>${timeFormatted}</span>
                </div>

                <button class="utme-topbar-submit-btn" onclick="window.UTME.promptSubmit()">
                  Submit ✓
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

                ${currentQ.passage ? `
                  <div class="utme-passage-card">
                    <div style="font-weight: 800; font-size: 0.78rem; text-transform: uppercase; color: var(--ps-purple-hover); margin-bottom: 0.3rem;">Reading Passage:</div>
                    ${escapeHtml(currentQ.passage)}
                  </div>
                ` : ''}

                <div class="utme-q-text">
                  ${escapeHtml(currentQ.questionText)}
                </div>

                <!-- Options List -->
                <div class="utme-options-list">
                  ${(currentQ.options || []).map((opt) => {
                    const letter = opt.substring(0, 1).toUpperCase();
                    const text = opt.substring(3).trim();
                    const isSelected = savedResp.selectedOption === letter;

                    return `
                      <button class="utme-option-btn ${isSelected ? 'selected' : ''}" onclick="window.UTME.selectOption('${letter}')">
                        <span class="utme-option-letter">${letter}</span>
                        <span>${escapeHtml(text)}</span>
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Navigation Bar (Sticky Thumb Controls on Mobile) -->
              <div class="utme-exam-nav-bar">
                <div class="utme-nav-left">
                  <button class="utme-nav-prev-btn" onclick="window.UTME.prevQuestion()" ${state.currentQuestionIndex === 0 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}>
                    ← Prev
                  </button>
                  <button class="utme-flag-btn ${savedResp.isMarkedForReview ? 'flagged' : ''}" onclick="window.UTME.toggleReviewFlag()">
                    <span>${savedResp.isMarkedForReview ? '🚩 Marked' : '🏳️ Mark'}</span>
                  </button>
                  ${savedResp.selectedOption ? `
                    <button id="utme-clear-choice-btn" class="utme-clear-btn" onclick="window.UTME.clearOption()">
                      Clear
                    </button>
                  ` : ''}
                </div>

                <div class="utme-nav-center">
                  <button class="utme-mobile-nav-palette-btn" onclick="window.UTME.toggleMobilePalette()" aria-label="Open Question Palette">
                    <span>📋</span> <span>${answeredCount}/${totalQ}</span>
                  </button>
                </div>

                <div class="utme-nav-right">
                  <button class="utme-nav-next-btn" onclick="window.UTME.nextQuestion()" ${state.currentQuestionIndex === totalQ - 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}>
                    Next →
                  </button>
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
                Submit Complete Exam 📝
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
                ✕ Close
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
                Submit Complete Exam 📝
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function attachExamHallEvents() {
    // Controlled keyboard input (A, B, C, D only - arrow keys do NOT change questions)
    window.onkeydown = (e) => {
      if (state.currentView !== "EXAM") return;
      if (e.repeat) return; // Prevent key hold repetition
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key.toUpperCase();
      if (["A", "B", "C", "D"].includes(key)) {
        window.UTME.selectOption(key);
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
        timerEl.innerHTML = `<span>⏱</span><span>${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}</span>`;

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

        <!-- Action Buttons -->
        <div class="utme-results-actions" style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 2rem;">
          <button onclick="window.UTME.loadReview()" class="utme-course-action-btn" style="flex: 1; padding: 1rem; font-size: 1.05rem;">
            <span>📖 Review All Answers & Step-by-Step Explanations →</span>
          </button>
          <button onclick="window.UTME.startAnotherExam()" style="background: #FFFFFF; border: 2px solid var(--ps-border-light); color: #1E293B; font-weight: 800; padding: 1rem 1.5rem; border-radius: var(--radius-sm); cursor: pointer;">
            🔄 Retake Another Mock Exam
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
              ? `<span style="background: #D1FAE5; color: #065F46; font-weight: 800; font-size: 0.8rem; padding: 0.2rem 0.6rem; border-radius: 6px;">✓ Correct</span>`
              : (q.isUnanswered
                ? `<span style="background: #F1F5F9; color: #475569; font-weight: 800; font-size: 0.8rem; padding: 0.2rem 0.6rem; border-radius: 6px;">○ Unanswered</span>`
                : `<span style="background: #FEE2E2; color: #991B1B; font-weight: 800; font-size: 0.8rem; padding: 0.2rem 0.6rem; border-radius: 6px;">✕ Incorrect</span>`);

            return `
              <div class="utme-review-item ${statusClass}">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem;">
                  <span style="font-family: 'Outfit', sans-serif; font-weight: 800; color: #334155;">
                    ${escapeHtml(q.subjectName)} • Question ${idx + 1} (${escapeHtml(q.sourceDocument || 'Past Paper')})
                  </span>
                  ${statusBadge}
                </div>

                <div style="font-size: 1.1rem; font-weight: 600; color: #0F172A; line-height: 1.5; margin-bottom: 1rem;">
                  ${escapeHtml(q.questionText)}
                </div>

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
                        ${isCorrectOpt ? '<span style="font-size: 0.8rem; font-weight: 800;">✓ Correct Answer</span>' : (isStudentOpt ? '<span style="font-size: 0.8rem; font-weight: 800;">Your Choice</span>' : '')}
                      </div>
                    `;
                  }).join('')}
                </div>

                <!-- Step-by-Step Educational Explanation -->
                <div class="utme-explanation-box">
                  <div class="utme-explanation-header">
                    <span>💡 Step-by-Step Educational Explanation:</span>
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
                    <span>📌 Syllabus Topic: <strong>${escapeHtml(q.topic)}</strong></span>
                    <span>📄 Source: Page ${q.sourcePage || 1}, Q${q.originalQuestionNumber || idx + 1}</span>
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
              ⚙️ Question Bank Administration & Audit Dashboard
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
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    jumpToSubject(code) {
      this.closeMobilePalette();
      const qIdx = state.examData.questions.findIndex(q => q.subjectCode === code);
      if (qIdx !== -1) {
        state.currentQuestionIndex = qIdx;
        state.paletteSubjectCode = code;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    prevQuestion() {
      if (state.currentQuestionIndex > 0) {
        state.currentQuestionIndex -= 1;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    nextQuestion() {
      if (state.currentQuestionIndex < state.examData.questions.length - 1) {
        state.currentQuestionIndex += 1;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    async selectOption(letter) {
      const q = state.examData?.questions?.[state.currentQuestionIndex];
      if (!q) return;

      const currentResp = state.responses[q.id] || { selectedOption: null, isMarkedForReview: false };
      currentResp.selectedOption = letter;
      state.responses[q.id] = currentResp;

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
      document.querySelectorAll(".utme-mobile-palette-toggle-btn").forEach(el => el.textContent = `📋 Palette (${answeredCount}/${totalQ})`);
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
      document.querySelectorAll(".utme-mobile-palette-toggle-btn").forEach(el => el.textContent = `📋 Palette (${answeredCount}/${totalQ})`);
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
          flagBtn.innerHTML = "<span>🚩 Marked</span>";
        } else {
          flagBtn.classList.remove("flagged");
          flagBtn.innerHTML = "<span>🏳️ Mark</span>";
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
    }
  };

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
