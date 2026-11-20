import { Link } from "react-router-dom";
import { Store, ShieldCheck, HelpCircle, Banknote, Landmark } from "lucide-react";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="ss-footer-root">
      <div className="ss-footer-top">
        {/* About */}
        <div className="ss-footer-col">
          <h4 className="ss-footer-heading">ABOUT</h4>
          <ul className="ss-footer-links">
            <li>
              <Link to="/help-center" className="ss-footer-link">
                Contact Us
              </Link>
            </li>
            <li>
              <Link to="/about-us" className="ss-footer-link">
                About Us
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 2: HELP */}
        <div className="ss-footer-col">
          <h4 className="ss-footer-heading">HELP</h4>
          <ul className="ss-footer-links">
            <li>
              <Link to="/payments" className="ss-footer-link">
                Payments
              </Link>
            </li>
            <li>
              <Link to="/help-center" className="ss-footer-link">
                Shipping
              </Link>
            </li>
            <li>
              <Link to="/customer-care" className="ss-footer-link">
                Cancellation &amp; Returns
              </Link>
            </li>
            <li>
              <Link to="/help-center" className="ss-footer-link">
                FAQ
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 3: CONSUMER POLICY (Cancellation to Privacy) */}
        <div className="ss-footer-col">
          <h4 className="ss-footer-heading">CONSUMER POLICY</h4>
          <ul className="ss-footer-links">
            <li>
              <Link to="/customer-care" className="ss-footer-link">
                Cancellation &amp; Returns
              </Link>
            </li>
            <li>
              <Link to="/terms-of-use" className="ss-footer-link">
                Terms Of Use
              </Link>
            </li>
            <li>
              <Link to="/security" className="ss-footer-link">
                Security
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="ss-footer-link">
                Privacy
              </Link>
            </li>
            <li>
              <Link to="/grievance-redressal" className="ss-footer-link">
                Grievance Redressal
              </Link>
            </li>
            <li>
              <Link to="/epr-compliance" className="ss-footer-link">
                EPR Compliance
              </Link>
            </li>
          </ul>
        </div>

        {/* Support information */}
        <div className="ss-footer-col ss-footer-border-left">
          <h4 className="ss-footer-heading">Need help?</h4>
          <p className="ss-footer-address-text">Visit the Help Center for order, account, and product support.</p>
          <p className="ss-footer-tel"><Link to="/help-center" className="ss-footer-link">Open Help Center</Link></p>
        </div>
      </div>

      {/* Bottom Bar with Features & Copyright */}
      <div className="ss-footer-bottom">
        <div className="ss-footer-bottom-inner">
          <div className="ss-footer-features">
            <Link to="/become-seller" className="ss-footer-feature-item">
              <Store size={16} className="ss-footer-feature-icon" />
              <span>Become a Seller</span>
            </Link>

            <Link to="/help-center" className="ss-footer-feature-item">
              <HelpCircle size={16} className="ss-footer-feature-icon" />
              <span>Help Center</span>
            </Link>

              <Link to="/help-center" className="ss-footer-feature-item">
              <HelpCircle size={16} className="ss-footer-feature-icon" />
              <span>Customer Care</span>
            </Link>

            <span className="ss-footer-feature-item">
              <ShieldCheck size={16} className="ss-footer-feature-icon" />
              <span>Review product details before ordering</span>
            </span>
          </div>

          <p className="ss-footer-copy">
            &copy; 2026 ShoppingSphere.com. All rights reserved.
          </p>

          <div className="ss-footer-cards" aria-label="Accepted payment methods">
            <span className="ss-footer-pay-logo" role="img" aria-label="UPI" title="UPI">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4.5 19.5 12l-5 7.5H11l3.5-7.5L11 4.5h3.5Z" fill="#00833F"/><path d="M9.5 4.5 14.5 12l-5 7.5H6l3.5-7.5L6 4.5h3.5Z" fill="#E87424"/></svg><span>UPI</span>
            </span>
            <span className="ss-footer-pay-logo" role="img" aria-label="Google Pay" title="Google Pay">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.5 12.2c0-.7-.1-1.4-.2-2H12v4.1h5.3c-.2 1.2-1 2.3-2.1 3v2.5h3.4c2-1.9 3.1-4.7 3.1-7.6Z" fill="#4285F4"/><path d="M12 22c2.7 0 5-1 6.7-2.6l-3.4-2.5c-.9.6-2.1 1-3.3 1-2.6 0-4.8-1.7-5.5-4.1H3v2.6C4.7 19.8 8.1 22 12 22Z" fill="#34A853"/><path d="M6.5 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.6H3C2.4 8.9 2 10.4 2 12s.4 3.1 1 4.4l3.5-2.6Z" fill="#FBBC05"/><path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 2.8 14.7 2 12 2 8.1 2 4.7 4.2 3 7.6l3.5 2.6c.7-2.4 2.9-4.3 5.5-4.3Z" fill="#EA4335"/></svg><span>Google Pay</span>
            </span>
            <span className="ss-footer-pay-logo" role="img" aria-label="PhonePe" title="PhonePe">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#5F259F"/><path d="M13.5 8H9v8h2v-3h2.5c1.4 0 2.5-1.1 2.5-2.5S14.9 8 13.5 8Zm0 3H11v-1h2.5c.3 0 .5.2.5.5s-.2.5-.5.5Z" fill="#fff"/><path d="M10 7h6v1.5h-6z" fill="#fff"/></svg><span>PhonePe</span>
            </span>
            <span className="ss-footer-pay-logo" role="img" aria-label="Paytm" title="Paytm">
              <svg viewBox="0 0 32 20" aria-hidden="true"><rect width="32" height="20" rx="3" fill="#002E6E"/><text x="3" y="14" fill="#00B9F5" fontSize="10" fontWeight="900" fontFamily="sans-serif">Pay</text><text x="20" y="14" fill="#fff" fontSize="10" fontWeight="900" fontFamily="sans-serif">tm</text></svg><span>Paytm</span>
            </span>
            <span className="ss-footer-pay-logo ss-footer-pay-visa" role="img" aria-label="Visa" title="Visa">
              <svg viewBox="0 0 36 20" aria-hidden="true"><rect width="36" height="20" rx="3" fill="#1A1F71"/><text x="5" y="15" fill="#fff" fontSize="13" fontStyle="italic" fontWeight="900" fontFamily="sans-serif">VISA</text></svg>
            </span>
            <span className="ss-footer-pay-logo ss-footer-pay-mastercard" role="img" aria-label="Mastercard" title="Mastercard">
              <svg viewBox="0 0 36 20" aria-hidden="true"><rect width="36" height="20" rx="3" fill="#222"/><circle cx="14" cy="10" r="6" fill="#EB001B"/><circle cx="22" cy="10" r="6" fill="#F79E1B" fillOpacity=".85"/></svg>
            </span>
            <span className="ss-footer-pay-logo ss-footer-pay-rupay" role="img" aria-label="RuPay" title="RuPay">
              <svg viewBox="0 0 36 20" aria-hidden="true"><rect width="36" height="20" rx="3" fill="#0A3A60"/><path d="m22 6 4 4-4 4M25 6l4 4-4 4" stroke="#00A859" strokeWidth="2.5" strokeLinecap="round"/><text x="4" y="14" fill="#fff" fontSize="9" fontWeight="900" fontFamily="sans-serif">RuPay</text></svg>
            </span>
            <span className="ss-footer-pay-logo ss-pay-bank" role="img" aria-label="Net banking" title="Net banking"><Landmark size={17} /><span>Net Banking</span></span>
            <span className="ss-footer-pay-logo ss-pay-cod" role="img" aria-label="Cash on delivery" title="Cash on delivery"><Banknote size={17} /><span>Cash on Delivery</span></span>
          </div>
        </div>
      </div>
    </footer>
  );
}

