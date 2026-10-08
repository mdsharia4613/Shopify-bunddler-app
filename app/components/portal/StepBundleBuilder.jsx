export default function StepBundleBuilder({
  title,
  setTitle,
  collectionRows,
  setCollectionRows,
  discountPercent,
  setDiscountPercent,
  color,
  setColor,
  onOpenCollectionPicker,
}) {
  // Add new step
  const handleAddStep = () => {
    const nextId = collectionRows.length > 0 ? Math.max(...collectionRows.map((r) => r.id)) + 1 : 1;
    setCollectionRows([
      ...collectionRows,
      {
        id: nextId,
        stepTitle: `Step ${collectionRows.length + 1}`,
        collectionId: "",
        collectionTitle: "Select Collection",
        collectionHandle: "",
      },
    ]);
  };

  // Remove step (minimum 2 steps required for a bundle)
  const handleRemoveStep = (id) => {
    if (collectionRows.length <= 2) {
      alert("A bundle requires at least 2 steps.");
      return;
    }
    setCollectionRows(collectionRows.filter((r) => r.id !== id));
  };

  // Update step title
  const handleStepTitleChange = (id, newTitle) => {
    setCollectionRows(
      collectionRows.map((r) => (r.id === id ? { ...r, stepTitle: newTitle } : r))
    );
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
              placeholder="Multi-Collection Step Bundle"
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
            />
          </div>

          {/* Dynamic Collection Steps Section */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                  Bundle Collection Steps ({collectionRows.length})
                </label>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Customers pick 1 product from each collection to unlock the discount.
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddStep}
                style={{
                  background: "#0f172a",
                  color: "#ffffff",
                  border: "none",
                  padding: "7px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>+ Add Step</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {collectionRows.map((row, index) => (
                <div
                  key={row.id}
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
                        STEP {index + 1}
                      </span>
                      <input
                        type="text"
                        value={row.stepTitle}
                        onChange={(e) => handleStepTitleChange(row.id, e.target.value)}
                        placeholder={`Step ${index + 1} Title`}
                        style={{
                          border: "1px solid #cbd5e1",
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontSize: 13,
                          fontWeight: 700,
                          background: "#ffffff",
                        }}
                      />
                    </div>

                    {collectionRows.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(row.id)}
                        title="Remove this step"
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          fontSize: 16,
                          padding: "4px 8px",
                        }}
                      >
                        🗑
                      </button>
                    )}
                  </div>

                  {/* Selected Collection Card */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "#ffffff",
                      border: "1.5px solid #cbd5e1",
                      borderRadius: 10,
                      padding: "10px 14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: "#f1f5f9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                        }}
                      >
                        📁
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: row.collectionTitle ? "#0f172a" : "#94a3b8" }}>
                          {row.collectionTitle || "No collection selected"}
                        </div>
                        {row.collectionHandle && (
                          <div style={{ fontSize: 11, color: "#64748b" }}>
                            /{row.collectionHandle}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenCollectionPicker(row.id)}
                      style={{
                        background: "#0f172a",
                        color: "#ffffff",
                        border: "none",
                        padding: "6px 14px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {row.collectionId ? "Change" : "Select Collection"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bundle Discount % */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>
              Bundle Discount Percentage (%)
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min="1"
                max="90"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseInt(e.target.value, 10) || 15)}
                style={{ width: 100, padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#64748b" }}>% OFF when all {collectionRows.length} items added</span>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
              {title || "Multi-Collection Step Bundle"}
            </h4>
            <span
              style={{
                background: color,
                color: "#ffffff",
                fontWeight: 800,
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 9999,
              }}
            >
              Bundle & Save {discountPercent}%
            </span>
          </div>

          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px 0", lineHeight: 1.4 }}>
            Pick 1 item from each of the <strong>{collectionRows.length} collections</strong> below to unlock <strong>{discountPercent}% OFF</strong> at checkout.
          </p>

          {/* Dynamic Steps Mockup */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
            {collectionRows.map((row, idx) => (
              <div
                key={row.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "#f1f5f9",
                      fontSize: 12,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                      {row.stepTitle || `Step ${idx + 1}`}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      From: {row.collectionTitle || "Collection"}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: color,
                    border: `1px solid ${color}`,
                    padding: "3px 8px",
                    borderRadius: 6,
                  }}
                >
                  Select Item →
                </span>
              </div>
            ))}
          </div>

          {/* Pricing Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid #e2e8f0", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>Bundle Total:</span>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 12, textDecoration: "line-through", color: "#94a3b8", marginRight: 6 }}>
                ${(collectionRows.length * 50).toFixed(2)}
              </span>
              <strong style={{ fontSize: 16, color: "#0f172a" }}>
                ${(collectionRows.length * 50 * (1 - discountPercent / 100)).toFixed(2)}
              </strong>
            </div>
          </div>

          <button
            type="button"
            style={{
              width: "100%",
              padding: 12,
              background: color,
              color: "#ffffff",
              borderRadius: 8,
              border: "none",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
            }}
          >
            Add Complete {collectionRows.length}-Step Bundle to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
