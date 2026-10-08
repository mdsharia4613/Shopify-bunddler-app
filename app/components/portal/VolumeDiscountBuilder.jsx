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
  const [selectedPreviewIdx, setSelectedPreviewIdx] = useState(0);
  const [openBars, setOpenBars] = useState({ 0: true, 1: true, 2: true });

  const toggleBar = (idx) => {
    setOpenBars((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleAddTier = () => {
    const nextQty = tiers.length > 0 ? Math.max(...tiers.map((t) => Number(t.quantity || t.qty || 1))) + 1 : 1;
    const nextDisc = tiers.length > 0 ? Math.min(Math.max(...tiers.map((t) => Number(t.discountPercent || t.discountValue || 0))) + 5, 80) : 10;
    const nextId = tiers.length > 0 ? Math.max(...tiers.map((t) => Number(t.id || 0))) + 1 : 1;

    const newTier = {
      id: nextId,
      quantity: nextQty,
      qty: nextQty,
      pricingType: "percentage_off",
      discountValue: nextDisc,
      discountPercent: nextDisc,
      title: `${nextQty} Units`,
      subtitle: `You save ${nextDisc}%`,
      label: `SAVE ${nextDisc}%`,
      badge: "",
    };

    setTiers([...tiers, newTier]);
    setOpenBars((prev) => ({ ...prev, [tiers.length]: true }));
  };

  const handleRemoveTier = (idx) => {
    if (tiers.length <= 1) {
      alert("At least 1 tier is required.");
      return;
    }
    const next = tiers.filter((_, i) => i !== idx);
    setTiers(next);
    if (selectedPreviewIdx >= next.length) {
      setSelectedPreviewIdx(0);
    }
  };

  const handleUpdateTier = (idx, field, value) => {
    const next = [...tiers];
    const current = { ...next[idx] };

    if (field === "quantity") {
      const q = Math.max(1, parseInt(value, 10) || 1);
      current.quantity = q;
      current.qty = q;
    } else if (field === "pricingType") {
      current.pricingType = value;
      if (value === "full_price") {
        current.discountValue = 0;
        current.discountPercent = 0;
      }
    } else if (field === "discountValue") {
      const v = Math.max(0, parseFloat(value) || 0);
      current.discountValue = v;
      if (current.pricingType === "percentage_off") {
        current.discountPercent = Math.min(100, v);
      }
    } else if (field === "title") {
      current.title = value;
    } else if (field === "subtitle") {
      current.subtitle = value;
    } else if (field === "label") {
      current.label = value;
    } else if (field === "badge") {
      current.badge = value;
    } else {
      current[field] = value;
    }

    next[idx] = current;
    setTiers(next);
  };

  const baseItemPrice = selectedProducts.length > 0 && selectedProducts[0]?.price
    ? parseFloat(selectedProducts[0].price)
    : 100.0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 28, alignItems: "start" }}>
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
              placeholder="Volume Discounts"
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

          {/* Quantity Discount Tiers */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                Quantity Discount Tiers ({tiers.length})
              </h3>
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

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {tiers.map((tier, idx) => {
                const isOpen = openBars[idx] !== false;
                const tierQty = tier.quantity ?? tier.qty ?? (idx + 1);
                const tierPricing = tier.pricingType || (tier.discountPercent > 0 ? "percentage_off" : "full_price");
                const tierTitle = tier.title || (tierQty === 1 ? "Single" : tierQty === 2 ? "Duo" : tierQty === 3 ? "Trio" : String(tierQty) + " Units");
                const tierSubtitle = tier.subtitle || (tierPricing === "full_price" ? "Standard price" : "You save " + (tier.discountPercent || tier.discountValue || 15) + "%");
                const tierLabel = tier.label ?? tier.saveTag ?? "";

                return (
                  <div
                    key={tier.id || idx}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 14,
                      background: "#ffffff",
                      overflow: "hidden",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    }}
                  >
                    {/* Accordion Bar Header (matches Bar #1 - Single in screenshot 2) */}
                    <div
                      style={{
                        padding: "14px 18px",
                        background: "#fafafa",
                        borderBottom: isOpen ? "1px solid #e2e8f0" : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                      onClick={() => toggleBar(idx)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{isOpen ? "⌄" : "›"}</span>
                        <span style={{ fontSize: 16 }}>⚙️</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                          Bar #{idx + 1} - {tierTitle}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 12 }} onClick={(e) => e.stopPropagation()}>
                        {tiers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTier(idx)}
                            style={{ background: "none", border: "none", color: "#ef4444", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                            title="Delete this tier"
                          >
                            🗑
                          </button>
                        )}
                        <span style={{ fontSize: 14, color: "#94a3b8", cursor: "pointer" }}>•••</span>
                      </div>
                    </div>

                    {/* Accordion Body (Form fields matching Screenshots 2 & 3) */}
                    {isOpen && (
                      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* Row 1: Quantity & Price Dropdown */}
                        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 14, alignItems: "start" }}>
                          <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>
                              Quantity
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={tierQty}
                              onChange={(e) => handleUpdateTier(idx, "quantity", e.target.value)}
                              style={{
                                width: "100%",
                                padding: "9px 12px",
                                border: "1.5px solid #cbd5e1",
                                borderRadius: 8,
                                fontSize: 14,
                                fontWeight: 700,
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>
                              Price
                            </label>
                            <div style={{ display: "flex", gap: 8 }}>
                              <select
                                value={tierPricing}
                                onChange={(e) => handleUpdateTier(idx, "pricingType", e.target.value)}
                                style={{
                                  flex: 1,
                                  padding: "9px 12px",
                                  border: "1.5px solid #cbd5e1",
                                  borderRadius: 8,
                                  fontSize: 14,
                                  fontWeight: 600,
                                  background: "#ffffff",
                                  cursor: "pointer",
                                }}
                              >
                                <option value="full_price">Full price</option>
                                <option value="percentage_off">Percentage off</option>
                                <option value="amount_off">Amount off</option>
                                <option value="fixed_price">Fixed price</option>
                              </select>

                              {tierPricing !== "full_price" && (
                                <div style={{ width: 110, position: "relative" }}>
                                  <input
                                    type="number"
                                    min="0"
                                    value={tier.discountValue ?? (tierPricing === "percentage_off" ? 15 : 10)}
                                    onChange={(e) => handleUpdateTier(idx, "discountValue", e.target.value)}
                                    style={{
                                      width: "100%",
                                      padding: "9px 24px 9px 10px",
                                      border: "1.5px solid #cbd5e1",
                                      borderRadius: 8,
                                      fontSize: 14,
                                      fontWeight: 700,
                                    }}
                                  />
                                  <span style={{ position: "absolute", right: 8, top: 10, fontSize: 12, fontWeight: 800, color: "#64748b" }}>
                                    {tierPricing === "percentage_off" ? "%" : "$"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Title & Subtitle with {} Variable Icons */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Title</label>
                              <span style={{ fontSize: 13, color: "#64748b", fontFamily: "monospace", fontWeight: "bold" }}>{"{ }"}</span>
                            </div>
                            <input
                              type="text"
                              value={tierTitle}
                              onChange={(e) => handleUpdateTier(idx, "title", e.target.value)}
                              placeholder="Single"
                              style={{
                                width: "100%",
                                padding: "9px 12px",
                                border: "1.5px solid #cbd5e1",
                                borderRadius: 8,
                                fontSize: 14,
                                fontWeight: 700,
                              }}
                            />
                          </div>

                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Subtitle</label>
                              <span style={{ fontSize: 13, color: "#64748b", fontFamily: "monospace", fontWeight: "bold" }}>{"{ }"}</span>
                            </div>
                            <input
                              type="text"
                              value={tierSubtitle}
                              onChange={(e) => handleUpdateTier(idx, "subtitle", e.target.value)}
                              placeholder="Standard price"
                              style={{
                                width: "100%",
                                padding: "9px 12px",
                                border: "1.5px solid #cbd5e1",
                                borderRadius: 8,
                                fontSize: 14,
                              }}
                            />
                          </div>
                        </div>

                        {/* Row 3: Label (Badge/Pill) */}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <label style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Label</label>
                            <span style={{ fontSize: 13, color: "#64748b", fontFamily: "monospace", fontWeight: "bold" }}>{"{ }"}</span>
                          </div>
                          <input
                            type="text"
                            value={tierLabel}
                            onChange={(e) => handleUpdateTier(idx, "label", e.target.value)}
                            placeholder="e.g. Most Popular, SAVE $30.00"
                            style={{
                              width: "100%",
                              padding: "9px 12px",
                              border: "1.5px solid #cbd5e1",
                              borderRadius: 8,
                              fontSize: 14,
                            }}
                          />
                        </div>
                      </div>
                    )}
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

      {/* Right Column: Live Storefront Preview (Exact Match to Screenshot 4) */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, position: "sticky", top: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
          <span>👁</span> Storefront Live Preview
        </div>

        {/* BUNDLE & SAVE Heading with Divider lines (matches Screenshot 4) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "#fed7aa" }} />
          <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: "0.08em", color: "#1e293b" }}>
            BUNDLE & SAVE
          </span>
          <div style={{ flex: 1, height: 1, background: "#fed7aa" }} />
        </div>

        {/* Tier Cards List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tiers.map((t, idx) => {
            const isSelected = selectedPreviewIdx === idx;
            const q = t.quantity ?? t.qty ?? (idx + 1);
            const pricing = t.pricingType || (t.discountPercent > 0 ? "percentage_off" : "full_price");
            const discVal = t.discountValue ?? t.discountPercent ?? 0;

            const tTitle = t.title || (q === 1 ? "Single" : q === 2 ? "Duo" : q === 3 ? "Trio" : String(q) + " Units");
            const tSubtitle = t.subtitle || (pricing === "full_price" ? "Standard price" : "You save " + discVal + "%");
            const tLabel = t.label || (pricing === "percentage_off" && discVal > 0 ? "SAVE $" + ((baseItemPrice * q * discVal) / 100).toFixed(2) : "");
            const tBadge = t.badge || (idx === 1 ? "Most Popular" : "");

            // Price calculation
            const originalTotal = baseItemPrice * q;
            let finalPrice = originalTotal;

            if (pricing === "percentage_off") {
              finalPrice = originalTotal * (1 - discVal / 100);
            } else if (pricing === "amount_off") {
              finalPrice = Math.max(0, originalTotal - discVal);
            } else if (pricing === "fixed_price") {
              finalPrice = discVal > 0 ? discVal : originalTotal;
            }

            return (
              <div
                key={t.id || idx}
                onClick={() => setSelectedPreviewIdx(idx)}
                style={{
                  position: "relative",
                  border: isSelected ? ("2px solid " + color) : "1.5px solid #fed7aa",
                  background: isSelected ? "#ffffff" : "#fffdf7",
                  borderRadius: 12,
                  padding: "16px 18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  boxShadow: isSelected ? "0 4px 14px rgba(245, 158, 11, 0.15)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Floating Corner Star Badge (matches Screenshot 4) */}
                {tBadge && (
                  <div
                    style={{
                      position: "absolute",
                      top: -12,
                      right: 18,
                      background: color || "#f59e0b",
                      color: "#ffffff",
                      fontSize: 11,
                      fontWeight: 900,
                      padding: "4px 12px",
                      borderRadius: 9999,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      zIndex: 2,
                    }}
                  >
                    <span>✨</span>
                    <span>{tBadge}</span>
                    <span>✨</span>
                  </div>
                )}

                {/* Left: Radio + Title + Subtitle */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: "2px solid " + (isSelected ? color : "#cbd5e1"),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#ffffff",
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && (
                      <div
                        style={{
                          width: 11,
                          height: 11,
                          borderRadius: "50%",
                          background: color,
                        }}
                      />
                    )}
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>
                        {tTitle}
                      </span>

                      {/* Save Pill */}
                      {tLabel && (
                        <span
                          style={{
                            background: "#ffedd5",
                            color: "#9a3412",
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "2px 7px",
                            borderRadius: 4,
                          }}
                        >
                          {tLabel}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
                      {tSubtitle}
                    </div>
                  </div>
                </div>

                {/* Right: Price & Strikethrough Price */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>
                    {"$" + finalPrice.toFixed(2)}
                  </div>
                  {finalPrice < originalTotal && (
                    <div style={{ fontSize: 12, color: "#94a3b8", textDecoration: "line-through", marginTop: 2 }}>
                      {"$" + originalTotal.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Button */}
        <button
          type="button"
          style={{
            width: "100%",
            marginTop: 20,
            padding: 13,
            background: "#0f172a",
            color: "#ffffff",
            borderRadius: 8,
            border: "none",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          Add Selected Pack to Cart
        </button>
      </div>
    </div>
  );
}
