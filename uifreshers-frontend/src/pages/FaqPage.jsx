import { useState } from "react";
import { Plus, Minus, MessageSquareText } from "lucide-react";
import { getFaqs } from "../api/content";
import { useFetch } from "../api/useFetch";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import PageHeader from "../components/layout/PageHeader";

export default function FaqPage() {
  const { data: faqs, loading, error } = useFetch(getFaqs, []);
  const [openId, setOpenId] = useState(null);

  return (
    <>
      <PageHeader
        title="Frequently Asked Questions"
        subtitle="Verified guidance for clearance, course add/drop, hostel reservation, and school fees."
      />

      <section className="container uif-catalog">
        <div className="card card-dark uif-catalog__policy" style={{ marginBottom: "2rem" }}>
          <span className="badge-gold">Need Extra Academic Guidance?</span>
          <h3 style={{ color: "#fff" }}>Chat with Your Friendly AI Teacher &amp; Mentor</h3>
          <p className="text-muted">
            Our Telegram AI Study Assistant is warm, knowledgeable, and always ready to answer
            your questions.
          </p>
          <a
            href="https://t.me/uifreshers_ai_mentor"
            target="_blank"
            rel="noreferrer"
            className="btn btn-gradient"
            style={{ alignSelf: "flex-start" }}
          >
            <MessageSquareText size={16} /> Launch Telegram AI Assistant
          </a>
        </div>

        {loading && <LoadingState label="Loading FAQs..." />}
        {error && <ErrorState message="Couldn't load FAQs from the server." />}
        {!loading && !error && (!faqs || faqs.length === 0) && (
          <EmptyState message="No FAQs published yet." />
        )}

        {!loading && !error && faqs && faqs.length > 0 && (
          <div className="uif-faq__list" style={{ maxWidth: "none" }}>
            {faqs
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((item) => {
                const isOpen = openId === item.id;
                return (
                  <div key={item.id} className={"uif-faq__item" + (isOpen ? " is-open" : "")}>
                    <button
                      className="uif-faq__question"
                      onClick={() => setOpenId(isOpen ? null : item.id)}
                    >
                      <span>{item.question}</span>
                      {isOpen ? <Minus size={18} /> : <Plus size={18} />}
                    </button>
                    {isOpen && <p className="uif-faq__answer text-muted">{item.answer}</p>}
                  </div>
                );
              })}
          </div>
        )}
      </section>
    </>
  );
}
