import { Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import CatalogPage from "./pages/CatalogPage";
import DepartmentCoursesPage from "./pages/DepartmentCoursesPage";
import GuidesPage from "./pages/GuidesPage";
import ResourcesPage from "./pages/ResourcesPage";
import OpportunitiesPage from "./pages/OpportunitiesPage";
import CbtPage from "./pages/CbtPage";
import FaqPage from "./pages/FaqPage";
import ProtectedRoute from "./routes/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Course Catalog is public-browsable, matching the live site's IA */}
        <Route path="/academic-hub" element={<CatalogPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/catalog/:departmentId" element={<DepartmentCoursesPage />} />

        <Route path="/guides" element={<GuidesPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/grants" element={<OpportunitiesPage />} />
        <Route path="/opportunities" element={<OpportunitiesPage />} />
        <Route path="/cbt" element={<CbtPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/ai-mentor" element={<FaqPage />} />

        {/* Any unmatched URL still renders inside the layout instead of a blank page */}
        <Route path="*" element={<Landing />} />
      </Route>
    </Routes>
  );
}
