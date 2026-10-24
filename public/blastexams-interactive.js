/* =========================================================
   BLASTEXAMS INTERACTIVE DESIGN SYSTEM COMPONENT LOGIC
   Powers the Faculty Carousel, FAQ Accordion, Animated Counters,
   and Mobile Navigation from blastexams.html
   ========================================================= */

(function () {
  "use strict";

  // --- 1. Faculty Carousel Data (17 Faculties from blastexams.html) ---
  const FACULTIES_DATA = [
    {
      name: "Faculty of Arts",
      emoji: "🎭",
      courses: 42,
      departments: ["English", "History", "Philosophy", "Linguistics", "Classics", "Theatre Arts", "Arabic & Islamic Studies", "European Studies"],
      deptCount: 8,
      color: "#FF6B4A"
    },
    {
      name: "Faculty of Science",
      emoji: "🔬",
      courses: 56,
      departments: ["Mathematics", "Physics", "Chemistry", "Biology", "Computer Science", "Microbiology", "Statistics", "Geology", "Zoology", "Botany"],
      deptCount: 10,
      color: "#2DBBAA"
    },
    {
      name: "Faculty of Computing",
      emoji: "💻",
      courses: 38,
      departments: ["Computer Science & AI", "Cybersecurity", "Information Technology", "Software Engineering", "Data Science"],
      deptCount: 5,
      color: "#830074"
    },
    {
      name: "Faculty of Technology",
      emoji: "⚙️",
      courses: 52,
      departments: ["Electrical & Electronic", "Mechanical", "Civil", "Industrial Production", "Agricultural & Environmental", "Petroleum Engineering"],
      deptCount: 6,
      color: "#F59E0B"
    },
    {
      name: "Faculty of Law",
      emoji: "⚖️",
      courses: 34,
      departments: ["Commercial & Industrial Law", "Public & International Law", "Private & Property Law", "Jurisprudence & International Law"],
      deptCount: 4,
      color: "#3B82F6"
    },
    {
      name: "Faculty of Clinical Sciences",
      emoji: "🏥",
      courses: 58,
      departments: ["Medicine & Surgery (MBBS)", "Physiotherapy", "Nursing Science", "Medical Laboratory Science"],
      deptCount: 6,
      color: "#EF4444"
    },
    {
      name: "Faculty of Basic Medical Sciences",
      emoji: "🧬",
      courses: 46,
      departments: ["Human Anatomy", "Physiology", "Biochemistry", "Pharmacology & Therapeutics"],
      deptCount: 4,
      color: "#10B981"
    },
    {
      name: "Faculty of Pharmacy",
      emoji: "💊",
      courses: 40,
      departments: ["Pharmaceutics", "Pharmaceutical Chemistry", "Pharmacognosy", "Clinical Pharmacy"],
      deptCount: 5,
      color: "#84CC16"
    },
    {
      name: "Faculty of Economics & Management",
      emoji: "📊",
      courses: 44,
      departments: ["Economics", "Accounting", "Banking & Finance", "Business Administration"],
      deptCount: 4,
      color: "#830074"
    },
    {
      name: "Faculty of The Social Sciences",
      emoji: "🌐",
      courses: 38,
      departments: ["Political Science", "Sociology", "Psychology", "Geography"],
      deptCount: 4,
      color: "#FF6B4A"
    },
    {
      name: "Faculty of Agriculture",
      emoji: "🌱",
      courses: 48,
      departments: ["Agricultural Economics", "Agronomy", "Animal Science", "Crop Protection", "Soil Resources Management"],
      deptCount: 5,
      color: "#2DBBAA"
    },
    {
      name: "Faculty of Renewable Natural Resources",
      emoji: "🌲",
      courses: 36,
      departments: ["Forest Resources Management", "Wildlife & Ecotourism Management", "Aquaculture & Fisheries", "Wood Products"],
      deptCount: 4,
      color: "#10B981"
    },
    {
      name: "Faculty of Veterinary Medicine",
      emoji: "🐾",
      courses: 54,
      departments: ["Veterinary Anatomy", "Veterinary Pathology", "Veterinary Medicine", "Veterinary Surgery", "Veterinary Microbiology"],
      deptCount: 6,
      color: "#F59E0B"
    },
    {
      name: "Faculty of Education",
      emoji: "📚",
      courses: 45,
      departments: ["Adult Education", "Guidance & Counselling", "LARIS", "Special Education", "Educational Management", "Teacher Education"],
      deptCount: 6,
      color: "#3B82F6"
    },
    {
      name: "Faculty of Environmental Design",
      emoji: "🏛️",
      courses: 42,
      departments: ["Architecture", "Estate Management", "Urban & Regional Planning", "Quantity Surveying"],
      deptCount: 4,
      color: "#830074"
    },
    {
      name: "Faculty of Public Health",
      emoji: "🫁",
      courses: 36,
      departments: ["Environmental Health Sciences", "Epidemiology & Medical Statistics", "Health Promotion & Education", "Human Nutrition"],
      deptCount: 4,
      color: "#2DBBAA"
    },
    {
      name: "Faculty of Dentistry",
      emoji: "🦷",
      courses: 32,
      departments: ["Child Dental Health", "Oral & Maxillofacial Surgery", "Oral Pathology", "Periodontology & Community Dentistry"],
      deptCount: 4,
      color: "#EF4444"
    }
  ];

  let currentCarouselIndex = 0;
  let isAutoSliding = true;
  let carouselTimer = null;

  function renderFacultyCards() {
    const track = document.getElementById("faculty-cards-track");
    const dotsContainer = document.getElementById("faculty-dots-container");
    if (!track) return;

    track.innerHTML = "";
    // Show 3 cards on desktop, responsive layout handled via CSS grid
    for (let i = 0; i < 3; i++) {
      const idx = (currentCarouselIndex + i) % FACULTIES_DATA.length;
      const fac = FACULTIES_DATA[idx];
      const isLead = i === 0;

      const card = document.createElement("div");
      card.className = `faculty-card card-hover ${isLead ? "featured" : ""}`;
      card.style.setProperty("--card-accent", fac.color);

      card.innerHTML = `
        <div class="faculty-courses-badge" style="background: ${fac.color}">${fac.courses} Courses</div>
        <div class="faculty-icon-box" style="background: ${fac.color}15; color: ${fac.color}">
          <span>${fac.emoji}</span>
        </div>
        <h3 class="faculty-card-name">${escapeHtml(fac.name)}</h3>
        <p class="faculty-card-depts">${escapeHtml(fac.departments.slice(0, 4).join(" • "))}</p>
        <div class="faculty-card-footer">
          <span class="faculty-dept-pill" style="background: ${fac.color}15; color: ${fac.color}">
            ${fac.deptCount} Departments
          </span>
          <button class="arrow-link" style="color: ${fac.color}; font-size: 0.82rem; font-weight: 700; background: none; border: none;" onclick="navigateToFacultyCatalog('${escapeHtml(fac.name)}')">
            <span>Explore Syllabus</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
        </div>
      `;
      track.appendChild(card);
    }

    if (dotsContainer) {
      dotsContainer.innerHTML = "";
      FACULTIES_DATA.forEach((fac, idx) => {
        const dot = document.createElement("button");
        dot.className = `faculty-dot ${idx === currentCarouselIndex ? "active" : ""}`;
        dot.setAttribute("aria-label", `Slide ${idx + 1}: ${fac.name}`);
        dot.onclick = () => {
          currentCarouselIndex = idx;
          renderFacultyCards();
        };
        dotsContainer.appendChild(dot);
      });
    }
  }

  function startCarouselTimer() {
    stopCarouselTimer();
    if (isAutoSliding) {
      carouselTimer = setInterval(() => {
        currentCarouselIndex = (currentCarouselIndex + 1) % FACULTIES_DATA.length;
        renderFacultyCards();
      }, 3500);
    }
  }

  function stopCarouselTimer() {
    if (carouselTimer) {
      clearInterval(carouselTimer);
      carouselTimer = null;
    }
  }

  window.stepFacultyCarousel = function (delta) {
    currentCarouselIndex = (currentCarouselIndex + delta + FACULTIES_DATA.length) % FACULTIES_DATA.length;
    renderFacultyCards();
    if (isAutoSliding) {
      startCarouselTimer();
    }
  };

  window.toggleFacultyAutoSlide = function () {
    isAutoSliding = !isAutoSliding;
    const btn = document.getElementById("faculty-auto-slide-btn");
    if (btn) {
      btn.innerHTML = isAutoSliding ? "⏸ Auto-Sliding" : "▶ Play";
    }
    if (isAutoSliding) {
      startCarouselTimer();
    } else {
      stopCarouselTimer();
    }
  };

  window.navigateToFacultyCatalog = function (facultyName) {
    if (typeof window.switchTab === "function") {
      window.switchTab("catalog");
    }
    const input = document.getElementById("faculty-search-input");
    if (input) {
      input.value = facultyName;
      if (typeof window.filterFacultyCatalog === "function") {
        window.filterFacultyCatalog(facultyName);
      }
    }
  };

  // --- 2. FAQ Accordion Logic (tv from blastexams.html) ---
  window.toggleFaqItem = function (id) {
    const allFaqs = document.querySelectorAll(".faq-item");
    allFaqs.forEach((item) => {
      const itemId = item.getAttribute("data-faq-id");
      if (itemId === String(id)) {
        const isActive = item.classList.contains("active");
        if (isActive) {
          item.classList.remove("active");
          const content = item.querySelector(".faq-content");
          if (content) content.style.display = "none";
        } else {
          item.classList.add("active");
          const content = item.querySelector(".faq-content");
          if (content) content.style.display = "block";
        }
      } else {
        item.classList.remove("active");
        const content = item.querySelector(".faq-content");
        if (content) content.style.display = "none";
      }
    });
  };

  // --- 3. Animated Counter for Proven Excellence ---
  let animatedExcellence = false;
  function initStatsObserver() {
    const section = document.getElementById("excellence-section");
    if (!section || animatedExcellence) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !animatedExcellence) {
          animatedExcellence = true;
          animateValue("stat-faculties-num", 0, 17, 1200, "");
          animateValue("stat-departments-num", 0, 94, 1500, "+");
          animateValue("stat-free-num", 0, 100, 1400, "%");
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(section);
  }

  function animateValue(id, start, end, duration, suffix) {
    const el = document.getElementById(id);
    if (!el) return;
    const startTime = performance.now();
    function update(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const val = Math.round(start + (end - start) * ease);
      el.textContent = `${val}${suffix}`;
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    requestAnimationFrame(update);
  }

  // --- 4. Mobile Bottom Nav Sync with Active Tab ---
  function syncMobileNav(tabName) {
    const buttons = document.querySelectorAll(".be-mobile-nav-btn");
    buttons.forEach((btn) => {
      const targetTab = btn.getAttribute("data-be-tab");
      if (targetTab === tabName) {
        btn.classList.add("active");
        const iconSpan = btn.querySelector(".be-mobile-nav-icon");
        if (iconSpan) {
          iconSpan.classList.add("animate-spring-pop");
          setTimeout(() => iconSpan.classList.remove("animate-spring-pop"), 400);
        }
      } else {
        btn.classList.remove("active");
      }
    });
  }

  // Hook into existing switchTab
  const originalSwitchTab = window.switchTab;
  if (typeof originalSwitchTab === "function") {
    window.switchTab = function (tabName, event) {
      originalSwitchTab(tabName, event);
      syncMobileNav(tabName);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  }

  window.handleMobileNavClick = function (tabName, event) {
    if (typeof window.switchTab === "function") {
      window.switchTab(tabName, event);
    }
  };

  // --- Helper ---
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Initialize once DOM is ready
  document.addEventListener("DOMContentLoaded", () => {
    renderFacultyCards();
    startCarouselTimer();
    initStatsObserver();
    syncMobileNav("home");
  });

  // Re-run if already loaded
  if (document.readyState === "complete" || document.readyState === "interactive") {
    renderFacultyCards();
    startCarouselTimer();
    initStatsObserver();
  }
})();
