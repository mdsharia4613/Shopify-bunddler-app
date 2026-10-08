import { useState, useMemo } from "react";

export default function CollectionSelectorModal({
  show,
  onClose,
  collections = [],
  selectedCollectionId,
  onSelectCollection,
  shop,
  isMulti = false,
  selectedCollectionIds = [],
  onToggleCollection,
}) {
  const [search, setSearch] = useState("");

  const filteredCollections = useMemo(() => {
    if (!search.trim()) return collections;
    return collections.filter((c) =>
      c.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [collections, search]);

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
          maxWidth: 560,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
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
              Select Collection from Store
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
            placeholder="Search collections by title..."
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

        {/* Collection List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {filteredCollections.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#64748b", fontSize: 14 }}>
              No collections found matching "{search}"
            </div>
          ) : (
            filteredCollections.map((c) => {
              const isSelected = isMulti
                ? selectedCollectionIds.includes(c.id)
                : selectedCollectionId === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    if (isMulti && onToggleCollection) {
                      onToggleCollection(c);
                    } else if (onSelectCollection) {
                      onSelectCollection(c);
                      onClose();
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: `1.5px solid ${isSelected ? "#0f172a" : "#e2e8f0"}`,
                    background: isSelected ? "#f8fafc" : "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: "#f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                      }}
                    >
                      📁
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                        {c.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {c.count !== undefined ? `${c.count} products` : "Collection"}
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
            })
          )}
        </div>

        {/* Footer */}
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
