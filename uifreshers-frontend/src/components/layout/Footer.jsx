import { GraduationCap, Send, Users, Info } from "lucide-react";
import "./footer.scss";

export default function Footer() {
  return (
    <footer className="uif-footer">
      <div className="container uif-footer__grid">
        <div className="uif-footer__brand">
          <div className="uif-navbar__brand" style={{ color: "#fff" }}>
            <GraduationCap size={22} />
            <span>
              uifreshers<span style={{ color: "#c0399f" }}>.</span>
            </span>
          </div>
          <p className="text-muted">
            The most accurate academic guide for University of Ibadan 100-Level students.
          </p>
        </div>

        <div className="uif-footer__col">
          <h6>Platform</h6>
          <a href="/">Home</a>
          <a href="/academic-hub">Academic Hub</a>
          <a href="/grants">Grants</a>
          <a href="/cbt">GST CBT</a>
          <a href="/ai-mentor">AI Mentor</a>
        </div>

        <div className="uif-footer__col">
          <h6>Resources</h6>
          <a href="/catalog">Course Packages</a>
          <a href="/guides">Clearance Guide</a>
          <a href="/tools/cgpa">CGPA Calculator</a>
          <a href="/faq">FAQ</a>
          <a href="/cbt">Exam Prep</a>
        </div>

        <div className="uif-footer__col">
          <h6>Community</h6>
          <a href="#" target="_blank" rel="noreferrer">
            <Send size={14} /> Telegram Channel
          </a>
          <a href="#" target="_blank" rel="noreferrer">
            <Users size={14} /> Student Forum
          </a>
          <a href="/about">
            <Info size={14} /> About Us
          </a>
        </div>
      </div>

      <div className="container uif-footer__bottom">
        <span className="text-muted">
          © {new Date().getFullYear()} UI Freshers Companion. Grounded in official University of
          Ibadan Senate regulations.
        </span>
        <span className="text-muted">Made with care for 100-Level students</span>
      </div>
    </footer>
  );
}
