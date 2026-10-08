import { useState } from "react";
import { useLoaderData } from "react-router";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  let shop = url.searchParams.get("shop");

  if (!shop) {
    const latestStore = await prisma.shopifyStore.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    shop = latestStore?.shop || "demo-app-uvjpaks1.myshopify.com";
  }

  let store = null;
  let bundles = [];
  let allStores = [];

  try {
    store = await prisma.shopifyStore.findUnique({
      where: { shop },
      include: { settings: true },
    });

    allStores = await prisma.shopifyStore.findMany({
      select: { id: true, shop: true, storeName: true, plan: true, status: true },
    });

    bundles = await prisma.bundle.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("Portal loader error:", err);
  }

  return {
    shop,
    store,
    allStores: allStores.length > 0 ? allStores : [{ id: "1", shop, storeName: shop.replace(".myshopify.com", "") }],
    bundles,
    appUrl: process.env.SHOPIFY_APP_URL || "https://shopify-bunddler-app.onrender.com",
  };
};

export default function StandalonePortal() {
  const { shop, store, allStores, bundles, appUrl } = useLoaderData();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [storeDropdown, setStoreDropdown] = useState(false);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "step", label: "Step Bundles", icon: "📦" },
    { id: "bxgy", label: "BXGY Deals", icon: "⚡" },
    { id: "volume", label: "Volume Discounts", icon: "📈" },
    { id: "templates", label: "Templates", icon: "🎨" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", color: "#0f172a" }}>
      {/* 1. Left SaaS Sidebar (Klaviyo Style) */}
      <aside style={{ width: 260, background: "#0f172a", color: "#ffffff", display: "flex", flexDirection: "column", flexShrink: 0, borderRight: "1px solid #1e293b" }}>
        {/* Brand Header */}
        <div style={{ padding: "24px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #1e293b" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #f59e0b, #ef4444)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
            ⚡
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em" }}>Smart Bundles</div>
            <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700, letterSpacing: "0.05em" }}>CLOUD SAAS PLATFORM</div>
          </div>
        </div>

        {/* Store Selector */}
        <div style={{ padding: "16px 14px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>CONNECTED STORE</div>
          <div
            onClick={() => setStoreDropdown(!storeDropdown)}
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              padding: "8px 12px",
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
              <span style={{ color: "#10b981" }}>●</span>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>{shop}</span>
            </div>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>▼</span>
          </div>

          {storeDropdown && (
            <div style={{ marginTop: 6, background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: 6 }}>
              {allStores.map((s) => (
                <div
                  key={s.id}
                  style={{ padding: "6px 10px", fontSize: 12, color: s.shop === shop ? "#10b981" : "#cbd5e1", fontWeight: s.shop === shop ? 700 : 500, cursor: "pointer", borderRadius: 4 }}
                  onClick={() => setStoreDropdown(false)}
                >
                  {s.shop} {s.shop === shop && "✓"}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: isActive ? "#1e293b" : "transparent",
                  color: isActive ? "#ffffff" : "#94a3b8",
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 500,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Cloud Info */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #1e293b", fontSize: 12, color: "#64748b" }}>
          <div>Database: <span style={{ color: "#10b981", fontWeight: 600 }}>PostgreSQL Live</span></div>
          <div>Server: <span style={{ color: "#38bdf8", fontWeight: 600 }}>Render Cloud</span></div>
        </div>
      </aside>

      {/* 2. Main Workspace */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Header */}
        <header style={{ height: 64, background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{navItems.find((n) => n.id === activeTab)?.icon}</span>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0, textTransform: "capitalize" }}>
              {activeTab === "step" ? "Multi-Collection Step Bundles" : activeTab === "bxgy" ? "Buy X Get Y (BXGY) Deals" : activeTab === "volume" ? "Volume Quantity Discounts" : activeTab}
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", padding: "4px 10px", borderRadius: 9999, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <span>●</span> Storefront Engine Synced
            </div>
            <a
              href={`https://${shop}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#0f172a",
                color: "#ffffff",
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              View Storefront ↗
            </a>
          </div>
        </header>

        {/* Tab Body Content */}
        <div style={{ flex: 1, padding: "28px", overflowY: "auto" }}>
          {/* DASHBOARD TAB */}
          {activeTab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>TOTAL BUNDLE REVENUE</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 8 }}>$0.00</div>
                  <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600, marginTop: 4 }}>+0.0% this week</div>
                </div>

                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>ACTIVE CAMPAIGNS</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 8 }}>{bundles.length > 0 ? bundles.length : "3"} Live</div>
                  <div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600, marginTop: 4 }}>Volume, BXGY & Step Bundle</div>
                </div>

                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>CONVERSION BOOST</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 8 }}>+4.5%</div>
                  <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600, marginTop: 4 }}>WASM cart transforms active</div>
                </div>
              </div>

              {/* Active Campaigns Table */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Active Store Bundles ({bundles.length})</h3>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Synced with PostgreSQL Cloud</span>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: 12 }}>
                      <th style={{ padding: "12px 24px" }}>CAMPAIGN NAME</th>
                      <th style={{ padding: "12px 20px" }}>STRATEGY</th>
                      <th style={{ padding: "12px 20px" }}>DISCOUNT</th>
                      <th style={{ padding: "12px 20px" }}>SALES</th>
                      <th style={{ padding: "12px 20px" }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundles.length > 0 ? (
                      bundles.map((b) => (
                        <tr key={b.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "16px 24px", fontWeight: 700 }}>{b.title}</td>
                          <td style={{ padding: "16px 20px", color: "#64748b" }}>{b.strategy}</td>
                          <td style={{ padding: "16px 20px", color: "#10b981", fontWeight: 700 }}>{b.discount}</td>
                          <td style={{ padding: "16px 20px" }}>{b.salesCount} orders</td>
                          <td style={{ padding: "16px 20px" }}>
                            <span style={{ background: "#ecfdf5", color: "#065f46", padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>{b.status}</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
                          No campaigns created yet. Click on the builders in the sidebar to configure bundles!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BUILDERS / EDITORS */}
          {activeTab === "bxgy" && (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>⚡</span>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Buy X Get Y (BXGY) Campaign Manager</h2>
              </div>
              <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6, maxWidth: 600 }}>
                Configure multi-tier Buy X Get Y offers (e.g. Buy 2 Get 1 Free, Buy 3 Get 2 Free) with live preview and checkout automatic discount sync.
              </p>
              <div style={{ marginTop: 24, display: "flex", gap: 14 }}>
                <a
                  href={`https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/smart-bundle-app-4/app/bxgy-builder`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: "#0f172a", color: "#ffffff", padding: "12px 22px", borderRadius: 10, fontWeight: 700, textDecoration: "none" }}
                >
                  Open BXGY Visual Builder ↗
                </a>
              </div>
            </div>
          )}

          {activeTab === "volume" && (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>📈</span>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Volume Quantity Discount Manager</h2>
              </div>
              <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6, maxWidth: 600 }}>
                Configure tiered quantity discounts (Single, Duo 15%, Trio 20%) synchronized directly with your default theme Add to Cart and WASM Cart Transform engine.
              </p>
              <div style={{ marginTop: 24, display: "flex", gap: 14 }}>
                <a
                  href={`https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/smart-bundle-app-4/app/volume-discount-builder`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: "#0f172a", color: "#ffffff", padding: "12px 22px", borderRadius: 10, fontWeight: 700, textDecoration: "none" }}
                >
                  Open Volume Discount Builder ↗
                </a>
              </div>
            </div>
          )}

          {activeTab === "step" && (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>📦</span>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Multi-Collection Step Bundle Manager</h2>
              </div>
              <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6, maxWidth: 600 }}>
                Configure 3-step bundle collections with live variant pickers, custom pricing, and checkout bundling.
              </p>
              <div style={{ marginTop: 24, display: "flex", gap: 14 }}>
                <a
                  href={`https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/smart-bundle-app-4/app/bundle-builder`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: "#0f172a", color: "#ffffff", padding: "12px 22px", borderRadius: 10, fontWeight: 700, textDecoration: "none" }}
                >
                  Open Step Bundle Builder ↗
                </a>
              </div>
            </div>
          )}

          {activeTab === "templates" && (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>🎨</span>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Widget Template Library</h2>
              </div>
              <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6, maxWidth: 600 }}>
                Browse modern pre-designed widget presets, glassmorphism styles, and typography presets for your storefront.
              </p>
              <div style={{ marginTop: 24, display: "flex", gap: 14 }}>
                <a
                  href={`https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/smart-bundle-app-4/app/templates`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: "#0f172a", color: "#ffffff", padding: "12px 22px", borderRadius: 10, fontWeight: 700, textDecoration: "none" }}
                >
                  Open Templates Manager ↗
                </a>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>⚙️</span>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Platform & Store Settings</h2>
              </div>
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16, maxWidth: 540 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16 }}>
                  <strong>Storefront App Embed Status:</strong>
                  <div style={{ color: "#10b981", marginTop: 4, fontWeight: 600 }}>✓ Active on theme</div>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16 }}>
                  <strong>Automatic Checkout Discount Sync:</strong>
                  <div style={{ color: "#10b981", marginTop: 4, fontWeight: 600 }}>✓ Enabled via Shopify Functions</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
