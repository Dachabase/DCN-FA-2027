import { Zap, ExternalLink, MessageCircle } from "lucide-react";
import { getCourses } from "../api/content";
import { useFetch } from "../api/useFetch";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import PageHeader from "../components/layout/PageHeader";

export default function CbtPage() {
  const { data: courses, loading, error } = useFetch(
    () => getCourses({ has_cbt_practice: true }),
    []
  );

  return (
    <>
      <PageHeader
        title="CBT Practice"
        subtitle="Practice 100L general and departmental courses matching authentic UI CBT exam standards."
      />

      <section className="container uif-catalog">
        <div className="card card-dark uif-catalog__policy" style={{ marginBottom: "2rem" }}>
          <span className="badge-gold">
            <Zap size={14} /> Interactive Telegram Bot Simulator
          </span>
          <h3 style={{ color: "#fff" }}>Practice 100L CBT on Telegram</h3>
          <p className="text-muted">
            Experience timed mock exams, automatic score calculation, instant answer
            explanations, and performance tracking directly in Telegram.
          </p>
          <a
            href="https://t.me/uifreshers_cbt_bot"
            target="_blank"
            rel="noreferrer"
            className="btn btn-gradient"
            style={{ alignSelf: "flex-start" }}
          >
            Launch CBT Bot on Telegram <Zap size={14} />
          </a>
        </div>

        {loading && <LoadingState label="Loading practice courses..." />}
        {error && <ErrorState message="Couldn't load CBT-enabled courses." />}
        {!loading && !error && (!courses || courses.length === 0) && (
          <EmptyState message="No CBT practice courses are set up yet." />
        )}

        {!loading && !error && courses && courses.length > 0 && (
          <div className="uif-catalog__grid">
            {courses.map((c) => (
              <div key={c.id} className="card card-lift uif-catalog-card">
                <div className="uif-catalog-card__top">
                  <span className="badge-pill">{c.code}</span>
                  <span className="text-xs text-muted">
                    {c.course_type.replace("_", " ")}
                  </span>
                </div>
                <h3>{c.title}</h3>
                {c.description && <p className="text-muted text-xs">{c.description}</p>}
                <a
                  href={c.telegram_practice_link || "https://t.me/uifreshers_cbt_bot"}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  Practice {c.code} on Telegram <ExternalLink size={14} />
                </a>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ marginTop: "2rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <MessageCircle size={20} color="#7a1f7a" />
          <p className="text-muted" style={{ margin: 0 }}>
            CBT practice currently runs through our Telegram bot rather than in-app — an in-app
            quiz engine is a candidate for a future phase.
          </p>
        </div>
      </section>
    </>
  );
}
