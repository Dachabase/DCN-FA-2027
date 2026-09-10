import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Lock, User, GraduationCap } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./auth.scss";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function AuthPage() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("mode") === "register" ? "register" : "login");
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, register, googleLogin, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  // Google Identity Services button
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      /* global google */
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            await googleLogin(response.credential);
          } catch {
            setError("Google sign-in failed. Please try again.");
          }
        },
      });
      window.google.accounts.id.renderButton(document.getElementById("google-btn"), {
        theme: "outline",
        size: "large",
        width: 320,
        shape: "pill",
      });
    };
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, [googleLogin]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password });
      } else {
        await register(form);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="uif-auth">
      <div className="uif-auth__card card">
        <div className="uif-auth__brand">
          <GraduationCap size={26} />
          <span>uifreshers.</span>
        </div>

        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="text-muted">
          {mode === "login"
            ? "Sign in to continue your academic journey."
            : "Join thousands of UI freshers already using the platform."}
        </p>

        <div id="google-btn" className="uif-auth__google" />

        {!GOOGLE_CLIENT_ID && (
          <p className="text-xs text-muted">
            (Google sign-in appears here once VITE_GOOGLE_CLIENT_ID is set in .env)
          </p>
        )}

        <div className="uif-auth__divider">
          <span>or continue with email</span>
        </div>

        <form onSubmit={handleSubmit} className="uif-auth__form">
          {mode === "register" && (
            <label className="uif-auth__field">
              <User size={16} />
              <input
                name="full_name"
                placeholder="Full name"
                value={form.full_name}
                onChange={handleChange}
                required
              />
            </label>
          )}

          <label className="uif-auth__field">
            <Mail size={16} />
            <input
              type="email"
              name="email"
              placeholder="Email address"
              value={form.email}
              onChange={handleChange}
              required
            />
          </label>

          <label className="uif-auth__field">
            <Lock size={16} />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={8}
            />
          </label>

          {error && <p className="uif-auth__error">{error}</p>}

          <button type="submit" className="btn btn-gradient btn-lg" disabled={submitting}>
            {submitting ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="uif-auth__switch">
          {mode === "login" ? (
            <>
              New here?{" "}
              <button type="button" onClick={() => setMode("register")}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => setMode("login")}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
