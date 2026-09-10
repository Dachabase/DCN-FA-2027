import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <section className="container" style={{ padding: "3rem 1.5rem" }}>
      <h1>Welcome back{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}</h1>
      <p className="text-muted">
        This is the logged-in dashboard shell — Course Catalog, Faculty Guides, Resources,
        Opportunities, CBT Practice, and FAQ & AI pages plug in here next.
      </p>
    </section>
  );
}
