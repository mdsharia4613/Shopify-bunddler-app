import { useState } from "react";

export default function VolumeDiscountBuilder({
  title,
  setTitle,
  appliesTo,
  setAppliesTo,
  selectedProducts,
  setSelectedProducts,
  selectedCollections,
  setSelectedCollections,
  tiers,
  setTiers,
  color,
  setColor,
  onOpenProductPicker,
  onOpenCollectionPicker,
}) {
  const [previewTierIdx, setPreviewTierIdx] = useState(1);

  const handleAddTier = () => {
    const nextQty = tiers.length > 0 ? Math.max(...tiers.map((t) => t.quantity || t.qty || 1)) + 1 : 1;
    const nextDisc = tiers.length > 0 ? Math.min(Math.max(...tiers.map((t) => t.discountPercent || t.discount || 0)) + 5, 80) : 10;
    const nextTitle = `${nextQty} Units Pack`;
    setTiers([
      ...tiers,
      {
        id: Date.now(),
        title: nextTitle,
        label: nextTitle,
        quantity: nextQty,
        qty: nextQty,
        discountPercent: nextDisc,
        discount: nextDisc,
        badge: `SAVE ${nextDisc}%`,
        popularBadge: `SAVE ${nextDisc}%`,
      },
    ]);
  };

  const handleRemoveTier = (idx) => {
    if (tiers.length <= 1) {
      alert("At least 1 tier is required.");
      return;
    }
    const next = tiers.filter((_, i) => i !== idx);
    setTiers(next);
    if (previewTierIdx >= next.length) {
      setPreviewTierIdx(0);
    }
  };

  const handleUpdateTier = (idx, field, value) => {
    const next = [...tiers];
    if (field === "title") {
      next[idx].title = value;
      next[idx].label = value;
    } else if (field === "quantity") {
      const q = Math.max(1, parseInt(value, 10) || 1);
      next[idx].quantity = q;
      next[idx].qty = q;
    } else if (field === "discountPercent") {
      const d = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
      next[idx].discountPercent = d;
      next[idx].discount = d;
    } else if (field === "badge") {
      next[idx].badge = value;
      next[idx].popularBadge = value;
    } else {
      next[idx][field] = value;
    }
    setTiers(next);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 28, alignItems: "start" }}>
      {/* Left Column: Form Configuration */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Campaign Title */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>
              Campaign Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Volume Discounts Campaign"
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
            />
          </div>

          {/* Applies To Selection */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 8 }}>
              Applies To
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[
                { id: "all", label: "All Products", icon: "🌐" },
                { id: "products", label: "Specific Products", icon: "📦" },
                { id: "collections", label: "Collections", icon: "📁" },
              ].map((opt) => {
                const isActive = appliesTo === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAppliesTo(opt.id)}
                    style={{
                      padding: "10px",
                      borderRadius: 10,
                      border: `1.5px solid ${isActive ? "#0f172a" : "#e2e8f0"}`,
                      background: isActive ? "#0f172a" : "#ffffff",
                      color: isActive ? "#ffffff" : "#334155",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Specific Products List */}
          {appliesTo === "products" && (
            <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                  Selected Products ({selectedProducts.length})
                </span>
                <button
                  type="button"
                  onClick={onOpenProductPicker}
                  style={{ background: "#0f172a", color: "#ffffff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  🔍 Select Products
                </button>
              </div>

              {selectedProducts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px", color: "#64748b", fontSize: 13 }}>
                  No products selected. Click <strong>Select Products</strong> to choose items.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                  {selectedProducts.map((p) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img src={p.image || "https://placehold.co/32x32?text=P"} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProducts(selectedProducts.filter((x) => x.id !== p.id))}
                        style={{ background: "none", border: "none", color: "#ef4444", fontSize: 16, cursor: "pointer" }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Specific Collections List */}
          {appliesTo === "collections" && (
            <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                  Selected Collections ({selectedCollections.length})
                </span>
                <button
                  type="button"
                  onClick={onOpenCollectionPicker}
                  style={{ background: "#0f172a", color: "#ffffff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  📁 Select Collections
                </button>
              </div>

              {selectedCollections.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px", color: "#64748b", fontSize: 13 }}>
                  No collections selected. Click <strong>Select Collections</strong> to choose collections.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                  {selectedCollections.map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>📁</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{c.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCollections(selectedCollections.filter((x) => x.id !== c.id))}
                        style={{ background: "none", border: "none", color: "#ef4444", fontSize: 16, cursor: "pointer" }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quantity Discount Tiers (Dynamic Title & Quantity) */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                  Quantity Discount Tiers ({tiers.length})
                </label>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Set a dynamic title / label, required quantity, discount %, and optional badge for each tier.
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddTier}
                style={{
                  background: "#0f172a",
                  color: "#ffffff",
                  border: "none",
                  padding: "7px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + Add Tier
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {tiers.map((tier, idx) => {
                const currentTitle = tier.title || tier.label || `${tier.quantity || 1} Units Pack`;
                const currentQty = tier.quantity ?? tier.qty ?? 1;
                const currentDisc = tier.discountPercent ?? tier.discount ?? 0;
                const currentBadge = tier.badge || tier.popularBadge || "";

                return (
                  <div
                    key={tier.id || idx}
                    style={{
                      background: "#f8fafc",
                      padding: 16,
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {/* Tier Card Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            background: "#0f172a",
                            color: "#ffffff",
                            fontSize: 11,
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 6,
                          }}
                        >
                          TIER {idx + 1}
                        </span>
                        {currentDisc > 0 ? (
                          <span style={{ background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999 }}>
                            SAVE {currentDisc}%
                          </span>
                        ) : (
                          <span style={{ background: "#f1f5f9", color: "#64748b", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
                            STANDARD
                          </span>
                        )}
                      </div>

                      {tiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTier(idx)}
                          style={{ background: "none", border: "none", color: "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >
                          🗑 Remove
                        </button>
                      )}
                    </div>

                    {/* Row 1: Dynamic Title & Quantity */}
                    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
                          Tier Title / Label (Dynamic)
                        </label>
                        <input
                          type="text"
                          value={currentTitle}
                          placeholder="e.g. Single, Duo Pack, Trio Pack"
                          onChange={(e) => handleUpdateTier(idx, "title", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 700,
                            background: "#ffffff",
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
                          Quantity (Units)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={currentQty}
                          onChange={(e) => handleUpdateTier(idx, "quantity", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 700,
                            background: "#ffffff",
                          }}
                        />
                      </div>
                    </div>

                    {/* Row 2: Discount % & Badge */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
                          Discount %
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={currentDisc}
                          onChange={(e) => handleUpdateTier(idx, "discountPercent", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 700,
                            background: "#ffffff",
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
                          Badge Text (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. MOST POPULAR, BEST VALUE"
                          value={currentBadge}
                          onChange={(e) => handleUpdateTier(idx, "badge", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            fontSize: 13,
                            background: "#ffffff",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>
              Widget Accent Color
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: 44, height: 44, border: "1px solid #cbd5e1", cursor: "pointer", borderRadius: 8, padding: 2 }}
              />
              <span style={{ fontSize: 13, color: "#64748b", fontFamily: "monospace", fontWeight: 700 }}>{color}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Live Storefront Interactive Preview */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, position: "sticky", top: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <span>👁</span> Storefront Live Preview
        </div>

        <div style={{ border: `2px solid ${color}`, borderRadius: 14, padding: 20, background: "#fafafa" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Select Bundle Option:</h4>
            <span style={{ fontSize: 11, background: "#ecfdf5", color: "#065f46", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
              AUTO DISCOUNT
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {tiers.map((t, idx) => {
              const isSelected = previewTierIdx === idx;
              const tierTitle = t.title || t.label || `${t.quantity || 1} Units Pack`;
              const tierQty = t.quantity ?? t.qty ?? 1;
              const tierDisc = t.discountPercent ?? t.discount ?? 0;
              const tierBadge = t.badge || t.popularBadge;

              return (
                <div
                  key={t.id || idx}
                  onClick={() => setPreviewTierIdx(idx)}
                  style={{
                    border: `2px solid ${isSelected ? color : "#e2e8f0"}`,
                    background: isSelected ? "#fffbeb" : "#ffffff",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    boxShadow: isSelected ? "0 4px 12px rgba(0,0,0,0.06)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: `2px solid ${isSelected ? color : "#cbd5e1"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />}
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>
                        {tierTitle}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        Buy {tierQty} Units {tierDisc > 0 ? `• Save ${tierDisc}% OFF` : "• Regular Price"}
                      </div>
                    </div>
                  </div>

                  {tierBadge ? (
                    <span
                      style={{
                        background: color,
                        color: "#ffffff",
                        fontSize: 10,
                        padding: "3px 8px",
                        borderRadius: 9999,
                        fontWeight: 800,
                        textTransform: "uppercase",
                      }}
                    >
                      {tierBadge}
                    </span>
                  ) : tierDisc > 0 ? (
                    <span
                      style={{
                        background: "#dcfce7",
                        color: "#15803d",
                        fontSize: 10,
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontWeight: 800,
                      }}
                    >
                      SAVE {tierDisc}%
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            style={{
              width: "100%",
              marginTop: 18,
              padding: 13,
              background: "#0f172a",
              color: "#ffffff",
              borderRadius: 8,
              border: "none",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Add Selected Pack to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
