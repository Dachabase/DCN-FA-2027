import { useParams, Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { getCourses } from "../api/content";
import { useFetch } from "../api/useFetch";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import PageHeader from "../components/layout/PageHeader";

export default function DepartmentCoursesPage() {
  const { departmentId } = useParams();
  const { data: courses, loading, error } = useFetch(
    () => getCourses({ department_id: departmentId }),
    [departmentId]
  );

  return (
    <>
      <PageHeader title="100-Level Course Package" subtitle="Compulsory, elective, and general studies courses for this department." />
      <section className="container uif-catalog">
        <Link to="/catalog" className="btn btn-ghost btn-sm">
          &larr; Back to catalog
        </Link>

        {loading && <LoadingState label="Loading courses..." />}
        {error && <ErrorState message="Couldn't load courses for this department." />}
        {!loading && !error && (!courses || courses.length === 0) && (
          <EmptyState message="No courses listed for this department yet." />
        )}

        {!loading && !error && courses && courses.length > 0 && (
          <div className="uif-catalog__grid">
            {courses.map((c) => (
              <div key={c.id} className="card card-lift uif-catalog-card">
                <div className="uif-catalog-card__top">
                  <span className="badge-pill">{c.code}</span>
                  <span className="text-xs text-muted">{c.units} Units · Sem {c.semester}</span>
                </div>
                <h3>{c.title}</h3>
                {c.description && <p className="text-muted text-xs">{c.description}</p>}
                {c.has_cbt_practice && (
                  <span className="badge-verified badge-pill">
                    <BookOpen size={12} /> CBT practice available
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
