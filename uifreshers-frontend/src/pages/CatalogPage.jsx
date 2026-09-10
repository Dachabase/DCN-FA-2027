import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowRight, ClipboardList, Award } from "lucide-react";
import { getFaculties, getDepartments } from "../api/content";
import { useFetch } from "../api/useFetch";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import PageHeader from "../components/layout/PageHeader";
import "./catalog.scss";

export default function CatalogPage() {
  const { data: faculties, loading, error } = useFetch(getFaculties, []);
  const [activeCategory, setActiveCategory] = useState("All Faculties");
  const [query, setQuery] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState(null);

  const categories = useMemo(() => {
    if (!faculties) return ["All Faculties"];
    const set = new Set(faculties.map((f) => f.category).filter(Boolean));
    return ["All Faculties", ...Array.from(set)];
  }, [faculties]);

  const filtered = useMemo(() => {
    if (!faculties) return [];
    return faculties.filter((f) => {
      const matchesCategory = activeCategory === "All Faculties" || f.category === activeCategory;
      const matchesQuery = f.name.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [faculties, activeCategory, query]);

  if (selectedFaculty) {
    return (
      <DepartmentDrillDown faculty={selectedFaculty} onBack={() => setSelectedFaculty(null)} />
    );
  }

  return (
    <>
      <PageHeader
        title="UI Faculties & Course Packages"
        subtitle="Select a faculty to inspect 100-Level departmental course packages and shared GES requirements."
        filters={categories}
        activeFilter={activeCategory}
        onFilterChange={setActiveCategory}
      />

      <section className="container uif-catalog">
        <div className="card uif-catalog__policy">
          <span className="badge-pill">
            <ClipboardList size={14} /> UI Academic Policy
          </span>
          <h3>Semester Credit Load &amp; 5.0 CGPA Scale</h3>
          <p className="text-muted">
            Official Senate rules: credit load is strictly 15–24 units per semester. Good
            Standing minimum CGPA is 1.50.
          </p>
          <div className="uif-catalog__policy-figures">
            <div>
              <span className="text-xs text-muted">CREDIT LIMIT</span>
              <strong>15 – 24 Units</strong>
            </div>
            <div>
              <span className="text-xs text-muted">GOOD STANDING</span>
              <strong className="uif-catalog__good">
                <Award size={16} /> ≥ 1.50 CGPA
              </strong>
            </div>
          </div>
        </div>

        <div className="uif-hero__search uif-catalog__search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search faculties or departments (e.g. Computer Science, MBBS, Law)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading && <LoadingState label="Loading faculties..." />}
        {error && <ErrorState message="Couldn't load faculties from the server." />}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState message="No faculties match your search." />
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="uif-catalog__grid">
            {filtered.map((f) => (
              <div key={f.id} className="card card-lift uif-catalog-card">
                <div className="uif-catalog-card__top">
                  <span className="text-xs text-muted uif-catalog-card__category">{f.category}</span>
                  <span className="badge-pill">{f.department_count} Depts</span>
                </div>
                <h3>{f.name}</h3>
                {f.description && <p className="text-muted text-xs">{f.description}</p>}
                <button
                  type="button"
                  className="uif-guide-card__link"
                  onClick={() => setSelectedFaculty(f)}
                >
                  Inspect Departmental Packages <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function DepartmentDrillDown({ faculty, onBack }) {
  const { data: departments, loading, error } = useFetch(() => getDepartments(faculty.id), [faculty.id]);

  return (
    <>
      <PageHeader title={faculty.name} subtitle={`${faculty.department_count} departments · ${faculty.course_count} courses`} />
      <section className="container uif-catalog">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          &larr; Back to all faculties
        </button>

        {loading && <LoadingState label="Loading departments..." />}
        {error && <ErrorState message="Couldn't load departments for this faculty." />}
        {!loading && !error && (!departments || departments.length === 0) && (
          <EmptyState message="No departments listed for this faculty yet." />
        )}

        {!loading && !error && departments && departments.length > 0 && (
          <div className="uif-catalog__grid">
            {departments.map((d) => (
              <Link key={d.id} to={`/catalog/${d.id}`} className="card card-lift uif-catalog-card">
                <h3>{d.name}</h3>
                <span className="badge-pill">{d.course_count} Courses</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
