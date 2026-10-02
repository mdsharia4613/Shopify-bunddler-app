import { useState, useRef } from "react";
import { useLoaderData, useSearchParams, useNavigate, useSubmit, Link } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Loader: Edit existing BXGY deal or start fresh
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

// Action: Save or Update BXGY Bundle and sync metafields
export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const bundleId = formData.get("bundleId");
    const title = formData.get("title") || "Buy X, Get Y Deal";
    const strategy = "Buy X Get Y";
    const discountSummary = formData.get("discountSummary") || "Buy X Get Y";
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

    // Clean IDs for Liquid checks
    const cleanProductIds = (parsedConfig.selectedProducts || []).map((p) => {
        const parts = String(p.id).split("/");
        return parts[parts.length - 1];
    });

    const cleanCollectionIds = (parsedConfig.selectedCollections || []).map((c) => {
        const parts = String(c.id).split("/");
        return parts[parts.length - 1];
    });

    // Sync App Metafields on AppInstallation and Shop
    try {
        const infoRes = await admin.graphql(`query { currentAppInstallation { id } shop { id } }`);
        const infoJson = await infoRes.json();
        const appInstallId = infoJson.data?.currentAppInstallation?.id;
        const shopId = infoJson.data?.shop?.id;

        const metafieldVal = JSON.stringify({
            id: savedBundle.id,
            title: savedBundle.title,
            headerTitle: parsedConfig.headerTitle || "",
            accentColor: parsedConfig.accentColor || "#10b981",
            defaultTier: parsedConfig.defaultTier || 1,
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
                key: "active_bxgy",
                type: "json",
                value: metafieldVal,
            });
        }
        if (shopId) {
            metafields.push({
                ownerId: shopId,
                namespace: "$app:smart_bundles",
                key: "active_bxgy",
                type: "json",
                value: metafieldVal,
            });
        }

        if (metafields.length > 0) {
            await admin.graphql(
                `#graphql
                mutation setBxgyMetafield($metafields: [MetafieldsSetInput!]!) {
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
        console.error("BXGY metafield sync error:", err);
    }

    return new Response(null, {
        status: 302,
        headers: { Location: "/app" },
    });
};

export default function BxgyBuilder() {
    const { existingBundle } = useLoaderData();
    const [searchParams] = useSearchParams();
    const submit = useSubmit();
    const navigate = useNavigate();

    const brandColorParam = searchParams.get("color") || "#10b981";

    // Initial state parse from existing bundle
    let initConfig = {};
    if (existingBundle && existingBundle.products) {
        try {
            initConfig = JSON.parse(existingBundle.products);
        } catch (e) {}
    }

    const [bundleTitle, setBundleTitle] = useState(existingBundle?.title || "Buy X, Get Y Deal");
    const [headerTitle, setHeaderTitle] = useState(initConfig.headerTitle || "Buy X, Get Y (BXGY) Special");
    const [accentColor, setAccentColor] = useState(initConfig.accentColor || brandColorParam);
    const [defaultTier, setDefaultTier] = useState(initConfig.defaultTier || 1);

    // Initial default 2 tiers matching template image
    const [tiers, setTiers] = useState(
        initConfig.tiers || [
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
        ]
    );

    // Selected Tier in Live Preview
    const [previewSelectedTier, setPreviewSelectedTier] = useState(defaultTier);

    // Target Eligibility
    const [appliesTo, setAppliesTo] = useState(initConfig.appliesTo || "all");
    const [selectedProducts, setSelectedProducts] = useState(initConfig.selectedProducts || []);
    const [selectedCollections, setSelectedCollections] = useState(initConfig.selectedCollections || []);

    const [isSaving, setIsSaving] = useState(false);

    // Helper: recalculate discount and totalQty when quantities change (supports 0 Get Free)
    const updateTier = (idx, field, value) => {
        const next = [...tiers];
        next[idx][field] = value;

        if (field === "buyQty" || field === "getQty") {
            const rawB = field === "buyQty" ? value : next[idx].buyQty;
            const rawG = field === "getQty" ? value : next[idx].getQty;

            const bQty = Math.max(1, parseInt(rawB, 10) || 1);
            const parsedG = parseInt(rawG, 10);
            const gQty = isNaN(parsedG) ? 0 : Math.max(0, parsedG);

            const total = bQty + gQty;
            const disc = total > 0 && gQty > 0 ? Math.round((gQty / total) * 100) : 0;

            next[idx].buyQty = bQty;
            next[idx].getQty = gQty;
            next[idx].totalQty = total;
            next[idx].discount = disc;
            next[idx].saveTag = disc > 0 ? `SAVE ${disc}%` : "";

            if (!next[idx].customTitle) {
                if (gQty > 0) {
                    next[idx].title = `Buy ${bQty} Get ${gQty} Free`;
                } else {
                    next[idx].title = bQty === 1 ? "Standard (Single)" : `Buy ${bQty}`;
                }
            }
        }

        setTiers(next);
    };

    const addTier = () => {
        const newId = tiers.length + 1;
        const bQty = newId;
        const gQty = newId;
        const total = bQty + gQty;
        const disc = Math.round((gQty / total) * 100);

        setTiers([
            ...tiers,
            {
                id: newId,
                title: `Buy ${bQty} Get ${gQty} Free`,
                buyQty: bQty,
                getQty: gQty,
                totalQty: total,
                discount: disc,
                saveTag: `SAVE ${disc}%`,
                popularBadge: "",
            },
        ]);
    };

    const removeTier = (idx) => {
        if (tiers.length <= 1) {
            alert("A deal must have at least 1 tier.");
            return;
        }
        const next = tiers.filter((_, i) => i !== idx);
        setTiers(next);
        if (defaultTier > next.length) {
            setDefaultTier(1);
        }
    };

    // Product Picker
    const selectProducts = async () => {
        if (window.shopify && window.shopify.resourcePicker) {
            const selected = await window.shopify.resourcePicker({
                type: "product",
                multiple: true,
                selectionIds: selectedProducts.map((p) => ({ id: p.id })),
            });
            if (selected) {
                setSelectedProducts(
                    selected.map((p) => ({
                        id: p.id,
                        title: p.title,
                        handle: p.handle,
                        image: p.images?.[0]?.originalSrc || "",
                    }))
                );
            }
        }
    };

    // Collection Picker
    const selectCollections = async () => {
        if (window.shopify && window.shopify.resourcePicker) {
            const selected = await window.shopify.resourcePicker({
                type: "collection",
                multiple: true,
                selectionIds: selectedCollections.map((c) => ({ id: c.id })),
            });
            if (selected) {
                setSelectedCollections(
                    selected.map((c) => ({
                        id: c.id,
                        title: c.title,
                        handle: c.handle,
                        image: c.image?.originalSrc || "",
                    }))
                );
            }
        }
    };

    // Save Deal Form Submission
    const handleSave = () => {
        setIsSaving(true);
        const configData = {
            headerTitle,
            accentColor,
            defaultTier,
            tiers,
            appliesTo,
            selectedProducts,
            selectedCollections,
        };

        const maxDisc = Math.max(...tiers.map((t) => t.discount || 0));

        const fd = new FormData();
        if (existingBundle) {
            fd.append("bundleId", existingBundle.id);
        }
        fd.append("title", bundleTitle);
        fd.append("discountSummary", `Save up to ${maxDisc}% (BXGY)`);
        fd.append("config", JSON.stringify(configData));

        submit(fd, { method: "post" });
    };

    const sampleBasePrice = 100;

    return (
        <s-page heading="Buy X, Get Y (BXGY) Customizer">
            <s-link slot="breadcrumb" href="/app/templates">Back to Templates</s-link>

            {/* Header Action Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <p style={{ margin: 0, color: "#4b5563", fontSize: "14px" }}>
                    Configure Buy X, Get Y tiers, discounts, and targeting. Real-time updates display in the preview!
                </p>
                <div style={{ display: "flex", gap: "10px" }}>
                    <button
                        type="button"
                        onClick={() => navigate("/app")}
                        style={{
                            padding: "9px 18px",
                            backgroundColor: "#ffffff",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: "14px",
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{
                            padding: "9px 20px",
                            backgroundColor: "#111827",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: 600,
                            cursor: isSaving ? "not-allowed" : "pointer",
                            fontSize: "14px",
                        }}
                    >
                        {isSaving ? "Saving Deal..." : "Save & Publish Deal"}
                    </button>
                </div>
            </div>

            {/* Two-Column Layout */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "24px", alignItems: "start" }}>

                {/* Left Column: Form Controls */}
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                    {/* Section 1: General Info */}
                    <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                        <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                            General Settings
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "#374151" }}>
                                    Deal Internal Name
                                </label>
                                <input
                                    type="text"
                                    value={bundleTitle}
                                    onChange={(e) => setBundleTitle(e.target.value)}
                                    placeholder="e.g. Buy 1 Get 1 Special"
                                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px", boxSizing: "border-box" }}
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "#374151" }}>
                                        Storefront Heading
                                    </label>
                                    <input
                                        type="text"
                                        value={headerTitle}
                                        onChange={(e) => setHeaderTitle(e.target.value)}
                                        placeholder="e.g. Buy X, Get Y Special Deals"
                                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px", boxSizing: "border-box" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "#374151" }}>
                                        Accent Color
                                    </label>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <input
                                            type="color"
                                            value={accentColor}
                                            onChange={(e) => setAccentColor(e.target.value)}
                                            style={{ width: "38px", height: "38px", padding: 0, border: "none", borderRadius: "6px", cursor: "pointer" }}
                                        />
                                        <span style={{ fontSize: "13px", color: "#4b5563", fontFamily: "monospace" }}>{accentColor}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Tiers Configuration */}
                    <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <div>
                                <h3 style={{ margin: "0", fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                                    BXGY Deal Tiers
                                </h3>
                                <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
                                    Configure Buy Quantity, Free Quantity, and savings pills.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={addTier}
                                style={{
                                    padding: "6px 14px",
                                    backgroundColor: "#f3f4f6",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "6px",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                + Add BXGY Tier
                            </button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {tiers.map((tier, idx) => (
                                <div
                                    key={tier.id}
                                    style={{
                                        border: defaultTier === idx + 1 ? `2px solid ${accentColor}` : "1px solid #e5e7eb",
                                        borderRadius: "10px",
                                        padding: "16px",
                                        backgroundColor: defaultTier === idx + 1 ? "#fafcfb" : "#ffffff",
                                        position: "relative",
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <span style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>
                                                Tier {idx + 1}
                                            </span>
                                            <label style={{ fontSize: "12px", color: "#4b5563", display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                                                <input
                                                    type="radio"
                                                    name="default_tier_radio"
                                                    checked={defaultTier === idx + 1}
                                                    onChange={() => setDefaultTier(idx + 1)}
                                                />
                                                Default Selected
                                            </label>
                                        </div>
                                        {tiers.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeTier(idx)}
                                                style={{ background: "none", border: "none", color: "#ef4444", fontSize: "13px", cursor: "pointer", fontWeight: 600 }}
                                            >
                                                ✕ Remove
                                            </button>
                                        )}
                                    </div>

                                    {/* Quantities & Title */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                                        <div>
                                            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4b5563", marginBottom: "4px" }}>
                                                Deal Title
                                            </label>
                                            <input
                                                type="text"
                                                value={tier.title}
                                                onChange={(e) => {
                                                    updateTier(idx, "customTitle", true);
                                                    updateTier(idx, "title", e.target.value);
                                                }}
                                                placeholder="e.g. Buy 1 Get 1 Free"
                                                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", boxSizing: "border-box" }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4b5563", marginBottom: "4px" }}>
                                                Buy (Paid)
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={tier.buyQty}
                                                onChange={(e) => updateTier(idx, "buyQty", e.target.value)}
                                                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", boxSizing: "border-box" }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4b5563", marginBottom: "4px" }}>
                                                Get (Free)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={tier.getQty}
                                                onChange={(e) => updateTier(idx, "getQty", e.target.value)}
                                                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", boxSizing: "border-box" }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4b5563", marginBottom: "4px" }}>
                                                Discount %
                                            </label>
                                            <div style={{ padding: "7px 10px", backgroundColor: "#f3f4f6", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", fontWeight: 700, color: "#059669", textAlign: "center" }}>
                                                {tier.discount}% OFF
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pill & Badges */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                        <div>
                                            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4b5563", marginBottom: "4px" }}>
                                                Save Tag Pill
                                            </label>
                                            <input
                                                type="text"
                                                value={tier.saveTag}
                                                onChange={(e) => updateTier(idx, "saveTag", e.target.value)}
                                                placeholder="e.g. SAVE 50%"
                                                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", boxSizing: "border-box" }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#4b5563", marginBottom: "4px" }}>
                                                Corner Badge (Optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={tier.popularBadge || ""}
                                                onChange={(e) => updateTier(idx, "popularBadge", e.target.value)}
                                                placeholder="e.g. Most Popular / Best Value"
                                                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", boxSizing: "border-box" }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section 3: Applies To Targeting */}
                    <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                        <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                            Applies To (Targeting)
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer" }}>
                                <input
                                    type="radio"
                                    name="appliesTo"
                                    value="all"
                                    checked={appliesTo === "all"}
                                    onChange={(e) => setAppliesTo(e.target.value)}
                                />
                                <strong>All Products</strong> (Widget shows on every product page)
                            </label>

                            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer" }}>
                                <input
                                    type="radio"
                                    name="appliesTo"
                                    value="products"
                                    checked={appliesTo === "products"}
                                    onChange={(e) => setAppliesTo(e.target.value)}
                                />
                                <strong>Specific Products</strong>
                            </label>

                            {appliesTo === "products" && (
                                <div style={{ paddingLeft: "24px" }}>
                                    <button
                                        type="button"
                                        onClick={selectProducts}
                                        style={{ padding: "8px 16px", backgroundColor: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
                                    >
                                        Select Products ({selectedProducts.length} selected)
                                    </button>
                                </div>
                            )}

                            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer" }}>
                                <input
                                    type="radio"
                                    name="appliesTo"
                                    value="collections"
                                    checked={appliesTo === "collections"}
                                    onChange={(e) => setAppliesTo(e.target.value)}
                                />
                                <strong>Specific Collections</strong>
                            </label>

                            {appliesTo === "collections" && (
                                <div style={{ paddingLeft: "24px" }}>
                                    <button
                                        type="button"
                                        onClick={selectCollections}
                                        style={{ padding: "8px 16px", backgroundColor: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
                                    >
                                        Select Collections ({selectedCollections.length} selected)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Right Column: Live Storefront Preview (Exact Template Matching) */}
                <div style={{ position: "sticky", top: "20px" }}>
                    <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", border: "1px solid #e5e7eb", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #f3f4f6", paddingBottom: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block" }}></span>
                                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#111827" }}>
                                    Live Storefront Preview
                                </h4>
                            </div>
                            <span style={{ fontSize: "12px", color: "#6b7280" }}>Based on sample $100 item</span>
                        </div>

                        {/* Storefront BXGY Widget Preview */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {headerTitle && (
                                <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                                    {headerTitle}
                                </h3>
                            )}

                            {tiers.map((tier, idx) => {
                                const isSelected = previewSelectedTier === idx + 1;
                                const rawCents = sampleBasePrice * tier.totalQty * 100;
                                const discCents = Math.round(rawCents * (tier.discount / 100));
                                const finalCents = rawCents - discCents;

                                return (
                                    <div
                                        key={tier.id}
                                        onClick={() => setPreviewSelectedTier(idx + 1)}
                                        style={{
                                            position: "relative",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "16px 18px",
                                            borderRadius: "12px",
                                            cursor: "pointer",
                                            backgroundColor: isSelected ? "#f0fdf4" : "#ffffff",
                                            border: isSelected ? `2px solid ${accentColor}` : "1.5px solid #e2e8f0",
                                            transition: "all 0.2s ease",
                                        }}
                                    >
                                        {/* Floating Badge */}
                                        {tier.popularBadge && (
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    top: "-11px",
                                                    right: "14px",
                                                    backgroundColor: accentColor,
                                                    color: "#ffffff",
                                                    padding: "2px 10px",
                                                    borderRadius: "20px",
                                                    fontSize: "11px",
                                                    fontWeight: 700,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                }}
                                            >
                                                <span>✨</span>
                                                <span>{tier.popularBadge}</span>
                                            </div>
                                        )}

                                        {/* Left Side: Radio & Title */}
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                            <div
                                                style={{
                                                    width: "20px",
                                                    height: "20px",
                                                    borderRadius: "50%",
                                                    border: isSelected ? `2.5px solid ${accentColor}` : "2px solid #cbd5e1",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    backgroundColor: "#ffffff",
                                                }}
                                            >
                                                {isSelected && (
                                                    <div style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: accentColor }} />
                                                )}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: "15px", fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
                                                    {tier.title}
                                                </div>
                                                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                                                    {tier.getQty > 0
                                                        ? `${tier.buyQty} Paid + ${tier.getQty} Free (${tier.totalQty} total items)`
                                                        : `${tier.buyQty} Item${tier.buyQty > 1 ? "s" : ""} (Standard)`
                                                    }
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Side: Save Pill & Final Price */}
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                                            {tier.discount > 0 && tier.saveTag && (
                                                <span
                                                    style={{
                                                        color: accentColor,
                                                        fontWeight: 800,
                                                        fontSize: "12px",
                                                        backgroundColor: "#ecfdf5",
                                                        padding: "2px 6px",
                                                        borderRadius: "4px",
                                                    }}
                                                >
                                                    {tier.saveTag}
                                                </span>
                                            )}
                                            <div style={{ fontSize: "16px", fontWeight: 800, color: "#111827" }}>
                                                ${(finalCents / 100).toFixed(2)}
                                            </div>
                                            {tier.discount > 0 && (
                                                <div style={{ fontSize: "12px", color: "#9ca3af", textDecoration: "line-through" }}>
                                                    ${(rawCents / 100).toFixed(2)}
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
        </s-page>
    );
}
