import { useState } from "react";
import { useLoaderData, useSearchParams, useNavigate, useSubmit, Link } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// ১. Loader: এডিট মোড হলে ডাটা লোড করবে এবং স্টোরের প্রোডাক্ট ও কালেকশন ফেচ করবে
export const loader = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const url = new URL(request.url);
    const editId = url.searchParams.get("id");

    let existingBundle = null;
    if (editId) {
        existingBundle = await db.bundle.findUnique({
            where: { id: editId },
        });
    }

    // Collections query
    let storeCollections = [];
    try {
        const colRes = await admin.graphql(
            `#graphql
            query getCollections {
                collections(first: 50) {
                    edges {
                        node {
                            id
                            title
                            handle
                            productsCount {
                                count
                            }
                        }
                    }
                }
            }`
        );
        const colJson = await colRes.json();
        storeCollections = colJson.data?.collections?.edges?.map((e) => ({
            id: e.node.id,
            title: e.node.title,
            handle: e.node.handle,
            count: e.node.productsCount?.count || 0,
        })) || [];
    } catch (e) {
        console.error("Collections fetch error:", e);
    }

    // Products query
    let storeProducts = [];
    try {
        const prodRes = await admin.graphql(
            `#graphql
            query getProducts {
                products(first: 50) {
                    edges {
                        node {
                            id
                            title
                            featuredImage {
                                url
                            }
                            variants(first: 1) {
                                edges {
                                    node {
                                        price
                                    }
                                }
                            }
                        }
                    }
                }
            }`
        );
        const prodJson = await prodRes.json();
        storeProducts = prodJson.data?.products?.edges?.map((e) => ({
            id: e.node.id,
            title: e.node.title,
            imageUrl: e.node.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
            price: parseFloat(e.node.variants?.edges[0]?.node?.price || "100.00"),
        })) || [];
    } catch (e) {
        console.error("Products fetch error:", e);
    }

    return { existingBundle, storeProducts, storeCollections };
};

// ২. Action: ডাটাবেসে সেভ করবে এবং শপিফাই মেটাফিল্ডে টার্গেটিং সহ পাবলিশ করবে
export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const bundleId = formData.get("bundleId");
    const title = formData.get("title") || "Volume Discounts";
    const strategy = "Volume Discounts";
    const discountSummary = formData.get("discountSummary") || "Up to 15% OFF";
    const configRaw = formData.get("config");

    let parsedConfig = {};
    try {
        parsedConfig = JSON.parse(configRaw);
    } catch (e) {
        parsedConfig = {};
    }

    let savedBundle = null;
    if (bundleId) {
        savedBundle = await db.bundle.update({
            where: { id: bundleId },
            data: {
                title,
                discount: discountSummary,
                products: configRaw,
                strategy,
            },
        });
    } else {
        savedBundle = await db.bundle.create({
            data: {
                title,
                strategy,
                discount: discountSummary,
                products: configRaw,
                status: "Active",
            },
        });
    }

    // Clean numeric IDs for Liquid check
    const cleanProductIds = (parsedConfig.selectedProducts || []).map((p) => {
        const parts = String(p.id).split("/");
        return parts[parts.length - 1];
    });

    const cleanCollectionIds = (parsedConfig.selectedCollections || []).map((c) => {
        const parts = String(c.id).split("/");
        return parts[parts.length - 1];
    });

    // Shopify App Metafield-এ সেভ করা যাতে স্টোরফ্রন্ট উইজেট লাইভ দেখতে পায়
    try {
        const shopRes = await admin.graphql(`query { shop { id } }`);
        const shopJson = await shopRes.json();
        const shopId = shopJson.data?.shop?.id;

        if (shopId) {
            await admin.graphql(
                `#graphql
                mutation setVolumeDiscountMetafield($metafields: [MetafieldsSetInput!]!) {
                    metafieldsSet(metafields: $metafields) {
                        userErrors {
                            field
                            message
                        }
                    }
                }`,
                {
                    variables: {
                        metafields: [
                            {
                                ownerId: shopId,
                                namespace: "$app:smart_bundles",
                                key: "active_volume_discount",
                                type: "json",
                                value: JSON.stringify({
                                    id: savedBundle.id,
                                    title: savedBundle.title,
                                    headerTitle: parsedConfig.headerTitle || "",
                                    headerSubtitle: parsedConfig.headerSubtitle || "",
                                    buttonText: parsedConfig.buttonText || "Choose",
                                    accentColor: parsedConfig.accentColor || "#f59e0b",
                                    defaultTier: parsedConfig.defaultTier || 2,
                                    tiers: parsedConfig.tiers || [],
                                    appliesTo: parsedConfig.appliesTo || "all",
                                    selectedProductIds: cleanProductIds,
                                    selectedCollectionIds: cleanCollectionIds,
                                    selectedProductsInfo: parsedConfig.selectedProducts || [],
                                    selectedCollectionsInfo: parsedConfig.selectedCollections || [],
                                    active: true,
                                    updatedAt: new Date().toISOString(),
                                }),
                            },
                        ],
                    },
                }
            );
        }
    } catch (err) {
        console.error("Volume discount metafield sync error:", err);
    }

    return new Response(null, {
        status: 302,
        headers: { Location: "/app" },
    });
};

