export default function StepBundleBuilder({
  title,
  setTitle,
  step1Products,
  step2Products,
  step3Products,
  discountPercent,
  setDiscountPercent,
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

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Step 1 */}
            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>STEP 1</div>
                  <strong style={{ fontSize: 13 }}>{step1Products[0]?.title || "No product selected"}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenProductPicker("step1")}
                  style={{ background: "#0f172a", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Change
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>STEP 2</div>
                  <strong style={{ fontSize: 13 }}>{step2Products[0]?.title || "No product selected"}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenProductPicker("step2")}
                  style={{ background: "#0f172a", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Change
                </button>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>STEP 3</div>
                  <strong style={{ fontSize: 13 }}>{step3Products[0]?.title || "No product selected"}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenProductPicker("step3")}
                  style={{ background: "#0f172a", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Change
                </button>
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Bundle Discount %</label>
            <input
              type="number"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(parseInt(e.target.value, 10) || 15)}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Complete 3-Step Bundle</h4>
            <span style={{ color, fontWeight: 800, fontSize: 12 }}>{discountPercent}% OFF</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            <div style={{ background: "#ffffff", padding: 8, borderRadius: 6, fontSize: 12 }}>1. {step1Products[0]?.title || "Step 1 Item"}</div>
            <div style={{ background: "#ffffff", padding: 8, borderRadius: 6, fontSize: 12 }}>2. {step2Products[0]?.title || "Step 2 Item"}</div>
            <div style={{ background: "#ffffff", padding: 8, borderRadius: 6, fontSize: 12 }}>3. {step3Products[0]?.title || "Step 3 Item"}</div>
          </div>
          <button style={{ width: "100%", padding: 12, background: color, color: "#ffffff", borderRadius: 8, border: "none", fontWeight: 800 }}>
            Add Complete Bundle to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
