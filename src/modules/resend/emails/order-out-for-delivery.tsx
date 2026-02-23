import {
    Body, Button, Column, Container, Head, Heading,
    Hr, Html, Link, Preview, Row, Section, Text,
} from "@react-email/components"

const BRAND       = "#18181b"
const ACCENT      = "#16a34a"   // green — delivery day!
const STEP_DONE   = "#16a34a"
const STEP_ACTIVE = "#16a34a"
const STEP_IDLE   = "#d1d5db"

export function orderOutForDeliveryEmail({ order, awb, courier_name, tracking_url }: {
    order: any
    awb?: string
    courier_name?: string
    tracking_url?: string
}) {
    const name = order?.customer?.first_name || order?.shipping_address?.first_name || "Valued Customer"
    const addr = order?.shipping_address
    const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })

    return (
        <Html>
            <Head />
            <Preview>🛵 Order #{order?.display_id} is out for delivery TODAY — Stay home!</Preview>
            <Body style={body}>
                {/* ── Header ── */}
                <Section style={headerSec}>
                    <Text style={brand}>Vridhira Marketplace</Text>
                </Section>

                <Container style={container}>
                    {/* ── Hero ── */}
                    <Section style={heroSec}>
                        <Text style={heroEmoji}>🛵</Text>
                        <Heading style={h1}>Arriving Today!</Heading>
                        <Text style={heroSub}>
                            Hi {name}, your order #{order?.display_id} is out for delivery and heading to
                            your door right now. Today is the day — {today}.
                        </Text>
                    </Section>

                    {/* ── Urgent badge ── */}
                    <Section style={{ textAlign: "center", padding: "4px 32px 16px" }}>
                        <Text style={urgentBadge}>🟢 DELIVERY IN PROGRESS TODAY</Text>
                    </Section>

                    {/* ── Progress Bar ── */}
                    <Section style={progressSec}>
                        <Row>
                            <Column style={stepCol}>
                                <Text style={dotDone}>●</Text>
                                <Text style={lblDone}>Ordered</Text>
                            </Column>
                            <Column style={connDone} />
                            <Column style={stepCol}>
                                <Text style={dotDone}>●</Text>
                                <Text style={lblDone}>Shipped</Text>
                            </Column>
                            <Column style={connDone} />
                            <Column style={stepCol}>
                                <Text style={dotDone}>●</Text>
                                <Text style={lblDone}>In Transit</Text>
                            </Column>
                            <Column style={connDone} />
                            <Column style={stepCol}>
                                <Text style={dotActive}>●</Text>
                                <Text style={lblActive}>Out for Delivery</Text>
                            </Column>
                            <Column style={connIdle} />
                            <Column style={stepCol}>
                                <Text style={dotIdle}>●</Text>
                                <Text style={lblIdle}>Delivered</Text>
                            </Column>
                        </Row>
                    </Section>

                    {/* ── Tracking Card ── */}
                    {awb && (
                        <Section style={trackCard}>
                            <Text style={trackCardLabel}>TRACKING NUMBER</Text>
                            <Text style={trackCardAwb}>{awb}</Text>
                            <Row style={{ marginTop: 8 }}>
                                {courier_name && (
                                    <Column>
                                        <Text style={trackMeta}>via {courier_name}</Text>
                                    </Column>
                                )}
                                <Column style={{ textAlign: "right" }}>
                                    <Text style={trackMeta}>Expected: <strong>Today</strong></Text>
                                </Column>
                            </Row>
                        </Section>
                    )}

                    {/* ── CTA ── */}
                    {tracking_url && (
                        <Section style={{ textAlign: "center", padding: "8px 32px 20px" }}>
                            <Button href={tracking_url} style={ctaBtn}>
                                Track Delivery →
                            </Button>
                        </Section>
                    )}

                    <Hr style={hr} />

                    {/* ── Items in this delivery ── */}
                    <Text style={sectionHead}>Arriving Today</Text>
                    {(order?.items || []).map((item: any) => (
                        <Section key={item.id} style={itemRow}>
                            <Row>
                                <Column>
                                    <Text style={itemName}>{item.title || item.product_title}</Text>
                                    {item.variant_title && item.variant_title !== "Default Title" && (
                                        <Text style={variantTag}>{item.variant_title}</Text>
                                    )}
                                </Column>
                                <Column style={{ textAlign: "right" }}>
                                    <Text style={itemQty}>×{item.quantity}</Text>
                                </Column>
                            </Row>
                        </Section>
                    ))}

                    {/* ── Delivery Address ── */}
                    {addr && (
                        <>
                            <Hr style={hr} />
                            <Text style={sectionHead}>Delivering To</Text>
                            <Section style={addrCard}>
                                <Text style={addrText}>
                                    📍 {`${addr.first_name || ""} ${addr.last_name || ""}`.trim()}{"\n"}
                                    {addr.address_1}{"\n"}
                                    {addr.address_2 ? addr.address_2 + "\n" : ""}
                                    {`${addr.city || ""}${addr.province ? `, ${addr.province}` : ""} – ${addr.postal_code || ""}`.trim()}
                                    {addr.phone ? `\n📞 ${addr.phone}` : ""}
                                </Text>
                            </Section>
                        </>
                    )}

                    <Hr style={hr} />

                    {/* ── Be home reminder ── */}
                    <Section style={tipsBox}>
                        <Text style={tipsTitle}>📋 Be Ready for Delivery</Text>
                        <Text style={tipsItem}>• Make sure someone is home to receive the package.</Text>
                        <Text style={tipsItem}>• Keep your phone reachable — the delivery agent will call.</Text>
                        <Text style={tipsItem}>• For COD orders, keep exact change ready.</Text>
                        <Text style={tipsItem}>• If you miss the delivery, the agent will attempt once more.</Text>
                    </Section>

                    <Hr style={hr} />

                    {/* ── Help ── */}
                    <Section style={helpSec}>
                        <Text style={helpTitle}>Need Help?</Text>
                        <Row>
                            <Column>
                                <Link href="https://vridhira.com/contact" style={helpLink}>Contact Support</Link>
                            </Column>
                            <Column style={{ textAlign: "right" }}>
                                <Text style={helpEmail}>support@vridhira.com</Text>
                            </Column>
                        </Row>
                    </Section>
                </Container>

                {/* ── Footer ── */}
                <Section style={footerSec}>
                    <Text style={footerText}>© {new Date().getFullYear()} Vridhira Marketplace · All rights reserved.</Text>
                    <Text style={footerText}>You received this because you placed an order on Vridhira.</Text>
                </Section>
            </Body>
        </Html>
    )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const body: React.CSSProperties            = { backgroundColor: "#f1f5f9", fontFamily: "'Segoe UI',Arial,sans-serif", margin: 0, padding: 0 }
