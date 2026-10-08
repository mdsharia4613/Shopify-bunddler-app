import { useState, useMemo } from "react";

export default function ProductSelectorModal({
  show,
  onClose,
  products = [],
  selectedProducts = [],
  onToggleProduct,
  shop,
}) {
  const [search, setSearch] = useState("");

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    return products.filter((p) =>
      p.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search]);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 580,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
              Select Products from Store
            </h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>{shop}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            ✕
          </button>
        </div>

        {/* Search Input */}
        <div style={{ padding: "14px 24px", borderBottom: "1px solid #f1f5f9" }}>
          <input
            type="text"
            placeholder="Search products by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              fontSize: 14,
            }}
          />
        </div>

        {/* Product List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {filteredProducts.map((p) => {
            const isSelected = selectedProducts.some((x) => x.id === p.id);

            return (
              <div
                key={p.id}
                onClick={() => onToggleProduct(p)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1.5px solid ${isSelected ? "#0f172a" : "#e2e8f0"}`,
                  background: isSelected ? "#f8fafc" : "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.1s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img
                    src={p.image}
                    alt={p.title}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 6,
                      objectFit: "cover",
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      ${p.price}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: `2px solid ${isSelected ? "#0f172a" : "#cbd5e1"}`,
                    background: isSelected ? "#0f172a" : "transparent",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {isSelected && "✓"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "#0f172a",
              color: "#ffffff",
              padding: "10px 24px",
              borderRadius: 8,
              border: "none",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
