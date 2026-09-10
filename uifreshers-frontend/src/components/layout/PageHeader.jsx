import "./pageheader.scss";

export default function PageHeader({ title, subtitle, filters, activeFilter, onFilterChange }) {
  return (
    <div className="uif-pageheader">
      <div className="container">
        <h1>{title}</h1>
        {subtitle && <p className="text-muted">{subtitle}</p>}
        {filters && filters.length > 0 && (
          <div className="uif-pageheader__filters">
            {filters.map((f) => (
              <button
                key={f}
                type="button"
                className={"uif-hero__chip" + (activeFilter === f ? " is-active" : "")}
                onClick={() => onFilterChange(f)}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
