import { useState } from "react";
import { Link } from "react-router";

export default function TemplatesPage() {
    const [selectedColor, setSelectedColor] = useState("#f59e0b");

    const colors = ["#111827", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

    return (
        <s-page heading="Choose a discount type">
            <s-paragraph>You can fully customize it in the next step.</s-paragraph>

            {/* Brand Color Selector */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <span style={{ fontSize: "14px", fontWeight: "bold" }}>Brand colors:</span>
                <div style={{ display: "flex", gap: "6px" }}>
                    {colors.map((c) => (
                        <button
                            key={c}
                            onClick={() => setSelectedColor(c)}
                            style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "50%",
                                backgroundColor: c,
                                border: selectedColor === c ? "2px solid #000" : "2px solid transparent",
                                cursor: "pointer",
                                padding: 0,
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Templates Grid (১ম ছবির মতো) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>

                {/* Template 1: Multi-Collection Tiered Bundle (আপনার মেইন ফিচার) */}
                <div style={{ border: `2px solid ${selectedColor}`, borderRadius: "12px", padding: "16px", backgroundColor: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                        <div style={{ backgroundColor: "#fef3c7", border: `1px solid ${selectedColor}`, borderRadius: "8px", padding: "10px", marginBottom: "10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                                <span>Row 1: Collection A</span>
                                <span>$45.00</span>
                            </div>
                            <small style={{ color: "#666" }}>Single / Multiple products</small>
                        </div>
                        <div style={{ backgroundColor: "#fffbeb", border: `1px solid ${selectedColor}`, borderRadius: "8px", padding: "10px", marginBottom: "10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                                <span>Row 2: Collection B</span>
                                <span style={{ color: selectedColor }}>SAVE 15%</span>
                            </div>
                        </div>
                        <div style={{ backgroundColor: "#fff", border: "1px dashed #ccc", borderRadius: "8px", padding: "10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                                <span>Row 3: Collection C</span>
                                <span style={{ color: selectedColor }}>SAVE 25%</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: "20px", textAlign: "center" }}>
                        <h4 style={{ margin: "0 0 6px 0" }}>Multi-Collection Tiered Bundle</h4>
                        <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#666" }}>
                            Collection 1, Collection 2, Collection 3 mix &amp; match with dynamic discounts
                        </p>
                        <Link to={`/app/bundle-builder?type=multi-collection&color=${encodeURIComponent(selectedColor)}`} style={{ textDecoration: "none" }}>
                            <button style={{ width: "100%", padding: "10px", backgroundColor: "#111827", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                                Choose
                            </button>
                        </Link>
                    </div>
                </div>

                {/* Template 2: Quantity Breaks (Same Product) */}
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", backgroundColor: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                        <div style={{ border: "1px solid #eee", borderRadius: "8px", padding: "10px", marginBottom: "10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>Buy 1 (Single)</span>
                                <strong>$45.00</strong>
                            </div>
                        </div>
                        <div style={{ border: `1px solid ${selectedColor}`, backgroundColor: "#fffbeb", borderRadius: "8px", padding: "10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>Buy 2 (Duo Pack)</span>
                                <strong style={{ color: selectedColor }}>Save 10%</strong>
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: "20px", textAlign: "center" }}>
                        <h4 style={{ margin: "0 0 6px 0" }}>Quantity breaks for same product</h4>
                        <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#666" }}>Single, Duo, Trio volume tiers</p>
                        <Link to={`/app/bundle-builder?type=quantity-break&color=${encodeURIComponent(selectedColor)}`} style={{ textDecoration: "none" }}>
                            <button style={{ width: "100%", padding: "10px", backgroundColor: "#111827", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                                Choose
                            </button>
                        </Link>
                    </div>
                </div>

                {/* Template 3: Buy X Get Y */}
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", backgroundColor: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                        <div style={{ border: "1px solid #eee", borderRadius: "8px", padding: "10px", marginBottom: "10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>Buy 1 Get 1 Free</span>
                                <span style={{ color: "#10b981", fontWeight: "bold" }}>SAVE 50%</span>
                            </div>
                        </div>
                        <div style={{ border: "1px solid #eee", borderRadius: "8px", padding: "10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>Buy 2 Get 3 Free</span>
                                <span style={{ color: "#10b981", fontWeight: "bold" }}>SAVE 60%</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: "20px", textAlign: "center" }}>
                        <h4 style={{ margin: "0 0 6px 0" }}>Buy X, Get Y (BXGY) deal</h4>
                        <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#666" }}>Free gifts or product combo tiers</p>
                        <Link to={`/app/bundle-builder?type=bxgy&color=${encodeURIComponent(selectedColor)}`} style={{ textDecoration: "none" }}>
                            <button style={{ width: "100%", padding: "10px", backgroundColor: "#111827", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                                Choose
                            </button>
                        </Link>
                    </div>
                </div>

            </div>
        </s-page>
    );
}
