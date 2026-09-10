import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  GraduationCap,
  Home,
  BookOpen,
  Award,
  MonitorCheck,
  MessageSquare,
  Download,
  ChevronDown,
  LogOut,
  UserCog,
  BarChart3,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "./navbar.scss";

const loggedOutLinks = [
  { to: "/", label: "Home", icon: Home },
  { to: "/academic-hub", label: "Academic Hub", icon: BookOpen },
  { to: "/grants", label: "Grants", icon: Award },
  { to: "/cbt", label: "GST CBT", icon: MonitorCheck },
  { to: "/ai-mentor", label: "AI Mentor", icon: MessageSquare },
];

const loggedInLinks = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/catalog", label: "Course Catalog", icon: BookOpen },
  { to: "/guides", label: "Faculty Guides", icon: GraduationCap },
  { to: "/resources", label: "Resources", icon: BarChart3 },
  { to: "/opportunities", label: "Opportunities", icon: Award },
  { to: "/cbt", label: "CBT Practice", icon: MonitorCheck },
  { to: "/faq", label: "FAQ & AI", icon: MessageSquare },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const links = user ? loggedInLinks : loggedOutLinks;

  async function handleLogout() {
    await logout();
    setMenuOpen(false);
    navigate("/");
  }

  return (
    <header className="uif-navbar">
      <div className="container uif-navbar__inner">
        <Link to="/" className="uif-navbar__brand">
          <GraduationCap size={22} />
          <span>
            uifreshers<span className="uif-navbar__dot">.</span>
          </span>
        </Link>

        <nav className="uif-navbar__links">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => "uif-navbar__link" + (isActive ? " is-active" : "")}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="uif-navbar__actions">
          <button className="btn btn-ghost btn-sm uif-navbar__install">
            <Download size={16} />
            <span>Install App</span>
          </button>

          {!user && (
            <>
              <Link to="/auth?mode=login" className="btn btn-outline btn-sm">
                Join
              </Link>
              <Link to="/auth?mode=register" className="btn btn-gradient btn-sm">
                Get Started
              </Link>
            </>
          )}

          {user && (
            <div className="uif-navbar__profile">
              <button className="uif-navbar__profile-trigger" onClick={() => setMenuOpen((v) => !v)}>
                <span className="uif-navbar__avatar">{user.full_name?.[0]?.toUpperCase() || "U"}</span>
                <span className="uif-navbar__level">{user.level || "—"}</span>
                <ChevronDown size={16} />
              </button>

              {menuOpen && (
                <div className="uif-navbar__dropdown">
                  <div className="uif-navbar__dropdown-header">
                    <strong>{user.full_name}</strong>
                    <span className="text-muted">{user.email}</span>
                  </div>
                  <Link to="/profile" className="uif-navbar__dropdown-item" onClick={() => setMenuOpen(false)}>
                    <UserCog size={16} /> Edit Academic Profile
                  </Link>
                  <button className="uif-navbar__dropdown-item uif-navbar__dropdown-item--danger" onClick={handleLogout}>
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
