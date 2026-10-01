import { useState } from "react";
import { useLoaderData, useSearchParams, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// ১. স্টোরের রিয়েল কালেকশন ও প্রোডাক্ট ফেচ করা
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
    const colRes = await admin.graphql(
        `#graphql
      query getCollections {
        collections(first: 10) {
          edges {
            node {
              id
              title
              productsCount {
                count
              }
            }
          }
        }
      }`
    );
    const colJson = await colRes.json();
    const collections = colJson.data?.collections?.edges?.map((e) => ({
        id: e.node.id,
        title: e.node.title,
        count: e.node.productsCount?.count || 0,
    })) || [
            { id: "col-1", title: "Collection 1", count: 2 },
            { id: "col-2", title: "Collection 2", count: 2 },
            { id: "col-3", title: "Home page", count: 1 },
        ];

    // Products query
    const prodRes = await admin.graphql(
        `#graphql
      query getProducts {
        products(first: 30) {
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
    const products = prodJson.data?.products?.edges?.map((e) => ({
        id: e.node.id,
        title: e.node.title,
        imageUrl: e.node.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
        price: parseFloat(e.node.variants?.edges[0]?.node?.price || "100.00"),
    })) || [
            { id: "p1", title: "product 1", imageUrl: "", price: 100.0 },
            { id: "p2", title: "product 2", imageUrl: "", price: 100.0 },
            { id: "p3", title: "product 3", imageUrl: "", price: 100.0 },
        ];

    return { collections, products, existingBundle };
};

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const bundleId = formData.get("bundleId");
    const title = formData.get("title");
    const strategy = "Multi-Collection Complete Bundle";
    const discount = formData.get("discountSummary");
    const products = formData.get("productsSummary");
    const bundleConfig = formData.get("bundleConfig");

    let savedBundle = null;
    if (bundleId) {
        savedBundle = await db.bundle.update({
            where: { id: bundleId },
            data: {
                title,
                discount,
                products: bundleConfig || products,
            },
        });
    } else {
        savedBundle = await db.bundle.create({
            data: {
                title,
                strategy,
                discount,
                products: bundleConfig || products,
                status: "Active",
            },
        });
    }

    // Sync with Shopify App Metafield for instant live storefront update
    try {
        let parsed = null;
        try { parsed = JSON.parse(bundleConfig); } catch (e) {}
        const discountMatch = discount?.match(/(\d+)%/);
        const discountNum = parsed?.discountPercent || (discountMatch ? parseInt(discountMatch[1], 10) : 15);

        const shopRes = await admin.graphql(`query { shop { id } }`);
        const shopJson = await shopRes.json();
        const shopId = shopJson.data?.shop?.id;

        if (shopId) {
            await admin.graphql(
                `#graphql
                mutation setBundleMetafield($metafields: [MetafieldsSetInput!]!) {
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
                                key: "active_bundle",
                                type: "json",
                                value: JSON.stringify({
                                    id: savedBundle.id,
                                    title: savedBundle.title,
                                    discountPercent: discountNum,
                                    discountSummary: savedBundle.discount,
                                    updatedAt: new Date().toISOString(),
                                }),
                            },
                        ],
                    },
                }
            );
        }
    } catch (err) {
        console.error("Metafield sync error:", err);
    }

    return { success: true, bundleId: savedBundle.id };
};

