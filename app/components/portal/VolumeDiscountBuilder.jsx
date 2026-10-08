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
  const handleAddTier = () => {
    const nextQty = tiers.length > 0 ? Math.max(...tiers.map((t) => t.quantity)) + 1 : 1;
    const nextDisc = tiers.length > 0 ? Math.min(Math.max(...tiers.map((t) => t.discountPercent)) + 5, 80) : 10;
    setTiers([
      ...tiers,
      {
        quantity: nextQty,
        discountPercent: nextDisc,
        label: `${nextQty} Units Pack`,
        badge: `SAVE ${nextDisc}%`,
      },
    ]);
  };

  const handleRemoveTier = (idx) => {
    if (tiers.length <= 1) {
      alert("At least 1 tier is required.");
      return;
    }
    setTiers(tiers.filter((_, i) => i !== idx));
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

          {/* Applies To Selection (All Products vs Specific Products vs Specific Collections) */}
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
                        <img src={p.image} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
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
                        <span>📁</span>
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

          {/* Tiers Configuration */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Quantity Discount Tiers</label>
              <button
                type="button"
                onClick={handleAddTier}
                style={{ background: "#0f172a", color: "#ffffff", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                + Add Tier
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tiers.map((tier, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr auto", gap: 10, alignItems: "center", background: "#f8fafc", padding: 12, borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Quantity</div>
                    <input
                      type="number"
                      value={tier.quantity}
                      onChange={(e) => {
                        const next = [...tiers];
                        next[idx].quantity = parseInt(e.target.value, 10) || 1;
                        setTiers(next);
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
                        const next = [...tiers];
                        next[idx].discountPercent = parseInt(e.target.value, 10) || 0;
                        setTiers(next);
                      }}
                      style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Badge / Label</div>
                    <input
                      type="text"
                      value={tier.badge}
                      onChange={(e) => {
                        const next = [...tiers];
                        next[idx].badge = e.target.value;
                        setTiers(next);
                      }}
                      style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTier(idx)}
                    style={{ background: "none", border: "none", color: "#ef4444", fontSize: 16, cursor: "pointer", padding: "4px" }}
                  >
                    🗑
                  </button>
                </div>
              ))}
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
                style={{ width: 60, height: 36, border: "none", cursor: "pointer", borderRadius: 6 }}
              />
              <span style={{ fontSize: 13, color: "#64748b", fontFamily: "monospace" }}>{color}</span>
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
            {tiers.map((t, idx) => (
              <div
                key={idx}
                style={{
                  border: `1.5px solid ${idx === 1 ? color : "#e2e8f0"}`,
                  background: idx === 1 ? "#fffbeb" : "#ffffff",
                  borderRadius: 10,
                  padding: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>
                    {t.quantity}x {t.label || `Quantity ${t.quantity}`}
                  </div>
                  {t.discountPercent > 0 ? (
                    <div style={{ fontSize: 12, color: color, fontWeight: 700, marginTop: 2 }}>
                      Save {t.discountPercent}% OFF
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Regular Price</div>
                  )}
                </div>
                <span
                  style={{
                    background: color,
                    color: "#ffffff",
                    fontSize: 10,
                    padding: "3px 8px",
                    borderRadius: 9999,
                    fontWeight: 800,
                  }}
                >
                  {t.badge || `TIER ${idx + 1}`}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            style={{
              width: "100%",
              marginTop: 18,
              padding: 12,
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
