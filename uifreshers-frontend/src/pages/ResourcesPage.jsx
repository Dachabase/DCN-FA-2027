import { useState } from "react";
import { FolderOpen, ExternalLink } from "lucide-react";
import { getResources } from "../api/content";
import { useFetch } from "../api/useFetch";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import PageHeader from "../components/layout/PageHeader";

const CATEGORIES = ["All Categories", "Academic", "General Studies", "Administrative"];

export default function ResourcesPage() {
  const [activeCategory, setActiveCategory] = useState("All Categories");
  const { data: resources, loading, error } = useFetch(
    () => getResources(activeCategory === "All Categories" ? undefined : activeCategory),
    [activeCategory]
  );

  return (
    <>
      <PageHeader
        title="Academic Resources & Library"
        subtitle="Access 100-Level lecture slides, GST past questions, academic calendar, and department study packs."
        filters={CATEGORIES}
        activeFilter={activeCategory}
        onFilterChange={setActiveCategory}
      />

      <section className="container uif-catalog">
        <div className="card card-dark uif-catalog__policy" style={{ marginBottom: "2rem" }}>
          <span className="badge-gold">
            <FolderOpen size={14} /> Google Drive Academic Vault
          </span>
          <h3 style={{ color: "#fff" }}>Official 100-Level Study Repository</h3>
          <p className="text-muted">
            All verified past questions, departmental lecture slides, textbooks, and laboratory
            manuals are archived in this Google Drive folder.
          </p>
        </div>

        {loading && <LoadingState label="Loading resources..." />}
        {error && <ErrorState message="Couldn't load resources from the server." />}
        {!loading && !error && (!resources || resources.length === 0) && (
          <EmptyState message="No resources in this category yet." />
        )}

        {!loading && !error && resources && resources.length > 0 && (
          <div className="uif-catalog__grid">
            {resources.map((r) => (
              <div key={r.id} className="card card-lift uif-catalog-card">
                <div className="uif-catalog-card__top">
                  <span className="badge-pill">{r.category}</span>
                  <span className="text-xs text-muted">{r.source_label}</span>
                </div>
                <h3>{r.title}</h3>
                <p className="text-muted text-xs">{r.description}</p>
                <a href={r.link} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                  Open in {r.source_label} <ExternalLink size={14} />
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
