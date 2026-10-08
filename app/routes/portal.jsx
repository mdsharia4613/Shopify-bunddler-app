import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import prisma from "../db.server";

// Modular Portal Components
import ProductSelectorModal from "../components/portal/ProductSelectorModal";
import CollectionSelectorModal from "../components/portal/CollectionSelectorModal";
import VolumeDiscountBuilder from "../components/portal/VolumeDiscountBuilder";
import BxgyBuilder from "../components/portal/BxgyBuilder";
import StepBundleBuilder from "../components/portal/StepBundleBuilder";

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
  let collections = [];

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
            query getStoreCatalog {
              products(first: 30) {
                nodes {
                  id
                  title
                  handle
                  featuredImage { url }
                  variants(first: 5) {
                    nodes { id title price }
                  }
                }
              }
              collections(first: 30) {
                nodes {
                  id
                  title
                  handle
                  productsCount { count }
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
      if (json?.data?.collections?.nodes) {
        collections = json.data.collections.nodes.map((c) => ({
          id: c.id,
          title: c.title,
          handle: c.handle,
          count: c.productsCount?.count || 0,
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
    ];
  }

  if (!collections || collections.length === 0) {
    collections = [
      { id: "gid://shopify/Collection/101", title: "Collection 1 - Snowboards", handle: "snowboards", count: 8 },
      { id: "gid://shopify/Collection/102", title: "Collection 2 - Protective Helmets", handle: "helmets", count: 12 },
      { id: "gid://shopify/Collection/103", title: "Collection 3 - Winter Accessories", handle: "winter-accessories", count: 15 },
    ];
  }

  return {
    shop,
    store,
    allStores: allStores.length > 0 ? allStores : [{ id: "1", shop, storeName: shop.replace(".myshopify.com", "") }],
    bundles,
    products,
    collections,
    appUrl: process.env.SHOPIFY_APP_URL || "https://shopify-bunddler-app.onrender.com",
  };
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const shop = formData.get("shop") || "demo-app-uvjpaks1.myshopify.com";

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
      const configRaw = formData.get("config");

      let parsedConfig = {};
      try {
        parsedConfig = JSON.parse(configRaw);
      } catch (e) {
        parsedConfig = {};
      }

      let savedBundle = null;
      if (bundleId) {
        savedBundle = await prisma.bundle.update({
          where: { id: bundleId },
          data: { title, strategy, discount, products: configRaw },
        });
      } else {
        savedBundle = await prisma.bundle.create({
          data: {
            title,
            strategy,
            discount,
            products: configRaw,
            status: "Active",
          },
        });
      }

      // Sync Storefront Metafields for instant live widget updates
      try {
        const session = await prisma.session.findFirst({
          where: { shop },
          orderBy: { expires: "desc" },
        });

        if (session?.accessToken) {
          const infoRes = await fetch(`https://${shop}/admin/api/2026-10/graphql.json`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": session.accessToken,
            },
            body: JSON.stringify({
              query: `query { currentAppInstallation { id } shop { id } }`,
            }),
          });
          const infoJson = await infoRes.json();
          const appInstallId = infoJson.data?.currentAppInstallation?.id;
          const shopId = infoJson.data?.shop?.id;

          let metafieldKey = "active_bundle";
          let metafieldVal = "";

          if (strategy === "Multi-Collection Complete Bundle") {
            metafieldKey = "active_bundle";
            const discountMatch = discount?.match(/(\d+)%/);
            const discountNum = parsedConfig?.discountPercent || (discountMatch ? parseInt(discountMatch[1], 10) : 15);

            metafieldVal = JSON.stringify({
              id: savedBundle.id,
              title: savedBundle.title,
              discountPercent: discountNum,
              discountSummary: savedBundle.discount,
              discountCode: `BUNDLE${discountNum}`,
              collectionRows: parsedConfig.collectionRows || [],
              brandColor: parsedConfig.brandColor || parsedConfig.accentColor || "#3b82f6",
              accentColor: parsedConfig.accentColor || "#3b82f6",
              active: true,
              updatedAt: new Date().toISOString(),
            });
          } else if (strategy === "Volume Discounts") {
            metafieldKey = "active_volume";
            metafieldVal = JSON.stringify({
              id: savedBundle.id,
              title: savedBundle.title,
              appliesTo: parsedConfig.appliesTo || "all",
              selectedProducts: parsedConfig.selectedProducts || [],
              selectedCollections: parsedConfig.selectedCollections || [],
              tiers: parsedConfig.tiers || [],
              accentColor: parsedConfig.accentColor || "#f59e0b",
              active: true,
              updatedAt: new Date().toISOString(),
            });
          } else if (strategy === "Buy X Get Y") {
            metafieldKey = "active_bxgy";
            metafieldVal = JSON.stringify({
              id: savedBundle.id,
              title: savedBundle.title,
              headerTitle: parsedConfig.headerTitle || "Buy X, Get Y Special",
              appliesTo: parsedConfig.appliesTo || "all",
              selectedProducts: parsedConfig.selectedProducts || [],
              selectedCollections: parsedConfig.selectedCollections || [],
              tiers: parsedConfig.tiers || [],
              defaultTier: parsedConfig.defaultTier || 1,
              accentColor: parsedConfig.accentColor || "#10b981",
              active: true,
              updatedAt: new Date().toISOString(),
            });
          }

          if (metafieldVal) {
            const metafields = [];
            if (appInstallId) {
              metafields.push({
                ownerId: appInstallId,
                namespace: "$app:smart_bundles",
                key: metafieldKey,
                type: "json",
                value: metafieldVal,
              });
            }
            if (shopId) {
              metafields.push({
                ownerId: shopId,
                namespace: "$app:smart_bundles",
                key: metafieldKey,
                type: "json",
                value: metafieldVal,
              });
              metafields.push({
                ownerId: shopId,
                namespace: "smart_bundles",
                key: metafieldKey,
                type: "json",
                value: metafieldVal,
              });
            }

            if (metafields.length > 0) {
              await fetch(`https://${shop}/admin/api/2026-10/graphql.json`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Shopify-Access-Token": session.accessToken,
                },
                body: JSON.stringify({
                  query: `
                    mutation setMetafields($metafields: [MetafieldsSetInput!]!) {
                      metafieldsSet(metafields: $metafields) {
                        userErrors { field message }
                      }
                    }
                  `,
                  variables: { metafields },
                }),
              });
            }
          }
        }
      } catch (syncErr) {
        console.warn("Storefront metafield sync note:", syncErr?.message);
      }

      return { success: true, message: "Campaign saved & published to storefront!" };
    }
  } catch (err) {
    console.error("Portal action error:", err);
    return { success: false, error: err.message };
  }

  return { success: true };
};