const headerSec: React.CSSProperties       = { backgroundColor: BRAND, padding: "16px 32px" }
const brand: React.CSSProperties           = { color: "#FF6B35", fontSize: 22, fontWeight: "800", margin: 0 }
const container: React.CSSProperties      = { backgroundColor: "#ffffff", maxWidth: 600, margin: "24px auto", borderRadius: 12 }
const heroSec: React.CSSProperties         = { textAlign: "center", padding: "32px 32px 12px" }
const heroEmoji: React.CSSProperties       = { fontSize: 52, margin: "0 0 8px" }
const h1: React.CSSProperties              = { fontSize: 30, fontWeight: "800", color: "#18181b", margin: "0 0 12px", letterSpacing: "-0.5px" }
const heroSub: React.CSSProperties         = { color: "#52525b", fontSize: 15, lineHeight: "1.6", margin: 0 }
const urgentBadge: React.CSSProperties     = { display: "inline-block", backgroundColor: "#dcfce7", color: "#15803d", fontSize: 12, fontWeight: "700", letterSpacing: "0.06em", padding: "6px 16px", borderRadius: 20, margin: 0 }
const progressSec: React.CSSProperties     = { padding: "14px 16px", backgroundColor: "#f8fafc", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }
const stepCol: React.CSSProperties         = { textAlign: "center", width: 56 }
const connDone: React.CSSProperties        = { borderTop: "2px solid #16a34a", verticalAlign: "middle" }
const connIdle: React.CSSProperties        = { borderTop: "2px solid #d1d5db", verticalAlign: "middle" }
const dotDone: React.CSSProperties         = { color: STEP_DONE, fontSize: 20, margin: "0 0 2px", lineHeight: "1" }
const dotActive: React.CSSProperties       = { color: STEP_ACTIVE, fontSize: 20, margin: "0 0 2px", lineHeight: "1" }
const dotIdle: React.CSSProperties         = { color: STEP_IDLE, fontSize: 20, margin: "0 0 2px", lineHeight: "1" }
const lblDone: React.CSSProperties         = { color: STEP_DONE, fontSize: 10, fontWeight: "700", margin: 0 }
const lblActive: React.CSSProperties       = { color: STEP_ACTIVE, fontSize: 10, fontWeight: "700", margin: 0 }
const lblIdle: React.CSSProperties         = { color: "#9ca3af", fontSize: 10, margin: 0 }
const trackCard: React.CSSProperties       = { margin: "16px 32px", backgroundColor: "#f0fdf4", border: "2px solid #86efac", borderRadius: 10, padding: "20px 24px" }
const trackCardLabel: React.CSSProperties  = { color: "#15803d", fontSize: 11, fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px" }
const trackCardAwb: React.CSSProperties    = { color: "#14532d", fontSize: 28, fontWeight: "800", margin: 0, letterSpacing: "0.04em", fontFamily: "monospace" }
const trackMeta: React.CSSProperties       = { color: "#16a34a", fontSize: 13, margin: 0 }
const ctaBtn: React.CSSProperties          = { backgroundColor: ACCENT, color: "#ffffff", fontSize: 16, fontWeight: "700", borderRadius: 8, padding: "14px 40px", textDecoration: "none", display: "inline-block" }
const hr: React.CSSProperties              = { borderColor: "#e4e4e7", margin: 0 }
const sectionHead: React.CSSProperties     = { fontSize: 16, fontWeight: "700", color: "#18181b", margin: "20px 32px 10px", paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }
const itemRow: React.CSSProperties         = { padding: "6px 32px" }
const itemName: React.CSSProperties        = { color: "#18181b", fontSize: 14, fontWeight: "600", margin: "0 0 3px" }
const variantTag: React.CSSProperties      = { color: "#6b7280", fontSize: 12, backgroundColor: "#f1f5f9", padding: "2px 8px", borderRadius: 4, margin: 0, display: "inline-block" }
const itemQty: React.CSSProperties         = { color: "#52525b", fontSize: 14, fontWeight: "600", margin: 0 }
const addrCard: React.CSSProperties        = { margin: "8px 32px 16px", backgroundColor: "#f8fafc", borderRadius: 8, padding: "12px 16px" }
const addrText: React.CSSProperties        = { color: "#52525b", fontSize: 13, lineHeight: "1.7", whiteSpace: "pre-line", margin: 0 }
const tipsBox: React.CSSProperties         = { margin: "16px 32px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "14px 20px" }
const tipsTitle: React.CSSProperties       = { color: "#14532d", fontSize: 13, fontWeight: "700", margin: "0 0 8px" }
const tipsItem: React.CSSProperties        = { color: "#166534", fontSize: 13, lineHeight: "1.7", margin: "2px 0" }
const helpSec: React.CSSProperties         = { padding: "12px 32px 24px" }
const helpTitle: React.CSSProperties       = { color: "#18181b", fontSize: 14, fontWeight: "700", margin: "0 0 8px" }
const helpLink: React.CSSProperties        = { color: ACCENT, fontSize: 13, textDecoration: "underline" }
const helpEmail: React.CSSProperties       = { color: "#52525b", fontSize: 13, margin: 0 }
const footerSec: React.CSSProperties       = { backgroundColor: BRAND, padding: "20px 32px", textAlign: "center" }
const footerText: React.CSSProperties      = { color: "#71717a", fontSize: 12, margin: "4px 0" }
