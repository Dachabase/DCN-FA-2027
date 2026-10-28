export interface LevelInfo {
  level: number;
  xpRequired: number;
  nextLevelXp: number;
  progressPct: number;
  academicTier: string;
  hunterRank: string;
}

export const LEVEL_TIERS = [
  { name: "Freshite", from: 1, to: 4, about: "Settling into UI campus life; first past questions solved." },
  { name: "Stalwart", from: 5, to: 8, about: "A solid study habit: library regular to departmental standout." },
  { name: "Departmental Ace", from: 9, to: 13, about: "Hundreds of questions solved; ahead of the pack." },
  { name: "Dean's Lister", from: 14, to: 17, about: "Consistent high scores across core courses." },
  { name: "Senior Scholar", from: 18, to: 21, about: "Deep mastery of semester course materials." },
  { name: "First Class Contender", from: 22, to: 25, about: "Revision is routine; high accuracy in CBT mock drills." },
  { name: "Faculty Fellow", from: 26, to: 29, about: "Top 5% of your faculty cohort." },
  { name: "Distinction Scholar", from: 30, to: 33, about: "University-level stamina and recall precision." },
  { name: "University Scholar", from: 34, to: 37, about: "Peers regularly approach you for problem explanations." },
  { name: "Valedictorian", from: 38, to: 41, about: "Exam-ready perfection across multiple sessions." },
  { name: "Hall of Fame", from: 42, to: 45, about: "An all-time UI preparation record." },
  { name: "Academic Monarch", from: 46, to: null, about: "Beyond every rank. Unstoppable mastery." },
] as const;

export const HUNTER_RANKS = [
  { rank: "E", name: "E-Rank Scholar", from: 1, about: "Just awakened into UI academic life." },
  { rank: "D", name: "D-Rank Scholar", from: 5, about: "Clearing the first past question gates daily." },
  { rank: "C", name: "C-Rank Scholar", from: 9, about: "Mastering complex calculation and theory questions." },
  { rank: "B", name: "B-Rank Scholar", from: 14, about: "High-yield raid leader; departmental anchor." },
  { rank: "A", name: "A-Rank Scholar", from: 22, about: "Study groups compete to have you." },
  { rank: "S", name: "S-Rank Scholar", from: 30, about: "One of the rare academic elite." },
  { rank: "N", name: "National Scholar", from: 38, about: "A dominant force in CBT exams." },
  { rank: "M", name: "Monarch", from: 46, about: "Beyond every level. Arise." },
] as const;

export const XP_PER_ANSWER = 10;
export const XP_DAILY_QUEST_BONUS = 50;
export const XP_WEEKLY_STREAK_BONUS = 150;
