import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Building2,
  GraduationCap as GradCapIcon,
  HeartHandshake,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Plus,
  Minus,
} from "lucide-react";
import "./landing.scss";

const popularSearches = ["MAT101", "Computer Science", "CGPA Scale", "GES107", "Jaja Clinic"];

const rotatingFeatures = [
  "Search any course in seconds",
  "Practice CBT exams like the real thing",
  "Chat with your AI study mentor",
  "Track your CGPA and credit load",
];

const stats = [
  { icon: Building2, value: "17", label: "Canonical Faculties", note: "Every faculty at UI fully covered" },
  { icon: GradCapIcon, value: "94+", label: "Departments Mapped", note: "From Architecture to Zoology, none left out" },
  { icon: HeartHandshake, value: "100%", label: "Completely Free", note: "No paywalls, no sign-up fees" },
];

const guides = [
  {
    tag: "Academic Rules",
    time: "4 min read",
    title: "Understanding Credit Units & Course Registration at UI",
    summary: "Everything about choosing courses, staying within credit limits, and managing your load each semester.",
  },
  {
    tag: "Official Clearance",
    time: "6 min read",
    title: "Complete 2026/27 Clearance Guide for New UI Students",
    summary: "Step-by-step walkthrough of every clearance stage, from medical examination to faculty sign-off.",
  },
  {
    tag: "Grading System",
    time: "3 min read",
    title: "How CGPA is Calculated — First Class, 2:1 & More",
    summary: "Demystify the UI grading scale, GPA calculation formula, and what score bands lead to which degree class.",
  },
  {
    tag: "Exam Prep",
    time: "5 min read",
    title: "GST CBT Exams: What Every 100-Level Student Must Know",
    summary: "Dates, registration steps, permitted materials, and tips for acing the General Studies Computer-Based Tests.",
  },
];

const faculties = [
  { name: "Engineering", depts: 8, courses: 42, color: "#4caf6d" },
  { name: "Medicine", depts: 6, courses: 56, color: "#d94f4f" },
  { name: "Agriculture", depts: 7, courses: 38, color: "#f2c14e" },
  { name: "Technology", depts: 6, courses: 33, color: "#9b2c8f" },
  { name: "Arts", depts: 8, courses: 47, color: "#e66239" },
  { name: "Science", depts: 10, courses: 61, color: "#00b8db" },
];

const faqs = [
  {
    q: "What is the deadline for course registration each semester?",
    a: "Course registration at University of Ibadan typically closes at the end of the third week of each semester. Late registration attracts a penalty fee and may affect your eligibility to sit examinations. Always confirm the exact date on the UI portal or with your faculty office each session.",
  },
  { q: "How is First Class Honours calculated at UI?", a: "" },
  { q: "What materials am I allowed to bring into an exam hall?", a: "" },
  { q: "Is there a verified Telegram community for UI 100-Level students?", a: "" },
];

export default function Landing() {
  return (
    <>
      <HeroSection />
      <StatsSection />
      <GuidesSection />
      <FacultyCarousel />
      <FaqSection />
    </>
  );
}

