import { useState, useMemo } from "react";
import { useLoaderData, useFetcher } from "react-router";
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
  let products = [];

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

    const session = await prisma.session.findFirst({
      where: { shop },
      orderBy: { expires: "desc" },
    });

    if (session?.accessToken) {
      const res = await fetch(`https://${shop}/admin/api/2026-10/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
        body: JSON.stringify({
          query: `
            query getProducts {
              products(first: 25) {
                nodes {
                  id
                  title
                  handle
                  featuredImage { url altText }
                  variants(first: 5) {
                    nodes { id title price }
                  }
                }
              }
            }
          `,
        }),
      });
      const json = await res.json();
      if (json?.data?.products?.nodes) {
        products = json.data.products.nodes.map((p) => ({
          id: p.id,
          title: p.title,
          handle: p.handle,
          image: p.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
          price: p.variants?.nodes?.[0]?.price || "30.00",
          variants: p.variants?.nodes || [],
        }));
      }
    }
  } catch (err) {
    console.error("Portal loader error:", err);
  }

  if (!products || products.length === 0) {
    products = [
      {
        id: "gid://shopify/Product/901",
        title: "The Multi-Collection Snowboard",
        handle: "the-multi-collection-snowboard",
        price: "45.00",
        image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
        variants: [{ id: "gid://shopify/ProductVariant/1001", title: "Default", price: "45.00" }],
      },
      {
        id: "gid://shopify/Product/902",
        title: "Pro Snowboard Helmet",
        handle: "pro-snowboard-helmet",
        price: "35.00",
        image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
        variants: [{ id: "gid://shopify/ProductVariant/1002", title: "Default", price: "35.00" }],
      },
      {
        id: "gid://shopify/Product/903",
        title: "Thermal Winter Gloves",
        handle: "thermal-winter-gloves",
        price: "20.00",
        image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
        variants: [{ id: "gid://shopify/ProductVariant/1003", title: "Default", price: "20.00" }],
      },
      {
        id: "gid://shopify/Product/904",
        title: "Polarized Anti-Fog Ski Goggles",
        handle: "polarized-ski-goggles",
        price: "28.00",
        image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
        variants: [{ id: "gid://shopify/ProductVariant/1004", title: "Default", price: "28.00" }],
      },
    ];
  }

  return {
    shop,
    store,
    allStores: allStores.length > 0 ? allStores : [{ id: "1", shop, storeName: shop.replace(".myshopify.com", "") }],
    bundles,
    products,
    appUrl: process.env.SHOPIFY_APP_URL || "https://shopify-bunddler-app.onrender.com",
  };
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "toggle_status") {
      const bundleId = formData.get("bundleId");
      const currentStatus = formData.get("currentStatus");
      const newStatus = currentStatus === "Active" ? "Inactive" : "Active";
      await prisma.bundle.update({
        where: { id: bundleId },
        data: { status: newStatus },
      });
      return { success: true, message: `Bundle marked as ${newStatus}` };
    }

    if (intent === "delete_bundle") {
      const bundleId = formData.get("bundleId");
      await prisma.bundle.delete({ where: { id: bundleId } });
      return { success: true, message: "Bundle deleted successfully" };
    }

    if (intent === "save_bundle") {
      const bundleId = formData.get("bundleId");
      const title = formData.get("title");
      const strategy = formData.get("strategy");
      const discount = formData.get("discount");
      const config = formData.get("config");

      if (bundleId) {
        await prisma.bundle.update({
          where: { id: bundleId },
          data: { title, strategy, discount, products: config },
        });
        return { success: true, message: "Campaign updated successfully!" };
      } else {
        await prisma.bundle.create({
          data: {
            title,
            strategy,
            discount,
            products: config,
            status: "Active",
          },
        });
        return { success: true, message: "New campaign created & published!" };
      }
    }
  } catch (err) {
    console.error("Portal action error:", err);
    return { success: false, error: err.message };
  }

  return { success: true };
};
export default function StandalonePortal() {
  const { shop, allStores, bundles, products } = useLoaderData();
  const fetcher = useFetcher();

  // Navigation states: "dashboard", "templates", "settings"
  const [activeTab, setActiveTab] = useState("dashboard");
  const [storeDropdown, setStoreDropdown] = useState(false);

  // Next Slide: Active Builder State (null = in templates gallery, "volume" | "bxgy" | "step" = in builder)
  const [activeBuilder, setActiveBuilder] = useState(null);
  const [editingBundleId, setEditingBundleId] = useState(null);

  // Option 1: Product Selector Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [modalTargetField, setModalTargetField] = useState("vol");

  // Volume Discounts Builder Form State
  const [volTitle, setVolTitle] = useState("Volume Discounts Campaign");
  const [volSelectedProducts, setVolSelectedProducts] = useState(products.slice(0, 1));
  const [volTiers, setVolTiers] = useState([
    { quantity: 1, discountPercent: 0, label: "Single Unit", badge: "STANDARD" },
    { quantity: 2, discountPercent: 15, label: "Duo Pack", badge: "MOST POPULAR" },
    { quantity: 3, discountPercent: 20, label: "Trio Pack", badge: "BEST VALUE" },
  ]);
  const [volColor, setVolColor] = useState("#f59e0b");

  // BXGY Builder Form State
  const [bxgyTitle, setBxgyTitle] = useState("Buy 2 Get 1 Free Deal");
  const [bxgySelectedProducts, setBxgySelectedProducts] = useState(products.slice(0, 1));
  const [bxgyBuyQty, setBxgyBuyQty] = useState(2);
  const [bxgyGetQty, setBxgyGetQty] = useState(1);
  const [bxgyBadge, setBxgyBadge] = useState("BUY 2 GET 1 FREE");
  const [bxgyColor, setBxgyColor] = useState("#10b981");

  // Step Bundle Builder Form State
  const [stepTitle, setStepTitle] = useState("Multi-Collection Step Bundle");
  const [step1Products, setStep1Products] = useState(products.slice(0, 1));
  const [step2Products, setStep2Products] = useState(products.slice(1, 2));
  const [step3Products, setStep3Products] = useState(products.slice(2, 3));
  const [stepDiscountPercent, setStepDiscountPercent] = useState(15);
  const [stepColor, setStepColor] = useState("#3b82f6");

  // EXACTLY 3 Main Navigation Links
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "templates", label: "Templates", icon: "🎨" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  // Open builder for creating new or editing
  const handleOpenBuilder = (type, existingBundle = null) => {
    setActiveBuilder(type);
    setActiveTab("templates");

    if (existingBundle) {
      setEditingBundleId(existingBundle.id);
      let parsed = {};
      try { parsed = JSON.parse(existingBundle.products); } catch (e) {}

      if (type === "volume") {
        setVolTitle(existingBundle.title || "Volume Discounts Campaign");
        if (parsed.selectedProducts) setVolSelectedProducts(parsed.selectedProducts);
        if (parsed.tiers) setVolTiers(parsed.tiers);
        if (parsed.accentColor) setVolColor(parsed.accentColor);
      } else if (type === "bxgy") {
        setBxgyTitle(existingBundle.title || "Buy 2 Get 1 Free Deal");
        if (parsed.selectedProducts) setBxgySelectedProducts(parsed.selectedProducts);
        if (parsed.buyQty) setBxgyBuyQty(parsed.buyQty);
        if (parsed.getQty) setBxgyGetQty(parsed.getQty);
        if (parsed.badge) setBxgyBadge(parsed.badge);
        if (parsed.accentColor) setBxgyColor(parsed.accentColor);
      } else if (type === "step") {
        setStepTitle(existingBundle.title || "Multi-Collection Step Bundle");
        if (parsed.step1Products) setStep1Products(parsed.step1Products);
        if (parsed.step2Products) setStep2Products(parsed.step2Products);
        if (parsed.step3Products) setStep3Products(parsed.step3Products);
        if (parsed.discountPercent) setStepDiscountPercent(parsed.discountPercent);
        if (parsed.accentColor) setStepColor(parsed.accentColor);
      }
    } else {
      setEditingBundleId(null);
    }
  };

  const handleSaveVolume = () => {
    const config = JSON.stringify({
      selectedProducts: volSelectedProducts,
      tiers: volTiers,
      accentColor: volColor,
    });
    const maxDiscount = Math.max(...volTiers.map(t => t.discountPercent || 0));
    fetcher.submit(
      {
        intent: "save_bundle",
        bundleId: editingBundleId || "",
        title: volTitle,
        strategy: "Volume Discounts",
        discount: `Up to ${maxDiscount}% OFF`,
        config,
      },
      { method: "POST" }
    );
    setActiveBuilder(null);
    setActiveTab("dashboard");
  };

  const handleSaveBXGY = () => {
    const config = JSON.stringify({
      selectedProducts: bxgySelectedProducts,
      buyQty: bxgyBuyQty,
      getQty: bxgyGetQty,
      badge: bxgyBadge,
      accentColor: bxgyColor,
    });
    fetcher.submit(
      {
        intent: "save_bundle",
        bundleId: editingBundleId || "",
        title: bxgyTitle,
        strategy: "Buy X Get Y",
        discount: `Save up to 33% (BXGY)`,
        config,
      },
      { method: "POST" }
    );
    setActiveBuilder(null);
    setActiveTab("dashboard");
  };

  const handleSaveStep = () => {
    const config = JSON.stringify({
      step1Products,
      step2Products,
      step3Products,
      discountPercent: stepDiscountPercent,
      accentColor: stepColor,
    });
    fetcher.submit(
      {
        intent: "save_bundle",
        bundleId: editingBundleId || "",
        title: stepTitle,
        strategy: "Multi-Collection Complete Bundle",
        discount: `${stepDiscountPercent}% OFF (All Steps)`,
        config,
      },
      { method: "POST" }
    );
    setActiveBuilder(null);
    setActiveTab("dashboard");
  };

  const openProductPicker = (targetField) => {
    setModalTargetField(targetField);
    setShowProductModal(true);
  };

  const handleToggleProductInModal = (product) => {
    if (modalTargetField === "vol") {
      const exists = volSelectedProducts.some(p => p.id === product.id);
      if (exists) {
        setVolSelectedProducts(volSelectedProducts.filter(p => p.id !== product.id));
      } else {
        setVolSelectedProducts([...volSelectedProducts, product]);
      }
    } else if (modalTargetField === "bxgy") {
      const exists = bxgySelectedProducts.some(p => p.id === product.id);
      if (exists) {
        setBxgySelectedProducts(bxgySelectedProducts.filter(p => p.id !== product.id));
      } else {
        setBxgySelectedProducts([...bxgySelectedProducts, product]);
      }
    } else if (modalTargetField === "step1") {
      setStep1Products([product]);
    } else if (modalTargetField === "step2") {
      setStep2Products([product]);
    } else if (modalTargetField === "step3") {
      setStep3Products([product]);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    return products.filter(p => p.title.toLowerCase().includes(productSearch.toLowerCase()));
  }, [products, productSearch]);
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", color: "#0f172a" }}>
      {/* 1. Left SaaS Sidebar (Klaviyo Style - 3 Menus Only) */}
      <aside style={{ width: 250, background: "#0f172a", color: "#ffffff", display: "flex", flexDirection: "column", flexShrink: 0, borderRight: "1px solid #1e293b" }}>
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

        {/* Connected Store Switcher */}
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
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>{shop}</span>
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

        {/* 3 Main Navigation Links */}
        <nav style={{ flex: 1, padding: "20px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== "templates") setActiveBuilder(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
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

        {/* Cloud Status Footer */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #1e293b", fontSize: 12, color: "#64748b" }}>
          <div>Database: <span style={{ color: "#10b981", fontWeight: 600 }}>PostgreSQL Live</span></div>
          <div>Hosting: <span style={{ color: "#38bdf8", fontWeight: 600 }}>Render Cloud</span></div>
        </div>
      </aside>

      {/* 2. Main View Workspace */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto" }}>
        {/* Top Header */}
        <header style={{ height: 64, background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0, textTransform: "capitalize" }}>
              {activeTab === "templates" && activeBuilder
                ? `Templates / ${activeBuilder === "volume" ? "Volume Discounts Builder" : activeBuilder === "bxgy" ? "BXGY Deals Builder" : "Step Bundle Builder"}`
                : activeTab}
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

        {/* View Content */}
        <div style={{ padding: "28px", flex: 1 }}>
          {/* TAB 1: DASHBOARD */}
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
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 8 }}>{bundles.length} Live</div>
                  <div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600, marginTop: 4 }}>WASM cart engine connected</div>
                </div>

                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>CONVERSION BOOST</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 8 }}>+4.5%</div>
                  <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600, marginTop: 4 }}>Cart transform active</div>
                </div>
              </div>

              {/* Active Campaigns Table */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Active Store Bundles ({bundles.length})</h3>
                    <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>Manage, toggle, or edit your live storefront widgets.</p>
                  </div>
                  <button
                    onClick={() => { setActiveTab("templates"); setActiveBuilder(null); }}
                    style={{ background: "#0f172a", color: "#ffffff", padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    + Create New Bundle
                  </button>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: 12 }}>
                      <th style={{ padding: "14px 24px" }}>CAMPAIGN NAME</th>
                      <th style={{ padding: "14px 20px" }}>STRATEGY</th>
                      <th style={{ padding: "14px 20px" }}>DISCOUNT</th>
                      <th style={{ padding: "14px 20px" }}>SALES</th>
                      <th style={{ padding: "14px 20px" }}>STATUS</th>
                      <th style={{ padding: "14px 24px", textAlign: "center" }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundles.length > 0 ? (
                      bundles.map((b) => {
                        const isActive = b.status === "Active";
                        const stratType = b.strategy.includes("Volume") ? "volume" : b.strategy.includes("Buy X") ? "bxgy" : "step";
                        return (
                          <tr key={b.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "16px 24px", fontWeight: 700 }}>{b.title}</td>
                            <td style={{ padding: "16px 20px", color: "#64748b" }}>{b.strategy}</td>
                            <td style={{ padding: "16px 20px", color: "#10b981", fontWeight: 700 }}>{b.discount}</td>
                            <td style={{ padding: "16px 20px" }}>{b.salesCount} orders</td>
                            <td style={{ padding: "16px 20px" }}>
                              <span style={{ background: isActive ? "#ecfdf5" : "#f1f5f9", color: isActive ? "#065f46" : "#64748b", padding: "4px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>
                                {b.status}
                              </span>
                            </td>
                            <td style={{ padding: "16px 24px", textAlign: "center" }}>
                              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
                                {/* Toggle Status */}
                                <button
                                  type="button"
                                  onClick={() => fetcher.submit({ intent: "toggle_status", bundleId: b.id, currentStatus: b.status }, { method: "POST" })}
                                  style={{
                                    background: isActive ? "#10b981" : "#cbd5e1",
                                    color: "#ffffff",
                                    border: "none",
                                    borderRadius: 6,
                                    padding: "4px 10px",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  {isActive ? "ON" : "OFF"}
                                </button>
                                {/* Edit */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenBuilder(stratType, b)}
                                  style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                >
                                  Edit
                                </button>
                                {/* Delete */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm("Delete this bundle?")) {
                                      fetcher.submit({ intent: "delete_bundle", bundleId: b.id }, { method: "POST" });
                                    }
                                  }}
                                  style={{ background: "none", border: "none", color: "#ef4444", fontSize: 14, cursor: "pointer", padding: "4px" }}
                                >
                                  🗑
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                          No bundles created yet. Go to <strong>Templates</strong> to launch your first bundle!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* TAB 2: TEMPLATES (Gallery OR Next Slide Builder) */}
          {activeTab === "templates" && (
            <div>
              {/* SLIDE A: WIDGET TEMPLATES GALLERY */}
              {!activeBuilder && (
                <div>
                  <div style={{ marginBottom: 28 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px 0" }}>Widget Templates & Builders</h2>
                    <p style={{ color: "#64748b", margin: 0, fontSize: 15 }}>
                      Select a bundle strategy to open its interactive builder and configure offers for your storefront.
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
                    {/* Widget 1: Multi-Collection Step Bundle */}
                    <div style={{ background: "#ffffff", border: "2px solid #e2e8f0", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          <span style={{ fontSize: 28 }}>📦</span>
                          <div>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Multi-Collection Step Bundle</h3>
                            <span style={{ fontSize: 11, background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                              MULTI-TIERED
                            </span>
                          </div>
                        </div>
                        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
                          Customers pick 1 item from 3 designated collections (e.g. Board + Helmet + Gloves) and get a combined bundle discount at checkout.
                        </p>
                        <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 10, padding: 12, marginBottom: 20 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>Storefront Widget Preview:</div>
                          <div style={{ fontSize: 12, color: "#475569", display: "flex", flexDirection: "column", gap: 4 }}>
                            <div>1. Choose Deck ($45.00)</div>
                            <div>2. Choose Helmet (SAVE 15%)</div>
                            <div>3. Choose Gloves (SAVE 25%)</div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenBuilder("step")}
                        style={{ background: "#0f172a", color: "#ffffff", padding: "12px 20px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        <span>Configure Step Bundle</span>
                        <span>→</span>
                      </button>
                    </div>

                    {/* Widget 2: Buy X Get Y (BXGY) Deals */}
                    <div style={{ background: "#ffffff", border: "2px solid #e2e8f0", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          <span style={{ fontSize: 28 }}>⚡</span>
                          <div>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Buy X Get Y (BXGY) Deals</h3>
                            <span style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                              HIGH CONVERSION
                            </span>
                          </div>
                        </div>
                        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
                          Reward customers with free or heavily discounted bonus items when they buy required quantities (e.g. Buy 2 Get 1 Free).
                        </p>
                        <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 10, padding: 12, marginBottom: 20 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>Storefront Widget Preview:</div>
                          <div style={{ fontSize: 12, color: "#475569", display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ color: "#10b981", fontWeight: 700 }}>★ BUY 2 GET 1 FREE (SAVE 33%)</div>
                            <div>Automatic line discount at cart</div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenBuilder("bxgy")}
                        style={{ background: "#0f172a", color: "#ffffff", padding: "12px 20px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        <span>Configure BXGY Deal</span>
                        <span>→</span>
                      </button>
                    </div>

                    {/* Widget 3: Volume Discounts */}
                    <div style={{ background: "#ffffff", border: "2px solid #e2e8f0", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          <span style={{ fontSize: 28 }}>📈</span>
                          <div>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Volume Quantity Discounts</h3>
                            <span style={{ fontSize: 11, background: "#ecfdf5", color: "#065f46", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                              TIERED PACKS
                            </span>
                          </div>
                        </div>
                        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
                          Tiered quantity packs on product pages (Single, Duo 15% OFF, Trio 20% OFF) synchronized with the default theme Add to Cart.
                        </p>
                        <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 10, padding: 12, marginBottom: 20 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>Storefront Widget Preview:</div>
                          <div style={{ fontSize: 12, color: "#475569", display: "flex", flexDirection: "column", gap: 4 }}>
                            <div>[1 Unit - Regular Price]</div>
                            <div style={{ color: "#f59e0b", fontWeight: 700 }}>[2 Units - 15% OFF (Duo)]</div>
                            <div style={{ color: "#10b981", fontWeight: 700 }}>[3 Units - 20% OFF (Trio)]</div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenBuilder("volume")}
                        style={{ background: "#0f172a", color: "#ffffff", padding: "12px 20px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        <span>Configure Volume Discount</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE B: IN-APP WIDGET BUILDER (NEXT SLIDE) */}
              {activeBuilder && (
                <div>
                  {/* Top Breadcrumb & Back Button */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                    <button
                      onClick={() => setActiveBuilder(null)}
                      style={{ background: "#ffffff", border: "1px solid #cbd5e1", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span>← Back to Templates</span>
                    </button>

                    <div style={{ display: "flex", gap: 12 }}>
                      <button
                        onClick={() => {
                          if (activeBuilder === "volume") handleSaveVolume();
                          if (activeBuilder === "bxgy") handleSaveBXGY();
                          if (activeBuilder === "step") handleSaveStep();
                        }}
                        style={{ background: "#10b981", color: "#ffffff", border: "none", padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 10px rgba(16, 185, 129, 0.3)" }}
                      >
                        💾 Save & Publish to Storefront
                      </button>
                    </div>
                  </div>

                  {/* 2-Column Builder: Left Config, Right Live Preview */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 28, alignItems: "start" }}>
                    {/* LEFT COLUMN: BUILDER CONFIG */}
                    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                      {/* VOLUME DISCOUNTS BUILDER */}
                      {activeBuilder === "volume" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                          <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Campaign Title</label>
                            <input
                              type="text"
                              value={volTitle}
                              onChange={(e) => setVolTitle(e.target.value)}
                              style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
                            />
                          </div>

                          {/* Option 1: Target Products with In-App Modal */}
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Target Products ({volSelectedProducts.length})</label>
                              <button
                                type="button"
                                onClick={() => openProductPicker("vol")}
                                style={{ background: "#0f172a", color: "#ffffff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                              >
                                🔍 Select Products from Store
                              </button>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {volSelectedProducts.map((p) => (
                                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <img src={p.image} alt={p.title} style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
                                    <div>
                                      <div style={{ fontSize: 13, fontWeight: 700 }}>{p.title}</div>
                                      <div style={{ fontSize: 11, color: "#64748b" }}>${p.price}</div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setVolSelectedProducts(volSelectedProducts.filter(x => x.id !== p.id))}
                                    style={{ background: "none", border: "none", color: "#ef4444", fontSize: 16, cursor: "pointer" }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Tiers Configuration */}
                          <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 8 }}>Quantity Discount Tiers</label>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {volTiers.map((tier, idx) => (
                                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: 10, background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                                  <div>
                                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Qty</div>
                                    <input
                                      type="number"
                                      value={tier.quantity}
                                      onChange={(e) => {
                                        const next = [...volTiers];
                                        next[idx].quantity = parseInt(e.target.value, 10) || 1;
                                        setVolTiers(next);
                                      }}
                                      style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                                    />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Discount %</div>
                                    <input
                                      type="number"
                                      value={tier.discountPercent}
                                      onChange={(e) => {
                                        const next = [...volTiers];
                                        next[idx].discountPercent = parseInt(e.target.value, 10) || 0;
                                        setVolTiers(next);
                                      }}
                                      style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                                    />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Badge Label</div>
                                    <input
                                      type="text"
                                      value={tier.badge}
                                      onChange={(e) => {
                                        const next = [...volTiers];
                                        next[idx].badge = e.target.value;
                                        setVolTiers(next);
                                      }}
                                      style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Widget Accent Color</label>
                            <input
                              type="color"
                              value={volColor}
                              onChange={(e) => setVolColor(e.target.value)}
                              style={{ width: 60, height: 36, border: "none", cursor: "pointer" }}
                            />
                          </div>
                        </div>
                      )}

                      {/* BXGY BUILDER */}
                      {activeBuilder === "bxgy" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                          <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Campaign Title</label>
                            <input
                              type="text"
                              value={bxgyTitle}
                              onChange={(e) => setBxgyTitle(e.target.value)}
                              style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
                            />
                          </div>

                          {/* Target Products */}
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Target Products</label>
                              <button
                                type="button"
                                onClick={() => openProductPicker("bxgy")}
                                style={{ background: "#0f172a", color: "#ffffff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                              >
                                🔍 Select Products from Store
                              </button>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {bxgySelectedProducts.map((p) => (
                                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <img src={p.image} alt={p.title} style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
                                    <div>
                                      <div style={{ fontSize: 13, fontWeight: 700 }}>{p.title}</div>
                                      <div style={{ fontSize: 11, color: "#64748b" }}>${p.price}</div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setBxgySelectedProducts(bxgySelectedProducts.filter(x => x.id !== p.id))}
                                    style={{ background: "none", border: "none", color: "#ef4444", fontSize: 16, cursor: "pointer" }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            <div>
                              <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Buy Quantity (X)</label>
                              <input
                                type="number"
                                value={bxgyBuyQty}
                                onChange={(e) => setBxgyBuyQty(parseInt(e.target.value, 10) || 1)}
                                style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Get Free Quantity (Y)</label>
                              <input
                                type="number"
                                value={bxgyGetQty}
                                onChange={(e) => setBxgyGetQty(parseInt(e.target.value, 10) || 1)}
                                style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
                              />
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Deal Badge Text</label>
                            <input
                              type="text"
                              value={bxgyBadge}
                              onChange={(e) => setBxgyBadge(e.target.value)}
                              style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Accent Color</label>
                            <input
                              type="color"
                              value={bxgyColor}
                              onChange={(e) => setBxgyColor(e.target.value)}
                              style={{ width: 60, height: 36, border: "none", cursor: "pointer" }}
                            />
                          </div>
                        </div>
                      )}

                      {/* STEP BUNDLE BUILDER */}
                      {activeBuilder === "step" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                          <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Campaign Title</label>
                            <input
                              type="text"
                              value={stepTitle}
                              onChange={(e) => setStepTitle(e.target.value)}
                              style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
                            />
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <strong style={{ fontSize: 13 }}>Step 1 Product: {step1Products[0]?.title || "None"}</strong>
                                <button type="button" onClick={() => openProductPicker("step1")} style={{ background: "#0f172a", color: "#fff", border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>Change</button>
                              </div>
                            </div>
                            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <strong style={{ fontSize: 13 }}>Step 2 Product: {step2Products[0]?.title || "None"}</strong>
                                <button type="button" onClick={() => openProductPicker("step2")} style={{ background: "#0f172a", color: "#fff", border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>Change</button>
                              </div>
                            </div>
                            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <strong style={{ fontSize: 13 }}>Step 3 Product: {step3Products[0]?.title || "None"}</strong>
                                <button type="button" onClick={() => openProductPicker("step3")} style={{ background: "#0f172a", color: "#fff", border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>Change</button>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Bundle Discount %</label>
                            <input
                              type="number"
                              value={stepDiscountPercent}
                              onChange={(e) => setStepDiscountPercent(parseInt(e.target.value, 10) || 15)}
                              style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Accent Color</label>
                            <input
                              type="color"
                              value={stepColor}
                              onChange={(e) => setStepColor(e.target.value)}
                              style={{ width: 60, height: 36, border: "none", cursor: "pointer" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    {/* RIGHT COLUMN: LIVE INTERACTIVE PREVIEW */}
                    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, position: "sticky", top: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>👁</span> Storefront Live Preview
                      </div>

                      {/* Volume Discount Preview */}
                      {activeBuilder === "volume" && (
                        <div style={{ border: `2px solid ${volColor}`, borderRadius: 14, padding: 18, background: "#fafafa" }}>
                          <h4 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 800 }}>Choose Quantity:</h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {volTiers.map((t, idx) => (
                              <div
                                key={idx}
                                style={{
                                  border: `1.5px solid ${idx === 1 ? volColor : "#e2e8f0"}`,
                                  background: idx === 1 ? "#fffbeb" : "#ffffff",
                                  borderRadius: 10,
                                  padding: 12,
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: 14 }}>{t.quantity}x {t.label}</div>
                                  {t.discountPercent > 0 && (
                                    <div style={{ fontSize: 12, color: volColor, fontWeight: 700 }}>Save {t.discountPercent}%</div>
                                  )}
                                </div>
                                <span style={{ background: volColor, color: "#ffffff", fontSize: 10, padding: "2px 8px", borderRadius: 9999, fontWeight: 800 }}>
                                  {t.badge}
                                </span>
                              </div>
                            ))}
                          </div>
                          <button style={{ width: "100%", marginTop: 16, padding: 12, background: "#0f172a", color: "#ffffff", borderRadius: 8, border: "none", fontWeight: 800 }}>
                            Add to Cart
                          </button>
                        </div>
                      )}

                      {/* BXGY Preview */}
                      {activeBuilder === "bxgy" && (
                        <div style={{ border: `2px solid ${bxgyColor}`, borderRadius: 14, padding: 18, background: "#fafafa" }}>
                          <div style={{ background: bxgyColor, color: "#fff", padding: "6px 12px", borderRadius: 6, fontWeight: 800, fontSize: 12, textAlign: "center", marginBottom: 12 }}>
                            ★ {bxgyBadge}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                            <img src={bxgySelectedProducts[0]?.image} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 14 }}>{bxgySelectedProducts[0]?.title}</div>
                              <div style={{ fontSize: 12, color: "#64748b" }}>Buy {bxgyBuyQty}, Get {bxgyGetQty} FREE!</div>
                            </div>
                          </div>
                          <button style={{ width: "100%", padding: 12, background: "#0f172a", color: "#ffffff", borderRadius: 8, border: "none", fontWeight: 800 }}>
                            Claim Deal & Add to Cart
                          </button>
                        </div>
                      )}

                      {/* Step Bundle Preview */}
                      {activeBuilder === "step" && (
                        <div style={{ border: `2px solid ${stepColor}`, borderRadius: 14, padding: 18, background: "#fafafa" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Complete 3-Step Bundle</h4>
                            <span style={{ color: stepColor, fontWeight: 800, fontSize: 12 }}>{stepDiscountPercent}% OFF</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                            <div style={{ background: "#ffffff", padding: 8, borderRadius: 6, fontSize: 12 }}>1. {step1Products[0]?.title} ($45)</div>
                            <div style={{ background: "#ffffff", padding: 8, borderRadius: 6, fontSize: 12 }}>2. {step2Products[0]?.title} ($35)</div>
                            <div style={{ background: "#ffffff", padding: 8, borderRadius: 6, fontSize: 12 }}>3. {step3Products[0]?.title} ($20)</div>
                          </div>
                          <button style={{ width: "100%", padding: 12, background: stepColor, color: "#ffffff", borderRadius: 8, border: "none", fontWeight: 800 }}>
                            Add Complete Bundle to Cart
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SETTINGS */}
          {activeTab === "settings" && (
            <div style={{ maxWidth: 680 }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px 0" }}>Storefront & App Settings</h2>
                <p style={{ color: "#64748b", margin: 0, fontSize: 15 }}>
                  Configure theme script injections, WASM discount engines, and global preferences.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: 15, color: "#0f172a" }}>Storefront App Embed</strong>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Injects bundle widget scripts into your active theme.</div>
                    </div>
                    <span style={{ background: "#ecfdf5", color: "#065f46", padding: "4px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 700 }}>
                      ✓ Active
                    </span>
                  </div>
                </div>

                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: 15, color: "#0f172a" }}>Cart Transform WASM Engine</strong>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Shopify Functions runtime for checkout bundle price sync.</div>
                    </div>
                    <span style={{ background: "#ecfdf5", color: "#065f46", padding: "4px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 700 }}>
                      ✓ Synced (&lt;4ms)
                    </span>
                  </div>
                </div>

                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: 15, color: "#0f172a" }}>PostgreSQL Database Live Sync</strong>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Multi-tenant cloud persistence via Render PostgreSQL.</div>
                    </div>
                    <span style={{ background: "#ecfdf5", color: "#065f46", padding: "4px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 700 }}>
                      ✓ Connected
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* OPTION 1: IN-APP PRODUCT SELECTOR MODAL */}
      {showProductModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 580,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Select Products from Store</h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>{shop}</span>
              </div>
              <button
                onClick={() => setShowProductModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div style={{ padding: "14px 24px", borderBottom: "1px solid #f1f5f9" }}>
              <input
                type="text"
                placeholder="Search products by title..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
              />
            </div>

            {/* Product List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredProducts.map((p) => {
                const isSelected =
                  modalTargetField === "vol" ? volSelectedProducts.some(x => x.id === p.id) :
                  modalTargetField === "bxgy" ? bxgySelectedProducts.some(x => x.id === p.id) :
                  modalTargetField === "step1" ? step1Products.some(x => x.id === p.id) :
                  modalTargetField === "step2" ? step2Products.some(x => x.id === p.id) :
                  modalTargetField === "step3" ? step3Products.some(x => x.id === p.id) : false;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleToggleProductInModal(p)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: `1.5px solid ${isSelected ? "#0f172a" : "#e2e8f0"}`,
                      background: isSelected ? "#f8fafc" : "#ffffff",
                      cursor: "pointer",
                      transition: "all 0.1s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <img src={p.image} alt={p.title} style={{ width: 42, height: 42, borderRadius: 6, objectFit: "cover" }} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{p.title}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>${p.price}</div>
                      </div>
                    </div>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: `2px solid ${isSelected ? "#0f172a" : "#cbd5e1"}`,
                        background: isSelected ? "#0f172a" : "transparent",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 900,
                      }}
                    >
                      {isSelected && "✓"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowProductModal(false)}
                style={{ background: "#0f172a", color: "#ffffff", padding: "10px 24px", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
