import { useState } from "react";
import { ExternalLink, CalendarDays } from "lucide-react";
import { getOpportunities } from "../api/content";
import { useFetch } from "../api/useFetch";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import PageHeader from "../components/layout/PageHeader";

const TYPES = ["All Types", "Scholarship", "Work-Study", "Hackathon", "Mentorship"];

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function OpportunitiesPage() {
  const [activeType, setActiveType] = useState("All Types");
  const { data: opportunities, loading, error } = useFetch(
    () => getOpportunities(activeType === "All Types" ? undefined : activeType),
    [activeType]
  );

  return (
    <>
      <PageHeader
        title="Scholarships & Student Grants"
        subtitle="Explore verified scholarships, campus work-study schemes, hackathons, and mentorship programs."
        filters={TYPES}
        activeFilter={activeType}
        onFilterChange={setActiveType}
      />

      <section className="container uif-catalog">
        {loading && <LoadingState label="Loading opportunities..." />}
        {error && <ErrorState message="Couldn't load opportunities from the server." />}
        {!loading && !error && (!opportunities || opportunities.length === 0) && (
          <EmptyState message="No opportunities in this category right now." />
        )}

        {!loading && !error && opportunities && opportunities.length > 0 && (
          <div className="uif-catalog__grid">
            {opportunities.map((o) => (
              <div key={o.id} className="card card-lift uif-catalog-card">
                <div className="uif-catalog-card__top">
                  <span className="badge-pill">{o.type}</span>
                  {o.deadline && (
                    <span className="text-xs text-muted">
                      <CalendarDays size={12} style={{ verticalAlign: "-2px" }} /> {formatDate(o.deadline)}
                    </span>
                  )}
                </div>
                <h3>{o.title}</h3>
                <p className="text-muted text-xs">{o.description}</p>
                <a href={o.link} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                  Apply / View Portal <ExternalLink size={14} />
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
