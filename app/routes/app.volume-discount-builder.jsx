import { useState } from "react";
import { useLoaderData, useSearchParams, useNavigate, useSubmit, Link } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// ১. Loader: এডিট মোড হলে ডাটা লোড করবে
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

// ২. Action: ডাটাবেসে সেভ করবে এবং শপিফাই মেটাফিল্ডে পাবলিশ করবে
export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const bundleId = formData.get("bundleId");
    const title = formData.get("title") || "Volume Discounts";
    const strategy = "Volume Discounts";
    const discountSummary = formData.get("discountSummary") || "Up to 20% OFF";
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
                                    footerHeading: parsedConfig.footerHeading || "Quantity breaks for same product",
                                    footerSubheading: parsedConfig.footerSubheading || "Single, Duo, Trio volume tiers",
                                    buttonText: parsedConfig.buttonText || "Choose",
                                    accentColor: parsedConfig.accentColor || "#eab308",
                                    cardBg: parsedConfig.cardBg || "#ffffff",
                                    borderColor: parsedConfig.borderColor || "#e5e7eb",
                                    textColor: parsedConfig.textColor || "#111827",
                                    btnBg: parsedConfig.btnBg || "#111827",
                                    btnTextColor: parsedConfig.btnTextColor || "#ffffff",
                                    defaultTier: parsedConfig.defaultTier || 2,
                                    tiers: parsedConfig.tiers || [],
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
    const { existingBundle } = useLoaderData();
    const [searchParams] = useSearchParams();
    const submit = useSubmit();
    const navigate = useNavigate();

    const brandColorParam = searchParams.get("color") || "#eab308";

    // Initial state parse from existing bundle
    let parsedInitial = null;
    if (existingBundle?.products) {
        try {
            parsedInitial = JSON.parse(existingBundle.products);
        } catch (e) {}
    }

    const [title, setTitle] = useState(existingBundle?.title || "Volume Discounts");
    const [headerTitle, setHeaderTitle] = useState(parsedInitial?.headerTitle || "");
    const [footerHeading, setFooterHeading] = useState(parsedInitial?.footerHeading || "Quantity breaks for same product");
    const [footerSubheading, setFooterSubheading] = useState(parsedInitial?.footerSubheading || "Single, Duo, Trio volume tiers");
    const [buttonText, setButtonText] = useState(parsedInitial?.buttonText || "Choose");
    const [accentColor, setAccentColor] = useState(parsedInitial?.accentColor || brandColorParam);
    const [defaultTier, setDefaultTier] = useState(parsedInitial?.defaultTier || 2);

    // Interactive preview selected tier state
    const [previewSelectedTier, setPreviewSelectedTier] = useState(defaultTier);

    const [tiers, setTiers] = useState(
        parsedInitial?.tiers || [
            { id: 1, qty: 1, title: "Buy 1 (Single)", discount: 0, badge: "" },
            { id: 2, qty: 2, title: "Buy 2 (Duo Pack)", discount: 10, badge: "Save 10%" },
            { id: 3, qty: 3, title: "Buy 3 (Trio Pack)", discount: 20, badge: "Save 20%" },
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
        const nextDiscount = tiers.length > 0 ? tiers[tiers.length - 1].discount + 10 : 10;
        setTiers([
            ...tiers,
            {
                id: Date.now(),
                qty: nextQty,
                title: `Buy ${nextQty} (Pack of ${nextQty})`,
                discount: Math.min(nextDiscount, 50),
                badge: `Save ${Math.min(nextDiscount, 50)}%`,
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

    // Publish / Save
    const handlePublish = () => {
        if (!title.trim()) {
            alert("Please enter a bundle title");
            return;
        }

        const maxDisc = Math.max(...tiers.map((t) => Number(t.discount) || 0));
        const discountSummary = maxDisc > 0 ? `Up to ${maxDisc}% OFF` : "Standard Pricing";

        const config = {
            headerTitle,
            footerHeading,
            footerSubheading,
            buttonText,
            accentColor,
            defaultTier: Number(defaultTier),
            tiers,
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

    // Sample price for preview calculation
    const sampleItemPrice = 45.0;

    return (
        <s-page heading="Volume Discounts Customizer">
            <s-link slot="breadcrumb" href="/app/templates">Back to Templates</s-link>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <p style={{ margin: 0, color: "#4b5563", fontSize: "14px" }}>
                    Configure your Volume Discounts widget. Once published, it will be saved to your Dashboard and synced with your storefront!
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

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px", alignItems: "start" }}>
                
                {/* বাম পাশ: সেটিংস ও টিয়ার কনফিগারেশন */}
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    
                    {/* General Settings */}
                    <div style={{ backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb", padding: "20px" }}>
                        <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700" }}>General Settings</h3>
                        
                        <div style={{ marginBottom: "14px" }}>
                            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                                Bundle Name (for your dashboard)
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px" }}
                                placeholder="e.g. Volume Discounts - Everyday Pack"
                            />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                                    Footer Title
                                </label>
                                <input
                                    type="text"
                                    value={footerHeading}
                                    onChange={(e) => setFooterHeading(e.target.value)}
                                    style={{ width: "100%", padding: "9px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                                    Footer Subtitle
                                </label>
                                <input
                                    type="text"
                                    value={footerSubheading}
                                    onChange={(e) => setFooterSubheading(e.target.value)}
                                    style={{ width: "100%", padding: "9px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
                                />
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                                    Action Button Text
                                </label>
                                <input
                                    type="text"
                                    value={buttonText}
                                    onChange={(e) => setButtonText(e.target.value)}
                                    style={{ width: "100%", padding: "9px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                                    Highlight / Accent Color
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
                            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>Discount Tiers</h3>
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

                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            {tiers.map((t, idx) => (
                                <div
                                    key={t.id || idx}
                                    style={{
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "8px",
                                        padding: "14px",
                                        backgroundColor: "#f9fafb",
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span style={{ fontWeight: "700", fontSize: "14px", color: "#111827" }}>
                                                Tier {idx + 1}
                                            </span>
                                            <label style={{ fontSize: "12px", color: "#4b5563", display: "flex", alignItems: "center", gap: "4px", marginLeft: "12px", cursor: "pointer" }}>
                                                <input
                                                    type="radio"
                                                    name="default_tier"
                                                    checked={Number(defaultTier) === idx + 1}
                                                    onChange={() => {
                                                        setDefaultTier(idx + 1);
                                                        setPreviewSelectedTier(idx + 1);
                                                    }}
                                                />
                                                Set as Default
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

                                    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1.2fr", gap: "10px" }}>
                                        <div>
                                            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#6b7280", marginBottom: "4px" }}>
                                                Title
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
                                                    if (disc > 0 && !t.badge) {
                                                        handleTierChange(idx, "badge", `Save ${disc}%`);
                                                    }
                                                }}
                                                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#6b7280", marginBottom: "4px" }}>
                                                Badge / Right Label
                                            </label>
                                            <input
                                                type="text"
                                                value={t.badge}
                                                onChange={(e) => handleTierChange(idx, "badge", e.target.value)}
                                                placeholder="e.g. Save 10%"
                                                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* ডান পাশ: লাইভ স্টোরফ্রন্ট প্রিভিউ */}
                <div style={{ position: "sticky", top: "20px" }}>
                    <div style={{ marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "700", fontSize: "14px", color: "#374151" }}>Live Storefront Preview</span>
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>Click cards to test interactivity</span>
                    </div>

                    <div
                        style={{
                            background: "#ffffff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "16px",
                            padding: "20px 18px",
                            boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
                        }}
                    >
                        {headerTitle && (
                            <div style={{ marginBottom: "14px" }}>
                                <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: "700", color: "#111827" }}>
                                    {headerTitle}
                                </h3>
                            </div>
                        )}

                        {/* Tiers List */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {tiers.map((t, idx) => {
                                const isSelected = previewSelectedTier === idx + 1;
                                const rawTotal = sampleItemPrice * t.qty;
                                const discountedTotal = rawTotal - rawTotal * ((Number(t.discount) || 0) / 100);

                                return (
                                    <div
                                        key={t.id || idx}
                                        onClick={() => setPreviewSelectedTier(idx + 1)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "13px 16px",
                                            border: isSelected ? `1.5px solid ${accentColor}` : "1px solid #e5e7eb",
                                            borderRadius: "10px",
                                            backgroundColor: isSelected ? "#fffdf5" : "#ffffff",
                                            cursor: "pointer",
                                            transition: "all 0.2s ease",
                                            boxShadow: isSelected ? `0 0 0 1px ${accentColor}` : "none",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <div
                                                style={{
                                                    width: "16px",
                                                    height: "16px",
                                                    borderRadius: "50%",
                                                    border: isSelected ? `1.5px solid ${accentColor}` : "1.5px solid #d1d5db",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                {isSelected && (
                                                    <div
                                                        style={{
                                                            width: "8px",
                                                            height: "8px",
                                                            borderRadius: "50%",
                                                            backgroundColor: accentColor,
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            <span style={{ fontSize: "14.5px", fontWeight: "500", color: "#111827" }}>
                                                {t.title}
                                            </span>
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14.5px", fontWeight: "600" }}>
                                            {t.badge ? (
                                                <span style={{ color: isSelected ? accentColor : "#4b5563", fontWeight: "700" }}>
                                                    {t.badge}
                                                </span>
                                            ) : (
                                                <span style={{ color: "#111827" }}>
                                                    ${discountedTotal.toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer Information */}
                        {(footerHeading || footerSubheading) && (
                            <div style={{ textAlign: "center", margin: "28px 0 16px" }}>
                                {footerHeading && (
                                    <h4 style={{ margin: "0 0 4px", fontSize: "14.5px", fontWeight: "700", color: "#111827" }}>
                                        {footerHeading}
                                    </h4>
                                )}
                                {footerSubheading && (
                                    <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                                        {footerSubheading}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Action Button */}
                        <div style={{ marginTop: "14px" }}>
                            <button
                                type="button"
                                style={{
                                    width: "100%",
                                    backgroundColor: "#111827",
                                    color: "#ffffff",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "13px 20px",
                                    fontSize: "15px",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.08)",
                                }}
                            >
                                {buttonText}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </s-page>
    );
}
