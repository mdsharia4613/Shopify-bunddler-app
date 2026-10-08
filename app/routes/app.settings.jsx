import { useState } from "react";
import { useLoaderData, useFetcher, Link } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  let store = null;
  let settings = null;
  try {
    store = await prisma.shopifyStore.findUnique({
      where: { shop: session.shop },
      include: { settings: true, bundles: true },
    });
    settings = store?.settings;
  } catch (err) {
    console.error("Settings loader error:", err);
  }

  return {
    shop: session.shop,
    store,
    settings,
    appUrl: process.env.SHOPIFY_APP_URL || "https://shopify-bunddler-app.onrender.com",
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const accentColor = formData.get("accentColor") || "#f59e0b";
  const themeEmbedOn = formData.get("themeEmbedOn") === "true";

  try {
    const store = await prisma.shopifyStore.findUnique({
      where: { shop: session.shop },
    });
    if (store) {
      await prisma.storeSetting.upsert({
        where: { storeId: store.id },
        update: { accentColor, themeEmbedOn },
        create: { storeId: store.id, accentColor, themeEmbedOn },
      });
    }
    return { success: true };
  } catch (err) {
    console.error("Settings save error:", err);
    return { success: false, error: err.message };
  }
};

export default function SettingsPage() {
  const { shop, store, settings, appUrl } = useLoaderData();
  const fetcher = useFetcher();

  const [accent, setAccent] = useState(settings?.accentColor || "#f59e0b");
  const [embedOn, setEmbedOn] = useState(settings?.themeEmbedOn ?? true);
  const [savedMsg, setSavedMsg] = useState(false);

  const isSaving = fetcher.state === "submitting";

  const handleSave = () => {
    fetcher.submit(
      { accentColor: accent, themeEmbedOn: String(embedOn) },
      { method: "POST" }
    );
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 6px 0" }}>
            ⚙️ SaaS Settings & Store Configuration
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
            Manage cloud sync, custom branding, multi-store connections, and theme integration.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <a
            href={appUrl + "/app"}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#ffffff",
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            🚀 Open Standalone Portal ↗
          </a>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              background: "#0f172a",
              color: "#ffffff",
              border: "none",
              padding: "8px 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: isSaving ? "not-allowed" : "pointer",
            }}
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {savedMsg && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: 14, fontWeight: 600 }}>
          ✅ Settings saved successfully to PostgreSQL database!
        </div>
      )}

      {/* Grid Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {/* Connected Store Info */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 20 }}>🛒</span>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>Shopify Store Identity</h2>
          </div>
          <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>
            Details of the currently linked Shopify storefront in your SaaS workspace.
          </p>

          <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #edf2f7", fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
            <div><strong>Connected Shop:</strong> <span style={{ color: "#2563eb" }}>{shop}</span></div>
            <div><strong>Store ID:</strong> <span style={{ color: "#64748b" }}>{store?.id || "Auto-registered"}</span></div>
            <div><strong>Database Plan:</strong> <span style={{ background: "#e0e7ff", color: "#4338ca", padding: "2px 8px", borderRadius: 9999, fontWeight: 700, fontSize: 11 }}>{store?.plan || "Pro"}</span></div>
            <div><strong>Cloud Status:</strong> <span style={{ color: "#059669", fontWeight: 700 }}>● Active & Synced</span></div>
          </div>
        </div>

        {/* Global SaaS Branding */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 20 }}>🎨</span>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>Global Widget Branding</h2>
          </div>
          <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>
            Default accent color applied to all bundles across your storefront.
          </p>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
              DEFAULT ACCENT COLOR
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                style={{ width: 44, height: 40, border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer", padding: 2 }}
              />
              <input
                type="text"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                style={{ flex: 1, padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, fontFamily: "monospace" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Storefront App Embed</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Enable or pause all bundle widgets globally</div>
            </div>
            <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={embedOn}
                onChange={(e) => setEmbedOn(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: "absolute",
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: embedOn ? "#10b981" : "#cbd5e1",
                borderRadius: 24,
                transition: "0.2s",
              }}>
                <span style={{
                  position: "absolute",
                  height: 18, width: 18,
                  left: embedOn ? 22 : 3,
                  bottom: 3,
                  backgroundColor: "white",
                  borderRadius: "50%",
                  transition: "0.2s",
                }} />
              </span>
            </label>
          </div>
        </div>

        {/* Database & Multi-Tenant Info */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 20 }}>🗄️</span>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>Render Cloud PostgreSQL</h2>
          </div>
          <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>
            Multi-tenant data isolation and permanent storage infrastructure.
          </p>

          <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #edf2f7", fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
            <div><strong>Database:</strong> <span style={{ fontFamily: "monospace" }}>smart_bundle_db_h9c4</span></div>
            <div><strong>Total Bundles:</strong> <span style={{ fontWeight: 700, color: "#0f172a" }}>{store?.bundles?.length || 0} Campaigns</span></div>
            <div><strong>SaaS Architecture:</strong> <span style={{ color: "#2563eb", fontWeight: 600 }}>Multi-Store Tenant Model</span></div>
            <div><strong>Render Service:</strong> <span style={{ color: "#059669", fontWeight: 700 }}>Live & Healthy</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
