# BlastExams: University of Ibadan Academic Mastery & CBT Engine

> An installable, offline-first Progressive Web Application (PWA) and academic exam preparation engine reverse engineered from `mbprep.app` and adapted specifically for University of Ibadan (UI) students across all 16 faculties.

---

## 🏛️ Architecture & System Overview

BlastExams translates professional exam preparation mechanics into a closed-loop mastery platform for Nigerian university students:

1. **Adaptive Practice & CBT Exam Hall:**
   - Multi-format past question drills: Single Best Answer (SBA) with distractor analyses, True/False with discrete statement/limb explanations, and Short Answer / Theory calculations with self-marking rubrics.
   - UI CBT Hall Simulator: Real timed countdown conditions with 5-minute and 1-minute alert thresholds, question navigation palette, and auto-submission on expiration.
2. **Course & Faculty Exam Intelligence ("Exam Intel"):**
   - Historical multi-session past paper scanning (e.g. 2018/19 through 2024/25).
   - Generates Topic Exam Likelihood % rings and identifies Top 10 High-Yield "Hero Topics".
   - Flags "Critical Weak Areas" when exam likelihood $\ge 60\%$ and personal accuracy $< 65\%$.
3. **Automated Spaced Repetition Review Queue:**
   - Any question answered incorrectly or marked with Low Confidence in practice/mocks automatically enters the spaced review queue.
   - Clean-room SuperMemo-2 (SM-2) / FSRS adaptation: expands recall intervals ($1 \to 3 \to 7 \to 16 \to 35$ days) upon correct recall, resetting to 1 day on error.
4. **Gamification & Habit Engine:**
   - **XP Engine:** Exact 10 XP awarded per answered question (`XP_PER_ANSWER = 10`), with daily quest completion bonus ($+50\text{ XP}$).
   - **Mathematical Level Curve:** Levels 1–13 through an exact threshold array $[0, 200, 500, \dots, 10000]$, progressing into quadratic scaling ($10000 + 2500n + \frac{250n(n-1)}{2}$) up to Level 45, and linear beyond.
   - **UI Academic Tiers:** Freshite $\to$ Stalwart $\to$ Departmental Ace $\to$ Dean's Lister $\to$ Senior Scholar $\to$ First Class Contender $\to$ Faculty Fellow $\to$ Distinction Scholar $\to$ University Scholar $\to$ Valedictorian $\to$ Hall of Fame $\to$ Academic Monarch.
   - **Hunter Ranks ($E \to M$):** E, D, C, B, A, S, National (N), and Monarch (M).
   - **Daily Quests:** Configurable daily target (10 to 300 answers), streak counter, and performance letter grades ($E \to M$).
5. **Class & Hall Leaderboards:**
   - Real-time ranking filtered by Today, Weekly, and All-Time.
   - Scoped by Department, Faculty, Hall of Residence (Tedder, Mellanby, Kuti, Bello, Idia, Awo, etc.), or Study Groups.
   - Privacy-preserving alias mode (real name vs. anonymous "UI Scholar #XYZ").
6. **Curriculum Lessons:**
   - Syllabus-mapped modular reading guides with read-time estimates and progress bars.
   - Embedded diagnostic check questions validating comprehension before progressing.
7. **Offline-Resilient PWA:**
   - Web App Manifest configured for standalone native display and quick launch shortcuts.
   - Service worker pre-caching, dynamic cache-first static asset delivery, and offline `/offline.html` fallback.
   - Local answer/telemetry buffer in IndexedDB/localStorage syncing with `sync.late` flags when online.

---

## 🛠️ Tech Stack

- **Runtime & Language:** Node.js (v20+), TypeScript, Express.js.
- **Database & ORM:** PostgreSQL, Prisma ORM (v7.9.1).
- **Authentication:** Passwordless 6-digit email OTP + HTTP-only JWT cookies + Google OAuth 2.0.
- **PWA & Offline:** HTML5, Service Worker API, Cache Storage, Web Push API, IndexedDB.
- **Validation:** Zod schemas.

---

## 🚀 Setup & Installation

### 1. Prerequisites
- Node.js $\ge 20.0.0$
- PostgreSQL database instance
- npm

### 2. Environment Variables
Copy `.env.example` to `.env` and configure your credentials:

```bash
cp .env.example .env
```

Key environment variables:
```ini
PORT=3000
DATABASE_URL="postgresql://user:password@host:5432/ui_freshers?sslmode=require"
JWT_SECRET="your-jwt-secret-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars"

# Optional Email & OAuth Integrations
BREVO_API_KEY="your-brevo-api-key"
MAIL_FROM_EMAIL="noreply@blastexams.app"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 3. Database Migration & Prisma Generation
```bash
# Push schema to PostgreSQL
npm run db:push

# Generate Prisma Client
npm run db:generate
```

### 4. Running the Application
```bash
# Start development server with live reload
npm run dev

# Compile TypeScript
npm run build

# Start production server
npm run start
```

---

## 📡 Core API Endpoints

### Gamification & Quests
- `GET /api/gamification/me` — Current student XP, level info, academic tier, hunter rank, and streak.
- `GET /api/gamification/quest/today` — Today's quest progress, target count, grade, and status.
- `PATCH /api/gamification/settings` — Update alias name, real-name display toggle, and daily answer quota.
- `GET /api/gamification/leaderboard?period=TODAY&scope=DEPARTMENT` — Ranked leaderboard ladder.

### Spaced Repetition Review
- `GET /api/review/queue` — Counts of cards due today, due this week, mastered, and active review cards.
- `POST /api/review/:questionId/resolve` — Submit review attempt (`{ isCorrect, confidence }`), updates SM-2 schedule.
- `POST /api/review/:questionId/enqueue` — Manually bookmark/enqueue a question for spaced recall.

### Practice & CBT Simulator (Mounted in subsequent phases)
- `POST /api/sessions/start` — Launch practice drill or timed CBT mock.
- `POST /api/sessions/:sessionId/answer` — Submit answer with confidence rating.
- `POST /api/sessions/:sessionId/complete` — Complete session and retrieve diagnostic report.
- `GET /api/courses/:courseId/intel` — Retrieve high-yield topic ranking, likelihood %, and weak-area flags.

