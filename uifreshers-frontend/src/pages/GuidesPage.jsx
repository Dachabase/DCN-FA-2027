import { useMemo, useState } from "react";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { getGuides } from "../api/content";
import { useFetch } from "../api/useFetch";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import PageHeader from "../components/layout/PageHeader";

const CATEGORIES = [
  "All Guides",
  "Faculty Guides",
  "Academic Mastery",
  "Exam Prep",
  "Study Strategy",
  "Student Life & Business",
  "Productivity & Mindset",
  "Course Registration",
  "Grading System",
  "Campus Navigation",
];

export default function GuidesPage() {
  const [activeCategory, setActiveCategory] = useState("All Guides");
  const { data: guides, loading, error } = useFetch(
    () => getGuides(activeCategory === "All Guides" ? undefined : activeCategory),
    [activeCategory]
  );

  return (
    <>
      <PageHeader
        title="Faculty & Clearance Guides"
        subtitle="Verified course registration rules, UI 5.0 CGPA breakdown, and lecture venue maps."
        filters={CATEGORIES}
        activeFilter={activeCategory}
        onFilterChange={setActiveCategory}
      />

      <section className="container uif-catalog">
        {loading && <LoadingState label="Loading guides..." />}
        {error && <ErrorState message="Couldn't load guides from the server." />}
        {!loading && !error && (!guides || guides.length === 0) && (
          <EmptyState message="No guides in this category yet." />
        )}

        {!loading && !error && guides && guides.length > 0 && (
          <div className="uif-guides__grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {guides.map((g) => (
              <article key={g.id} className="card card-lift uif-guide-card">
                <div className="uif-guide-card__meta">
                  <span className="badge-pill">{g.category}</span>
                  {g.verified && (
                    <span className="badge-verified badge-pill">
                      <BadgeCheck size={12} /> Verified
                    </span>
                  )}
                </div>
                <h3>{g.title}</h3>
                <p className="text-muted">{g.summary}</p>
                <span className="uif-guide-card__link">
                  Read Guide <ArrowRight size={14} />
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
