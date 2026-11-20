import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, ChevronDown, ChevronUp, CreditCard,
  Headphones, LifeBuoy, MessageCircle, Package,
  RotateCcw, Search, Send, ShieldCheck, Sparkles, UserRound,
} from "lucide-react";
import "./CustomerCare.css";

const topics = [
  { icon: Package, title: "Orders & delivery", detail: "Track a parcel or find an order update.", to: "/my-orders", tone: "lilac" },
  { icon: RotateCcw, title: "Returns & refunds", detail: "Check return steps and refund progress.", to: "/my-orders", tone: "mint" },
  { icon: CreditCard, title: "Payments & coupons", detail: "Get help with a payment or offer.", to: "/cart", tone: "peach" },
  { icon: UserRound, title: "Your account", detail: "Update profile, addresses, or alerts.", to: "/profile-settings", tone: "blue" },
];

const faqs = [
  { question: "Where can I track my order?", answer: "Open Orders & tracking from your profile to see your purchases and their latest status." },
  { question: "How do I request a return or refund?", answer: "Open your order history and check the order details for available return options. Eligibility and timing can vary by item." },
  { question: "How do I change my delivery address?", answer: "Visit Account settings → Manage addresses to add an address or choose your default delivery location." },
  { question: "Where can I find or apply a coupon?", answer: "Your available offers are on the My coupons page. Copy a coupon code and enter it in your cart." },
  { question: "How do I update notifications?", answer: "Open Notifications from your profile to choose which updates you receive by email, SMS, or in-app." },
];

const quickQuestions = ["Track an order", "Start a return", "Update my account"];

export default function CustomerCare() {
  const [query, setQuery] = useState("");
  const [activeFaq, setActiveFaq] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    { sender: "assistant", text: "Hi there! Tell me what you need help with, or pick a quick topic below." },
  ]);
  const filteredFaqs = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search ? faqs.filter(({ question, answer }) => `${question} ${answer}`.toLowerCase().includes(search)) : faqs;
  }, [query]);

  function sendMessage(text = chatInput) {
    const cleanText = text.trim();
    if (!cleanText) return;
    setMessages((current) => [
      ...current,
      { sender: "user", text: cleanText },
      { sender: "assistant", text: "Thanks for sharing that. For order-specific help, open Orders & tracking. You can also contact our support team using the options on this page." },
    ]);
    setChatInput("");
  }

  return (
    <main className="care-page">
      <div className="care-shell">
        <nav className="care-breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link><span>›</span><span>Help center</span></nav>
        <header className="care-hero">
          <div className="care-hero-copy">
            <span className="care-kicker"><Sparkles size={14} /> SHOPPINGSPHERE SUPPORT</span>
            <h1>Customer Care<br /><span>&amp; Support</span></h1>
            <p>Find a quick answer or get help with an order, return, payment, or account.</p>
            <label className="care-search"><Search size={18} /><input aria-label="Search help topics" placeholder="Search orders, returns, account help…" value={query} onChange={(event) => setQuery(event.target.value)} /><span>⌕</span></label>
          </div>
          <div className="care-hero-art" aria-hidden="true"><div className="care-art-ring" /><div className="care-art-orbit"><MessageCircle size={43} strokeWidth={1.6} /><Sparkles size={18} /></div><span className="care-art-pill"><span /> HELP CENTER</span></div>
        </header>

        <section className="care-topics-section" aria-labelledby="care-topics-title">
          <div className="care-section-title"><div><span>START HERE</span><h2 id="care-topics-title">What can we help with?</h2></div><Link to="/my-orders">View your orders <ArrowRight size={15} /></Link></div>
          <div className="care-topic-grid">{topics.map(({ icon: Icon, title, detail, to, tone }) => <Link className="care-topic-card" to={to} key={title}><span className={`care-topic-icon care-${tone}`}><Icon size={20} /></span><span className="care-topic-copy"><strong>{title}</strong><small>{detail}</small></span><ArrowRight className="care-topic-arrow" size={17} /></Link>)}</div>
        </section>

        <div className="care-main-grid">
          <section className="care-faq-panel" aria-labelledby="care-faq-heading">
            <div className="care-section-title care-faq-title"><div><span>GOOD TO KNOW</span><h2 id="care-faq-heading">Quick answers</h2></div><span className="care-faq-count">{filteredFaqs.length} topics</span></div>
            {query && <p className="care-search-caption">Showing answers for “{query}”</p>}
            <div className="care-faq-list">{filteredFaqs.map((faq) => { const index = faqs.indexOf(faq); const isOpen = activeFaq === index; return <article className={`care-faq-item${isOpen ? " is-open" : ""}`} key={faq.question}><button type="button" aria-expanded={isOpen} onClick={() => setActiveFaq(isOpen ? null : index)}><span>{faq.question}</span>{isOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>{isOpen && <p>{faq.answer}</p>}</article>; })}{!filteredFaqs.length && <div className="care-no-results"><Search size={19} /><strong>No matching answers yet</strong><span>Try “order”, “address”, or “coupon”, or send us a message.</span></div>}</div>
          </section>

          <section className="care-chat-panel" aria-labelledby="care-chat-heading">
            <div className="care-chat-header"><span className="care-chat-avatar"><LifeBuoy size={20} /></span><div><h2 id="care-chat-heading">SphereSidekick</h2><p><span /> ShoppingSphere support assistant</p></div><span className="care-chat-sparkle"><Sparkles size={16} /></span></div>
            <div className="care-chat-messages" aria-live="polite">{messages.map((message, index) => <div className={`care-message care-message-${message.sender}`} key={`${message.sender}-${index}`}><span>{message.text}</span></div>)}</div>
            <div className="care-quick-questions">{quickQuestions.map((question) => <button type="button" key={question} onClick={() => sendMessage(question)}>{question}</button>)}</div>
            <form className="care-chat-form" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}><input aria-label="Your support message" placeholder="Write a message…" value={chatInput} onChange={(event) => setChatInput(event.target.value)} /><button type="submit" aria-label="Send message" disabled={!chatInput.trim()}><Send size={17} /></button></form>
            <p className="care-chat-note"><ShieldCheck size={13} /> Don’t share passwords or OTPs in chat.</p>
          </section>
        </div>

        <section className="care-contact-strip"><div className="care-contact-icon"><Headphones size={21} /></div><div className="care-contact-copy"><strong>Need help with a purchase?</strong><span>Check your order details or read how to raise a grievance.</span></div><div className="care-contact-actions"><Link to="/grievance-redressal">Grievance redressal <ArrowRight size={15} /></Link><Link to="/cancellation-returns">Returns policy <ArrowRight size={15} /></Link></div></section>
        <p className="care-safety-note"><ShieldCheck size={14} /> Your account details stay private. We’ll never ask you to share a password or OTP.</p>
      </div>
    </main>
  );
}