export default function VolumeDiscountBuilder() {
    const { existingBundle, storeProducts, storeCollections } = useLoaderData();
    const [searchParams] = useSearchParams();
    const submit = useSubmit();
    const navigate = useNavigate();

    const brandColorParam = searchParams.get("color") || "#f59e0b";

    // Initial state parse from existing bundle
    let parsedInitial = null;
    if (existingBundle?.products) {
        try {
            parsedInitial = JSON.parse(existingBundle.products);
        } catch (e) {}
    }

    const [title, setTitle] = useState(existingBundle?.title || "Volume Discounts");
    const [headerTitle, setHeaderTitle] = useState(parsedInitial?.headerTitle || "");
    const [accentColor, setAccentColor] = useState(parsedInitial?.accentColor || brandColorParam);
    const [defaultTier, setDefaultTier] = useState(parsedInitial?.defaultTier || 2);
    const [buttonText, setButtonText] = useState(parsedInitial?.buttonText || "Choose");

    // Product Targeting State (All products / Selected products / Selected collections)
    const [appliesTo, setAppliesTo] = useState(parsedInitial?.appliesTo || "all");
    const [selectedProducts, setSelectedProducts] = useState(parsedInitial?.selectedProducts || []);
    const [selectedCollections, setSelectedCollections] = useState(parsedInitial?.selectedCollections || []);

    // Fallback Picker Modals state (in case App Bridge resourcePicker is offline)
    const [showProductModal, setShowProductModal] = useState(false);
    const [showCollectionModal, setShowCollectionModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Interactive preview selected tier state
    const [previewSelectedTier, setPreviewSelectedTier] = useState(defaultTier);

    // Initial Tiers matching the exact reference image
    const [tiers, setTiers] = useState(
        parsedInitial?.tiers || [
            {
                id: 1,
                qty: 1,
                title: "Single",
                subtitle: "Standard price",
                discount: 0,
                saveTag: "",
                popularBadge: "",
            },
            {
                id: 2,
                qty: 2,
                title: "Duo",
                subtitle: "You save 15%",
                discount: 15,
                saveTag: "SAVE $30.00",
                popularBadge: "Most Popular",
            },
            {
                id: 3,
                qty: 3,
                title: "Trio",
                subtitle: "You save 20%",
                discount: 20,
                saveTag: "SAVE $60.00",
                popularBadge: "",
            },
        ]
    );

    // Update single tier
    const handleTierChange = (index, field, value) => {
        const next = [...tiers];
        next[index] = { ...next[index], [field]: value };
        setTiers(next);
    };

    // Add new tier
    const handleAddTier = () => {
        const nextQty = tiers.length > 0 ? tiers[tiers.length - 1].qty + 1 : 1;
        const nextDiscount = tiers.length > 0 ? Math.min(tiers[tiers.length - 1].discount + 5, 50) : 10;
        setTiers([
            ...tiers,
            {
                id: Date.now(),
                qty: nextQty,
                title: `Pack ${nextQty}`,
                subtitle: `You save ${nextDiscount}%`,
                discount: nextDiscount,
                saveTag: `SAVE ${nextDiscount}%`,
                popularBadge: "",
            },
        ]);
    };

    // Delete tier
    const handleDeleteTier = (index) => {
        if (tiers.length <= 1) {
            alert("At least 1 tier is required.");
            return;
        }
        const next = tiers.filter((_, i) => i !== index);
        setTiers(next);
        if (defaultTier > next.length) {
            setDefaultTier(next.length);
            setPreviewSelectedTier(next.length);
        }
    };

    // Open Product Picker (Native App Bridge with Fallback)
    const handleOpenProductPicker = async () => {
        if (typeof window !== "undefined" && window.shopify?.resourcePicker) {
            try {
                const selected = await window.shopify.resourcePicker({
                    type: "product",
                    multiple: true,
                    selectionIds: selectedProducts.map((p) => ({ id: p.id })),
                });
                if (selected && selected.length > 0) {
                    const mapped = selected.map((p) => ({
                        id: p.id,
                        title: p.title,
                        imageUrl: p.images?.[0]?.originalSrc || p.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
                        price: parseFloat(p.variants?.[0]?.price || "100.00"),
                    }));
                    setSelectedProducts(mapped);
                    return;
                }
            } catch (err) {
                console.log("App Bridge resourcePicker fallback to modal:", err);
            }
        }
        setShowProductModal(true);
    };

    // Open Collection Picker (Native App Bridge with Fallback)
    const handleOpenCollectionPicker = async () => {
        if (typeof window !== "undefined" && window.shopify?.resourcePicker) {
            try {
                const selected = await window.shopify.resourcePicker({
                    type: "collection",
                    multiple: true,
                    selectionIds: selectedCollections.map((c) => ({ id: c.id })),
                });
                if (selected && selected.length > 0) {
                    const mapped = selected.map((c) => ({
                        id: c.id,
                        title: c.title,
                        handle: c.handle,
                        count: c.productsCount?.count || 0,
                    }));
                    setSelectedCollections(mapped);
                    return;
                }
            } catch (err) {
                console.log("App Bridge resourcePicker fallback to modal:", err);
            }
        }
        setShowCollectionModal(true);
    };

    // Remove single product
    const handleRemoveProduct = (productId) => {
        setSelectedProducts(selectedProducts.filter((p) => p.id !== productId));
    };

    // Remove single collection
    const handleRemoveCollection = (collectionId) => {
        setSelectedCollections(selectedCollections.filter((c) => c.id !== collectionId));
    };

    // Publish / Save
    const handlePublish = () => {
        if (!title.trim()) {
            alert("Please enter a bundle title");
            return;
        }

        if (appliesTo === "products" && selectedProducts.length === 0) {
            alert("Please select at least 1 product, or choose 'All products'.");
            return;
        }

        if (appliesTo === "collections" && selectedCollections.length === 0) {
            alert("Please select at least 1 collection, or choose 'All products'.");
            return;
        }

        const maxDisc = Math.max(...tiers.map((t) => Number(t.discount) || 0));
        const discountSummary = maxDisc > 0 ? `Up to ${maxDisc}% OFF` : "Volume Pricing";

        const config = {
            headerTitle,
            buttonText,
            accentColor,
            defaultTier: Number(defaultTier),
            tiers,
            appliesTo,
            selectedProducts,
            selectedCollections,
        };

        const formData = new FormData();
        if (existingBundle?.id) {
            formData.append("bundleId", existingBundle.id);
        }
        formData.append("title", title);
        formData.append("discountSummary", discountSummary);
        formData.append("config", JSON.stringify(config));

        submit(formData, { method: "POST" });
    };

    // Sample price for preview calculation (dynamically uses 1st selected product's price if chosen)
    const previewProduct = selectedProducts.length > 0 ? selectedProducts[0] : null;
    const sampleItemPrice = previewProduct?.price || 100.0;
    const previewItemTitle = previewProduct?.title || "Demo Product";

    return (
        <s-page heading="Volume Discounts Customizer">
            <s-link slot="breadcrumb" href="/app/templates">Back to Templates</s-link>

            {/* Header Action Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <p style={{ margin: 0, color: "#4b5563", fontSize: "14px" }}>
                    Configure products, discounts, and visual styling. Real-time changes update in the preview!
                </p>
                <div style={{ display: "flex", gap: "10px" }}>
                    <button
                        type="button"
                        onClick={() => navigate("/app")}
                        style={{
                            padding: "9px 18px",
                            backgroundColor: "#fff",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            fontWeight: "600",
                            cursor: "pointer",
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handlePublish}
                        style={{
                            padding: "9px 24px",
                            backgroundColor: "#008060",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: "bold",
                            cursor: "pointer",
                            boxShadow: "0 2px 4px rgba(0, 128, 96, 0.2)",
                        }}
                    >
                        {existingBundle ? "Update & Publish 🚀" : "Publish to Store 🚀"}
                    </button>
                </div>
            </div>

            {/* 2-Column Layout: Controls & Live Preview */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px", alignItems: "start" }}>

                {/* বাম পাশ: সেটিংস */}
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                    {/* ১. Products Targeting Section (আপনার ছবির হুবহু ৩টি রেডিও অপশন) */}
                    <div style={{ backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb", padding: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                            <span style={{ fontSize: "18px" }}>🏷️</span>
                            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#111827" }}>
                                Products
                            </h3>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
                            {/* Option 1: All products */}
                            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px", fontWeight: appliesTo === "all" ? "600" : "400" }}>
                                <input
                                    type="radio"
                                    name="appliesTo"
                                    checked={appliesTo === "all"}
                                    onChange={() => setAppliesTo("all")}
                                    style={{ width: "16px", height: "16px", accentColor: "#111827", cursor: "pointer" }}
                                />
                                All products
                            </label>

                            {/* Option 2: Selected products */}
                            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px", fontWeight: appliesTo === "products" ? "600" : "400" }}>
                                <input
                                    type="radio"
                                    name="appliesTo"
                                    checked={appliesTo === "products"}
                                    onChange={() => setAppliesTo("products")}
                                    style={{ width: "16px", height: "16px", accentColor: "#111827", cursor: "pointer" }}
                                />
                                Selected products
                            </label>

                            {/* Option 3: Selected collections */}
                            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px", fontWeight: appliesTo === "collections" ? "600" : "400" }}>
                                <input
                                    type="radio"
                                    name="appliesTo"
                                    checked={appliesTo === "collections"}
                                    onChange={() => setAppliesTo("collections")}
                                    style={{ width: "16px", height: "16px", accentColor: "#111827", cursor: "pointer" }}
                                />
                                Selected collections
                            </label>
                        </div>

                        {/* Selected Products Picker Sub-panel */}
                        {appliesTo === "products" && (
                            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "14px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
                                        Products ({selectedProducts.length} selected)
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleOpenProductPicker}
                                        style={{
                                            padding: "6px 14px",
                                            backgroundColor: "#f3f4f6",
                                            border: "1px solid #d1d5db",
                                            borderRadius: "6px",
                                            fontSize: "13px",
                                            fontWeight: "600",
                                            cursor: "pointer",
                                        }}
                                    >
                                        🔍 Browse Products
                                    </button>
                                </div>

                                {selectedProducts.length === 0 ? (
                                    <div style={{ padding: "16px", textAlign: "center", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px dashed #d1d5db", color: "#6b7280", fontSize: "13px" }}>
                                        No products selected. Click <strong>Browse Products</strong> to pick products.
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto" }}>
                                        {selectedProducts.map((p) => (
                                            <div
                                                key={p.id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    padding: "8px 12px",
                                                    backgroundColor: "#f9fafb",
                                                    border: "1px solid #e5e7eb",
                                                    borderRadius: "8px",
                                                }}
                                            >
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                    {p.imageUrl && (
                                                        <img
                                                            src={p.imageUrl}
                                                            alt={p.title}
                                                            style={{ width: "32px", height: "32px", borderRadius: "4px", objectFit: "cover", border: "1px solid #e5e7eb" }}
                                                        />
                                                    )}
                                                    <div>
                                                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>{p.title}</div>
                                                        <div style={{ fontSize: "11px", color: "#6b7280" }}>${p.price.toFixed(2)}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveProduct(p.id)}
                                                    style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: "14px", padding: "4px" }}
                                                    title="Remove product"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Selected Collections Picker Sub-panel */}
                        {appliesTo === "collections" && (
                            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "14px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
                                        Collections ({selectedCollections.length} selected)
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleOpenCollectionPicker}
                                        style={{
                                            padding: "6px 14px",
                                            backgroundColor: "#f3f4f6",
                                            border: "1px solid #d1d5db",
                                            borderRadius: "6px",
                                            fontSize: "13px",
                                            fontWeight: "600",
                                            cursor: "pointer",
                                        }}
                                    >
                                        📁 Browse Collections
                                    </button>
                                </div>

                                {selectedCollections.length === 0 ? (
                                    <div style={{ padding: "16px", textAlign: "center", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px dashed #d1d5db", color: "#6b7280", fontSize: "13px" }}>
                                        No collections selected. Click <strong>Browse Collections</strong> to pick collections.
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto" }}>
                                        {selectedCollections.map((c) => (
                                            <div
                                                key={c.id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    padding: "8px 12px",
                                                    backgroundColor: "#f9fafb",
                                                    border: "1px solid #e5e7eb",
                                                    borderRadius: "8px",
                                                }}
                                            >
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                    <span style={{ fontSize: "16px" }}>📁</span>
                                                    <div>
                                                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>{c.title}</div>
                                                        <div style={{ fontSize: "11px", color: "#6b7280" }}>{c.count} products</div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveCollection(c.id)}
                                                    style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: "14px", padding: "4px" }}
                                                    title="Remove collection"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* General Settings */}
                    <div style={{ backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb", padding: "20px" }}>
                        <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700" }}>General Settings</h3>

                        <div style={{ marginBottom: "14px" }}>
                            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                                Bundle Name (for dashboard)
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px" }}
                                placeholder="e.g. Volume Discounts - Tiered Pack"
                            />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                                    Widget Title (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={headerTitle}
                                    onChange={(e) => setHeaderTitle(e.target.value)}
                                    placeholder="e.g. Select Quantity & Save"
                                    style={{ width: "100%", padding: "9px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                                    Accent / Highlight Color
                                </label>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <input
                                        type="color"
                                        value={accentColor}
                                        onChange={(e) => setAccentColor(e.target.value)}
                                        style={{ width: "40px", height: "38px", border: "none", borderRadius: "6px", cursor: "pointer", padding: 0 }}
                                    />
                                    <span style={{ fontSize: "13px", color: "#6b7280" }}>{accentColor}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tiers Settings */}
                    <div style={{ backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb", padding: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>Discount Tiers (Exact Layout)</h3>
                            <button
                                type="button"
                                onClick={handleAddTier}
                                style={{
                                    padding: "6px 14px",
                                    backgroundColor: "#f3f4f6",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "6px",
                                    fontSize: "13px",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                }}
                            >
                                + Add Tier
                            </button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {tiers.map((t, idx) => (
                                <div
                                    key={t.id || idx}
                                    style={{
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "10px",
                                        padding: "16px",
                                        backgroundColor: "#f9fafb",
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <span style={{ fontWeight: "700", fontSize: "14px", color: "#111827" }}>
                                                Tier {idx + 1}
                                            </span>
                                            <label style={{ fontSize: "12px", color: "#4b5563", display: "flex", alignItems: "center", gap: "4px", marginLeft: "8px", cursor: "pointer" }}>
                                                <input
                                                    type="radio"
                                                    name="default_tier_select"
                                                    checked={Number(defaultTier) === idx + 1}
                                                    onChange={() => {
                                                        setDefaultTier(idx + 1);
                                                        setPreviewSelectedTier(idx + 1);
                                                    }}
                                                />
                                                Default Selected
                                            </label>
                                        </div>
                                        {tiers.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteTier(idx)}
                                                style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: "13px" }}
                                            >
                                                ✕ Remove
                                            </button>
                                        )}
                                    </div>

                                    {/* Inputs Grid */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                                        <div>
                                            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#6b7280", marginBottom: "4px" }}>
                                                Title (e.g. Single, Duo)
                                            </label>
                                            <input
                                                type="text"
                                                value={t.title}
                                                onChange={(e) => handleTierChange(idx, "title", e.target.value)}
                                                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#6b7280", marginBottom: "4px" }}>
                                                Quantity
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={t.qty}
                                                onChange={(e) => handleTierChange(idx, "qty", parseInt(e.target.value, 10) || 1)}
                                                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#6b7280", marginBottom: "4px" }}>
                                                Discount %
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={t.discount}
                                                onChange={(e) => {
                                                    const disc = parseInt(e.target.value, 10) || 0;
                                                    handleTierChange(idx, "discount", disc);
                                                    if (disc > 0 && !t.subtitle) {
                                                        handleTierChange(idx, "subtitle", `You save ${disc}%`);
                                                    }
                                                }}
                                                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "10px" }}>
                                        <div>
                                            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#6b7280", marginBottom: "4px" }}>
                                                Subtitle (e.g. Standard price, You save 15%)
                                            </label>
                                            <input
                                                type="text"
                                                value={t.subtitle}
                                                onChange={(e) => handleTierChange(idx, "subtitle", e.target.value)}
                                                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#6b7280", marginBottom: "4px" }}>
                                                Save Tag Pill (e.g. SAVE $30.00)
                                            </label>
                                            <input
                                                type="text"
                                                value={t.saveTag}
                                                onChange={(e) => handleTierChange(idx, "saveTag", e.target.value)}
                                                placeholder="e.g. SAVE $30.00"
                                                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#6b7280", marginBottom: "4px" }}>
                                                Corner Badge (e.g. Most Popular)
                                            </label>
                                            <input
                                                type="text"
                                                value={t.popularBadge}
                                                onChange={(e) => handleTierChange(idx, "popularBadge", e.target.value)}
                                                placeholder="e.g. Most Popular"
                                                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
                                            />
                                        </div>
                                    </div>

                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* ডান পাশ: লাইভ প্রিভিউ (হুবহু ইমেজ ডিজাইন) */}
                <div style={{ position: "sticky", top: "20px" }}>
                    <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "700", fontSize: "14px", color: "#1f2937" }}>
                            Live Storefront Preview
                        </span>
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>
                            {previewProduct ? `Preview: ${previewItemTitle}` : "Based on sample $100 item"}
                        </span>
                    </div>

                    <div
                        style={{
                            background: "#ffffff",
                            padding: "24px 20px",
                            borderRadius: "16px",
                            boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
                            border: "1px solid #f3f4f6",
                        }}
                    >
                        {headerTitle && (
                            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#111827" }}>
                                {headerTitle}
                            </h3>
                        )}

                        {/* Tiers List */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            {tiers.map((t, idx) => {
                                const isSelected = previewSelectedTier === idx + 1;
                                const rawTotal = sampleItemPrice * t.qty;
                                const discountPct = Number(t.discount) || 0;
                                const savedAmount = rawTotal * (discountPct / 100);
                                const finalTotal = rawTotal - savedAmount;

                                return (
                                    <div
                                        key={t.id || idx}
                                        onClick={() => setPreviewSelectedTier(idx + 1)}
                                        style={{
                                            position: "relative",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "16px 20px",
                                            borderRadius: "10px",
                                            cursor: "pointer",
                                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                            userSelect: "none",
                                            backgroundColor: isSelected ? "#fffdf5" : "#fffefc",
                                            border: isSelected
                                                ? `2px solid ${accentColor}`
                                                : "1.5px solid #fde68a",
                                            boxShadow: isSelected
                                                ? `0 2px 8px -2px ${accentColor}33`
                                                : "none",
                                        }}
                                    >
                                        {/* Floating Most Popular Corner Badge */}
                                        {t.popularBadge && (
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    top: "-14px",
                                                    right: "14px",
                                                    backgroundColor: accentColor,
                                                    color: "#ffffff",
                                                    padding: "4px 14px",
                                                    borderRadius: "20px",
                                                    fontSize: "12px",
                                                    fontWeight: "700",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                                                    letterSpacing: "0.2px",
                                                    zIndex: 2,
                                                }}
                                            >
                                                <span>✨</span>
                                                <span>{t.popularBadge}</span>
                                            </div>
                                        )}

                                        {/* Left Side: Radio + Title + Tag + Subtitle */}
                                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                            {/* Custom Radio Button */}
                                            <div
                                                style={{
                                                    width: "22px",
                                                    height: "22px",
                                                    borderRadius: "50%",
                                                    border: isSelected ? `2.5px solid ${accentColor}` : "2px solid #fcd34d",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                    backgroundColor: "#ffffff",
                                                }}
                                            >
                                                {isSelected && (
                                                    <div
                                                        style={{
                                                            width: "10px",
                                                            height: "10px",
                                                            borderRadius: "50%",
                                                            backgroundColor: accentColor,
                                                        }}
                                                    />
                                                )}
                                            </div>

                                            {/* Title & Subtitle */}
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span style={{ fontSize: "18px", fontWeight: "700", color: "#111827" }}>
                                                        {t.title}
                                                    </span>

                                                    {/* Save Pill Tag */}
                                                    {t.saveTag ? (
                                                        <span
                                                            style={{
                                                                backgroundColor: "#fef3c7",
                                                                color: "#92400e",
                                                                fontSize: "11.5px",
                                                                fontWeight: "700",
                                                                padding: "3px 8px",
                                                                borderRadius: "6px",
                                                                textTransform: "uppercase",
                                                                letterSpacing: "0.3px",
                                                            }}
                                                        >
                                                            {t.saveTag}
                                                        </span>
                                                    ) : discountPct > 0 ? (
                                                        <span
                                                            style={{
                                                                backgroundColor: "#fef3c7",
                                                                color: "#92400e",
                                                                fontSize: "11.5px",
                                                                fontWeight: "700",
                                                                padding: "3px 8px",
                                                                borderRadius: "6px",
                                                                textTransform: "uppercase",
                                                            }}
                                                        >
                                                            SAVE ${savedAmount.toFixed(2)}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                {/* Subtitle */}
                                                <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>
                                                    {t.subtitle || (discountPct > 0 ? `You save ${discountPct}%` : "Standard price")}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Side: Price & Strikethrough */}
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: "20px", fontWeight: "800", color: "#111827" }}>
                                                ${finalTotal.toFixed(2)}
                                            </div>
                                            {discountPct > 0 && (
                                                <div
                                                    style={{
                                                        fontSize: "13px",
                                                        color: "#9ca3af",
                                                        textDecoration: "line-through",
                                                        marginTop: "1px",
                                                    }}
                                                >
                                                    ${rawTotal.toFixed(2)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </div>

            {/* Fallback Product Selection Modal */}
            {showProductModal && (
                <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
                    <div style={{ backgroundColor: "#fff", width: "500px", maxWidth: "90%", borderRadius: "12px", padding: "20px", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>Select Products</h3>
                            <button type="button" onClick={() => setShowProductModal(false)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "16px" }}>✕</button>
                        </div>
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", marginBottom: "12px", fontSize: "13px" }}
                        />
                        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                            {storeProducts.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase())).map((p) => {
                                const isChecked = selectedProducts.some((sp) => sp.id === p.id);
                                return (
                                    <label
                                        key={p.id}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                            padding: "8px 10px",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                            backgroundColor: isChecked ? "#f0fdf4" : "#ffffff",
                                            border: isChecked ? "1px solid #86efac" : "1px solid #e5e7eb",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                                if (isChecked) {
                                                    setSelectedProducts(selectedProducts.filter((sp) => sp.id !== p.id));
                                                } else {
                                                    setSelectedProducts([...selectedProducts, p]);
                                                }
                                            }}
                                        />
                                        {p.imageUrl && (
                                            <img src={p.imageUrl} alt={p.title} style={{ width: "32px", height: "32px", borderRadius: "4px", objectFit: "cover" }} />
                                        )}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: "13px", fontWeight: "600" }}>{p.title}</div>
                                            <div style={{ fontSize: "11px", color: "#6b7280" }}>${p.price.toFixed(2)}</div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowProductModal(false)}
                            style={{ marginTop: "14px", padding: "10px", backgroundColor: "#111827", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                        >
                            Done ({selectedProducts.length} selected)
                        </button>
                    </div>
                </div>
            )}

            {/* Fallback Collection Selection Modal */}
            {showCollectionModal && (
                <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
                    <div style={{ backgroundColor: "#fff", width: "500px", maxWidth: "90%", borderRadius: "12px", padding: "20px", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>Select Collections</h3>
                            <button type="button" onClick={() => setShowCollectionModal(false)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "16px" }}>✕</button>
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                            {storeCollections.map((c) => {
                                const isChecked = selectedCollections.some((sc) => sc.id === c.id);
                                return (
                                    <label
                                        key={c.id}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                            padding: "8px 10px",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                            backgroundColor: isChecked ? "#f0fdf4" : "#ffffff",
                                            border: isChecked ? "1px solid #86efac" : "1px solid #e5e7eb",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                                if (isChecked) {
                                                    setSelectedCollections(selectedCollections.filter((sc) => sc.id !== c.id));
                                                } else {
                                                    setSelectedCollections([...selectedCollections, c]);
                                                }
                                            }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: "13px", fontWeight: "600" }}>📁 {c.title}</div>
                                            <div style={{ fontSize: "11px", color: "#6b7280" }}>{c.count} products</div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCollectionModal(false)}
                            style={{ marginTop: "14px", padding: "10px", backgroundColor: "#111827", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                        >
                            Done ({selectedCollections.length} selected)
                        </button>
                    </div>
                </div>
            )}

        </s-page>
    );
}
