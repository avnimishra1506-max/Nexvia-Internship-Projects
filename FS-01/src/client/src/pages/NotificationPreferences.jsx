import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, Mail, MessageSquare, Smartphone } from "lucide-react";
import { getNotificationPreferences, saveNotificationPreferences } from "../services/auth.js";
import "./NotificationPreferences.css";

const CHANNELS = [
  { key: "email", label: "Email", icon: Mail },
  { key: "sms", label: "SMS", icon: Smartphone },
  { key: "inApp", label: "In-app", icon: MessageSquare },
];

const SETTINGS = [
  { key: "orderUpdates", label: "Order updates", description: "Order placed, confirmed, and payment status updates." },
  { key: "deliveryUpdates", label: "Delivery updates", description: "Packing, dispatch, and delivery progress." },
  { key: "offers", label: "Offers and recommendations", description: "Personalized offers, new arrivals, and shopping picks." },
  { key: "wishlistAlerts", label: "Wishlist alerts", description: "Updates when wishlist items change or become available." },
];

function defaultPreferences() {
  return {
    email: { orderUpdates: true, deliveryUpdates: true, offers: false, wishlistAlerts: true },
    sms: { orderUpdates: true, deliveryUpdates: true, offers: false, wishlistAlerts: false },
    inApp: { orderUpdates: true, deliveryUpdates: true, offers: true, wishlistAlerts: true },
  };
}

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    getNotificationPreferences()
      .then((savedPreferences) => {
        if (!active) return;
        const defaults = defaultPreferences();
        setPreferences(Object.fromEntries(CHANNELS.map(({ key }) => [
          key,
          { ...defaults[key], ...(savedPreferences?.[key] || {}) },
        ])));
      })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function togglePreference(channel, type) {
    setPreferences((current) => ({
      ...current,
      [channel]: { ...current[channel], [type]: !current[channel][type] },
    }));
    setSaved(false);
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const updated = await saveNotificationPreferences(preferences);
      setPreferences(updated);
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  const signedIn = Boolean(sessionStorage.getItem("token"));

  if (!signedIn) {
    return (
      <main className="notification-page">
        <section className="notification-card notification-login-card">
          <Bell size={30} />
          <h1>Notification preferences</h1>
          <p>Sign in to manage and save notification preferences for your account.</p>
          <Link to="/login" className="notification-save-button">Sign in</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="notification-page">
      <header className="notification-page-heading">
        <div className="notification-heading-icon"><Bell size={23} /></div>
        <div>
          <p>YOUR ACCOUNT</p>
          <h1>Notification preferences</h1>
          <span>Choose which updates you want to receive and where.</span>
        </div>
      </header>

      <form className="notification-card" onSubmit={handleSave}>
        {loading ? <p className="notification-state">Loading your saved preferences…</p> : (
          <>
            <div className="notification-table-wrap">
              <div className="notification-table notification-table-head">
                <div className="notification-setting-heading">Updates</div>
                {CHANNELS.map(({ key, label, icon: Icon }) => (
                  <div className="notification-channel-heading" key={key}><Icon size={17} /><span>{label}</span></div>
                ))}
              </div>
              {SETTINGS.map((setting) => (
                <div className="notification-table notification-setting-row" key={setting.key}>
                  <div className="notification-setting-copy">
                    <strong>{setting.label}</strong>
                    <span>{setting.description}</span>
                  </div>
                  {CHANNELS.map(({ key, label }) => (
                    <div className="notification-toggle-cell" key={key}>
                      <label className="notification-switch" aria-label={`${setting.label} by ${label}`}>
                        <input
                          type="checkbox"
                          checked={Boolean(preferences[key]?.[setting.key])}
                          disabled={saving}
                          onChange={() => togglePreference(key, setting.key)}
                        />
                        <span className="notification-switch-track" />
                      </label>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {error && <p className="notification-feedback notification-error" role="alert">{error}</p>}
            {saved && <p className="notification-feedback notification-success" role="status"><Check size={17} /> Preferences saved to your account.</p>}
            <div className="notification-form-footer">
              <p>Your choices are saved to your account and stay in place when you sign in again.</p>
              <button type="submit" className="notification-save-button" disabled={saving || loading}>
                {saving ? "Saving…" : "Save preferences"}
              </button>
            </div>
          </>
        )}
      </form>
    </main>
  );
}
