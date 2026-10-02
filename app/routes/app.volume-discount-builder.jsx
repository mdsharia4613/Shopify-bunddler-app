import { useState, useRef } from "react";
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

    return { existingBundle };
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
        const infoRes = await admin.graphql(`query { currentAppInstallation { id } shop { id } }`);
        const infoJson = await infoRes.json();
        const appInstallId = infoJson.data?.currentAppInstallation?.id;
        const shopId = infoJson.data?.shop?.id;

        const metafieldVal = JSON.stringify({
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
        });

        const metafields = [];
        if (appInstallId) {
            metafields.push({
                ownerId: appInstallId,
                namespace: "$app:smart_bundles",
                key: "active_volume_discount",
                type: "json",
                value: metafieldVal,
            });
        }
        if (shopId) {
            metafields.push({
                ownerId: shopId,
                namespace: "$app:smart_bundles",
                key: "active_volume_discount",
                type: "json",
                value: metafieldVal,
            });
        }

        if (metafields.length > 0) {
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
                        metafields,
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
    const { existingBundle } = useLoaderData();
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

    // Interactive preview selected tier state
    const [previewSelectedTier, setPreviewSelectedTier] = useState(defaultTier);
    const [imageModalTierIdx, setImageModalTierIdx] = useState(null);
    const [openGiftDropdownIdx, setOpenGiftDropdownIdx] = useState(null);
    const fileInputRef = useRef(null);
    const [fileInputTierIdx, setFileInputTierIdx] = useState(null);

    // Initial Tiers matching the exact reference image with image & gift options
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
                image: null,
                gift: { enabled: false, type: "gift", text: "+ FREE Gift", productId: "", productTitle: "", imageUrl: "", imageSize: 30, showOriginalPrice: true },
            },
            {
                id: 2,
                qty: 2,
                title: "Duo",
                subtitle: "You save 15%",
                discount: 15,
                saveTag: "SAVE $30.00",
                popularBadge: "Most Popular",
                image: null,
                gift: { enabled: false, type: "gift", text: "+ FREE Gift", productId: "", productTitle: "", imageUrl: "", imageSize: 30, showOriginalPrice: true },
            },
            {
                id: 3,
                qty: 3,
                title: "Trio",
                subtitle: "You save 20%",
                discount: 20,
                saveTag: "SAVE $60.00",
                popularBadge: "",
                image: null,
                gift: { enabled: false, type: "gift", text: "+ FREE Gift", productId: "", productTitle: "", imageUrl: "", imageSize: 30, showOriginalPrice: true },
            },
        ]
    );

    // Update single tier
    const handleTierChange = (index, field, value) => {
        const next = [...tiers];
        next[index] = { ...next[index], [field]: value };
        setTiers(next);
    };

    // Update tier image settings
    const handleUpdateImage = (index, imageObj) => {
        const next = [...tiers];
        const curr = next[index].image || { url: "", size: 48, radius: 6 };
        next[index] = { ...next[index], image: { ...curr, ...imageObj } };
        setTiers(next);
    };

    // Remove tier image
    const handleRemoveImage = (index) => {
        const next = [...tiers];
        next[index] = { ...next[index], image: null };
        setTiers(next);
    };

    // Toggle tier gift
    const handleToggleGift = (index, forceState) => {
        const next = [...tiers];
        const currentGift = next[index].gift || {
            enabled: false,
            type: "gift",
            text: "+ FREE Gift",
            productId: "",
            productTitle: "",
            imageUrl: "",
            imageSize: 30,
            showOriginalPrice: true,
        };
        const nextEnabled = typeof forceState === "boolean" ? forceState : !currentGift.enabled;
        next[index] = {
            ...next[index],
            gift: {
                ...currentGift,
                enabled: nextEnabled,
            },
        };
        setTiers(next);
    };

    // Update tier gift settings
    const handleUpdateGift = (index, giftUpdates) => {
        const next = [...tiers];
        const currentGift = next[index].gift || {
            enabled: true,
            type: "gift",
            text: "+ FREE Gift",
            productId: "",
            productTitle: "",
            imageUrl: "",
            imageSize: 30,
            showOriginalPrice: true,
        };
        next[index] = {
            ...next[index],
            gift: {
                ...currentGift,
                ...giftUpdates,
            },
        };
        setTiers(next);
    };

    // Open Shopify Resource Picker to select an image, or fallback to file picker
    const handlePickImageForTier = async (tierIdx) => {
        if (typeof window !== "undefined" && window.shopify?.resourcePicker) {
            try {
                const selected = await window.shopify.resourcePicker({
                    type: "product",
                    multiple: false,
                });
                if (selected && Array.isArray(selected) && selected.length > 0) {
                    const p = selected[0];
                    const imgUrl = p.images?.[0]?.originalSrc || p.featuredImage?.url || "";
                    if (imgUrl) {
                        handleUpdateImage(tierIdx, { url: imgUrl });
                        return;
                    }
                }
            } catch (err) {
                // Closed or cancelled
                return;
            }
        }
        // Fallback: trigger file input
        setFileInputTierIdx(tierIdx);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (file && fileInputTierIdx !== null) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const url = event.target?.result;
                if (url) {
                    handleUpdateImage(fileInputTierIdx, { url });
                }
            };
            reader.readAsDataURL(file);
        }
        e.target.value = "";
    };

    // Open Shopify Resource Picker to select a gift product for the tier
    const handlePickGiftProduct = async (tierIdx) => {
        if (typeof window !== "undefined" && window.shopify?.resourcePicker) {
            try {
                const selected = await window.shopify.resourcePicker({
                    type: "product",
                    multiple: false,
                });
                if (selected && Array.isArray(selected) && selected.length > 0) {
                    const p = selected[0];
                    const imgUrl = p.images?.[0]?.originalSrc || p.featuredImage?.url || "";
                    const vId = p.variants?.[0]?.id || "";
                    const price = p.variants?.[0]?.price || "0.00";
                    handleUpdateGift(tierIdx, {
                        productId: p.id,
                        productTitle: p.title,
                        imageUrl: imgUrl,
                        variantId: vId,
                        price: parseFloat(price),
                    });
                }
            } catch (err) {
                // Closed or cancelled
            }
        }
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
                image: null,
                gift: { enabled: false, type: "gift", text: "+ FREE Gift", productId: "", productTitle: "", imageUrl: "", imageSize: 30, showOriginalPrice: true },
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

    // Open Product Picker (Native Shopify App Bridge Only)
    const handleOpenProductPicker = async () => {
        if (typeof window !== "undefined" && window.shopify?.resourcePicker) {
            try {
                const selected = await window.shopify.resourcePicker({
                    type: "product",
                    multiple: true,
                    selectionIds: selectedProducts.map((p) => ({ id: p.id })),
                });
                if (selected && Array.isArray(selected) && selected.length > 0) {
                    const mapped = selected.map((p) => ({
                        id: p.id,
                        title: p.title,
                        imageUrl: p.images?.[0]?.originalSrc || p.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
                        price: parseFloat(p.variants?.[0]?.price || "100.00"),
                    }));
                    setSelectedProducts(mapped);
                }
            } catch (err) {
                // User cancelled or closed modal - do nothing
            }
        }
    };

    // Open Collection Picker (Native Shopify App Bridge Only)
    const handleOpenCollectionPicker = async () => {
        if (typeof window !== "undefined" && window.shopify?.resourcePicker) {
            try {
                const selected = await window.shopify.resourcePicker({
                    type: "collection",
                    multiple: true,
                    selectionIds: selectedCollections.map((c) => ({ id: c.id })),
                });
                if (selected && Array.isArray(selected) && selected.length > 0) {
                    const mapped = selected.map((c) => ({
                        id: c.id,
                        title: c.title,
                        handle: c.handle,
                        count: c.productsCount?.count || 0,
                    }));
                    setSelectedCollections(mapped);
                }
            } catch (err) {
                // User cancelled or closed modal - do nothing
            }
        }
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

                                    {/* Action Buttons: Add Image & Add Gift (Image 1) */}
                                    <div style={{ display: "flex", gap: "8px", marginTop: "14px", paddingTop: "12px", borderTop: "1px dashed #e5e7eb", flexWrap: "wrap", alignItems: "center" }}>
                                        <button
                                            type="button"
                                            onClick={() => setImageModalTierIdx(idx)}
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                padding: "7px 14px",
                                                backgroundColor: "#ffffff",
                                                border: "1px solid #d1d5db",
                                                borderRadius: "6px",
                                                fontSize: "13px",
                                                fontWeight: "600",
                                                color: "#374151",
                                                cursor: "pointer",
                                            }}
                                        >
                                            <span>📷</span>
                                            <span>{t.image?.url ? "Edit image" : "Add image"}</span>
                                        </button>

                                        {t.image?.url && (
                                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#f3f4f6", padding: "4px 8px", borderRadius: "6px" }}>
                                                <img
                                                    src={t.image.url}
                                                    alt="Tier thumb"
                                                    style={{ width: "24px", height: "24px", borderRadius: `${t.image.radius ?? 4}px`, objectFit: "cover" }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveImage(idx)}
                                                    style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                                                    title="Remove image"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => handleToggleGift(idx)}
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                padding: "7px 14px",
                                                backgroundColor: t.gift?.enabled ? "#ecfdf5" : "#ffffff",
                                                border: t.gift?.enabled ? "1px solid #6ee7b7" : "1px solid #d1d5db",
                                                borderRadius: "6px",
                                                fontSize: "13px",
                                                fontWeight: "600",
                                                color: t.gift?.enabled ? "#065f46" : "#374151",
                                                cursor: "pointer",
                                            }}
                                        >
                                            <span>🎁</span>
                                            <span>{t.gift?.enabled ? "Gift Active" : "Add gift"}</span>
                                            <span style={{ fontSize: "11px" }}>{t.gift?.enabled ? "✓" : "⌵"}</span>
                                        </button>
                                    </div>

                                    {/* Gifts Block (Images 3 & 4) */}
                                    {t.gift?.enabled && (
                                        <div
                                            style={{
                                                marginTop: "14px",
                                                border: "1px solid #e5e7eb",
                                                borderRadius: "10px",
                                                padding: "16px",
                                                backgroundColor: "#f9fafb",
                                            }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span style={{ fontSize: "15px" }}>🎁</span>
                                                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>Gifts</span>
                                                </div>
                                            </div>

                                            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#6b7280", marginBottom: "12px", cursor: "pointer" }}>
                                                <input
                                                    type="checkbox"
                                                    checked={t.gift?.summaryWhenUnselected || false}
                                                    onChange={(e) => handleUpdateGift(idx, { summaryWhenUnselected: e.target.checked })}
                                                />
                                                Show multiple free gifts summary when bar is not selected
                                            </label>

                                            {/* Sub-card matching Image 3 and Image 4 */}
                                            <div
                                                style={{
                                                    backgroundColor: "#ffffff",
                                                    border: "1px solid #e5e7eb",
                                                    borderRadius: "8px",
                                                    padding: "16px",
                                                }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>
                                                        {t.gift?.type === "shipping" ? "🚚 Free shipping" : "🎁 Free gift"}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleGift(idx, false)}
                                                        style={{ border: "none", background: "none", color: "#6b7280", cursor: "pointer", fontSize: "12px", fontWeight: "600", textDecoration: "underline" }}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>

                                                {/* Segmented control / Tabs */}
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateGift(idx, { type: "gift", text: t.gift?.text === "+ FREE Shipping" ? "+ FREE Gift" : (t.gift?.text || "+ FREE Gift") })}
                                                        style={{
                                                            padding: "10px",
                                                            borderRadius: "6px",
                                                            border: t.gift?.type !== "shipping" ? "2px solid #059669" : "1px solid #d1d5db",
                                                            backgroundColor: t.gift?.type !== "shipping" ? "#f0fdf4" : "#ffffff",
                                                            color: t.gift?.type !== "shipping" ? "#065f46" : "#4b5563",
                                                            fontWeight: "700",
                                                            fontSize: "13px",
                                                            cursor: "pointer",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            gap: "6px",
                                                        }}
                                                    >
                                                        <span>🎁</span>
                                                        <span>Free gift</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateGift(idx, { type: "shipping", text: t.gift?.text === "+ FREE Gift" ? "+ FREE Shipping" : (t.gift?.text || "+ FREE Shipping") })}
                                                        style={{
                                                            padding: "10px",
                                                            borderRadius: "6px",
                                                            border: t.gift?.type === "shipping" ? "2px solid #059669" : "1px solid #d1d5db",
                                                            backgroundColor: t.gift?.type === "shipping" ? "#f0fdf4" : "#ffffff",
                                                            color: t.gift?.type === "shipping" ? "#065f46" : "#4b5563",
                                                            fontWeight: "700",
                                                            fontSize: "13px",
                                                            cursor: "pointer",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            gap: "6px",
                                                        }}
                                                    >
                                                        <span>🚚</span>
                                                        <span>Free shipping</span>
                                                    </button>
                                                </div>

                                                {/* Alert banner */}
                                                <div
                                                    style={{
                                                        backgroundColor: "#eff6ff",
                                                        border: "1px solid #bfdbfe",
                                                        borderRadius: "6px",
                                                        padding: "10px 14px",
                                                        marginBottom: "14px",
                                                        fontSize: "12px",
                                                        color: "#1e40af",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "8px",
                                                    }}
                                                >
                                                    <span>ℹ️</span>
                                                    <span>
                                                        We automatically apply a 100% discount to {t.gift?.type === "shipping" ? "shipping" : "gifts"}
                                                    </span>
                                                </div>

                                                {/* Tab 1: Free gift specific content */}
                                                {t.gift?.type !== "shipping" && (
                                                    <div style={{ marginBottom: "14px" }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePickGiftProduct(idx)}
                                                            style={{
                                                                width: "100%",
                                                                padding: "10px",
                                                                backgroundColor: "#111827",
                                                                color: "#ffffff",
                                                                border: "none",
                                                                borderRadius: "6px",
                                                                fontSize: "13px",
                                                                fontWeight: "700",
                                                                cursor: "pointer",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                gap: "8px",
                                                            }}
                                                        >
                                                            <span>🎁</span>
                                                            <span>{t.gift?.productTitle ? `Gift: ${t.gift.productTitle}` : "Select a product"}</span>
                                                        </button>

                                                        {t.gift?.productTitle && (
                                                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", padding: "8px", backgroundColor: "#f9fafb", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
                                                                {t.gift.imageUrl && (
                                                                    <img src={t.gift.imageUrl} alt={t.gift.productTitle} style={{ width: "32px", height: "32px", borderRadius: "4px", objectFit: "cover" }} />
                                                                )}
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>{t.gift.productTitle}</div>
                                                                    <div style={{ fontSize: "11px", color: "#059669", fontWeight: "700" }}>$0.00 (100% Free Gift)</div>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handlePickGiftProduct(idx)}
                                                                    style={{ border: "none", background: "none", color: "#2563eb", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
                                                                >
                                                                    Change
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Text input */}
                                                <div style={{ marginBottom: "14px" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                                        <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280" }}>Text</label>
                                                        <span style={{ fontSize: "11px", color: "#9ca3af" }}>{"{}"}</span>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={t.gift?.text || (t.gift?.type === "shipping" ? "+ FREE Shipping" : "+ FREE Gift")}
                                                        onChange={(e) => handleUpdateGift(idx, { text: e.target.value })}
                                                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
                                                    />
                                                </div>

                                                {/* Image & Image size slider */}
                                                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                        {t.gift?.imageUrl ? (
                                                            <img src={t.gift.imageUrl} alt="Gift thumb" style={{ width: "32px", height: "32px", borderRadius: "4px", objectFit: "cover", border: "1px solid #d1d5db" }} />
                                                        ) : (
                                                            <div style={{ width: "32px", height: "32px", backgroundColor: "#f3f4f6", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", border: "1px solid #d1d5db" }}>
                                                                {t.gift?.type === "shipping" ? "🚚" : "🎁"}
                                                            </div>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePickGiftProduct(idx)}
                                                            style={{
                                                                padding: "6px 12px",
                                                                backgroundColor: "#ffffff",
                                                                border: "1px solid #d1d5db",
                                                                borderRadius: "6px",
                                                                fontSize: "12px",
                                                                fontWeight: "600",
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            📷 Edit image
                                                        </button>
                                                    </div>

                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "160px" }}>
                                                        <span style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", whiteSpace: "nowrap" }}>Image size</span>
                                                        <input
                                                            type="range"
                                                            min="16"
                                                            max="60"
                                                            value={t.gift?.imageSize || 30}
                                                            onChange={(e) => handleUpdateGift(idx, { imageSize: parseInt(e.target.value, 10) || 30 })}
                                                            style={{ flex: 1 }}
                                                        />
                                                        <span style={{ fontSize: "12px", fontWeight: "600", minWidth: "40px", textAlign: "right" }}>
                                                            {t.gift?.imageSize || 30} px
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Checkboxes matching Image 3 and 4 */}
                                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                                    {t.gift?.type !== "shipping" ? (
                                                        <>
                                                            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#4b5563", cursor: "pointer" }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={t.gift?.showOriginalPrice !== false}
                                                                    onChange={(e) => handleUpdateGift(idx, { showOriginalPrice: e.target.checked })}
                                                                />
                                                                Show original price
                                                            </label>
                                                            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#4b5563", cursor: "pointer" }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={t.gift?.includeCompareAt || false}
                                                                    onChange={(e) => handleUpdateGift(idx, { includeCompareAt: e.target.checked })}
                                                                />
                                                                Include in compare-at price
                                                            </label>
                                                        </>
                                                    ) : (
                                                        <div>
                                                            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#4b5563", cursor: "pointer" }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={t.gift?.excludeOverAmount || false}
                                                                    onChange={(e) => handleUpdateGift(idx, { excludeOverAmount: e.target.checked })}
                                                                />
                                                                Exclude shipping rates over a certain amount
                                                            </label>
                                                            {t.gift?.excludeOverAmount && (
                                                                <div style={{ paddingLeft: "24px", marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                                                                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Max shipping amount: $</span>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="1"
                                                                        placeholder="20"
                                                                        value={t.gift?.maxShippingAmount || ""}
                                                                        onChange={(e) => handleUpdateGift(idx, { maxShippingAmount: e.target.value })}
                                                                        style={{ width: "90px", padding: "4px 8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px" }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#4b5563", cursor: "pointer" }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={t.gift?.onlySubscriptions || false}
                                                            onChange={(e) => handleUpdateGift(idx, { onlySubscriptions: e.target.checked })}
                                                        />
                                                        Apply only for subscriptions
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    )}

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
                                const hasGift = t.gift?.enabled;

                                return (
                                    <div
                                        key={t.id || idx}
                                        onClick={() => setPreviewSelectedTier(idx + 1)}
                                        style={{
                                            position: "relative",
                                            cursor: "pointer",
                                            userSelect: "none",
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

                                        {/* Main Tier Box */}
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "16px 20px",
                                                borderRadius: hasGift ? "10px 10px 0 0" : "10px",
                                                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                                backgroundColor: isSelected ? "#fffdf5" : "#fffefc",
                                                border: isSelected
                                                    ? `2px solid ${accentColor}`
                                                    : "1.5px solid #fde68a",
                                                borderBottom: hasGift ? "none" : undefined,
                                                boxShadow: isSelected
                                                    ? `0 2px 8px -2px ${accentColor}33`
                                                    : "none",
                                            }}
                                        >
                                            {/* Left Side: Radio OR Image + Title + Tag + Subtitle */}
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                {/* If tier has image, render image in place of circular radio button */}
                                                {t.image?.url ? (
                                                    <img
                                                        src={t.image.url}
                                                        alt={t.title}
                                                        style={{
                                                            width: `${t.image.size || 48}px`,
                                                            height: `${t.image.size || 48}px`,
                                                            borderRadius: `${t.image.radius ?? 6}px`,
                                                            objectFit: "cover",
                                                            flexShrink: 0,
                                                            border: "1px solid #e5e7eb",
                                                        }}
                                                    />
                                                ) : (
                                                    /* Custom Radio Button */
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
                                                )}

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

                                        {/* Bottom Attached Gift Ribbon (Image 3 and 4) */}
                                        {hasGift && (
                                            <div
                                                style={{
                                                    backgroundColor: accentColor,
                                                    color: "#ffffff",
                                                    padding: "7px 16px",
                                                    fontWeight: "700",
                                                    fontSize: "13px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                    borderBottomLeftRadius: "10px",
                                                    borderBottomRightRadius: "10px",
                                                    boxShadow: isSelected ? `0 4px 10px -2px ${accentColor}44` : "none",
                                                }}
                                            >
                                                {t.gift.type === "shipping" ? (
                                                    <span>🚚</span>
                                                ) : t.gift.imageUrl ? (
                                                    <img
                                                        src={t.gift.imageUrl}
                                                        alt="Gift"
                                                        style={{
                                                            width: `${t.gift.imageSize || 24}px`,
                                                            height: `${t.gift.imageSize || 24}px`,
                                                            borderRadius: "4px",
                                                            objectFit: "cover",
                                                        }}
                                                    />
                                                ) : (
                                                    <span>🎁</span>
                                                )}
                                                <span>{t.gift.text || (t.gift.type === "shipping" ? "+ FREE Shipping" : "+ FREE Gift")}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </div>

            {/* Add Image Modal (Image 2) */}
            {imageModalTierIdx !== null && tiers[imageModalTierIdx] && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.45)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: "20px",
                    }}
                >
                    <div
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: "16px",
                            width: "820px",
                            maxWidth: "95%",
                            maxHeight: "90vh",
                            overflowY: "auto",
                            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
                            padding: "24px",
                        }}
                    >
                        {/* Modal Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid #f3f4f6", paddingBottom: "14px" }}>
                            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#111827" }}>
                                Add image ({tiers[imageModalTierIdx].title})
                            </h3>
                            <button
                                type="button"
                                onClick={() => setImageModalTierIdx(null)}
                                style={{ border: "none", background: "none", fontSize: "20px", cursor: "pointer", color: "#6b7280" }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal 2-Column Layout */}
                        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "24px", alignItems: "start" }}>
                            {/* Left: Controls */}
                            <div>
                                {/* Dropzone */}
                                <div
                                    style={{
                                        position: "relative",
                                        border: tiers[imageModalTierIdx].image?.url ? "1px solid #d1d5db" : "1.5px dashed #d1d5db",
                                        borderRadius: "10px",
                                        padding: "20px",
                                        minHeight: "110px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        backgroundColor: tiers[imageModalTierIdx].image?.url ? "#ffffff" : "#fafafa",
                                        marginBottom: "20px",
                                    }}
                                >
                                    {tiers[imageModalTierIdx].image?.url ? (
                                        <>
                                            <img
                                                src={tiers[imageModalTierIdx].image.url}
                                                alt="Selected tier thumbnail"
                                                onClick={() => handlePickImageForTier(imageModalTierIdx)}
                                                style={{
                                                    width: `${tiers[imageModalTierIdx].image.size || 48}px`,
                                                    height: `${tiers[imageModalTierIdx].image.size || 48}px`,
                                                    borderRadius: `${tiers[imageModalTierIdx].image.radius ?? 6}px`,
                                                    objectFit: "cover",
                                                    border: "1px solid #e5e7eb",
                                                    cursor: "pointer",
                                                }}
                                                title="Click to change image"
                                            />
                                            {/* Trash button in top right matching screenshot */}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveImage(imageModalTierIdx)}
                                                title="Remove image"
                                                style={{
                                                    position: "absolute",
                                                    top: "12px",
                                                    right: "12px",
                                                    width: "32px",
                                                    height: "32px",
                                                    borderRadius: "6px",
                                                    border: "1px solid #e5e7eb",
                                                    backgroundColor: "#ffffff",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    cursor: "pointer",
                                                    color: "#6b7280",
                                                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                                }}
                                            >
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handlePickImageForTier(imageModalTierIdx)}
                                            style={{
                                                padding: "8px 22px",
                                                backgroundColor: "#ffffff",
                                                border: "1px solid #d1d5db",
                                                borderRadius: "8px",
                                                fontSize: "13px",
                                                fontWeight: "600",
                                                color: "#111827",
                                                cursor: "pointer",
                                                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                            }}
                                        >
                                            Add image
                                        </button>
                                    )}
                                </div>

                                {/* Size slider */}
                                <div style={{ marginBottom: "14px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                                        <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>Size</label>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <input
                                            type="range"
                                            min="24"
                                            max="100"
                                            value={tiers[imageModalTierIdx].image?.size || 48}
                                            onChange={(e) =>
                                                handleUpdateImage(imageModalTierIdx, {
                                                    size: parseInt(e.target.value, 10) || 48,
                                                })
                                            }
                                            style={{ flex: 1 }}
                                        />
                                        <div style={{ display: "flex", alignItems: "center", gap: "4px", width: "70px" }}>
                                            <input
                                                type="number"
                                                min="24"
                                                max="100"
                                                value={tiers[imageModalTierIdx].image?.size || 48}
                                                onChange={(e) =>
                                                    handleUpdateImage(imageModalTierIdx, {
                                                        size: parseInt(e.target.value, 10) || 48,
                                                    })
                                                }
                                                style={{ width: "45px", padding: "4px 6px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "12px", textAlign: "right" }}
                                            />
                                            <span style={{ fontSize: "12px", color: "#6b7280" }}>px</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Corner radius slider */}
                                <div style={{ marginBottom: "18px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                                        <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>Corner radius</label>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <input
                                            type="range"
                                            min="0"
                                            max="40"
                                            value={tiers[imageModalTierIdx].image?.radius ?? 6}
                                            onChange={(e) =>
                                                handleUpdateImage(imageModalTierIdx, {
                                                    radius: parseInt(e.target.value, 10) || 0,
                                                })
                                            }
                                            style={{ flex: 1 }}
                                        />
                                        <div style={{ display: "flex", alignItems: "center", gap: "4px", width: "70px" }}>
                                            <input
                                                type="number"
                                                min="0"
                                                max="40"
                                                value={tiers[imageModalTierIdx].image?.radius ?? 6}
                                                onChange={(e) =>
                                                    handleUpdateImage(imageModalTierIdx, {
                                                        radius: parseInt(e.target.value, 10) || 0,
                                                    })
                                                }
                                                style={{ width: "45px", padding: "4px 6px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "12px", textAlign: "right" }}
                                            />
                                            <span style={{ fontSize: "12px", color: "#6b7280" }}>px</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Live Preview in Modal (Image 2) */}
                            <div>
                                <div style={{ fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "10px" }}>
                                    Preview
                                </div>
                                {(() => {
                                    const mt = tiers[imageModalTierIdx];
                                    const rawTotal = sampleItemPrice * mt.qty;
                                    const discountPct = Number(mt.discount) || 0;
                                    const savedAmount = rawTotal * (discountPct / 100);
                                    const finalTotal = rawTotal - savedAmount;

                                    return (
                                        <div
                                            style={{
                                                position: "relative",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "16px 20px",
                                                borderRadius: "10px",
                                                backgroundColor: "#fffdf5",
                                                border: `2px solid ${accentColor}`,
                                                boxShadow: `0 2px 8px -2px ${accentColor}33`,
                                            }}
                                        >
                                            {mt.popularBadge && (
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
                                                        zIndex: 2,
                                                    }}
                                                >
                                                    <span>✨</span>
                                                    <span>{mt.popularBadge}</span>
                                                </div>
                                            )}

                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                {/* If tier has image, render image in place of circular radio button */}
                                                {mt.image?.url ? (
                                                    <img
                                                        src={mt.image.url}
                                                        alt={mt.title}
                                                        style={{
                                                            width: `${mt.image.size || 48}px`,
                                                            height: `${mt.image.size || 48}px`,
                                                            borderRadius: `${mt.image.radius ?? 6}px`,
                                                            objectFit: "cover",
                                                            flexShrink: 0,
                                                            border: "1px solid #e5e7eb",
                                                        }}
                                                    />
                                                ) : (
                                                    /* Circular Radio */
                                                    <div
                                                        style={{
                                                            width: "22px",
                                                            height: "22px",
                                                            borderRadius: "50%",
                                                            border: `2.5px solid ${accentColor}`,
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            flexShrink: 0,
                                                            backgroundColor: "#ffffff",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: "10px",
                                                                height: "10px",
                                                                borderRadius: "50%",
                                                                backgroundColor: accentColor,
                                                            }}
                                                        />
                                                    </div>
                                                )}

                                                <div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                        <span style={{ fontSize: "18px", fontWeight: "700", color: "#111827" }}>
                                                            {mt.title}
                                                        </span>
                                                        {(mt.saveTag || discountPct > 0) && (
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
                                                                {mt.saveTag || `SAVE $${savedAmount.toFixed(2)}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>
                                                        {mt.subtitle || (discountPct > 0 ? `You save ${discountPct}%` : "Standard price")}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ textAlign: "right" }}>
                                                <div style={{ fontSize: "20px", fontWeight: "800", color: "#111827" }}>
                                                    ${finalTotal.toFixed(2)}
                                                </div>
                                                {discountPct > 0 && (
                                                    <div style={{ fontSize: "13px", color: "#9ca3af", textDecoration: "line-through", marginTop: "1px" }}>
                                                        ${rawTotal.toFixed(2)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px", paddingTop: "14px", borderTop: "1px solid #f3f4f6" }}>
                            <button
                                type="button"
                                onClick={() => setImageModalTierIdx(null)}
                                style={{
                                    padding: "9px 24px",
                                    backgroundColor: "#111827",
                                    color: "#ffffff",
                                    border: "none",
                                    borderRadius: "6px",
                                    fontSize: "13px",
                                    fontWeight: "700",
                                    cursor: "pointer",
                                }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden File Input for Image Upload */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                style={{ display: "none" }}
            />
        </s-page>
    );
}
