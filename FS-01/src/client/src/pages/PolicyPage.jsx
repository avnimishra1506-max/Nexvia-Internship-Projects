import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, BadgeCheck, BookOpen, LockKeyhole, PackageCheck, ShieldCheck } from "lucide-react";
import "./PolicyPage.css";

const pages = {
  returns: {
    eyebrow: "HELP & SUPPORT", title: "Cancellation & Returns", intro: "Clear steps for changing or cancelling an order, and getting help with an item.", icon: PackageCheck,
    sections: [
      { title: "Cancel an order", body: "The My Orders screen currently shows order status but does not have a cancellation action. This demo therefore cannot process a cancellation request. For covered e-commerce entities, the Consumer Protection (E-Commerce) Rules, 2020 also restrict cancellation charges unless the entity bears a similar charge when it cancels an order on its own." },
      { title: "Returns and refunds", body: "This demo does not provide a self-service return or refund flow, and it has no configured return window or return-shipping fee. Under the 2020 E-Commerce Rules, covered marketplace sellers and inventory entities cannot refuse a return or refund for goods that are defective, deficient, spurious, do not match the characteristics or features advertised or agreed, or arrive after the stated schedule (subject to the force-majeure exception for delay). Other eligibility terms must be shown by the seller before purchase. Accepted refunds must be processed within the period required by applicable law.", links: [{ label: "Consumer Protection (E-Commerce) Rules, 2020 (official Gazette copy)", href: "https://consumeraffairs.nic.in/sites/default/files/E%20commerce%20rules_0.pdf" }] },
      { title: "Get assistance", body: "The Help Center currently contains FAQs and a demo assistant; no staffed support contact has been configured in this project. Keep your order number handy, and never share a password, card PIN, or OTP.", links: [{ label: "Open Help Center", to: "/help-center" }] },
    ],
  },
  terms: {
    eyebrow: "SHOPPINGSPHERE POLICIES", title: "Terms of Use", intro: "The basic terms for browsing and using this ShoppingSphere storefront.", icon: BookOpen,
    sections: [
      { title: "Using this site", body: "Use the storefront lawfully and provide accurate information when creating an account or placing an order. You are responsible for keeping your sign-in credentials confidential and for activity carried out through your account." },
      { title: "Products and orders", body: "Product availability, descriptions, prices, delivery estimates, and seller information are shown on the relevant product or checkout screen and may change. An order is subject to confirmation. If an item or price cannot be fulfilled, support will help resolve the order." },
      { title: "Consumer rights and changes", body: "These terms do not remove rights available under applicable law. The Consumer Protection Act, 2019 and the Consumer Protection (E-Commerce) Rules, 2020 are among the Indian laws relevant to online commerce. This page is general storefront information, not legal advice.", links: [{ label: "Consumer Protection Act, 2019 (India Code)", href: "https://www.indiacode.nic.in/indiacode/handle/123456789/15256?sam_handle=123456789%2F1362&view_type=browse" }, { label: "Consumer Protection (E-Commerce) Rules, 2020 (Department of Consumer Affairs)", href: "https://consumeraffairs.nic.in/sites/default/files/E%20commerce%20rules_0.pdf" }] },
    ],
  },
  security: {
    eyebrow: "ACCOUNT SAFETY", title: "Security", intro: "Practical steps for keeping your ShoppingSphere account and payments safer.", icon: LockKeyhole,
    sections: [
      { title: "Protect your sign-in", body: "Choose a unique password, sign out on shared devices, and do not share passwords, card PINs, or one-time passcodes with anyone claiming to be support." },
      { title: "Pay safely", body: "Use only the payment choices shown at checkout. Enter bank credentials or OTPs only in your bank or payment provider's secure flow. ShoppingSphere support will never need your OTP or card PIN." },
      { title: "Report a concern", body: "If you notice an unfamiliar order or account activity, change your password and contact support through the Help Center. Do not send full card details by email or chat." },
    ],
  },
  privacy: {
    eyebrow: "YOUR INFORMATION", title: "Privacy", intro: "A plain-language overview of information this storefront uses to provide its features.", icon: ShieldCheck,
    sections: [
      { title: "Information used by the storefront", body: "Account details you submit are used for sign-in and account features. Order details are used to create and show purchases. This browser stores cart contents and some address or wishlist preferences locally; sign-in information is held in the browser session. The server processes account and order requests." },
      { title: "Your choices", body: "You can edit available profile details, manage saved addresses, and sign out from your account. Clearing browser storage removes locally saved cart and preference data. Contact support for help with account or order information." },
      { title: "Applicable law", body: "India's Digital Personal Data Protection Act, 2023 is being brought into force in stages. Under the Central Government's November 13, 2025 notification, some provisions commenced on publication, specified provisions followed after one year, and many core provisions are scheduled after eighteen months (May 13, 2027). This summary is not a substitute for a complete operator-specific privacy notice.", links: [{ label: "DPDP Act commencement notification (MeitY, November 13, 2025)", href: "https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf" }, { label: "DPDP Rules, 2025 (MeitY)", href: "https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf" }] },
    ],
  },
  grievance: {
    eyebrow: "RESOLVING AN ISSUE", title: "Grievance Redressal", intro: "How to raise an issue about an order, product, payment, or account.", icon: BadgeCheck,
    sections: [
      { title: "Contact support", body: "Start at the Help Center and include your order number, the issue, and the outcome you are seeking. Do not include passwords, full card numbers, PINs, or OTPs. Keep any complaint reference provided to you." },
      { title: "Grievance officer details", body: "The legal entity operating this storefront has not supplied a verified grievance officer name or direct contact for publication here. The operator must add its verified legal name, grievance officer name, and contact details before this page is used as a live marketplace compliance notice." },
      { title: "Applicable process", body: "India's Consumer Protection (E-Commerce) Rules, 2020 require covered e-commerce entities to publish grievance officer details and provide for complaint acknowledgement within 48 hours and redressal within one month. Applicability depends on the operator and service. See the official rules for details.", links: [{ label: "Consumer Protection (E-Commerce) Rules, 2020 (Department of Consumer Affairs)", href: "https://consumeraffairs.nic.in/sites/default/files/E%20commerce%20rules_0.pdf" }] },
    ],
  },
  epr: {
    eyebrow: "RESPONSIBLE DISPOSAL", title: "EPR Compliance", intro: "Extended Producer Responsibility applies to specified product categories and the businesses defined by the relevant rules.", icon: PackageCheck,
    sections: [
      { title: "What EPR means", body: "EPR places end-of-life collection and environmentally sound management responsibilities on producers covered by applicable waste-management rules. Requirements differ by category, including e-waste, plastic packaging, batteries, and other regulated products." },
      { title: "ShoppingSphere status", body: "The operator's legal identity, producer/importer status, product categories, and registration identifiers have not been verified for this storefront. No EPR registration or compliance claim is made on this page. The responsible operator should publish applicable category-specific registration and collection information here." },
      { title: "Official guidance", body: "For electrical and electronic equipment covered by India's E-Waste (Management) Rules, 2022, CPCB describes producer registration and EPR obligations. Check the current rules for the category relevant to a product.", links: [{ label: "E-Waste (Management) Rules, 2022 (CPCB)", href: "https://cpcb.nic.in/uploads/Projects/E-Waste/e-waste_rules_2022.pdf" }] },
    ],
  },
  about: {
    eyebrow: "ABOUT THE STOREFRONT", title: "About ShoppingSphere", intro: "A simple place to discover products, save favourites, and manage a shopping cart.", icon: BookOpen,
    sections: [
      { title: "What you can do", body: "Browse product categories, search the catalog, add items to your bag, create an account, and review orders. Available features and catalog information are shown in the storefront." },
      { title: "Who operates this service", body: "Verified company registration, registered office, and legal operator details were not available in the project records. We have left out unverified addresses and registration numbers. The business operator should add its confirmed legal identity and contact details before public launch." },
      { title: "Questions", body: "Visit the Help Center for assistance with the storefront, an account, or an order." },
    ],
  },
  payments: {
    eyebrow: "CHECKOUT INFORMATION", title: "Payments", intro: "ShoppingSphere uses Razorpay Checkout and confirms orders only after payment verification.", icon: BadgeCheck,
    sections: [
      { title: "Razorpay Checkout", body: "The server creates a Razorpay order using prices from the product database. Checkout returns payment details that the server verifies with Razorpay before an order is marked paid. Razorpay webhooks provide a second signed confirmation path.", links: [{ label: "Razorpay Standard Checkout integration", href: "https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps" }] },
      { title: "Payment safety", body: "Payment credentials are entered in Razorpay Checkout, not in this site's form. Never share your OTP, card PIN, or bank password with anyone. An order is shown as paid only after server-side verification." },
    ],
  },
};

export default function PolicyPage({ page }) {
  const content = pages[page] || pages.about;
  const Icon = content.icon;
  return <main className="policy-page"><div className="policy-shell">
    <Link className="policy-back" to="/"><ArrowLeft size={15} /> Back to shopping</Link>
    <header className="policy-hero"><span className="policy-hero-icon"><Icon size={23} /></span><span className="policy-eyebrow">{content.eyebrow}</span><h1>{content.title}</h1><p>{content.intro}</p></header>
    <div className="policy-body">{content.sections.map((section) => <section className="policy-section" key={section.title}><h2>{section.title}</h2><p>{section.body}</p>{section.links && <ul className="policy-sources">{section.links.map((link) => <li key={link.href || link.to}>{link.to ? <Link to={link.to}>{link.label}<ArrowUpRight size={13} /></Link> : <a href={link.href} target="_blank" rel="noreferrer">{link.label}<ArrowUpRight size={13} /></a>}</li>)}</ul>}</section>)}</div>
    <aside className="policy-updated"><ShieldCheck size={15} /> Store information last reviewed November 19, 2026. Policy details should be confirmed by the service operator before launch.</aside>
  </div></main>;
}

