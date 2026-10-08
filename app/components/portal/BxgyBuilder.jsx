import { useState } from "react";

export default function BxgyBuilder({
  title,
  setTitle,
  headerTitle,
  setHeaderTitle,
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
  defaultTier,
  setDefaultTier,
  onOpenProductPicker,
  onOpenCollectionPicker,
}) {
  const [previewSelectedTier, setPreviewSelectedTier] = useState(defaultTier || 1);

  // Update tier fields and auto-calc savings
  const handleUpdateTier = (idx, field, value) => {
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
        next[idx].title = gQty > 0 ? `Buy ${bQty} Get ${gQty} Free` : `Buy ${bQty}`;
      }
    }

    setTiers(next);
  };

  const handleAddTier = () => {
    const newId = tiers.length > 0 ? Math.max(...tiers.map((t) => t.id || 0)) + 1 : 1;
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

  const handleRemoveTier = (idx) => {
    if (tiers.length <= 1) {
      alert("At least 1 tier is required for a BXGY deal.");
      return;
    }
    const next = tiers.filter((_, i) => i !== idx);
    setTiers(next);
    if (defaultTier > next.length) {
      setDefaultTier(1);
    }
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
              placeholder="Buy X, Get Y Deal"
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
            />
          </div>

          {/* Header Title for storefront */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>
              Storefront Header Banner
            </label>
            <input
              type="text"
              value={headerTitle}
              onChange={(e) => setHeaderTitle(e.target.value)}
              placeholder="Buy X, Get Y (BXGY) Special"
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
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                  Selected Products ({selectedProducts.length})
                </label>
                <button
                  type="button"
                  onClick={onOpenProductPicker}
                  style={{ background: "#0f172a", color: "#ffffff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  🔍 Browse Products
                </button>
              </div>

              {selectedProducts.length === 0 ? (
                <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px dashed #cbd5e1", textAlign: "center", fontSize: 12, color: "#64748b" }}>
                  No products selected yet. Click "Browse Products" to add.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                  {selectedProducts.map((p) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img src={p.image || "https://placehold.co/40x40?text=P"} alt={p.title} style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover" }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{p.title}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>${p.price}</div>
                        </div>
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
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                  Selected Collections ({selectedCollections.length})
                </label>
                <button
                  type="button"
                  onClick={onOpenCollectionPicker}
                  style={{ background: "#0f172a", color: "#ffffff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  📁 Browse Collections
                </button>
              </div>

              {selectedCollections.length === 0 ? (
                <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px dashed #cbd5e1", textAlign: "center", fontSize: 12, color: "#64748b" }}>
                  No collections selected yet. Click "Browse Collections" to add.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                  {selectedCollections.map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 20 }}>📁</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{c.title}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>/{c.handle}</div>
                        </div>
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

          {/* BXGY Tiers Configuration */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                  BXGY Discount Tiers ({tiers.length})
                </label>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Set Buy (X) and Free (Y) quantities. Savings % calculates automatically.
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
              {tiers.map((t, idx) => (
                <div
                  key={t.id || idx}
                  style={{
                    background: "#f8fafc",
                    padding: 16,
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>Tier {idx + 1}</span>
                      {t.saveTag && (
                        <span style={{ background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999 }}>
                          {t.saveTag}
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

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
                        Buy Quantity (X)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={t.buyQty}
                        onChange={(e) => handleUpdateTier(idx, "buyQty", e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
                        Get Free Quantity (Y)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={t.getQty}
                        onChange={(e) => handleUpdateTier(idx, "getQty", e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, fontWeight: 700 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
                        Tier Title / Label
                      </label>
                      <input
                        type="text"
                        value={t.title}
                        onChange={(e) => {
                          const next = [...tiers];
                          next[idx].title = e.target.value;
                          next[idx].customTitle = true;
                          setTiers(next);
                        }}
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
                        Badge (e.g. Best Value)
                      </label>
                      <input
                        type="text"
                        placeholder="Popular, Best Value"
                        value={t.popularBadge || ""}
                        onChange={(e) => handleUpdateTier(idx, "popularBadge", e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>
              Accent Color
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: 44, height: 44, borderRadius: 8, border: "1px solid #cbd5e1", cursor: "pointer", padding: 2 }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>{color}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Live Storefront Preview */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, position: "sticky", top: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <span>👁</span> Storefront Live Preview
        </div>

        <div style={{ border: `2px solid ${color}`, borderRadius: 14, padding: 18, background: "#fafafa" }}>
          {/* Header */}
          <div style={{ background: color, color: "#ffffff", padding: "10px 14px", borderRadius: 8, fontWeight: 800, fontSize: 14, textAlign: "center", marginBottom: 14 }}>
            🎁 {headerTitle || "Buy X, Get Y Special Deal"}
          </div>

          {/* Product Preview if specific */}
          {selectedProducts.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#ffffff", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 14 }}>
              <img src={selectedProducts[0]?.image || "https://placehold.co/44x44?text=P"} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{selectedProducts[0]?.title}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Applicable to this item</div>
              </div>
            </div>
          )}

          {/* Tier Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {tiers.map((t, idx) => {
              const isSelected = (previewSelectedTier === t.id) || (previewSelectedTier === idx + 1);
              return (
                <div
                  key={t.id || idx}
                  onClick={() => setPreviewSelectedTier(t.id || idx + 1)}
                  style={{
                    position: "relative",
                    background: "#ffffff",
                    border: `2px solid ${isSelected ? color : "#e2e8f0"}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    boxShadow: isSelected ? "0 4px 12px rgba(0,0,0,0.06)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {t.popularBadge && (
                    <div
                      style={{
                        position: "absolute",
                        top: -9,
                        right: 14,
                        background: color,
                        color: "#ffffff",
                        fontSize: 10,
                        fontWeight: 900,
                        padding: "2px 8px",
                        borderRadius: 999,
                        textTransform: "uppercase",
                      }}
                    >
                      {t.popularBadge}
                    </div>
                  )}

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
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        Pay for {t.buyQty}, Get {t.getQty} Free (Total: {t.totalQty || (t.buyQty + t.getQty)})
                      </div>
                    </div>
                  </div>

                  {t.saveTag && (
                    <span
                      style={{
                        background: "#dcfce7",
                        color: "#15803d",
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "4px 8px",
                        borderRadius: 6,
                      }}
                    >
                      {t.saveTag}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <button
            type="button"
            style={{
              width: "100%",
              padding: "13px 18px",
              background: color,
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            Claim Deal & Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
