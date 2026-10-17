/**
 * =========================================================
 * UNIVERSITY OF IBADAN 100-LEVEL ACADEMIC VAULT, COURSE HUB,
 * CBT EXAMINATION ENGINE, AND FLASHCARD SYSTEM
 * =========================================================
 */

(function () {
  const state = {
    vault: {
      items: [],
      faculties: [],
      courses: [],
      categories: ["Lecture Notes", "Past Questions", "Textbooks", "Practical Manuals", "Tutorial Sheets", "Syllabi"],
      selectedFaculty: "ALL",
      selectedCourse: "ALL",
      selectedCategory: "ALL",
      selectedFormat: "ALL",
      selectedSemester: "ALL",
      searchQuery: "",
      page: 1,
      limit: 18,
      totalPages: 1,
      totalCount: 0,
      isLoading: false,
    },
    courses: {
      items: [],
      selectedFaculty: "ALL",
      selectedSemester: "ALL",
      searchQuery: "",
      isLoading: false,
    },
    activeCourse: null,
    activeCourseTab: "materials", // materials | cbt | flashcards | history
    cbt: {
      config: null,
      attempt: null,
      currentQuestionIndex: 0,
      selectedAnswers: {},
      flaggedQuestions: new Set(),
      timeRemainingSeconds: 0,
      timerInterval: null,
      isSubmitting: false,
      result: null,
    },
    flashcards: {
      deck: [],
      currentIndex: 0,
      isFlipped: false,
      selectedTopic: "ALL",
      knownCount: 0,
      revisionCount: 0,
      isLoading: false,
    },
    cbtPortal: {
      searchQuery: "",
      selectedFaculty: "ALL",
      selectedSemester: "ALL",
      filterWithQuestionsOnly: true,
      selectedPopularChip: "ALL",
    },
  };

  // Expose global controller
  window.UI100L = {
    init: initAcademic100L,
    switchVaultPage,
    filterVault,
    searchVault,
    openCourseDetail,
    closeCourseDetail,
    switchCourseTab,
    startCbt,
    selectCbtAnswer,
    navigateCbtQuestion,
    toggleFlagCbtQuestion,
    confirmSubmitCbt,
    submitCbtNow,
    retakeCbt,
    flipFlashcard,
    nextFlashcard,
    prevFlashcard,
    markFlashcard,
    shuffleFlashcards,
    openAdminVaultReport,
    renderCbtPortal: render100lCbtPortal,
    searchCbtPortal,
    filterCbtPortal,
    open100lCbtTab,
    renderHomeCbtLaunchpad,
    exitCbtHall,
    getCourses: () => state.courses.items || [],
  };

  /**
   * Initialize 100L Academic System
   */
  async function initAcademic100L() {
    console.log("[UI100L] Initializing 100-Level Academic System...");
    ensureGlobalOverlay();
    enhanceResourcesTab();
    render100lCbtPortal();
    renderHomeCbtLaunchpad();
    await Promise.all([
      load100lCourses(),
      loadVaultMaterials(),
    ]);
    render100lCbtPortal();
    renderHomeCbtLaunchpad();
  }

  function open100lCbtTab() {
    if (typeof window.switchTab === "function") {
      window.switchTab("cbt");
    }
    if (typeof window.switchCbtMode === "function") {
      window.switchCbtMode("100L");
    }
    render100lCbtPortal();
  }

  function ensureGlobalOverlay() {
    let overlay = document.getElementById("course-hub-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "course-hub-overlay";
      overlay.style.display = "none";
      document.body.appendChild(overlay);
    } else if (overlay.parentElement !== document.body) {
      document.body.appendChild(overlay);
    }
  }

  /**
   * 1. Transform #tab-resources into the Academic Materials Vault
   */
  function enhanceResourcesTab() {
    const resourcesTab = document.getElementById("tab-resources");
    if (!resourcesTab) return;

    // Check if already enhanced
    if (document.getElementById("vault-interactive-root")) return;

    // Create container
    const vaultRoot = document.createElement("div");
    vaultRoot.id = "vault-interactive-root";
    vaultRoot.innerHTML = `
      <!-- Vault Hero Banner -->
      <div class="vault-header-hero">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1.25rem;">
          <div style="max-width: 680px;">
            <div style="display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.78rem; font-weight: 800; color: #A78BFA; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 0.45rem;">
              <span><svg class="app-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>OFFICIAL ACADEMIC MATERIALS VAULT</span>
            </div>
            <h2 style="font-family: 'Outfit', sans-serif; font-size: 1.85rem; font-weight: 900; color: #FFFFFF; margin: 0 0 0.5rem 0; letter-spacing: -0.5px;">University of Ibadan 100-Level Archive</h2>
            <p style="color: #CBD5E1; font-size: 0.95rem; line-height: 1.5; margin: 0;">
              Over 1,860 verified departmental lecture notes, textbooks, past examination papers, laboratory manuals, and tutorial sheets preserved in original formats.
            </p>
          </div>
          <a href="https://drive.google.com/drive/folders/1fnSakjwMMiewYKsSPc92CZVKPFe4EOQX" target="_blank" rel="noopener noreferrer" class="action-btn" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #FFF; font-weight: 700; padding: 0.75rem 1.25rem; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.45rem; text-decoration: none;">
            <span>Backup Google Drive Archive ↗</span>
          </a>
        </div>

        <div class="vault-stats-matrix">
          <div class="vault-stat-box">
            <div class="vault-stat-val" id="vault-stat-total">1,866</div>
            <div class="vault-stat-label">Total Documents</div>
          </div>
          <div class="vault-stat-box">
            <div class="vault-stat-val">147</div>
            <div class="vault-stat-label">100L Courses</div>
          </div>
          <div class="vault-stat-box">
            <div class="vault-stat-val">3,826</div>
            <div class="vault-stat-label">CBT Questions</div>
          </div>
          <div class="vault-stat-box">
            <div class="vault-stat-val">1,549</div>
            <div class="vault-stat-label">PDF Documents</div>
          </div>
          <div class="vault-stat-box">
            <div class="vault-stat-val">19</div>
            <div class="vault-stat-label">UI Faculties</div>
          </div>
        </div>
      </div>

      <!-- Navigation Switcher: Materials Vault vs Course Hub -->
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1.75rem; border-bottom: 2px solid #E2E8F0; padding-bottom: 0.5rem;">
        <button id="vault-tab-btn-materials" class="filter-chip active" onclick="UI100L.filterVault('VIEW_MATERIALS')" style="font-size: 0.95rem; padding: 0.55rem 1.25rem;">
          <svg class="app-icon app-icon-mr" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
          Browse All Materials (1,866)
        </button>
        <button id="vault-tab-btn-courses" class="filter-chip" onclick="UI100L.filterVault('VIEW_COURSES')" style="font-size: 0.95rem; padding: 0.55rem 1.25rem;">
          <svg class="app-icon app-icon-mr" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
          Course Directory &amp; CBT Portal (147 Courses)
        </button>
      </div>

      <!-- VIEW 1: MATERIALS BROWSER -->
      <div id="vault-materials-view-container">
        <!-- Search & Filter Controls -->
        <div class="vault-toolbar">
          <div class="vault-search-row">
            <input 
              type="text" 
              id="vault-search-input" 
              class="vault-search-input" 
              placeholder="Search materials by title, course code (e.g. COS 101, MTH 101, BIO 102), topic, or session..." 
              oninput="UI100L.searchVault(this.value)"
            />
          </div>
          <div class="vault-dropdown-row">
            <select id="vault-filter-faculty" class="vault-select" onchange="UI100L.filterVault()">
              <option value="ALL">All Faculties</option>
            </select>
            <select id="vault-filter-category" class="vault-select" onchange="UI100L.filterVault()">
              <option value="ALL">All Categories</option>
              <option value="Lecture Notes">Lecture Notes</option>
              <option value="Past Questions">Past Examination Questions</option>
              <option value="Academic">Textbooks &amp; Study Packs</option>
              <option value="Practical Manual">Practical &amp; Lab Manuals</option>
              <option value="Tutorial Sheet">Tutorial &amp; Problem Sets</option>
              <option value="Syllabus">Curriculum &amp; Syllabi</option>
            </select>
            <select id="vault-filter-format" class="vault-select" onchange="UI100L.filterVault()">
              <option value="ALL">All File Formats</option>
              <option value="pdf">PDF Documents</option>
              <option value="docx">Word (.docx)</option>
              <option value="pptx">PowerPoint (.pptx)</option>
              <option value="jpg">Images / Scans</option>
              <option value="zip">ZIP Archives</option>
            </select>
            <select id="vault-filter-semester" class="vault-select" onchange="UI100L.filterVault()">
              <option value="ALL">All Semesters</option>
              <option value="1st">1st Semester</option>
              <option value="2nd">2nd Semester</option>
            </select>
          </div>
        </div>

        <!-- Materials Count Badge -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <div id="vault-results-summary" style="font-size: 0.9rem; font-weight: 700; color: #64748B;">
            Loading academic materials...
          </div>
        </div>

        <!-- Grid -->
        <div id="vault-materials-grid" class="vault-materials-grid">
          <!-- Populated dynamically -->
        </div>

        <!-- Pagination -->
        <div id="vault-pagination-container" class="vault-pagination"></div>
      </div>

      <!-- VIEW 2: COURSE DIRECTORY -->
      <div id="vault-courses-view-container" style="display: none;">
        <div class="vault-toolbar" style="margin-bottom: 1.5rem;">
          <input 
            type="text" 
            id="courses-search-input" 
            class="vault-search-input" 
            placeholder="Search 100L courses by code (e.g. CSC 101, MTH 101, GES 107) or title..." 
            oninput="UI100L.filterVault('SEARCH_COURSES', this.value)"
            style="margin-bottom: 0.75rem;"
          />
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <select id="courses-filter-faculty" class="vault-select" onchange="UI100L.filterVault('FILTER_COURSES')" style="flex: 1; min-width: 200px;">
              <option value="ALL">All Faculties</option>
            </select>
            <select id="courses-filter-semester" class="vault-select" onchange="UI100L.filterVault('FILTER_COURSES')" style="width: 180px;">
              <option value="ALL">All Semesters</option>
              <option value="1st">1st Semester</option>
              <option value="2nd">2nd Semester</option>
            </select>
          </div>
        </div>

        <div id="courses-100l-grid" class="courses-grid-100l"></div>
      </div>

      <!-- COURSE HUB / DETAIL MODAL OR VIEW -->
      <div id="course-hub-overlay" style="display: none;"></div>
    `;

    // Append into #tab-resources
    resourcesTab.appendChild(vaultRoot);
  }

  /**
   * Load materials with active filters & pagination
   */
  async function loadVaultMaterials() {
    const v = state.vault;
    v.isLoading = true;

    const summaryEl = document.getElementById("vault-results-summary");
    if (summaryEl) summaryEl.textContent = "Loading academic materials...";

    const params = new URLSearchParams({
      page: String(v.page),
      limit: String(v.limit),
    });

    if (v.selectedFaculty !== "ALL") params.append("facultyId", v.selectedFaculty);
    if (v.selectedCourse !== "ALL") params.append("courseCode", v.selectedCourse);
    if (v.selectedCategory !== "ALL") params.append("category", v.selectedCategory);
    if (v.selectedFormat !== "ALL") params.append("fileFormat", v.selectedFormat);
    if (v.selectedSemester !== "ALL") params.append("semester", v.selectedSemester);
    if (v.searchQuery) params.append("search", v.searchQuery);

    try {
      const res = await fetch(`/api/vault/materials?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        v.items = json.items || [];
        v.totalPages = json.pagination.totalPages || 1;
        v.totalCount = json.pagination.total || 0;
        renderVaultMaterials();
        renderVaultPagination();
      }
    } catch (err) {
      console.error("[UI100L] Error loading materials:", err);
    } finally {
      v.isLoading = false;
    }
  }

  /**
   * Render Material Cards Grid
   */
  function renderVaultMaterials() {
    const grid = document.getElementById("vault-materials-grid");
    const summaryEl = document.getElementById("vault-results-summary");
    if (!grid) return;

    const v = state.vault;

    if (summaryEl) {
      summaryEl.textContent = `Showing ${v.items.length} of ${v.totalCount} materials (Page ${v.page} of ${v.totalPages})`;
    }

    if (v.items.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1.5rem; background: #FFF; border-radius: 12px; border: 1px solid #E2E8F0;">
          <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.25rem; font-weight: 800; color: #0F172A; margin-bottom: 0.5rem;">No matching materials found</h3>
          <p style="color: #64748B; font-size: 0.9rem;">Try broadening your search term or clearing faculty/category filters.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = v.items.map((item) => {
      const ext = (item.fileFormat || "pdf").toLowerCase().replace(".", "");
      const formatBadgeClass = ext === "pdf" ? "pdf" : ext === "docx" || ext === "doc" ? "docx" : ext.includes("ppt") ? "pptx" : "";
      const sizeStr = item.fileSize ? `${(item.fileSize / (1024 * 1024)).toFixed(1)} MB` : "Available";
      const pagesStr = item.pageCount ? `${item.pageCount} pages` : "Complete";
      const courseStr = item.courseCode || "UI 100L";
      const facultyName = item.faculty ? item.faculty.name : "University of Ibadan";

      return `
        <div class="vault-card">
          <div>
            <div class="vault-card-header">
              <span class="vault-course-chip">${escapeHtml(courseStr)}</span>
              <span class="vault-format-badge ${formatBadgeClass}">.${escapeHtml(ext)}</span>
            </div>
            <h3 class="vault-card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
            <p class="vault-card-desc">${escapeHtml(item.description || "Official University of Ibadan verified academic resource.")}</p>
          </div>
          <div>
            <div class="vault-card-meta">
              <span><svg class="app-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg> ${escapeHtml(item.category || "Academic")}</span>
              <span><svg class="app-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${pagesStr}</span>
              <span>${sizeStr}</span>
            </div>
            <div class="vault-card-actions">
              <a href="${escapeHtml(item.fileViewUrl)}" target="_blank" rel="noopener" class="vault-btn-view">
                <svg class="app-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                View Document
              </a>
              <a href="${escapeHtml(item.fileDownloadUrl)}" class="vault-btn-download" title="Download original file">
                <svg class="app-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                Download
              </a>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  /**
   * Render Pagination
   */
  function renderVaultPagination() {
    const container = document.getElementById("vault-pagination-container");
    if (!container) return;

    const v = state.vault;
    if (v.totalPages <= 1) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <button class="vault-page-btn" ${v.page <= 1 ? "disabled" : ""} onclick="UI100L.switchVaultPage(${v.page - 1})">
        ← Previous
      </button>
      <span style="font-weight: 700; color: #475569; font-size: 0.9rem; padding: 0 0.5rem;">
        Page ${v.page} of ${v.totalPages}
      </span>
      <button class="vault-page-btn" ${v.page >= v.totalPages ? "disabled" : ""} onclick="UI100L.switchVaultPage(${v.page + 1})">
        Next →
      </button>
    `;
  }

  function switchVaultPage(p) {
    if (p < 1 || p > state.vault.totalPages) return;
    state.vault.page = p;
    loadVaultMaterials();
    window.scrollTo({ top: 300, behavior: "smooth" });
  }

  let searchDebounceTimer = null;
  function searchVault(q) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      state.vault.searchQuery = q.trim();
      state.vault.page = 1;
      loadVaultMaterials();
    }, 300);
  }

  function filterVault(action, payload) {
    if (action === "VIEW_MATERIALS") {
      document.getElementById("vault-tab-btn-materials")?.classList.add("active");
      document.getElementById("vault-tab-btn-courses")?.classList.remove("active");
      document.getElementById("vault-materials-view-container").style.display = "block";
      document.getElementById("vault-courses-view-container").style.display = "none";
      return;
    }
    if (action === "VIEW_COURSES") {
      document.getElementById("vault-tab-btn-courses")?.classList.add("active");
      document.getElementById("vault-tab-btn-materials")?.classList.remove("active");
      document.getElementById("vault-materials-view-container").style.display = "none";
      document.getElementById("vault-courses-view-container").style.display = "block";
      render100lCourses();
      return;
    }

    const facEl = document.getElementById("vault-filter-faculty");
    const catEl = document.getElementById("vault-filter-category");
    const fmtEl = document.getElementById("vault-filter-format");
    const semEl = document.getElementById("vault-filter-semester");

    if (facEl) state.vault.selectedFaculty = facEl.value;
    if (catEl) state.vault.selectedCategory = catEl.value;
    if (fmtEl) state.vault.selectedFormat = fmtEl.value;
    if (semEl) state.vault.selectedSemester = semEl.value;

    state.vault.page = 1;
    loadVaultMaterials();
  }

  /**
   * 2. Load 100-Level Courses Directory
   */
  async function load100lCourses() {
    state.courses.isLoading = true;
    try {
      const res = await fetch("/api/100l/courses");
      const json = await res.json();
      if (json.success && json.data) {
        state.courses.items = json.data;

        // Populate faculty filters
        const facultiesMap = new Map();
        for (const c of json.data) {
          if (c.faculty) facultiesMap.set(c.faculty.id, c.faculty.name);
        }
        const optHtml = Array.from(facFacs(facultiesMap)).map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`).join("");

        const facSelect1 = document.getElementById("vault-filter-faculty");
        const facSelect2 = document.getElementById("courses-filter-faculty");
        const facSelectCbt = document.getElementById("cbt-filter-faculty");

        if (facSelect1) facSelect1.innerHTML = `<option value="ALL">All Faculties</option>${optHtml}`;
        if (facSelect2) facSelect2.innerHTML = `<option value="ALL">All Faculties</option>${optHtml}`;
        if (facSelectCbt) facSelectCbt.innerHTML = `<option value="ALL">All Faculties</option>${optHtml}`;

        render100lCourses();
        renderCbtPortalCourses();
        renderHomeCbtLaunchpad();
      }
    } catch (err) {
      console.error("[UI100L] Error loading courses:", err);
    } finally {
      state.courses.isLoading = false;
    }
  }

  function* facFacs(map) {
    for (const entry of map.entries()) yield entry;
  }

  /**
   * Render Course Directory Cards
   */
  function render100lCourses() {
    const grid = document.getElementById("courses-100l-grid");
    if (!grid) return;

    const list = state.courses.items || [];
    if (list.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Loading course directory...</div>`;
      return;
    }

    grid.innerHTML = list.map((c) => {
      const facName = c.faculty ? c.faculty.name : "University-Wide";
      return `
        <div class="course-card-100l" onclick="UI100L.openCourseDetail('${escapeHtml(c.code)}')">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span class="vault-course-chip" style="font-size: 0.85rem; padding: 0.35rem 0.75rem;">${escapeHtml(c.code)}</span>
              <span style="font-size: 0.78rem; font-weight: 700; color: #64748B;">${escapeHtml(c.semester)} Sem • ${c.units} Units</span>
            </div>
            <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 800; color: #0F172A; margin-bottom: 0.35rem;">${escapeHtml(c.title)}</h3>
            <div style="font-size: 0.8rem; color: #64748B; margin-bottom: 0.85rem;">Faculty of ${escapeHtml(facName)}</div>
          </div>
          <div>
            <div class="course-stats-badges">
              <span class="course-stat-badge materials"><svg class="app-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg> ${c.materialsCount} Materials</span>
              <span class="course-stat-badge questions"><svg class="app-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> ${c.questionsCount} Questions</span>
              <span class="course-stat-badge flashcards"><svg class="app-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ${c.flashcardsCount} Cards</span>
            </div>
            <button class="vault-btn-view" style="width: 100%; justify-content: center; margin-top: 0.5rem;" onclick="event.stopPropagation(); UI100L.openCourseDetail('${escapeHtml(c.code)}')">
              Open Course Hub &amp; CBT →
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  /**
   * Render 100-Level CBT Examination Portal inside #cbt-100l-portal-root
   */
  function render100lCbtPortal() {
    const root = document.getElementById("cbt-100l-portal-root");
    if (!root) return;

    // Check if the shell is already rendered
    let coursesGrid = document.getElementById("cbt-portal-courses-grid");
    if (!coursesGrid) {
      // Build faculties options
      const facultiesMap = new Map();
      for (const c of (state.courses.items || [])) {
        if (c.faculty) facultiesMap.set(c.faculty.id, c.faculty.name);
      }
      const facOptions = Array.from(facultiesMap.entries())
        .map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`)
        .join("");

      root.innerHTML = `
        <!-- 100L CBT Hero Header -->
        <div class="vault-header-hero" style="background: linear-gradient(135deg, rgba(30, 27, 75, 0.96) 0%, rgba(15, 13, 21, 0.98) 100%); border-color: rgba(168, 85, 247, 0.35); margin-bottom: 2rem;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1.25rem;">
            <div style="max-width: 680px;">
              <div style="display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.78rem; font-weight: 800; color: #C084FC; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 0.45rem;">
                <svg class="app-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                OFFICIAL UNIVERSITY OF IBADAN SEMESTER CBT
              </div>
              <h2 style="font-family: 'Outfit', sans-serif; font-size: 1.95rem; font-weight: 900; color: #FFFFFF; margin: 0 0 0.5rem 0; letter-spacing: -0.5px;">100-Level CBT Examination Engine</h2>
              <p style="color: #CBD5E1; font-size: 0.95rem; line-height: 1.55; margin: 0;">
                Over 3,826 authentic University of Ibadan past examination questions verified against official marking schemes. Practise timed exams under real UI hall conditions, tackle past papers by academic session, or take fast 10-question drills.
              </p>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button onclick="UI100L.filterCbtPortal('QUESTIONS_ONLY')" id="cbt-filter-toggle-btn" class="action-btn" style="background: rgba(139, 92, 246, 0.25); border: 1px solid #8B5CF6; color: #FFF; font-weight: 700; padding: 0.65rem 1.15rem; border-radius: 10px; font-size: 0.85rem;">
                <span>Active CBT Courses (67)</span>
              </button>
            </div>
          </div>

          <div class="vault-stats-matrix">
            <div class="vault-stat-box">
              <div class="vault-stat-val">3,826</div>
              <div class="vault-stat-label">CBT Questions</div>
            </div>
            <div class="vault-stat-box">
              <div class="vault-stat-val">67</div>
              <div class="vault-stat-label">Active 100L Courses</div>
            </div>
            <div class="vault-stat-box">
              <div class="vault-stat-val">100%</div>
              <div class="vault-stat-label">Verified Past Papers</div>
            </div>
            <div class="vault-stat-box">
              <div class="vault-stat-val">Instant</div>
              <div class="vault-stat-label">Grading &amp; Explanations</div>
            </div>
          </div>
        </div>

        <!-- Popular High-Demand Courses Strip -->
        <div style="margin-bottom: 1.5rem;">
          <div style="font-size: 0.78rem; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 0.6rem;">
            ⚡ POPULAR 100L CBT COURSES (TAP TO DRILL):
          </div>
          <div class="cbt-chip-strip">
            <button class="cbt-quick-chip active" onclick="UI100L.filterCbtPortal('CHIP', 'ALL', this)">All Courses (67)</button>
            <button class="cbt-quick-chip" onclick="UI100L.filterCbtPortal('CHIP', 'COS 101', this)">COS 101 (1,011 Qs)</button>
            <button class="cbt-quick-chip" onclick="UI100L.filterCbtPortal('CHIP', 'CHE 126', this)">CHE 126 (273 Qs)</button>
            <button class="cbt-quick-chip" onclick="UI100L.filterCbtPortal('CHIP', 'ECO 102', this)">ECO 102 (181 Qs)</button>
            <button class="cbt-quick-chip" onclick="UI100L.filterCbtPortal('CHIP', 'MTH 101', this)">MTH 101</button>
            <button class="cbt-quick-chip" onclick="UI100L.filterCbtPortal('CHIP', 'PHY 101', this)">PHY 101</button>
            <button class="cbt-quick-chip" onclick="UI100L.filterCbtPortal('CHIP', 'BIO 101', this)">BIO 101</button>
            <button class="cbt-quick-chip" onclick="UI100L.filterCbtPortal('CHIP', 'GES 107', this)">GES 107</button>
            <button class="cbt-quick-chip" onclick="UI100L.filterCbtPortal('CHIP', 'ZOO 114', this)">ZOO 114</button>
            <button class="cbt-quick-chip" onclick="UI100L.filterCbtPortal('CHIP', 'MAT 111', this)">MAT 111</button>
            <button class="cbt-quick-chip" onclick="UI100L.filterCbtPortal('CHIP', 'CLA 101', this)">CLA 101</button>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="vault-toolbar">
          <div class="vault-search-row">
            <input 
              type="text" 
              id="cbt-search-input" 
              class="vault-search-input" 
              placeholder="Search 100L courses by code (e.g. COS 101, MTH 101, BIO 101, CHE 126, PHY 101, GES 107) or title..." 
              oninput="UI100L.searchCbtPortal(this.value)"
            />
          </div>
          <div class="vault-dropdown-row">
            <select id="cbt-filter-faculty" class="vault-select" onchange="UI100L.filterCbtPortal('FILTER')">
              <option value="ALL">All Faculties</option>
              ${facOptions}
            </select>
            <select id="cbt-filter-semester" class="vault-select" onchange="UI100L.filterCbtPortal('FILTER')">
              <option value="ALL">All Semesters</option>
              <option value="1st">1st Semester</option>
              <option value="2nd">2nd Semester</option>
            </select>
            <select id="cbt-filter-has-questions" class="vault-select" onchange="UI100L.filterCbtPortal('FILTER')">
              <option value="YES">Courses with CBT Questions (Recommended)</option>
              <option value="ALL">Show All 147 100L Courses</option>
            </select>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <div id="cbt-results-summary" style="font-size: 0.9rem; font-weight: 700; color: #64748B;">
            Loading 100-Level CBT Courses...
          </div>
        </div>

        <!-- Courses Grid -->
        <div id="cbt-portal-courses-grid" class="courses-grid-100l">
          <!-- Rendered via renderCbtPortalCourses() -->
        </div>
      `;
    }

    renderCbtPortalCourses();
  }

  function renderCbtPortalCourses() {
    const grid = document.getElementById("cbt-portal-courses-grid");
    const summary = document.getElementById("cbt-results-summary");
    if (!grid) return;

    let items = state.courses.items || [];
    const p = state.cbtPortal;

    // Filter by questions only (default true)
    if (p.filterWithQuestionsOnly) {
      items = items.filter((c) => (c.questionsCount || 0) > 0);
    }

    // Filter by search query (handle spaces & hyphens flexibly)
    if (p.searchQuery) {
      const q = p.searchQuery.toLowerCase().trim();
      const qClean = q.replace(/[\s\-]/g, "");
      items = items.filter((c) => {
        const codeNorm = c.code.toLowerCase();
        const codeClean = codeNorm.replace(/[\s\-]/g, "");
        const titleNorm = c.title.toLowerCase();
        const facNorm = c.faculty ? c.faculty.name.toLowerCase() : "";
        return (
          codeNorm.includes(q) ||
          codeClean.includes(qClean) ||
          titleNorm.includes(q) ||
          facNorm.includes(q)
        );
      });
    }

    // Filter by faculty
    if (p.selectedFaculty && p.selectedFaculty !== "ALL") {
      items = items.filter((c) => c.faculty && c.faculty.id === p.selectedFaculty);
    }

    // Filter by semester
    if (p.selectedSemester && p.selectedSemester !== "ALL") {
      items = items.filter((c) => (c.semester || "").toLowerCase().includes(p.selectedSemester.toLowerCase()));
    }

    // Sort: courses with most questions first, then by code
    items = items.slice().sort((a, b) => {
      const qDiff = (b.questionsCount || 0) - (a.questionsCount || 0);
      if (qDiff !== 0) return qDiff;
      return a.code.localeCompare(b.code);
    });

    if (summary) {
      const totalQs = items.reduce((sum, c) => sum + (c.questionsCount || 0), 0);
      summary.innerHTML = `Showing <strong>${items.length} courses</strong> with <strong>${totalQs.toLocaleString()} verified questions</strong>`;
    }

    if (items.length === 0) {
      if (state.courses.isLoading) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1.5rem; background: #FFF; border-radius: 14px; border: 1px solid #E2E8F0;">
            <div class="app-icon-spin" style="margin-bottom: 0.5rem;"><svg class="app-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ps-purple-primary)" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
            <p style="color: #64748B; font-weight: 600;">Loading 100-Level CBT Course Directory...</p>
          </div>
        `;
        return;
      }
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1.5rem; background: #FFF; border-radius: 14px; border: 1px solid #E2E8F0;">
          <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.25rem; font-weight: 800; color: #0F172A; margin-bottom: 0.5rem;">No matching 100L CBT courses found</h3>
          <p style="color: #64748B; font-size: 0.9rem; margin-bottom: 1.25rem;">Try clearing your search query or switching to show all courses.</p>
          <button class="action-btn" onclick="UI100L.filterCbtPortal('RESET')" style="padding: 0.6rem 1.2rem; font-size: 0.85rem;">Reset Filters</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = items.map((c) => {
      const facName = c.faculty ? c.faculty.name : "University of Ibadan";
      const hasQuestions = (c.questionsCount || 0) > 0;

      return `
        <div class="course-card-100l" style="border: 1px solid #E2E8F0; border-radius: 14px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between; background: #FFFFFF; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span class="vault-course-chip" style="font-size: 0.92rem; font-weight: 800; padding: 0.35rem 0.8rem; border-radius: 8px;">${escapeHtml(c.code)}</span>
              <span style="font-size: 0.78rem; font-weight: 700; color: #64748B;">${escapeHtml(c.semester)} Sem • ${c.units} Units</span>
            </div>
            <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 800; color: #0F172A; margin: 0.35rem 0 0.3rem 0; line-height: 1.35;">${escapeHtml(c.title)}</h3>
            <div style="font-size: 0.8rem; color: #64748B; margin-bottom: 0.75rem;">Faculty of ${escapeHtml(facName)}</div>
            
            <div class="course-stats-badges" style="margin-bottom: 1rem;">
              ${hasQuestions ? `
                <span class="course-stat-badge questions" style="font-size: 0.82rem; padding: 0.35rem 0.75rem; background: rgba(16, 185, 129, 0.12); color: #059669; font-weight: 800;">
                  <svg class="app-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                  ${c.questionsCount.toLocaleString()} Questions Ready
                </span>
              ` : `
                <span class="course-stat-badge" style="font-size: 0.78rem; padding: 0.3rem 0.6rem; background: #F1F5F9; color: #64748B;">
                  ⏳ Question Bank Indexing
                </span>
              `}
              <span class="course-stat-badge materials" style="font-size: 0.78rem; padding: 0.3rem 0.6rem;">
                ${c.materialsCount} Docs
              </span>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem; border-top: 1px solid #F1F5F9; padding-top: 1rem;">
            ${hasQuestions ? `
              <div class="cbt-course-actions-grid">
                <button class="cbt-launch-btn-primary" onclick="UI100L.startCbt('${escapeHtml(c.code)}', 'FULL_CBT')">
                  ⚡ Full Exam (30m)
                </button>
                <button class="vault-btn-view" style="font-size: 0.82rem; padding: 0.65rem 0.5rem; justify-content: center; border-radius: 8px;" onclick="UI100L.startCbt('${escapeHtml(c.code)}', 'QUICK_DRILL')">
                  ⏱️ 10-Q Drill
                </button>
              </div>
              <button class="vault-btn-download" style="width: 100%; justify-content: center; font-size: 0.82rem; padding: 0.6rem 0.75rem; border-radius: 8px;" onclick="UI100L.openCourseDetail('${escapeHtml(c.code)}', 'cbt')">
                📖 Past Papers by Year &amp; Materials →
              </button>
            ` : `
              <button class="vault-btn-view" style="width: 100%; justify-content: center; font-size: 0.82rem; padding: 0.7rem 0.85rem; border-radius: 8px;" onclick="UI100L.openCourseDetail('${escapeHtml(c.code)}', 'materials')">
                📚 View Course Outline &amp; Vault Materials →
              </button>
            `}
          </div>
        </div>
      `;
    }).join("");
  }

  /**
   * Render Home Dashboard CBT Launchpad Cards
   */
  function renderHomeCbtLaunchpad() {
    const grid = document.getElementById("home-cbt-cards-grid");
    if (!grid) return;

    let items = (state.courses.items || []).filter((c) => (c.questionsCount || 0) > 0);
    if (items.length === 0) return; // preserve pre-rendered static cards

    // Sort by question count descending
    items.sort((a, b) => (b.questionsCount || 0) - (a.questionsCount || 0));
    const topCourses = items.slice(0, 8);

    grid.innerHTML = topCourses.map((c) => {
      const facName = c.faculty ? c.faculty.name : "University of Ibadan";
      return `
        <div class="home-cbt-card" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; padding: 1.35rem; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.25s ease;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span class="vault-course-chip" style="font-size: 0.88rem; font-weight: 800; padding: 0.35rem 0.75rem; border-radius: 8px;">${escapeHtml(c.code)}</span>
              <span style="font-size: 0.76rem; font-weight: 700; color: #94A3B8;">${escapeHtml(c.semester || '1st')} Sem • ${c.units || 3} Units</span>
            </div>
            <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 800; color: #FFFFFF; margin: 0.35rem 0 0.25rem 0; line-height: 1.35;">${escapeHtml(c.title)}</h3>
            <div style="font-size: 0.78rem; color: #94A3B8; margin-bottom: 0.85rem;">Faculty of ${escapeHtml(facName)}</div>
            
            <div style="margin-bottom: 1rem;">
              <span class="course-stat-badge questions" style="font-size: 0.82rem; padding: 0.35rem 0.75rem; background: rgba(16, 185, 129, 0.18); color: #34D399; font-weight: 800; border: 1px solid rgba(52, 211, 153, 0.3);">
                <svg class="app-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                ${(c.questionsCount || 0).toLocaleString()} Verified Questions
              </span>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.45rem; margin-top: 0.75rem; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 0.85rem;">
            <div class="cbt-course-actions-grid">
              <button class="cbt-launch-btn-primary" onclick="UI100L.startCbt('${escapeHtml(c.code)}', 'FULL_CBT')">
                ⚡ Full Exam (30m)
              </button>
              <button class="vault-btn-view" style="font-size: 0.82rem; padding: 0.65rem 0.5rem; justify-content: center; border-radius: 8px; background: rgba(255,255,255,0.08); color: #FFF; border-color: rgba(255,255,255,0.18);" onclick="UI100L.startCbt('${escapeHtml(c.code)}', 'QUICK_DRILL')">
                ⏱️ 10-Q Drill
              </button>
            </div>
            <button class="vault-btn-download" style="width: 100%; justify-content: center; font-size: 0.8rem; padding: 0.55rem 0.75rem; border-radius: 8px; background: transparent; color: #C084FC; border-color: rgba(192, 132, 252, 0.3);" onclick="UI100L.openCourseDetail('${escapeHtml(c.code)}', 'cbt')">
              📖 Past Papers &amp; Hub →
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  let cbtSearchDebounceTimer = null;
  function searchCbtPortal(q) {
    clearTimeout(cbtSearchDebounceTimer);
    cbtSearchDebounceTimer = setTimeout(() => {
      state.cbtPortal.searchQuery = q.trim();
      renderCbtPortalCourses();
    }, 200);
  }

  function filterCbtPortal(action, val, btnEl) {
    if (action === "CHIP") {
      document.querySelectorAll(".cbt-quick-chip").forEach((c) => c.classList.remove("active"));
      if (btnEl) btnEl.classList.add("active");
      if (val === "ALL") {
        state.cbtPortal.searchQuery = "";
        const searchInput = document.getElementById("cbt-search-input");
        if (searchInput) searchInput.value = "";
      } else {
        state.cbtPortal.searchQuery = val;
        const searchInput = document.getElementById("cbt-search-input");
        if (searchInput) searchInput.value = val;
      }
      renderCbtPortalCourses();
      return;
    }

    if (action === "QUESTIONS_ONLY") {
      state.cbtPortal.filterWithQuestionsOnly = !state.cbtPortal.filterWithQuestionsOnly;
      const toggleBtn = document.getElementById("cbt-filter-toggle-btn");
      if (toggleBtn) {
        toggleBtn.innerHTML = `<span>${state.cbtPortal.filterWithQuestionsOnly ? "Active CBT Courses (67)" : "All Courses (147)"}</span>`;
      }
      const selectQ = document.getElementById("cbt-filter-has-questions");
      if (selectQ) selectQ.value = state.cbtPortal.filterWithQuestionsOnly ? "YES" : "ALL";
      renderCbtPortalCourses();
      return;
    }

    if (action === "RESET") {
      state.cbtPortal.searchQuery = "";
      state.cbtPortal.selectedFaculty = "ALL";
      state.cbtPortal.selectedSemester = "ALL";
      state.cbtPortal.filterWithQuestionsOnly = true;
      const searchInput = document.getElementById("cbt-search-input");
      if (searchInput) searchInput.value = "";
      const facSelect = document.getElementById("cbt-filter-faculty");
      if (facSelect) facSelect.value = "ALL";
      const semSelect = document.getElementById("cbt-filter-semester");
      if (semSelect) semSelect.value = "ALL";
      const qSelect = document.getElementById("cbt-filter-has-questions");
      if (qSelect) qSelect.value = "YES";
      renderCbtPortalCourses();
      return;
    }

    const facEl = document.getElementById("cbt-filter-faculty");
    const semEl = document.getElementById("cbt-filter-semester");
    const qEl = document.getElementById("cbt-filter-has-questions");

    if (facEl) state.cbtPortal.selectedFaculty = facEl.value;
    if (semEl) state.cbtPortal.selectedSemester = semEl.value;
    if (qEl) state.cbtPortal.filterWithQuestionsOnly = qEl.value === "YES";

    renderCbtPortalCourses();
  }

  /**
   * 3. Open Detailed Course Hub
   */
  async function openCourseDetail(courseCode, preferredTab = null) {
    ensureGlobalOverlay();
    const overlay = document.getElementById("course-hub-overlay");
    if (!overlay) return;

    if (preferredTab) {
      state.activeCourseTab = preferredTab;
    } else {
      state.activeCourseTab = "materials";
    }

    overlay.style.display = "block";
    overlay.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(15,13,21,0.85); backdrop-filter: blur(8px); z-index: 9999; overflow-y: auto; padding: 2rem 1rem;">
        <div style="max-width: 960px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); overflow: hidden; position: relative;">
          <div style="text-align: center; padding: 4rem 2rem; color: #64748B;">
            <div class="app-icon-spin" style="font-size: 2rem; margin-bottom: 1rem;"><svg class="app-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
            <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.35rem; font-weight: 800; color: #0F172A;">Loading ${escapeHtml(courseCode)} Academic Hub...</h3>
          </div>
        </div>
      </div>
    `;

    try {
      const res = await fetch(`/api/100l/courses/${encodeURIComponent(courseCode)}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        alert("Course not found or unavailable.");
        overlay.style.display = "none";
        return;
      }

      state.activeCourse = json.data;
      renderCourseHubModal();
    } catch (err) {
      console.error("[UI100L] Error opening course hub:", err);
      overlay.style.display = "none";
    }
  }

  function closeCourseDetail() {
    const overlay = document.getElementById("course-hub-overlay");
    if (overlay) overlay.style.display = "none";
  }

  function switchCourseTab(tabName) {
    state.activeCourseTab = tabName;
    renderCourseHubModal();
  }

  /**
   * Render Course Hub Modal Content
   */
  function renderCourseHubModal() {
    const overlay = document.getElementById("course-hub-overlay");
    if (!overlay || !state.activeCourse) return;

    const c = state.activeCourse.course;
    const stats = state.activeCourse.questionStats;
    const materials = state.activeCourse.materials;
    const flashcardsCount = state.activeCourse.flashcardsCount;
    const tab = state.activeCourseTab;

    overlay.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(15,13,21,0.85); backdrop-filter: blur(8px); z-index: 9999; overflow-y: auto; padding: 2rem 1rem;">
        <div style="max-width: 960px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); overflow: hidden; position: relative;">
          
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #1E1B2E 0%, #110F1D 100%); padding: 2.25rem 2.5rem; color: #FFFFFF; position: relative;">
            <button onclick="UI100L.closeCourseDetail()" style="position: absolute; top: 1.5rem; right: 1.5rem; background: rgba(255,255,255,0.1); border: none; color: #FFF; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">✕</button>
            <div style="display: flex; gap: 0.65rem; align-items: center; margin-bottom: 0.75rem;">
              <span style="background: var(--grad-brand-primary); color: #FFF; font-weight: 800; font-size: 0.88rem; padding: 0.35rem 0.85rem; border-radius: 8px;">${escapeHtml(c.code)}</span>
              <span style="background: rgba(255,255,255,0.1); color: #DDD6FE; font-weight: 700; font-size: 0.8rem; padding: 0.35rem 0.75rem; border-radius: 8px;">100 Level • ${escapeHtml(c.semester)} Semester</span>
              <span style="background: rgba(16,185,129,0.15); color: #6EE7B7; font-weight: 700; font-size: 0.8rem; padding: 0.35rem 0.75rem; border-radius: 8px;">${c.units} Credit Units</span>
            </div>
            <h1 style="font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 900; color: #FFFFFF; margin: 0 0 0.5rem 0;">${escapeHtml(c.title)}</h1>
            <p style="color: #94A3B8; font-size: 0.95rem; margin: 0;">Faculty of ${escapeHtml(c.faculty ? c.faculty.name : "University of Ibadan")}</p>
          </div>

          <!-- Tabs Strip -->
          <div style="display: flex; gap: 0.5rem; padding: 0.75rem 2rem; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; overflow-x: auto;">
            <button class="filter-chip ${tab === 'materials' ? 'active' : ''}" onclick="UI100L.switchCourseTab('materials')">
              📚 Course Materials (${materials.length})
            </button>
            <button class="filter-chip ${tab === 'cbt' ? 'active' : ''}" onclick="UI100L.switchCourseTab('cbt')">
              🎯 CBT Practice &amp; Exams (${stats.totalQuestions})
            </button>
            <button class="filter-chip ${tab === 'flashcards' ? 'active' : ''}" onclick="UI100L.switchCourseTab('flashcards')">
              ⚡ Flashcards Deck (${flashcardsCount})
            </button>
          </div>

          <!-- Body Container -->
          <div style="padding: 2rem 2.5rem; min-height: 400px;">
            ${renderCourseHubTabBody(tab)}
          </div>
        </div>
      </div>
    `;

    if (tab === "flashcards") {
      loadCourseFlashcards(c.code);
    }
  }

  function renderCourseHubTabBody(tab) {
    const c = state.activeCourse.course;
    const stats = state.activeCourse.questionStats;
    const materials = state.activeCourse.materials;

    // TAB 1: MATERIALS
    if (tab === "materials") {
      if (materials.length === 0) {
        return `<div style="text-align: center; padding: 3rem; color: #64748B;">No materials currently linked to this course.</div>`;
      }
      return `
        <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.35rem; font-weight: 800; color: #0F172A; margin-bottom: 1.25rem;">Preserved Course Vault Documents</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
          ${materials.map((m) => `
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <span class="vault-format-badge" style="margin-bottom: 0.5rem; display: inline-block;">.${escapeHtml(m.fileFormat || 'pdf')} • ${escapeHtml(m.category || 'Material')}</span>
                <h4 style="font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 800; color: #0F172A; margin: 0 0 0.5rem 0;">${escapeHtml(m.title)}</h4>
                <div style="font-size: 0.78rem; color: #64748B; margin-bottom: 1rem;">${m.pageCount ? `${m.pageCount} pages • ` : ''}${m.fileSize ? `${(m.fileSize / (1024*1024)).toFixed(1)} MB` : ''}</div>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <a href="${escapeHtml(m.fileViewUrl)}" target="_blank" rel="noopener" class="vault-btn-view" style="font-size: 0.78rem;">View Online</a>
                <a href="${escapeHtml(m.fileDownloadUrl)}" class="vault-btn-download" style="font-size: 0.78rem;">Download</a>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

    // TAB 2: CBT PRACTICE & EXAMS
    if (tab === "cbt") {
      if (stats.totalQuestions === 0) {
        return `
          <div style="text-align: center; padding: 3rem; color: #64748B;">
            <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.35rem; font-weight: 800; color: #0F172A; margin-bottom: 0.5rem;">CBT Question Bank in Preparation</h3>
            <p>Our academic data architects are indexing authentic questions for ${escapeHtml(c.code)}. Check back shortly!</p>
          </div>
        `;
      }

      return `
        <div style="margin-bottom: 2rem;">
          <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.45rem; font-weight: 800; color: #0F172A; margin-bottom: 0.4rem;">Select CBT Examination Mode</h3>
          <p style="color: #64748B; font-size: 0.92rem; margin: 0;">Authentic University of Ibadan past examination questions verified against official marking schemes.</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; margin-bottom: 2.5rem;">
          <div style="background: #F8FAFC; border: 2px solid var(--ps-purple-primary); border-radius: 14px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 0.75rem; font-weight: 800; color: var(--ps-purple-primary); text-transform: uppercase; margin-bottom: 0.35rem;">FULL EXAMINATION</div>
              <h4 style="font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 800; color: #0F172A; margin: 0 0 0.5rem 0;">Timed CBT Simulation</h4>
              <p style="font-size: 0.85rem; color: #475569; margin-bottom: 1rem;">Experience a full 40-question timed exam under genuine UI computer hall conditions.</p>
            </div>
            <button class="action-btn" style="width: 100%; justify-content: center;" onclick="UI100L.startCbt('${escapeHtml(c.code)}', 'FULL_CBT')">
              Launch Full Exam (30 Mins) →
            </button>
          </div>

          <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 14px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 0.75rem; font-weight: 800; color: #059669; text-transform: uppercase; margin-bottom: 0.35rem;">PAST PAPERS BY YEAR</div>
              <h4 style="font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 800; color: #0F172A; margin: 0 0 0.5rem 0;">Authentic Paper Practice</h4>
              <p style="font-size: 0.85rem; color: #475569; margin-bottom: 0.75rem;">Practise questions preserving original order from a specific year.</p>
              <select id="cbt-paper-year-select" class="vault-select" style="margin-bottom: 1rem;">
                ${stats.availableYears.map((y) => `<option value="${y}">${y} Past Examination Paper</option>`).join("")}
              </select>
            </div>
            <button class="vault-btn-view" style="width: 100%; justify-content: center;" onclick="const y = document.getElementById('cbt-paper-year-select').value; UI100L.startCbt('${escapeHtml(c.code)}', 'PAST_QUESTION_YEAR', { examYear: y })">
              Start Year Paper Practice →
            </button>
          </div>

          <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 14px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 0.75rem; font-weight: 800; color: #D97706; text-transform: uppercase; margin-bottom: 0.35rem;">FAST SPRINT</div>
              <h4 style="font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 800; color: #0F172A; margin: 0 0 0.5rem 0;">Quick 10-Question Drill</h4>
              <p style="font-size: 0.85rem; color: #475569; margin-bottom: 1rem;">A fast 10-minute quick revision sprint between lectures or study groups.</p>
            </div>
            <button class="vault-btn-download" style="width: 100%; justify-content: center;" onclick="UI100L.startCbt('${escapeHtml(c.code)}', 'QUICK_DRILL')">
              Start Quick Drill (10 Mins) →
            </button>
          </div>
        </div>
      `;
    }

    // TAB 3: FLASHCARDS
    if (tab === "flashcards") {
      return `
        <div id="course-flashcards-root">
          <div style="text-align: center; padding: 3rem; color: #64748B;">Loading flashcards deck...</div>
        </div>
      `;
    }

    return "";
  }

  /**
   * 4. Flashcards Study Deck Engine
   */
  async function loadCourseFlashcards(courseCode) {
    const root = document.getElementById("course-flashcards-root");
    if (!root) return;

    try {
      const res = await fetch(`/api/100l/flashcards/${encodeURIComponent(courseCode)}`);
      const json = await res.json();
      if (!json.success || !json.data || json.data.length === 0) {
        root.innerHTML = `
          <div style="text-align: center; padding: 3rem; color: #64748B;">
            <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.35rem; font-weight: 800; color: #0F172A; margin-bottom: 0.5rem;">No Flashcards for this Course Yet</h3>
            <p>Our educational processing team will generate concept flashcards for ${escapeHtml(courseCode)} shortly.</p>
          </div>
        `;
        return;
      }

      state.flashcards.deck = json.data;
      state.flashcards.currentIndex = 0;
      state.flashcards.isFlipped = false;
      renderFlashcardView();
    } catch (err) {
      console.error("[UI100L] Error loading flashcards:", err);
    }
  }

  function renderFlashcardView() {
    const root = document.getElementById("course-flashcards-root");
    if (!root) return;

    const f = state.flashcards;
    const card = f.deck[f.currentIndex];
    if (!card) return;

    root.innerHTML = `
      <div style="max-width: 620px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <span style="font-weight: 800; font-size: 0.9rem; color: var(--ps-purple-primary);">${escapeHtml(card.courseCode)} • ${escapeHtml(card.topic || 'Core Concept')}</span>
          <span style="font-weight: 700; font-size: 0.85rem; color: #64748B;">Card ${f.currentIndex + 1} of ${f.deck.length}</span>
        </div>

        <!-- 3D Flip Card -->
        <div class="flashcard-wrapper" onclick="UI100L.flipFlashcard()">
          <div class="flashcard-inner ${f.isFlipped ? 'flipped' : ''}">
            <div class="flashcard-front">
              <div>
                <span style="font-size: 0.72rem; font-weight: 800; color: #A78BFA; text-transform: uppercase; letter-spacing: 0.6px;">CONCEPT PROMPT / QUESTION</span>
                <div style="font-family: 'Outfit', sans-serif; font-size: 1.25rem; font-weight: 700; line-height: 1.5; margin-top: 1.25rem; color: #FFFFFF;">
                  ${escapeHtml(card.front)}
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #94A3B8;">
                <span>Click card to reveal answer ↷</span>
                <span style="color: #FBBF24;">${card.difficulty || 'MEDIUM'}</span>
              </div>
            </div>

            <div class="flashcard-back">
              <div>
                <span style="font-size: 0.72rem; font-weight: 800; color: #38BDF8; text-transform: uppercase; letter-spacing: 0.6px;">VERIFIED ANSWER &amp; MEANING</span>
                <div style="font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 700; line-height: 1.5; margin-top: 1rem; color: #FFFFFF;">
                  ${escapeHtml(card.back)}
                </div>
                ${card.explanation ? `<p style="font-size: 0.88rem; color: #CBD5E1; margin-top: 0.85rem; line-height: 1.5;">${escapeHtml(card.explanation)}</p>` : ''}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #94A3B8;">
                <span>Click to flip back</span>
                <span>Source: ${escapeHtml(card.sourceDocument || 'UI Course Material')}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Study Actions -->
        <div style="display: flex; gap: 0.75rem; justify-content: center; margin-top: 1.5rem;">
          <button class="vault-btn-download" onclick="UI100L.markFlashcard('NEEDS_REVISION')" style="border-color: #F59E0B; color: #D97706;">
            ⚠️ Needs Revision
          </button>
          <button class="action-btn" onclick="UI100L.markFlashcard('KNOWN')" style="background: var(--grad-status-emerald);">
            ✓ Mark as Known
          </button>
        </div>

        <!-- Deck Navigation -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid #E2E8F0;">
          <button class="vault-page-btn" ${f.currentIndex === 0 ? 'disabled' : ''} onclick="UI100L.prevFlashcard()">← Previous</button>
          <button class="vault-page-btn" onclick="UI100L.shuffleFlashcards()">🔀 Shuffle Deck</button>
          <button class="vault-page-btn" ${f.currentIndex === f.deck.length - 1 ? 'disabled' : ''} onclick="UI100L.nextFlashcard()">Next →</button>
        </div>
      </div>
    `;
  }

  function flipFlashcard() {
    state.flashcards.isFlipped = !state.flashcards.isFlipped;
    renderFlashcardView();
  }

  function nextFlashcard() {
    if (state.flashcards.currentIndex < state.flashcards.deck.length - 1) {
      state.flashcards.currentIndex++;
      state.flashcards.isFlipped = false;
      renderFlashcardView();
    }
  }

  function prevFlashcard() {
    if (state.flashcards.currentIndex > 0) {
      state.flashcards.currentIndex--;
      state.flashcards.isFlipped = false;
      renderFlashcardView();
    }
  }

  async function markFlashcard(status) {
    const card = state.flashcards.deck[state.flashcards.currentIndex];
    if (card && card.id) {
      try {
        await fetch(`/api/100l/flashcards/${card.id}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
          credentials: "include",
        });
      } catch (e) {}
    }
    nextFlashcard();
  }

  function shuffleFlashcards() {
    state.flashcards.deck = [...state.flashcards.deck].sort(() => 0.5 - Math.random());
    state.flashcards.currentIndex = 0;
    state.flashcards.isFlipped = false;
    renderFlashcardView();
  }

  /**
   * 5. Interactive CBT Examination Engine
   */
  async function startCbt(courseCode, mode, options = {}) {
    ensureGlobalOverlay();
    closeCourseDetail();

    const overlay = document.getElementById("course-hub-overlay");
    if (!overlay) return;
    overlay.style.display = "block";

    overlay.innerHTML = `
      <div style="position: fixed; inset: 0; background: #0F0D15; z-index: 10000; overflow-y: auto; padding: 1.5rem;">
        <div style="text-align: center; padding: 6rem 1rem; color: #DDD6FE;">
          <div class="app-icon-spin" style="font-size: 2.5rem; margin-bottom: 1rem;"><svg class="app-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
          <h2 style="font-family: 'Outfit', sans-serif; font-size: 1.85rem; font-weight: 800; color: #FFFFFF;">Initializing CBT Examination...</h2>
          <p style="color: #94A3B8;">Configuring authentic UI exam hall simulation for ${escapeHtml(courseCode)}</p>
        </div>
      </div>
    `;

    try {
      const res = await fetch("/api/100l/cbt/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseCode,
          mode,
          examYear: options.examYear,
          topic: options.topic,
          questionCount: mode === "QUICK_DRILL" ? 10 : 30,
          durationMinutes: mode === "QUICK_DRILL" ? 10 : 25,
        }),
        credentials: "include",
      });

      const json = await res.json();
      if (!json.success || !json.data) {
        alert(json.error || "Failed to start examination.");
        overlay.style.display = "none";
        return;
      }

      state.cbt.attempt = json.data;
      state.cbt.currentQuestionIndex = 0;
      state.cbt.selectedAnswers = {};
      state.cbt.flaggedQuestions = new Set();
      state.cbt.timeRemainingSeconds = json.data.timeAllowedSeconds || 1800;

      startCbtTimer();
      renderCbtInterface();
    } catch (err) {
      console.error("[UI100L] CBT start error:", err);
      overlay.style.display = "none";
    }
  }

  function startCbtTimer() {
    clearInterval(state.cbt.timerInterval);
    state.cbt.timerInterval = setInterval(() => {
      state.cbt.timeRemainingSeconds--;

      const timerEl = document.getElementById("cbt-live-timer");
      if (timerEl) {
        const m = Math.floor(state.cbt.timeRemainingSeconds / 60);
        const s = state.cbt.timeRemainingSeconds % 60;
        timerEl.textContent = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

        if (state.cbt.timeRemainingSeconds <= 300 && state.cbt.timeRemainingSeconds > 60) {
          timerEl.parentElement.className = "cbt-timer-badge warning";
        } else if (state.cbt.timeRemainingSeconds <= 60) {
          timerEl.parentElement.className = "cbt-timer-badge critical";
        }
      }

      if (state.cbt.timeRemainingSeconds <= 0) {
        clearInterval(state.cbt.timerInterval);
        alert("Time is up! Submitting examination automatically.");
        submitCbtNow();
      }
    }, 1000);
  }

  function renderCbtInterface() {
    const overlay = document.getElementById("course-hub-overlay");
    if (!overlay || !state.cbt.attempt) return;

    const att = state.cbt.attempt;
    const qIndex = state.cbt.currentQuestionIndex;
    const q = att.questions[qIndex];
    if (!q) return;

    const m = Math.floor(state.cbt.timeRemainingSeconds / 60);
    const s = state.cbt.timeRemainingSeconds % 60;
    const timeStr = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

    const selectedOption = state.cbt.selectedAnswers[q.id] || "";
    const isFlagged = state.cbt.flaggedQuestions.has(q.id);

    overlay.innerHTML = `
      <div style="position: fixed; inset: 0; background: #0F0D15; z-index: 10000; overflow-y: auto; padding: 1.5rem;">
        <div style="max-width: 1080px; margin: 0 auto;">
          
          <!-- CBT Top Header -->
          <div class="cbt-header-bar">
            <div>
              <span class="vault-course-chip" style="font-size: 0.85rem; padding: 0.35rem 0.8rem; margin-right: 0.5rem;">${escapeHtml(att.courseCode)}</span>
              <strong style="color: #FFFFFF; font-size: 1.1rem; font-family: 'Outfit', sans-serif;">${escapeHtml(att.courseTitle)}</strong>
              <div style="color: #94A3B8; font-size: 0.82rem; margin-top: 0.2rem;">Authentic University of Ibadan CBT Simulation Engine</div>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div class="cbt-timer-badge">
                <svg class="app-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span id="cbt-live-timer">${timeStr}</span>
              </div>
              <button onclick="UI100L.confirmSubmitCbt()" class="action-btn" style="background: var(--grad-status-emerald); padding: 0.65rem 1.25rem;">
                Submit Exam ✓
              </button>
              <button onclick="UI100L.exitCbtHall()" class="vault-btn-view" style="border-color: rgba(239, 68, 68, 0.4); color: #F87171; background: rgba(239, 68, 68, 0.12); padding: 0.65rem 1rem; border-radius: 8px; font-weight: 700; font-size: 0.85rem;">
                ✕ Exit Hall
              </button>
            </div>
          </div>

          <!-- Exam Grid Layout -->
          <div class="cbt-body-layout">
            
            <!-- Left: Question & Options -->
            <div>
              <div class="cbt-question-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.75rem;">
                  <span style="font-weight: 800; color: #DDD6FE; font-size: 1rem;">Question ${qIndex + 1} of ${att.questions.length}</span>
                  <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span style="font-size: 0.78rem; color: #94A3B8;">Topic: ${escapeHtml(q.topic || 'General')}</span>
                    ${q.examYear ? `<span class="vault-format-badge" style="background: rgba(139,92,246,0.15); color: #C4B5FD;">${q.examYear}</span>` : ''}
                  </div>
                </div>

                ${q.passage ? `
                  <div style="background: rgba(255,255,255,0.04); border-left: 3px solid #8B5CF6; padding: 1rem; border-radius: 6px; margin-bottom: 1.25rem; font-size: 0.92rem; line-height: 1.55; color: #CBD5E1;">
                    ${escapeHtml(q.passage)}
                  </div>
                ` : ''}

                <div class="cbt-question-text">
                  ${escapeHtml(cleanCbtText(q.questionText))}
                </div>

                <!-- Options -->
                <div class="cbt-options-list">
                  ${(q.options || []).map((opt) => {
                    const cleanOpt = cleanCbtText(opt);
                    const optKey = cleanOpt.trim().charAt(0).toUpperCase();
                    const isSelected = selectedOption === optKey;
                    return `
                      <button class="cbt-option-btn ${isSelected ? 'selected' : ''}" onclick="UI100L.selectCbtAnswer('${q.id}', '${optKey}')">
                        <span style="display: inline-flex; width: 26px; height: 26px; border-radius: 50%; background: ${isSelected ? '#8B5CF6' : 'rgba(255,255,255,0.1)'}; color: #FFF; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem;">
                          ${optKey}
                        </span>
                        <span>${escapeHtml(cleanOpt)}</span>
                      </button>
                    `;
                  }).join("")}
                </div>
              </div>

              <!-- Question Nav Bar -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem;">
                <button class="vault-page-btn" ${qIndex === 0 ? 'disabled' : ''} onclick="UI100L.navigateCbtQuestion(${qIndex - 1})">
                  ← Previous
                </button>
                <button class="vault-btn-download" onclick="UI100L.toggleFlagCbtQuestion('${q.id}')" style="background: ${isFlagged ? 'rgba(245,158,11,0.2)' : '#1E1B2E'}; color: ${isFlagged ? '#FDE68A' : '#FFF'}; border-color: ${isFlagged ? '#F59E0B' : 'rgba(255,255,255,0.15)'};">
                  ${isFlagged ? '🚩 Flagged' : '🏳️ Flag for Review'}
                </button>
                <button class="vault-page-btn" ${qIndex === att.questions.length - 1 ? 'disabled' : ''} onclick="UI100L.navigateCbtQuestion(${qIndex + 1})">
                  Next →
                </button>
              </div>
            </div>

            <!-- Right: Question Palette Matrix -->
            <div>
              <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1.25rem;">
                <h4 style="font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 800; color: #FFFFFF; margin: 0 0 1rem 0;">Question Navigator</h4>
                <div class="cbt-palette-grid">
                  ${att.questions.map((quest, idx) => {
                    const isAnswered = !!state.cbt.selectedAnswers[quest.id];
                    const isQuestFlagged = state.cbt.flaggedQuestions.has(quest.id);
                    const isActive = idx === qIndex;

                    let cls = "cbt-palette-btn";
                    if (isAnswered) cls += " answered";
                    if (isQuestFlagged) cls += " flagged";
                    if (isActive) cls += " active";

                    return `
                      <button class="${cls}" onclick="UI100L.navigateCbtQuestion(${idx})">
                        ${idx + 1}
                      </button>
                    `;
                  }).join("")}
                </div>

                <div style="margin-top: 1.25rem; font-size: 0.76rem; color: #94A3B8; display: flex; flex-direction: column; gap: 0.4rem;">
                  <div><span style="display:inline-block; width:10px; height:10px; background:#8B5CF6; border-radius:2px; margin-right:5px;"></span> Answered</div>
                  <div><span style="display:inline-block; width:10px; height:10px; background:rgba(245,158,11,0.5); border-radius:2px; margin-right:5px;"></span> Flagged for review</div>
                  <div><span style="display:inline-block; width:10px; height:10px; background:rgba(255,255,255,0.1); border-radius:2px; margin-right:5px;"></span> Unanswered</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function selectCbtAnswer(questionId, answerKey) {
    state.cbt.selectedAnswers[questionId] = answerKey;
    renderCbtInterface();
  }

  function navigateCbtQuestion(newIndex) {
    if (newIndex >= 0 && newIndex < state.cbt.attempt.questions.length) {
      state.cbt.currentQuestionIndex = newIndex;
      renderCbtInterface();
    }
  }

  function toggleFlagCbtQuestion(questionId) {
    if (state.cbt.flaggedQuestions.has(questionId)) {
      state.cbt.flaggedQuestions.delete(questionId);
    } else {
      state.cbt.flaggedQuestions.add(questionId);
    }
    renderCbtInterface();
  }

  function confirmSubmitCbt() {
    const total = state.cbt.attempt.questions.length;
    const answeredCount = Object.keys(state.cbt.selectedAnswers).length;
    const unansweredCount = total - answeredCount;

    if (confirm(`You have answered ${answeredCount} of ${total} questions (${unansweredCount} remaining).\n\nAre you ready to submit and calculate your official score?`)) {
      submitCbtNow();
    }
  }

  /**
   * Submit CBT for server-side evaluation & explanations
   */
  async function submitCbtNow() {
    clearInterval(state.cbt.timerInterval);
    const att = state.cbt.attempt;

    const overlay = document.getElementById("course-hub-overlay");
    if (overlay) {
      overlay.innerHTML = `
        <div style="position: fixed; inset: 0; background: #0F0D15; z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 2rem;">
          <div style="text-align: center; color: #FFF;">
            <div class="app-icon-spin" style="font-size: 2.5rem; margin-bottom: 1rem;"><svg class="app-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
            <h2 style="font-family: 'Outfit', sans-serif; font-size: 1.85rem; font-weight: 800;">Grading Examination...</h2>
            <p style="color: #94A3B8;">Evaluating answers against official University of Ibadan marking schemes.</p>
          </div>
        </div>
      `;
    }

    try {
      const timeSpent = (att.timeAllowedSeconds || 1800) - state.cbt.timeRemainingSeconds;
      const res = await fetch("/api/100l/cbt/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: att.attemptId,
          courseCode: att.courseCode,
          mode: att.mode,
          selectedAnswers: state.cbt.selectedAnswers,
          timeSpentSeconds: timeSpent,
        }),
        credentials: "include",
      });

      const json = await res.json();
      if (!json.success || !json.data) {
        alert("Grading error: " + (json.error || "Please try again."));
        closeCourseDetail();
        return;
      }

      state.cbt.result = json.data;
      renderCbtResultsView();
    } catch (err) {
      console.error("[UI100L] CBT submission error:", err);
      alert("Network error submitting exam.");
      closeCourseDetail();
    }
  }

  function exitCbtHall() {
    if (confirm("Are you sure you want to exit the examination hall? Any unsaved answers will be discarded.")) {
      clearInterval(state.cbt.timerInterval);
      const overlay = document.getElementById("course-hub-overlay");
      if (overlay) overlay.style.display = "none";
    }
  }

  /**
   * Render Comprehensive Results & Review
   */
  function renderCbtResultsView() {
    const overlay = document.getElementById("course-hub-overlay");
    if (!overlay || !state.cbt.result) return;

    const r = state.cbt.result;
    const scoreVal = r.score;
    let gradeLabel = "Grade A (First Class / Distinction)";
    let gradeColor = "#10B981";

    if (scoreVal < 40) {
      gradeLabel = "Grade F (Needs Immediate Revision)";
      gradeColor = "#EF4444";
    } else if (scoreVal < 50) {
      gradeLabel = "Grade D (Pass)";
      gradeColor = "#F97316";
    } else if (scoreVal < 60) {
      gradeLabel = "Grade C (Credit)";
      gradeColor = "#F59E0B";
    } else if (scoreVal < 70) {
      gradeLabel = "Grade B (Very Good)";
      gradeColor = "#3B82F6";
    }

    overlay.innerHTML = `
      <div style="position: fixed; inset: 0; background: #0F0D15; z-index: 10000; overflow-y: auto; padding: 2rem 1rem;">
        <div style="max-width: 900px; margin: 0 auto; background: #161420; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; overflow: hidden; padding: 2.5rem; color: #FFFFFF;">
          
          <!-- Top Results Banner -->
          <div style="text-align: center; margin-bottom: 2.5rem;">
            <span class="vault-course-chip" style="font-size: 0.85rem; padding: 0.35rem 0.85rem; margin-bottom: 0.5rem; display: inline-block;">${escapeHtml(r.courseCode)} OFFICIAL CBT REPORT</span>
            <div style="font-family: 'Outfit', sans-serif; font-size: 3.5rem; font-weight: 900; color: ${gradeColor}; margin: 0.5rem 0;">
              ${scoreVal}%
            </div>
            <div style="font-size: 1.15rem; font-weight: 700; color: #FFFFFF;">${gradeLabel}</div>
            <div style="font-size: 0.85rem; color: #94A3B8; margin-top: 0.35rem;">Time Spent: ${Math.floor(r.timeSpentSeconds / 60)}m ${r.timeSpentSeconds % 60}s</div>
          </div>

          <!-- Score Breakdown Matrix -->
          <div class="vault-stats-matrix" style="margin-bottom: 2.5rem;">
            <div class="vault-stat-box" style="border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.08);">
              <div class="vault-stat-val" style="color: #34D399;">${r.correctCount}</div>
              <div class="vault-stat-label">Correct Answers</div>
            </div>
            <div class="vault-stat-box" style="border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08);">
              <div class="vault-stat-val" style="color: #F87171;">${r.wrongCount}</div>
              <div class="vault-stat-label">Wrong Answers</div>
            </div>
            <div class="vault-stat-box" style="border-color: rgba(148,163,184,0.3);">
              <div class="vault-stat-val" style="color: #CBD5E1;">${r.unansweredCount}</div>
              <div class="vault-stat-label">Unanswered</div>
            </div>
            <div class="vault-stat-box">
              <div class="vault-stat-val">${r.totalQuestions}</div>
              <div class="vault-stat-label">Total Questions</div>
            </div>
          </div>

          <!-- Topic Mastery Breakdown -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1.5rem; margin-bottom: 2.5rem;">
            <h4 style="font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 800; color: #FFFFFF; margin: 0 0 1rem 0;">Topic Mastery Breakdown</h4>
            <div style="display: flex; flex-direction: column; gap: 0.85rem;">
              ${Object.entries(r.topicPerformance || {}).map(([topic, data]) => `
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.25rem;">
                    <span>${escapeHtml(topic)}</span>
                    <span style="color: ${data.percentage >= 70 ? '#34D399' : data.percentage >= 50 ? '#FBBF24' : '#F87171'};">${data.correct}/${data.total} (${data.percentage}%)</span>
                  </div>
                  <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden;">
                    <div style="width: ${data.percentage}%; height: 100%; background: ${data.percentage >= 70 ? '#10B981' : data.percentage >= 50 ? '#F59E0B' : '#EF4444'};"></div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 3rem;">
            <button class="action-btn" onclick="UI100L.retakeCbt()">Retake Examination ↻</button>
            <button class="vault-btn-download" onclick="UI100L.closeCourseDetail()">Back to Course Hub →</button>
          </div>

          <!-- Step-by-Step Question Review & Explanations -->
          <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.45rem; font-weight: 800; color: #FFFFFF; margin-bottom: 1.5rem;">Detailed Question Explanations &amp; Marking Provenance</h3>
          
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            ${(r.review || []).map((q, idx) => {
              const isCorrect = q.isCorrect;
              const isSkipped = q.isUnanswered;
              const statusBadge = isCorrect 
                ? `<span style="background: rgba(16,185,129,0.2); color: #34D399; font-weight: 800; font-size: 0.75rem; padding: 0.25rem 0.6rem; border-radius: 6px;">✓ Correct</span>`
                : (isSkipped ? `<span style="background: rgba(148,163,184,0.2); color: #94A3B8; font-weight: 800; font-size: 0.75rem; padding: 0.25rem 0.6rem; border-radius: 6px;">○ Skipped</span>` : `<span style="background: rgba(239,68,68,0.2); color: #F87171; font-weight: 800; font-size: 0.75rem; padding: 0.25rem 0.6rem; border-radius: 6px;">✕ Incorrect</span>`);

              return `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid ${isCorrect ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}; border-radius: 12px; padding: 1.5rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                    <span style="font-weight: 800; font-size: 0.95rem; color: #DDD6FE;">Question ${idx + 1}</span>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                      ${statusBadge}
                      ${q.examYear ? `<span class="vault-format-badge">${q.examYear}</span>` : ''}
                    </div>
                  </div>

                  <div style="font-size: 1.05rem; line-height: 1.55; color: #FFFFFF; margin-bottom: 1rem;">
                    ${escapeHtml(cleanCbtText(q.questionText))}
                  </div>

                  <!-- Options list -->
                  <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.25rem;">
                    ${(q.options || []).map((opt) => {
                      const cleanOpt = cleanCbtText(opt);
                      const optKey = cleanOpt.trim().charAt(0).toUpperCase();
                      const isUserChoice = q.selectedAnswer === optKey;
                      const isRealAnswer = q.correctAnswer === optKey || q.correctAnswer.startsWith(optKey);

                      let style = "background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);";
                      if (isRealAnswer) {
                        style = "background: rgba(16,185,129,0.15); border: 1px solid #10B981; color: #A7F3D0;";
                      } else if (isUserChoice && !isCorrect) {
                        style = "background: rgba(239,68,68,0.15); border: 1px solid #EF4444; color: #FECACA;";
                      }

                      return `
                        <div style="${style} padding: 0.65rem 1rem; border-radius: 8px; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem;">
                          <strong>${optKey}</strong>
                          <span>${escapeHtml(cleanOpt)}</span>
                          ${isRealAnswer ? `<span style="margin-left: auto; font-size: 0.75rem; font-weight: 800; color: #34D399;">✓ Correct Answer</span>` : ''}
                          ${isUserChoice && !isCorrect ? `<span style="margin-left: auto; font-size: 0.75rem; font-weight: 800; color: #F87171;">Your Choice</span>` : ''}
                        </div>
                      `;
                    }).join("")}
                  </div>

                  <!-- Explanation Box -->
                  <div style="background: rgba(139,92,246,0.08); border-left: 3px solid #8B5CF6; padding: 0.85rem 1.15rem; border-radius: 6px; font-size: 0.88rem; line-height: 1.5; color: #E2E8F0;">
                    <div style="font-weight: 800; color: #DDD6FE; font-size: 0.78rem; text-transform: uppercase; margin-bottom: 0.35rem;">VERIFIED EXPLANATION:</div>
                    ${escapeHtml(cleanCbtText(q.explanation || 'Verified according to University of Ibadan departmental course curriculum.'))}
                    <div style="font-size: 0.75rem; color: #94A3B8; margin-top: 0.5rem;">
                      Source: ${escapeHtml(q.sourceDocument || 'Official Past Questions')}${q.sourcePage ? `, Page ${q.sourcePage}` : ''}
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;
  }

  function retakeCbt() {
    if (state.cbt.attempt) {
      startCbt(state.cbt.attempt.courseCode, state.cbt.attempt.mode);
    }
  }

  /**
   * 6. Admin Inventory Report
   */
  async function openAdminVaultReport() {
    try {
      const res = await fetch("/api/100l/admin/inventory");
      const json = await res.json();
      if (json.success && json.data) {
        alert(
          `100L ACADEMIC VAULT MASTER INVENTORY REPORT:\n\n` +
          `• Total Vault Documents: ${json.data.summary.totalMaterials}\n` +
          `• Total CBT Questions: ${json.data.summary.totalQuestions}\n` +
          `• Total Flashcards: ${json.data.summary.totalFlashcards}\n` +
          `• Total 100L Courses: ${json.data.summary.total100LCourses}\n` +
          `• Total UI Faculties: ${json.data.summary.totalFaculties}\n\n` +
          `Top Question Courses:\n` +
          json.data.topQuestionCourses.map((q) => `  - ${q.courseCode}: ${q.questions} questions`).join("\n")
        );
      }
    } catch (e) {
      alert("Failed to fetch admin inventory report.");
    }
  }

  function cleanCbtText(str) {
    if (!str || typeof str !== 'string') return '';
    str = str.trim();
    if (!str.includes("' '") && !/'[a-zA-Z0-9]'/.test(str)) {
      return str;
    }
    const optMatch = str.match(/^(\(?[A-Ea-e][\.\)]\s*)(.*)$/);
    if (optMatch) {
      return optMatch[1] + cleanCbtText(optMatch[2]);
    }
    if (str.length >= 3 && str.startsWith("'") && str.endsWith("'") && str.length % 2 === 1) {
      let allEven = true;
      for (let i = 0; i < str.length; i += 2) {
        if (str[i] !== "'") {
          allEven = false;
          break;
        }
      }
      if (allEven) {
        const chars = [];
        for (let i = 1; i < str.length; i += 2) {
          chars.push(str[i]);
        }
        return chars.join('').trim();
      }
    }
    let cleaned = str.replace(/'([^'])'/g, '$1');
    return cleaned.replace(/^'|'$/g, '').replace(/''/g, "'").replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m]));
  }

  // Auto-init on DOMContentLoaded or immediate execution
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAcademic100L);
  } else {
    initAcademic100L();
  }
})();