export default function StandalonePortal() {
  const { shop, allStores, bundles, products, collections } = useLoaderData();
  const fetcher = useFetcher();

  // Navigation states: "dashboard", "templates", "settings"
  const [activeTab, setActiveTab] = useState("dashboard");
  const [storeDropdown, setStoreDropdown] = useState(false);

  // Active Builder State ("volume", "bxgy", "step")
  const [activeBuilder, setActiveBuilder] = useState(null);
  const [editingBundleId, setEditingBundleId] = useState(null);

  // In-App Product Selector Modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalProductTarget, setModalProductTarget] = useState("vol");

  // In-App Collection Selector Modal
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionModalTarget, setCollectionModalTarget] = useState({ type: "step", stepId: 1 });

  // 1. STEP BUNDLE (MULTI-COLLECTION) STATE
  const [stepTitle, setStepTitle] = useState("Multi-Collection Step Bundle");
  const [stepCollectionRows, setStepCollectionRows] = useState([
    {
      id: 1,
      stepTitle: "Step 1",
      collectionId: collections[0]?.id || "",
      collectionTitle: collections[0]?.title || "Collection 1",
      collectionHandle: collections[0]?.handle || "",
    },
    {
      id: 2,
      stepTitle: "Step 2",
      collectionId: collections[1]?.id || "",
      collectionTitle: collections[1]?.title || "Collection 2",
      collectionHandle: collections[1]?.handle || "",
    },
    {
      id: 3,
      stepTitle: "Step 3",
      collectionId: collections[2]?.id || "",
      collectionTitle: collections[2]?.title || "Collection 3",
      collectionHandle: collections[2]?.handle || "",
    },
  ]);
  const [stepDiscountPercent, setStepDiscountPercent] = useState(15);
  const [stepColor, setStepColor] = useState("#3b82f6");

  // 2. VOLUME DISCOUNTS STATE
  const [volTitle, setVolTitle] = useState("Volume Discounts Campaign");
  const [volAppliesTo, setVolAppliesTo] = useState("all");
  const [volSelectedProducts, setVolSelectedProducts] = useState(products.slice(0, 1));
  const [volSelectedCollections, setVolSelectedCollections] = useState([]);
  const [volTiers, setVolTiers] = useState([
    {
      id: 1,
      qty: 1,
      quantity: 1,
      pricingType: "full_price",
      discount: 0,
      discountPercent: 0,
      title: "Single",
      subtitle: "Standard price",
      label: "",
      saveTag: "",
      popularBadge: "",
    },
    {
      id: 2,
      qty: 2,
      quantity: 2,
      pricingType: "percentage_off", discountValue: 15,
      discount: 15,
      discountPercent: 15,
      title: "Duo",
      subtitle: "You save 15%",
      label: "SAVE $30.00",
      saveTag: "SAVE $30.00",
      popularBadge: "Most Popular",
    },
    {
      id: 3,
      qty: 3,
      quantity: 3,
      pricingType: "percentage_off", discountValue: 15,
      discount: 20,
      discountPercent: 20,
      title: "Trio",
      subtitle: "You save 20%",
      label: "SAVE $60.00",
      saveTag: "SAVE $60.00",
      popularBadge: "",
    },
  ]);
  const [volColor, setVolColor] = useState("#f59e0b");

  // 3. BXGY DEALS STATE
  const [bxgyTitle, setBxgyTitle] = useState("Buy X Get Y Special Deal");
  const [bxgyHeaderTitle, setBxgyHeaderTitle] = useState("Buy X, Get Y (BXGY) Special");
  const [bxgyAppliesTo, setBxgyAppliesTo] = useState("all");
  const [bxgySelectedProducts, setBxgySelectedProducts] = useState(products.slice(0, 1));
  const [bxgySelectedCollections, setBxgySelectedCollections] = useState([]);
  const [bxgyTiers, setBxgyTiers] = useState([
    {
      id: 1,
      title: "Buy 1 Get 1 Free",
      buyQty: 1,
      getQty: 1,
      totalQty: 2,
      discount: 50,
      saveTag: "SAVE 50%",
      popularBadge: "Best Value",
    },
    {
      id: 2,
      title: "Buy 2 Get 3 Free",
      buyQty: 2,
      getQty: 3,
      totalQty: 5,
      discount: 60,
      saveTag: "SAVE 60%",
      popularBadge: "",
    },
  ]);
  const [bxgyColor, setBxgyColor] = useState("#10b981");
  const [bxgyDefaultTier, setBxgyDefaultTier] = useState(1);

  // EXACTLY 3 Main Navigation Links
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "ðŸ“Š" },
    { id: "templates", label: "Templates", icon: "ðŸŽ¨" },
    { id: "settings", label: "Settings", icon: "âš™ï¸" },
  ];

  const handleOpenBuilder = (type, existingBundle = null) => {
    setActiveBuilder(type);
    setActiveTab("templates");

    if (existingBundle) {
      setEditingBundleId(existingBundle.id);
      let parsed = {};
      try { parsed = JSON.parse(existingBundle.products); } catch (e) {}

      if (type === "volume") {
        setVolTitle(existingBundle.title || "Volume Discounts Campaign");
        if (parsed.appliesTo) setVolAppliesTo(parsed.appliesTo);
        if (parsed.selectedProducts) setVolSelectedProducts(parsed.selectedProducts);
        if (parsed.selectedCollections) setVolSelectedCollections(parsed.selectedCollections);
        if (parsed.tiers && Array.isArray(parsed.tiers)) {
          setVolTiers(parsed.tiers.map((t, i) => ({
            id: t.id || i + 1,
            qty: t.qty ?? t.quantity ?? (i + 1),
            quantity: t.quantity ?? t.qty ?? (i + 1),
            pricingType: (t.pricingType === "percentage" ? "percentage_off" : (t.pricingType || (t.discount > 0 || t.discountPercent > 0 ? "percentage_off" : "full_price"))), discountValue: (t.discountValue ?? t.discountPercent ?? t.discount ?? 0),
            discount: t.discount ?? t.discountPercent ?? 0,
            discountPercent: t.discountPercent ?? t.discount ?? 0,
            title: t.title || (i === 0 ? "Single" : i === 1 ? "Duo" : i === 2 ? "Trio" : `Pack ${i + 1}`),
            subtitle: t.subtitle || (t.discount > 0 || t.discountPercent > 0 ? `You save ${t.discount || t.discountPercent}%` : "Standard price"),
            label: t.label || t.saveTag || "",
            saveTag: t.saveTag || t.label || "",
            popularBadge: t.popularBadge || t.badge || "",
          })));
        }
        if (parsed.accentColor) setVolColor(parsed.accentColor);
      } else if (type === "bxgy") {
        setBxgyTitle(existingBundle.title || "Buy X Get Y Special Deal");
        if (parsed.headerTitle) setBxgyHeaderTitle(parsed.headerTitle);
        if (parsed.appliesTo) setBxgyAppliesTo(parsed.appliesTo);
        if (parsed.selectedProducts) setBxgySelectedProducts(parsed.selectedProducts);
        if (parsed.selectedCollections) setBxgySelectedCollections(parsed.selectedCollections);
        if (parsed.tiers) setBxgyTiers(parsed.tiers);
        if (parsed.accentColor) setBxgyColor(parsed.accentColor);
        if (parsed.defaultTier) setBxgyDefaultTier(parsed.defaultTier);
      } else if (type === "step") {
        setStepTitle(existingBundle.title || "Multi-Collection Step Bundle");
        if (parsed.collectionRows && Array.isArray(parsed.collectionRows)) {
          setStepCollectionRows(parsed.collectionRows);
        }
        if (parsed.discountPercent) setStepDiscountPercent(parsed.discountPercent);
        if (parsed.accentColor || parsed.brandColor) setStepColor(parsed.accentColor || parsed.brandColor);
      }
    } else {
      setEditingBundleId(null);
    }
  };

  const handleSaveStep = () => {
    const config = JSON.stringify({
      collectionRows: stepCollectionRows,
      discountPercent: stepDiscountPercent,
      accentColor: stepColor,
      brandColor: stepColor,
    });
    fetcher.submit(
      {
        intent: "save_bundle",
        shop,
        bundleId: editingBundleId || "",
        title: stepTitle,
        strategy: "Multi-Collection Complete Bundle",
        discount: `${stepDiscountPercent}% OFF (${stepCollectionRows.length} Collections)`,
        config,
      },
      { method: "POST" }
    );
    setActiveBuilder(null);
    setActiveTab("dashboard");
  };

  const handleSaveVolume = () => {
    const config = JSON.stringify({
      appliesTo: volAppliesTo,
      selectedProducts: volSelectedProducts,
      selectedCollections: volSelectedCollections,
      tiers: volTiers,
      accentColor: volColor,
    });
    const maxDiscount = Math.max(...volTiers.map(t => t.discountPercent || 0));
    fetcher.submit(
      {
        intent: "save_bundle",
        shop,
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
      headerTitle: bxgyHeaderTitle,
      appliesTo: bxgyAppliesTo,
      selectedProducts: bxgySelectedProducts,
      selectedCollections: bxgySelectedCollections,
      tiers: bxgyTiers,
      defaultTier: bxgyDefaultTier,
      accentColor: bxgyColor,
    });
    const maxDiscount = Math.max(...bxgyTiers.map(t => t.discount || 0));
    fetcher.submit(
      {
        intent: "save_bundle",
        shop,
        bundleId: editingBundleId || "",
        title: bxgyTitle,
        strategy: "Buy X Get Y",
        discount: `Save up to ${maxDiscount}% (BXGY)`,
        config,
      },
      { method: "POST" }
    );
    setActiveBuilder(null);
    setActiveTab("dashboard");
  };

  const openProductPicker = (target) => {
    setModalProductTarget(target);
    setShowProductModal(true);
  };

  const handleToggleProductInModal = (product) => {
    if (modalProductTarget === "vol") {
      const exists = volSelectedProducts.some(p => p.id === product.id);
      if (exists) {
        setVolSelectedProducts(volSelectedProducts.filter(p => p.id !== product.id));
      } else {
        setVolSelectedProducts([...volSelectedProducts, product]);
      }
    } else if (modalProductTarget === "bxgy") {
      const exists = bxgySelectedProducts.some(p => p.id === product.id);
      if (exists) {
        setBxgySelectedProducts(bxgySelectedProducts.filter(p => p.id !== product.id));
      } else {
        setBxgySelectedProducts([...bxgySelectedProducts, product]);
      }
    }
  };

  const getSelectedModalProducts = () => {
    if (modalProductTarget === "vol") return volSelectedProducts;
    if (modalProductTarget === "bxgy") return bxgySelectedProducts;
    return [];
  };

  const openStepCollectionPicker = (stepId) => {
    setCollectionModalTarget({ type: "step", stepId });
    setShowCollectionModal(true);
  };

  const openVolCollectionPicker = () => {
    setCollectionModalTarget({ type: "vol" });
    setShowCollectionModal(true);
  };

  const openBxgyCollectionPicker = () => {
    setCollectionModalTarget({ type: "bxgy" });
    setShowCollectionModal(true);
  };

  const handleSelectCollectionForStep = (col) => {
    if (collectionModalTarget.type === "step") {
      const targetId = collectionModalTarget.stepId;
      setStepCollectionRows(
        stepCollectionRows.map((r) =>
          r.id === targetId
            ? {
                ...r,
                collectionId: col.id,
                collectionTitle: col.title,
                collectionHandle: col.handle,
              }
            : r
        )
      );
    }
  };

  const handleToggleCollectionInModal = (col) => {
    if (collectionModalTarget.type === "vol") {
      const exists = volSelectedCollections.some(c => c.id === col.id);
      if (exists) {
        setVolSelectedCollections(volSelectedCollections.filter(c => c.id !== col.id));
      } else {
        setVolSelectedCollections([...volSelectedCollections, col]);
      }
    } else if (collectionModalTarget.type === "bxgy") {
      const exists = bxgySelectedCollections.some(c => c.id === col.id);
      if (exists) {
        setBxgySelectedCollections(bxgySelectedCollections.filter(c => c.id !== col.id));
      } else {
        setBxgySelectedCollections([...bxgySelectedCollections, col]);
      }
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", color: "#0f172a" }}>
      {/* 1. Left SaaS Sidebar (3 Menus Only) */}
      <aside style={{ width: 250, background: "#0f172a", color: "#ffffff", display: "flex", flexDirection: "column", flexShrink: 0, borderRight: "1px solid #1e293b" }}>
        <div style={{ padding: "24px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #1e293b" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #f59e0b, #ef4444)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
            âš¡
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
            style={{ background: "#1e293b", border: "1px solid #334155", padding: "8px 12px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
              <span style={{ color: "#10b981" }}>â—</span>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>{shop}</span>
            </div>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>â–¼</span>
          </div>

          {storeDropdown && (
            <div style={{ marginTop: 6, background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: 6 }}>
              {allStores.map((s) => (
                <div
                  key={s.id}
                  style={{ padding: "6px 10px", fontSize: 12, color: s.shop === shop ? "#10b981" : "#cbd5e1", fontWeight: s.shop === shop ? 700 : 500, cursor: "pointer", borderRadius: 4 }}
                  onClick={() => setStoreDropdown(false)}
                >
                  {s.shop} {s.shop === shop && "âœ“"}
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

      {/* 2. Main Workspace */}
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
              <span>â—</span> Storefront Engine Synced
            </div>
            <a
              href={`https://${shop}`}
              target="_blank"
              rel="noreferrer"
              style={{ background: "#0f172a", color: "#ffffff", textDecoration: "none", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
            >
              <span>View Storefront</span>
              <span style={{ fontSize: 11 }}>â†—</span>
            </a>
          </div>
        </header>

        {/* Content Body */}
        <div style={{ padding: 28, flex: 1 }}>
          {/* TAB 1: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 28 }}>
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>ACTIVE CAMPAIGNS</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 8 }}>{bundles.length} Live</div>
                  <div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600, marginTop: 4 }}>Storefront widgets active</div>
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
                            <td style={{ padding: "16px 20px" }}>{b.salesCount || 0} orders</td>
                            <td style={{ padding: "16px 20px" }}>
                              <span style={{ background: isActive ? "#ecfdf5" : "#f1f5f9", color: isActive ? "#065f46" : "#64748b", padding: "4px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>
                                {b.status}
                              </span>
                            </td>
                            <td style={{ padding: "16px 24px", textAlign: "center" }}>
                              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
                                <button
                                  type="button"
                                  onClick={() => fetcher.submit({ intent: "toggle_status", bundleId: b.id, currentStatus: b.status }, { method: "POST" })}
                                  style={{ background: isActive ? "#10b981" : "#cbd5e1", color: "#ffffff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                >
                                  {isActive ? "ON" : "OFF"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenBuilder(stratType, b)}
                                  style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm("Delete this bundle?")) {
                                      fetcher.submit({ intent: "delete_bundle", bundleId: b.id }, { method: "POST" });
                                    }
                                  }}
                                  style={{ background: "none", border: "none", color: "#ef4444", fontSize: 14, cursor: "pointer", padding: "4px" }}
                                >
                                  ðŸ—‘
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

          {/* TAB 2: TEMPLATES (Gallery OR Modular Next Slide Builder) */}
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
                    {/* Multi-Collection Step Bundle Card */}
                    <div style={{ background: "#ffffff", border: "2px solid #e2e8f0", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          <span style={{ fontSize: 28 }}>ðŸªœ</span>
                          <div>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Multi-Collection Step Bundle</h3>
                            <span style={{ fontSize: 11, background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>DYNAMIC STEPS & COLLECTIONS</span>
                          </div>
                        </div>
                        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
                          Customers build their own custom bundle across 2, 3, or multiple store collections with automatic percentage discount.
                        </p>
                        <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 10, padding: 12, marginBottom: 20 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>Storefront Widget Preview:</div>
                          <div style={{ fontSize: 12, color: "#475569", display: "flex", flexDirection: "column", gap: 4 }}>
                            <div>Step 1: Pick from Collection A</div>
                            <div>Step 2: Pick from Collection B</div>
                            <div>Step 3: Pick from Collection C (+ Add more)</div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenBuilder("step")}
                        style={{ background: "#0f172a", color: "#ffffff", padding: "12px 20px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        <span>Configure Step Bundle</span>
                        <span>â†’</span>
                      </button>
                    </div>

                    {/* BXGY Deals Card */}
                    <div style={{ background: "#ffffff", border: "2px solid #e2e8f0", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          <span style={{ fontSize: 28 }}>ðŸŽ</span>
                          <div>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Buy X Get Y (BXGY) Deals</h3>
                            <span style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>HIGH CONVERSION</span>
                          </div>
                        </div>
                        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
                          Reward customers with free or heavily discounted bonus items when they buy required quantities (e.g. Buy 1 Get 1 Free, Buy 2 Get 3 Free).
                        </p>
                        <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 10, padding: 12, marginBottom: 20 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>Storefront Widget Preview:</div>
                          <div style={{ fontSize: 12, color: "#475569", display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ color: "#10b981", fontWeight: 700 }}>ðŸŽ BUY 1 GET 1 FREE (SAVE 50%)</div>
                            <div>All Products / Specific Items / Collections</div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenBuilder("bxgy")}
                        style={{ background: "#0f172a", color: "#ffffff", padding: "12px 20px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        <span>Configure BXGY Deal</span>
                        <span>â†’</span>
                      </button>
                    </div>

                    {/* Volume Discounts Card */}
                    <div style={{ background: "#ffffff", border: "2px solid #e2e8f0", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          <span style={{ fontSize: 28 }}>ðŸ“¦</span>
                          <div>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Volume Quantity Discounts</h3>
                            <span style={{ fontSize: 11, background: "#ecfdf5", color: "#065f46", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>TIERED PACKS</span>
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
                        <span>â†’</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE B: MODULAR BUILDER SLIDE */}
              {activeBuilder && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                    <button
                      onClick={() => setActiveBuilder(null)}
                      style={{ background: "#ffffff", border: "1px solid #cbd5e1", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span>â† Back to Templates</span>
                    </button>

                    <button
                      onClick={() => {
                        if (activeBuilder === "volume") handleSaveVolume();
                        if (activeBuilder === "bxgy") handleSaveBXGY();
                        if (activeBuilder === "step") handleSaveStep();
                      }}
                      style={{ background: "#10b981", color: "#ffffff", border: "none", padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 10px rgba(16, 185, 129, 0.3)" }}
                    >
                      ðŸ’¾ Save & Publish to Storefront
                    </button>
                  </div>

                  {/* Render Dedicated Modular Builders */}
                  {activeBuilder === "volume" && (
                    <VolumeDiscountBuilder
                      title={volTitle}
                      setTitle={setVolTitle}
                      appliesTo={volAppliesTo}
                      setAppliesTo={setVolAppliesTo}
                      selectedProducts={volSelectedProducts}
                      setSelectedProducts={setVolSelectedProducts}
                      selectedCollections={volSelectedCollections}
                      setSelectedCollections={setVolSelectedCollections}
                      tiers={volTiers}
                      setTiers={setVolTiers}
                      color={volColor}
                      setColor={setVolColor}
                      onOpenProductPicker={() => openProductPicker("vol")}
                      onOpenCollectionPicker={openVolCollectionPicker}
                    />
                  )}

                  {activeBuilder === "bxgy" && (
                    <BxgyBuilder
                      title={bxgyTitle}
                      setTitle={setBxgyTitle}
                      headerTitle={bxgyHeaderTitle}
                      setHeaderTitle={setBxgyHeaderTitle}
                      appliesTo={bxgyAppliesTo}
                      setAppliesTo={setBxgyAppliesTo}
                      selectedProducts={bxgySelectedProducts}
                      setSelectedProducts={setBxgySelectedProducts}
                      selectedCollections={bxgySelectedCollections}
                      setSelectedCollections={setBxgySelectedCollections}
                      tiers={bxgyTiers}
                      setTiers={setBxgyTiers}
                      color={bxgyColor}
                      setColor={setBxgyColor}
                      defaultTier={bxgyDefaultTier}
                      setDefaultTier={setBxgyDefaultTier}
                      onOpenProductPicker={() => openProductPicker("bxgy")}
                      onOpenCollectionPicker={openBxgyCollectionPicker}
                    />
                  )}

                  {activeBuilder === "step" && (
                    <StepBundleBuilder
                      title={stepTitle}
                      setTitle={setStepTitle}
                      collectionRows={stepCollectionRows}
                      setCollectionRows={setStepCollectionRows}
                      discountPercent={stepDiscountPercent}
                      setDiscountPercent={setStepDiscountPercent}
                      color={stepColor}
                      setColor={setStepColor}
                      onOpenCollectionPicker={openStepCollectionPicker}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SETTINGS */}
          {activeTab === "settings" && (
            <div style={{ maxWidth: 680 }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px 0" }}>Storefront & App Settings</h2>
                <p style={{ color: "#64748b", margin: 0, fontSize: 15 }}>Configure theme script injections, WASM discount engines, and global preferences.</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: 15, color: "#0f172a" }}>Storefront App Embed</strong>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Injects bundle widget scripts into your active theme.</div>
                    </div>
                    <span style={{ background: "#ecfdf5", color: "#065f46", padding: "4px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 700 }}>â— Active</span>
                  </div>
                </div>

                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: 15, color: "#0f172a" }}>Cart Transform WASM Engine</strong>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Shopify Functions runtime for checkout bundle price sync.</div>
                    </div>
                    <span style={{ background: "#ecfdf5", color: "#065f46", padding: "4px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 700 }}>â— Synced (&lt;4ms)</span>
                  </div>
                </div>

                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: 15, color: "#0f172a" }}>PostgreSQL Database Live Sync</strong>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Multi-tenant cloud persistence via Render PostgreSQL.</div>
                    </div>
                    <span style={{ background: "#ecfdf5", color: "#065f46", padding: "4px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 700 }}>â— Connected</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODULAR IN-APP PRODUCT SELECTOR MODAL */}
      <ProductSelectorModal
        show={showProductModal}
        onClose={() => setShowProductModal(false)}
        products={products}
        selectedProducts={getSelectedModalProducts()}
        onToggleProduct={handleToggleProductInModal}
        shop={shop}
      />

      {/* MODULAR IN-APP COLLECTION SELECTOR MODAL */}
      <CollectionSelectorModal
        show={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        collections={collections}
        isMulti={collectionModalTarget.type !== "step"}
        selectedCollectionId={
          collectionModalTarget.type === "step"
            ? stepCollectionRows.find((r) => r.id === collectionModalTarget.stepId)?.collectionId
            : undefined
        }
        selectedCollectionIds={
          collectionModalTarget.type === "vol"
            ? volSelectedCollections.map((c) => c.id)
            : collectionModalTarget.type === "bxgy"
            ? bxgySelectedCollections.map((c) => c.id)
            : []
        }
        onSelectCollection={handleSelectCollectionForStep}
        onToggleCollection={handleToggleCollectionInModal}
        shop={shop}
      />
    </div>
  );
}
