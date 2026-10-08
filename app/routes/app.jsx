import { Outlet, useLoaderData, useRouteError, Link, useLocation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  // Auto-sync Store in PostgreSQL
  let store = null;
  try {
    store = await prisma.shopifyStore.upsert({
      where: { shop: session.shop },
      update: { updatedAt: new Date(), status: "ACTIVE" },
      create: {
        shop: session.shop,
        storeName: session.shop.replace(".myshopify.com", ""),
        status: "ACTIVE",
        currency: "USD",
      },
    });

    if (session.email) {
      const user = await prisma.user.upsert({
        where: { email: session.email },
        update: { updatedAt: new Date() },
        create: {
          email: session.email,
          name: `${session.firstName || ""} ${session.lastName || ""}`.trim() || "Store Admin",
          role: "OWNER",
        },
      });

      await prisma.storeMember.upsert({
        where: {
          userId_storeId: {
            userId: user.id,
            storeId: store.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          storeId: store.id,
          role: "OWNER",
        },
      });
    }
  } catch (err) {
    console.error("Auto-sync store error in app.jsx:", err);
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
    store,
    appUrl: process.env.SHOPIFY_APP_URL || "https://shopify-bunddler-app.onrender.com",
  };
};

export default function App() {
  const { apiKey, shop, appUrl } = useLoaderData();
  const location = useLocation();

  const navLinks = [
    { label: "📊 Dashboard", href: "/app" },
    { label: "📦 Step Bundles", href: "/app/bundle-builder" },
    { label: "⚡ BXGY Deals", href: "/app/bxgy-builder" },
    { label: "📈 Volume Discounts", href: "/app/volume-discount-builder" },
    { label: "🎨 Templates", href: "/app/templates" },
    { label: "⚙️ Settings", href: "/app/settings" },
  ];

  const currentPath = location.pathname;

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
        <s-link href="/app/bundle-builder">Step Bundle</s-link>
        <s-link href="/app/bxgy-builder">BXGY Deals</s-link>
        <s-link href="/app/volume-discount-builder">Volume Discounts</s-link>
        <s-link href="/app/templates">Templates</s-link>
        <s-link href="/app/settings">Settings</s-link>
      </s-app-nav>

      {/* Klaviyo-Style SaaS Top Navigation & Store Switcher Bar */}
      <div
        style={{
          background: "#0f172a",
          color: "#ffffff",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          borderBottom: "1px solid #1e293b",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        {/* Left: Brand + SaaS Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #f59e0b, #ef4444)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            ⚡
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", color: "#ffffff" }}>
              Smart Bundles <span style={{ fontSize: 10, background: "#10b981", color: "#ffffff", padding: "1px 6px", borderRadius: 4, fontWeight: 700, marginLeft: 4 }}>CLOUD SAAS</span>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Multi-Tenant Storefront Platform</div>
          </div>
        </div>

        {/* Center: Nav Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {navLinks.map((link) => {
            const isActive = currentPath === link.href || (link.href !== "/app" && currentPath.startsWith(link.href));
            return (
              <Link
                key={link.href}
                to={link.href}
                style={{
                  color: isActive ? "#ffffff" : "#cbd5e1",
                  background: isActive ? "#1e293b" : "transparent",
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                  border: isActive ? "1px solid #334155" : "1px solid transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right: Store Switcher & Fullscreen Launch */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Store Switcher Pill */}
          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              padding: "5px 12px",
              borderRadius: 9999,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "#e2e8f0",
              fontWeight: 600,
            }}
          >
            <span style={{ color: "#10b981" }}>●</span>
            <span>{shop}</span>
          </div>

          {/* Fullscreen Breakout Link */}
          <a
            href={appUrl + "/app"}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new full-screen tab"
            style={{
              background: "#3b82f6",
              color: "#ffffff",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Fullscreen Portal ↗
          </a>
        </div>
      </div>

      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