export default function BundleBuilder() {
    const { collections, products, existingBundle } = useLoaderData();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const brandColor = searchParams.get("color") || "#f59e0b";

    // Parse existing bundle data if in edit mode
    let initialDiscount = 15;
    let initialTitle = existingBundle?.title || "Multi-Collection Step Bundle";
    let initialRows = [
        { id: 1, collectionId: collections[0]?.id || "", selectionType: "all", selectedProducts: [] },
        { id: 2, collectionId: collections[1]?.id || "", selectionType: "all", selectedProducts: [] },
    ];

    if (existingBundle) {
        const match = existingBundle.discount?.match(/(\d+)%/);
        if (match) {
            initialDiscount = parseInt(match[1], 10);
        }
        try {
            const parsed = JSON.parse(existingBundle.products);
            if (parsed.collectionRows && Array.isArray(parsed.collectionRows) && parsed.collectionRows.length > 0) {
                initialRows = parsed.collectionRows;
            }
            if (parsed.discountPercent) {
                initialDiscount = parsed.discountPercent;
            }
        } catch (e) {}
    }

    const [collectionRows, setCollectionRows] = useState(initialRows);
    const [discountPercent, setDiscountPercent] = useState(initialDiscount);
    const [bundleTitle, setBundleTitle] = useState(initialTitle);
    const [isPublishing, setIsPublishing] = useState(false);

    // মোডাল স্টেট
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeRowId, setActiveRowId] = useState(null);
    const [tempSelectedProducts, setTempSelectedProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");

    // কালেকশন রো যোগ করা
    const addCollectionRow = () => {
        setCollectionRows([
            ...collectionRows,
            { id: collectionRows.length + 1, collectionId: collections[0]?.id || "", selectionType: "all", selectedProducts: [] },
        ]);
    };

    // রো রিমুভ করা
    const removeCollectionRow = (id) => {
        if (collectionRows.length > 1) {
            setCollectionRows(collectionRows.filter((r) => r.id !== id));
        }
    };

    // টাইপ পরিবর্তন (All products vs Specific products)
    const handleTypeChange = (rowId, type) => {
        setCollectionRows(
            collectionRows.map((row) =>
                row.id === rowId ? { ...row, selectionType: type } : row
            )
        );
    };

    // মোডাল ওপেন
    const openProductModal = (rowId) => {
        setActiveRowId(rowId);
        const currentRow = collectionRows.find((r) => r.id === rowId);
        setTempSelectedProducts(currentRow?.selectedProducts || []);
        setSearchQuery("");
        setIsModalOpen(true);
    };

    // মোডালে প্রোডাক্ট সিলেক্ট টগল
    const toggleProductInModal = (productId) => {
        setTempSelectedProducts((prev) =>
            prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
        );
    };

    // মোডাল সেভ
    const handleSaveModal = () => {
        setCollectionRows(
            collectionRows.map((row) =>
                row.id === activeRowId ? { ...row, selectedProducts: tempSelectedProducts } : row
            )
        );
        setIsModalOpen(false);
    };

    // পাবলিশ করা
    const handlePublish = async () => {
        setIsPublishing(true);
        const formData = new FormData();
        if (existingBundle) {
            formData.append("bundleId", existingBundle.id);
        }
        formData.append("title", bundleTitle);
        formData.append("discountSummary", `${discountPercent}% OFF (All ${collectionRows.length} Collections)`);
        formData.append("productsSummary", `Must pick 1 product from each of ${collectionRows.length} Collections`);

        const bundleConfig = {
            discountPercent,
            collectionRows,
            brandColor,
            title: bundleTitle,
        };
        formData.append("bundleConfig", JSON.stringify(bundleConfig));

        const res = await fetch("/app/bundle-builder", {
            method: "POST",
            body: formData,
        });

        if (res.ok) {
            alert(existingBundle ? "Bundle updated successfully! Redirecting to Dashboard..." : "Bundle published successfully! Redirecting to Dashboard...");
            navigate("/app");
        } else {
            alert("Failed to save bundle. Please try again.");
        }
        setIsPublishing(false);
    };

    // প্রাইস ক্যালকুলেশন (ডায়নামিক)
    const basePricePerItem = products[0]?.price || 100.0;
    const totalCollectionsCount = collectionRows.length;
    const originalTotalPrice = basePricePerItem * totalCollectionsCount;
    const discountedTotalPrice = originalTotalPrice * (1 - discountPercent / 100);

    // ফিল্টার প্রোডাক্টস
    const filteredProducts = products.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <s-page heading={existingBundle ? `Edit Bundle: ${existingBundle.title}` : "Multi-Collection Bundle Builder"}>
            {/* টপ অ্যাকশন বার */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <button
                    onClick={() => navigate(existingBundle ? "/app" : "/app/templates")}
                    style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: "14px" }}
                >
                    ← Back to Templates
                </button>
                <div style={{ display: "flex", gap: "10px" }}>
                    <button style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
                        Save as draft
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={isPublishing}
                        style={{ padding: "8px 20px", borderRadius: "6px", border: "none", background: "#111827", color: "#fff", fontWeight: "bold", cursor: "pointer" }}
                    >
                        {isPublishing ? "Saving..." : existingBundle ? "Update Bundle ??" : "Publish Bundle ??"}
                    </button>
                </div>
            </div>

            {/* ২ কলাম গ্রিড লেআউট */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px" }}>

                {/* ================= বাম পাশ: কনফিগারেশন ================= */}
                <div>
                    {/* বান্ডেল টাইটেল */}
                    <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "10px", border: "1px solid #e5e7eb", marginBottom: "16px" }}>
                        <label style={{ display: "block", fontWeight: "bold", marginBottom: "8px" }}>Bundle Campaign Title</label>
                        <input
                            type="text"
                            value={bundleTitle}
                            onChange={(e) => setBundleTitle(e.target.value)}
                            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px" }}
                        />
                    </div>

                    {/* কালেকশন স্টেপস (Row 1, Row 2, Row 3...) */}
                    <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "10px", border: "1px solid #e5e7eb", marginBottom: "16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <div>
                                <h3 style={{ margin: "0 0 4px 0" }}>Collection Rows ({totalCollectionsCount} Steps)</h3>
                                <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                                    Customers must pick products from all {totalCollectionsCount} collection rows to qualify for the bundle discount.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={addCollectionRow}
                                style={{ padding: "6px 12px", backgroundColor: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
                            >
                                + Add Collection Row
                            </button>
                        </div>

                        {collectionRows.map((row, index) => (
                            <div
                                key={row.id}
                                style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", marginBottom: "14px", backgroundColor: "#fafafa" }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                    <span style={{ fontWeight: "bold", fontSize: "14px" }}>
                                        Row #{index + 1}: Step {index + 1} Collection
                                    </span>
                                    {collectionRows.length > 1 && (
                                        <button
                                            onClick={() => removeCollectionRow(row.id)}
                                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "12px" }}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>

                                {/* কালেকশন সিলেক্টর ড্রপডাউন */}
                                <select
                                    value={row.collectionId}
                                    onChange={(e) => {
                                        const newRows = [...collectionRows];
                                        newRows[index].collectionId = e.target.value;
                                        setCollectionRows(newRows);
                                    }}
                                    style={{ width: "100%", padding: "9px", borderRadius: "6px", border: "1px solid #ccc", marginBottom: "12px", backgroundColor: "#fff" }}
                                >
                                    {collections.map((col) => (
                                        <option key={col.id} value={col.id}>
                                            📁 {col.title} ({col.count} products)
                                        </option>
                                    ))}
                                </select>

                                {/* রেডিও অপশন (All vs Specific) */}
                                <div style={{ display: "flex", gap: "20px", fontSize: "14px", marginBottom: "10px" }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                                        <input
                                            type="radio"
                                            name={`prod-type-${row.id}`}
                                            checked={row.selectionType === "all"}
                                            onChange={() => handleTypeChange(row.id, "all")}
                                        />
                                        All products in collection
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                                        <input
                                            type="radio"
                                            name={`prod-type-${row.id}`}
                                            checked={row.selectionType === "specific"}
                                            onChange={() => handleTypeChange(row.id, "specific")}
                                        />
                                        Specific products
                                    </label>
                                </div>

                                {/* Specific Products বাটন */}
                                {row.selectionType === "specific" && (
                                    <button
                                        type="button"
                                        onClick={() => openProductModal(row.id)}
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            backgroundColor: "#18181b",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: "6px",
                                            fontWeight: "bold",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: "8px",
                                            marginTop: "6px",
                                        }}
                                    >
                                        <span>⊕</span> {row.selectedProducts.length > 0 ? `Selected (${row.selectedProducts.length} products) - Click to edit` : "Select products"}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* ডায়নামিক কালেকশন ডিসকাউন্ট কার্ড */}
                    <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
                        <h3 style={{ margin: "0 0 6px 0", fontSize: "16px" }}>Dynamic Collection Discount</h3>
                        <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#6b7280" }}>
                            Applied automatically when a customer picks products across all <strong>{totalCollectionsCount} collections</strong>.
                        </p>

                        <div style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#f9fafb", padding: "14px", borderRadius: "8px", border: "1px solid #eee" }}>
                            <div style={{ flex: 1, fontSize: "14px", fontWeight: "bold" }}>
                                Complete all {totalCollectionsCount} Collection Rows:
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "140px" }}>
                                <input
                                    type="number"
                                    value={discountPercent}
                                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", fontWeight: "bold" }}
                                />
                                <span style={{ fontSize: "15px", fontWeight: "bold" }}>% OFF</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ================= ডান পাশ: ডায়নামিক লাইভ প্রিভিউ ================= */}
                <div>
                    <div style={{ position: "sticky", top: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <span style={{ fontWeight: "bold", fontSize: "14px", color: "#4b5563" }}>Live Storefront Preview ↗</span>
                            <span style={{ fontSize: "12px", color: "#6b7280" }}>Real-time updates</span>
                        </div>

                        {/* প্রোডাক্ট পেজের আসল ডার্ক উইজেট (Golden Honey Box Style) */}
                        <div
                            style={{
                                backgroundColor: "#1c1917",
                                borderRadius: "12px",
                                padding: "24px",
                                color: "#fff",
                                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                            }}
                        >
                            <div style={{ textAlign: "center", marginBottom: "16px" }}>
                                <span style={{ color: brandColor, letterSpacing: "1px", fontSize: "12px", fontWeight: "bold", textTransform: "uppercase" }}>
                                    COMPLETE BOX OF {totalCollectionsCount} COLLECTIONS
                                </span>
                                <h2 style={{ margin: "4px 0", fontSize: "20px" }}>{bundleTitle}</h2>
                                <div style={{ fontSize: "14px", color: "#a1a1aa" }}>
                                    Pick at least 1 item from each collection below:
                                </div>
                            </div>

                            {/* কালেকশন স্টেপস ভিজ্যুয়ালাইজেশন */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                                {collectionRows.map((row, idx) => {
                                    const col = collections.find((c) => c.id === row.collectionId) || collections[0];
                                    return (
                                        <div
                                            key={row.id}
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "10px 14px",
                                                backgroundColor: "#292524",
                                                borderRadius: "8px",
                                                border: "1px solid #444",
                                                fontSize: "13px",
                                            }}
                                        >
                                            <span style={{ fontWeight: "bold" }}>
                                                Step {idx + 1}: {col?.title || `Collection ${idx + 1}`}
                                            </span>
                                            <span style={{ color: brandColor, fontSize: "12px" }}>
                                                {row.selectionType === "all" ? "✓ All Items Eligible" : `✓ ${row.selectedProducts.length || "Specific"} Items`}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* বান্ডেল প্রাইসিং কার্ড */}
                            <div
                                style={{
                                    position: "relative",
                                    border: `2px solid ${brandColor}`,
                                    borderRadius: "8px",
                                    padding: "16px",
                                    backgroundColor: "#292524",
                                }}
                            >
                                <div
                                    style={{
                                        position: "absolute",
                                        top: "-10px",
                                        right: "16px",
                                        backgroundColor: brandColor,
                                        color: "#000",
                                        fontSize: "10px",
                                        fontWeight: "bold",
                                        padding: "2px 8px",
                                        borderRadius: "12px",
                                        textTransform: "uppercase",
                                    }}
                                >
                                    ★ {discountPercent}% BUNDLE DISCOUNT
                                </div>

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontWeight: "bold", fontSize: "15px" }}>
                                            Buy from all {totalCollectionsCount} Collections
                                        </div>
                                        <small style={{ color: "#a1a1aa" }}>Instant {discountPercent}% OFF unlocked at checkout</small>
                                    </div>

                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontWeight: "bold", fontSize: "18px", color: brandColor }}>
                                            ${discountedTotalPrice.toFixed(2)}
                                        </div>
                                        {discountPercent > 0 && (
                                            <div style={{ fontSize: "12px", color: "#71717a", textDecoration: "line-through" }}>
                                                ${originalTotalPrice.toFixed(2)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Add to Cart বাটন */}
                            <button
                                style={{
                                    width: "100%",
                                    marginTop: "16px",
                                    padding: "14px",
                                    backgroundColor: brandColor,
                                    color: "#000",
                                    border: "none",
                                    borderRadius: "6px",
                                    fontWeight: "bold",
                                    fontSize: "15px",
                                    cursor: "pointer",
                                }}
                            >
                                ADD COMPLETE BUNDLE TO CART
                            </button>

                            <div style={{ textAlign: "center", marginTop: "12px", fontSize: "12px", color: "#a1a1aa" }}>
                                ✓ Native Shopify Functions • Separate Inventory Tracking
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* প্রোডাক্ট সিলেক্টর মোডাল */}
            {isModalOpen && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100vw",
                        height: "100vh",
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                    }}
                >
                    <div
                        style={{
                            backgroundColor: "#fff",
                            borderRadius: "12px",
                            width: "550px",
                            maxWidth: "90%",
                            maxHeight: "85vh",
                            display: "flex",
                            flexDirection: "column",
                            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
                        }}
                    >
                        {/* Modal Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #eee" }}>
                            <h3 style={{ margin: 0, fontSize: "16px" }}>Select products</h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#666" }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Search Input */}
                        <div style={{ padding: "12px 20px", borderBottom: "1px solid #eee" }}>
                            <input
                                type="text"
                                placeholder="🔍 Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px" }}
                            />
                        </div>

                        {/* Product List */}
                        <div style={{ overflowY: "auto", flex: 1, padding: "10px 20px" }}>
                            {filteredProducts.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "20px", color: "#888" }}>No products found</div>
                            ) : (
                                filteredProducts.map((p) => {
                                    const isChecked = tempSelectedProducts.includes(p.id);
                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => toggleProductInModal(p.id)}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "12px",
                                                padding: "10px 0",
                                                borderBottom: "1px solid #f3f4f6",
                                                cursor: "pointer",
                                            }}
                                        >
                                            <input type="checkbox" checked={isChecked} readOnly style={{ width: "16px", height: "16px" }} />
                                            <img
                                                src={p.imageUrl}
                                                alt={p.title}
                                                style={{ width: "42px", height: "42px", objectFit: "cover", borderRadius: "6px", border: "1px solid #e5e7eb" }}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: "14px", fontWeight: "bold" }}>{p.title}</div>
                                                <div style={{ fontSize: "12px", color: "#6b7280" }}>${p.price.toFixed(2)}</div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderTop: "1px solid #eee" }}>
                            <span style={{ fontSize: "13px", color: "#6b7280" }}>
                                {tempSelectedProducts.length}/200 products selected
                            </span>
                            <div style={{ display: "flex", gap: "10px" }}>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveModal}
                                    style={{ padding: "8px 20px", borderRadius: "6px", border: "none", background: "#111827", color: "#fff", fontWeight: "bold", cursor: "pointer" }}
                                >
                                    Select
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

        </s-page>
    );
}