function HeroSection() {
  const [featureIndex, setFeatureIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFeatureIndex((i) => (i + 1) % rotatingFeatures.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="uif-hero">
      <div className="container uif-hero__inner">
        <div className="uif-hero__copy">
          <span className="badge-pill">Verified Guide for 2026/27 Session</span>
          <h1>
            The most <span className="text-gradient">accurate</span> academic guide for UI
            Freshers
          </h1>
          <p className="uif-hero__snippet" key={featureIndex}>
            {rotatingFeatures[featureIndex]}
          </p>

          <form className="uif-hero__search" onSubmit={(e) => e.preventDefault()}>
            <Search size={18} />
            <input type="text" placeholder="Search by course code, department, GST course, or venue..." />
            <button type="submit" className="btn btn-gradient">
              Search
            </button>
          </form>

          <div className="uif-hero__popular">
            <span className="text-muted">Popular searches:</span>
            {popularSearches.map((term) => (
              <button key={term} type="button" className="uif-hero__chip">
                {term}
              </button>
            ))}
          </div>
        </div>

        <div className="uif-hero__visual">
          <div className="uif-hero__badge uif-hero__badge--top">
            <strong>17</strong>
            <span>Faculties, all covered</span>
          </div>
          <div className="uif-hero__badge uif-hero__badge--bottom">
            <strong>100% Free</strong>
            <span>Always &amp; forever</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section className="uif-stats">
      <div className="container">
        <div className="uif-stats__header">
          <span className="badge-gold">Proven Excellence</span>
          <h2>Trusted by thousands of UI students</h2>
          <p className="text-muted">Accurate, verified data directly from official University of Ibadan sources.</p>
        </div>

        <div className="uif-stats__grid">
          {stats.map(({ icon: Icon, value, label, note }) => (
            <div key={label} className="card card-lift uif-stats__card">
              <span className="icon-shape icon-shape-lg">
                <Icon size={22} />
              </span>
              <div>
                <div className="uif-stats__value">{value}</div>
                <div className="uif-stats__label">{label}</div>
                <p className="text-muted text-xs">{note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GuidesSection() {
  return (
    <section className="uif-guides">
      <div className="container">
        <div className="uif-guides__header">
          <div>
            <span className="badge-pill">Essential Reading</span>
            <h2>
              Essential <span className="text-gradient">Freshers Guides</span>
            </h2>
            <p className="text-muted">In-depth articles on everything you need to know before resumption.</p>
          </div>
          <Link to="/guides" className="btn btn-outline">
            View All Articles
          </Link>
        </div>

        <div className="uif-guides__grid">
          {guides.map((g) => (
            <article key={g.title} className="card card-lift uif-guide-card">
              <div className="uif-guide-card__meta">
                <span className="badge-pill">{g.tag}</span>
                <span className="text-xs text-muted">{g.time}</span>
              </div>
              <h3>{g.title}</h3>
              <p className="text-muted">{g.summary}</p>
              <Link to="/guides" className="uif-guide-card__link">
                Read Full Article <ArrowRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FacultyCarousel() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const perPage = 3;
  const pages = Math.ceil(faculties.length / perPage);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % pages);
    }, 3500);
    return () => clearInterval(timerRef.current);
  }, [playing, pages]);

  const visible = faculties.slice(index * perPage, index * perPage + perPage);

  return (
    <section className="uif-faculties">
      <div className="container">
        <div className="uif-guides__header">
          <div>
            <span className="badge-pill">Faculties</span>
            <h2>
              Explore All <span className="text-gradient">17 Faculties</span>
            </h2>
            <p className="text-muted">Browse departments, core courses, and syllabi across University of Ibadan.</p>
          </div>
          <div className="uif-faculties__controls">
            <button className="btn btn-outline btn-sm" onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause size={14} /> : <Play size={14} />}
              {playing ? "Auto-Sliding" : "Paused"}
            </button>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setIndex((i) => (i - 1 + pages) % pages)}
              aria-label="Previous"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="btn btn-gradient btn-icon"
              onClick={() => setIndex((i) => (i + 1) % pages)}
              aria-label="Next"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="uif-faculties__grid">
          {visible.map((f) => (
            <div key={f.name} className="card card-lift uif-faculty-card" style={{ borderColor: f.color }}>
              <span className="badge-pill" style={{ background: `${f.color}22`, color: f.color }}>
                {f.courses} Courses
              </span>
              <h3>Faculty of {f.name}</h3>
              <span className="badge-pill">{f.depts} Departments</span>
              <Link to="/catalog" className="uif-guide-card__link">
                Explore Syllabus <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>

        <div className="uif-faculties__dots">
          {Array.from({ length: pages }).map((_, i) => (
            <span key={i} className={i === index ? "is-active" : ""} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="uif-faq">
      <div className="container">
        <div className="uif-faq__header">
          <span className="badge-pill">FAQs</span>
          <h2>
            Frequently Asked <span className="text-gradient">Questions</span>
          </h2>
          <p className="text-muted">Everything a UI 100-Level student typically wonders about.</p>
        </div>

        <div className="uif-faq__list">
          {faqs.map((item, i) => {
            const isOpen = i === openIndex;
            return (
              <div key={item.q} className={"uif-faq__item" + (isOpen ? " is-open" : "")}>
                <button className="uif-faq__question" onClick={() => setOpenIndex(isOpen ? -1 : i)}>
                  <span className="uif-faq__number">{i + 1}</span>
                  <span>{item.q}</span>
                  {isOpen ? <Minus size={18} /> : <Plus size={18} />}
                </button>
                {isOpen && item.a && <p className="uif-faq__answer text-muted">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
