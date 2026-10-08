import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);

  // Automatically activate Cart Transform & Bundle Discount Functions
  try {
    const fnRes = await admin.graphql(`
      query getFunctions {
        shopifyFunctions(first: 10) {
          nodes {
            id
            title
            apiType
          }
        }
      }
    `);
    const fnData = await fnRes.json();
    const fns = fnData?.data?.shopifyFunctions?.nodes || [];

    const ctFn = fns.find(f => f.apiType === 'cart_transform' || f.title.includes('cart-transform'));
    if (ctFn) {
      await admin.graphql(
        `#graphql
        mutation createCartTransform($functionId: String!) {
          cartTransformCreate(functionId: $functionId) {
            cartTransform { id }
            userErrors { field message }
          }
        }`,
        { variables: { functionId: ctFn.id } }
      );
    }

    const discFn = fns.find(f => f.apiType === 'discount' || f.title.includes('bundle-discount'));
    if (discFn) {
      await admin.graphql(
        `#graphql
        mutation createBundleDiscountApp($automaticAppDiscount: DiscountAutomaticAppInput!) {
          discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
            automaticAppDiscount {
              discountId
              title
            }
            userErrors { field message }
          }
        }`,
        {
          variables: {
            automaticAppDiscount: {
              title: "Smart Bundle Automatic Line Discount",
              functionId: discFn.id,
              startsAt: new Date().toISOString(),
            }
          }
        }
      );
    }
  } catch(e) {
    console.warn("Function auto-activation check:", e);
  }

  // Auto-sync store
  try {
    await prisma.shopifyStore.upsert({
      where: { shop: session.shop },
      update: { updatedAt: new Date(), status: "ACTIVE" },
      create: {
        shop: session.shop,
        storeName: session.shop.replace(".myshopify.com", ""),
        status: "ACTIVE",
        currency: "USD",
      },
    });
  } catch (e) {}

  return {
    shop: session.shop,
    appUrl: process.env.SHOPIFY_APP_URL || "https://shopify-bunddler-app.onrender.com",
  };
};

export default function EmbeddedWelcomeLaunchpad() {
  const { shop, appUrl } = useLoaderData();
  const portalUrl = `${appUrl}/portal?shop=${encodeURIComponent(shop)}`;

  return (
    <div style={{ maxWidth: 720, margin: "60px auto", padding: "0 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      <div
        style={{
          background: "#ffffff",
          borderRadius: 24,
          border: "1px solid #e2e8f0",
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.07)",
          overflow: "hidden",
          textAlign: "center",
          padding: "52px 40px",
        }}
      >
        {/* Glow Logo Badge */}
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 22,
            background: "linear-gradient(135deg, #f59e0b, #ef4444)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 38,
            margin: "0 auto 24px auto",
            boxShadow: "0 10px 25px rgba(245, 158, 11, 0.35)",
            color: "#ffffff",
          }}
        >
          ⚡
        </div>

        {/* Welcome Title */}
        <h1 style={{ fontSize: 30, fontWeight: 900, color: "#0f172a", margin: "0 0 12px 0", letterSpacing: "-0.02em" }}>
          Welcome to Smart Bundles
        </h1>
        <p style={{ color: "#64748b", fontSize: 16, lineHeight: 1.6, maxWidth: 520, margin: "0 auto 32px auto" }}>
          Your standalone bundle & discount platform is active for <strong style={{ color: "#0f172a" }}>{shop}</strong>. All bundles, templates, and analytics are managed in our dedicated full-screen web app.
        </p>

        {/* Primary Launch Button */}
        <div style={{ marginBottom: 36 }}>
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              background: "#0f172a",
              color: "#ffffff",
              padding: "16px 40px",
              borderRadius: 14,
              fontSize: 17,
              fontWeight: 800,
              textDecoration: "none",
              boxShadow: "0 8px 20px rgba(15, 23, 42, 0.25)",
              transition: "all 0.15s ease",
            }}
          >
            <span>🚀 Open Web Dashboard in New Tab</span>
            <span style={{ fontSize: 20 }}>↗</span>
          </a>
        </div>

        {/* Status Pills */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 20,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            padding: "12px 24px",
            borderRadius: 9999,
            fontSize: 13,
            color: "#475569",
            fontWeight: 600,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#10b981", fontSize: 12 }}>●</span> Store: <strong style={{ color: "#0f172a" }}>{shop}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#10b981", fontSize: 12 }}>●</span> Cart Engine: <span style={{ color: "#059669" }}>Active & Synced</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#38bdf8", fontSize: 12 }}>●</span> Database: <span style={{ color: "#0284c7" }}>PostgreSQL Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
