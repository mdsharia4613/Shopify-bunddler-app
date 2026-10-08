export default function VolumeDiscountBuilder({
  title,
  setTitle,
  selectedProducts,
  setSelectedProducts,
  tiers,
  setTiers,
  color,
  setColor,
  onOpenProductPicker,
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 28, alignItems: "start" }}>
      {/* Left Column: Form Configuration */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Campaign Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
            />
          </div>

          {/* Option 1: Selected Products with Modal Launcher */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Target Products ({selectedProducts.length})</label>
              <button
                type="button"
                onClick={onOpenProductPicker}
                style={{ background: "#0f172a", color: "#ffffff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                🔍 Select Products from Store
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selectedProducts.map((p) => (
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
                    onClick={() => setSelectedProducts(selectedProducts.filter((x) => x.id !== p.id))}
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
              {tiers.map((tier, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: 10, background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Qty</div>
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
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Badge Label</div>
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
                </div>
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Widget Accent Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: 60, height: 36, border: "none", cursor: "pointer" }}
            />
          </div>
        </div>
      </div>

      {/* Right Column: Live Interactive Storefront Preview */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, position: "sticky", top: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <span>👁</span> Storefront Live Preview
        </div>

        <div style={{ border: `2px solid ${color}`, borderRadius: 14, padding: 18, background: "#fafafa" }}>
          <h4 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 800 }}>Choose Quantity:</h4>
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
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{t.quantity}x {t.label}</div>
                  {t.discountPercent > 0 && (
                    <div style={{ fontSize: 12, color, fontWeight: 700 }}>Save {t.discountPercent}%</div>
                  )}
                </div>
                <span style={{ background: color, color: "#ffffff", fontSize: 10, padding: "2px 8px", borderRadius: 9999, fontWeight: 800 }}>
                  {t.badge}
                </span>
              </div>
            ))}
          </div>
          <button style={{ width: "100%", marginTop: 16, padding: 12, background: "#0f172a", color: "#ffffff", borderRadius: 8, border: "none", fontWeight: 800 }}>
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
