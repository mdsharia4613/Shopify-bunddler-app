export default function BxgyBuilder({
  title,
  setTitle,
  selectedProducts,
  setSelectedProducts,
  buyQty,
  setBuyQty,
  getQty,
  setGetQty,
  badge,
  setBadge,
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

          {/* Target Products */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Target Products</label>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Buy Quantity (X)</label>
              <input
                type="number"
                value={buyQty}
                onChange={(e) => setBuyQty(parseInt(e.target.value, 10) || 1)}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Get Free Quantity (Y)</label>
              <input
                type="number"
                value={getQty}
                onChange={(e) => setGetQty(parseInt(e.target.value, 10) || 1)}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Deal Badge Text</label>
            <input
              type="text"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Accent Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: 60, height: 36, border: "none", cursor: "pointer" }}
            />
          </div>
        </div>
      </div>

      {/* Right Column: Live Storefront Preview */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, position: "sticky", top: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <span>👁</span> Storefront Live Preview
        </div>

        <div style={{ border: `2px solid ${color}`, borderRadius: 14, padding: 18, background: "#fafafa" }}>
          <div style={{ background: color, color: "#fff", padding: "6px 12px", borderRadius: 6, fontWeight: 800, fontSize: 12, textAlign: "center", marginBottom: 12 }}>
            ★ {badge}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <img src={selectedProducts[0]?.image} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{selectedProducts[0]?.title || "Select a Product"}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Buy {buyQty}, Get {getQty} FREE!</div>
            </div>
          </div>
          <button style={{ width: "100%", padding: 12, background: "#0f172a", color: "#ffffff", borderRadius: 8, border: "none", fontWeight: 800 }}>
            Claim Deal & Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
