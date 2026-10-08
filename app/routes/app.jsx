import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  // Auto-sync Store in PostgreSQL
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
  } catch (err) {
    console.error("Auto-sync store error in app.jsx:", err);
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
  };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      {/* Note: s-app-nav has been removed so Shopify Admin left sidebar stays clean without sub-links */}
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
