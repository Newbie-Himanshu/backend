import {
    Body, Button, Column, Container, Head, Heading,
    Hr, Html, Link, Preview, Row, Section, Text,
} from "@react-email/components"

const BRAND  = "#18181b"
const ACCENT = "#2563eb"
const STEP_DONE   = "#16a34a"
const STEP_ACTIVE = "#2563eb"
const STEP_IDLE   = "#d1d5db"

export function orderShippedEmail({ order, awb, courier_name, tracking_url }: {
    order: any
    awb?: string
    courier_name?: string
    tracking_url?: string
}) {
    const name = order?.customer?.first_name || order?.shipping_address?.first_name || "Valued Customer"
    const addr = order?.shipping_address
    const estimatedDelivery = order?.updated_at
        ? new Date(new Date(order.updated_at).getTime() + 5 * 24 * 60 * 60 * 1000)
            .toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
        : "3–5 business days"

    return (
        <Html>
            <Head />
            <Preview>🚚 Order #{order?.display_id} is on its way! Track your shipment now.</Preview>
            <Body style={body}>
                {/* ── Header ── */}
                <Section style={headerSec}>
                    <Text style={brand}>The Marketplace</Text>
                </Section>

                <Container style={container}>
                    {/* ── Hero (Nike-inspired) ── */}
                    <Section style={heroSec}>
                        <Text style={heroEmoji}>🚚</Text>
                        <Heading style={h1}>It's On Its Way!</Heading>
                        <Text style={heroSub}>
                            Hi {name}, your order #{order?.display_id} has been shipped and is heading to you.
                        </Text>
                    </Section>

                    {/* ── Progress Bar ── */}
                    <Section style={progressSec}>
                        <Row>
                            <Column style={stepCol}>
                                <Text style={dotDone}>●</Text>
                                <Text style={lblDone}>Ordered</Text>
                            </Column>
                            <Column style={stepDiv} />
                            <Column style={stepCol}>
                                <Text style={dotDone}>●</Text>
                                <Text style={lblDone}>Processed</Text>
                            </Column>
                            <Column style={stepDiv} />
                            <Column style={stepCol}>
                                <Text style={dotActive}>●</Text>
                                <Text style={lblActive}>Shipped</Text>
                            </Column>
                            <Column style={stepDiv} />
                            <Column style={stepCol}>
                                <Text style={dotIdle}>●</Text>
                                <Text style={lblIdle}>Delivered</Text>
                            </Column>
                        </Row>
                    </Section>

                    {/* ── Tracking Card (prominent) ── */}
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
                                    <Text style={trackMeta}>Est. Delivery: <strong>{estimatedDelivery}</strong></Text>
                                </Column>
                            </Row>
                        </Section>
                    )}

                    {/* ── Track My Package CTA ── */}
                    {tracking_url && (
                        <Section style={{ textAlign: "center", padding: "8px 32px 20px" }}>
                            <Button href={tracking_url} style={ctaBtn}>
                                Track My Package →
                            </Button>
                        </Section>
                    )}

                    <Hr style={hr} />

                    {/* ── Items in Shipment ── */}
                    <Text style={sectionHead}>Items in This Shipment</Text>
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

                    {/* ── Help Links ── */}
                    <Section style={helpSec}>
                        <Text style={helpTitle}>Need Help?</Text>
                        <Row>
                            <Column>
                                <Link href="https://Himanshu.com/contact" style={helpLink}>Contact Support</Link>
                            </Column>
                            <Column style={{ textAlign: "center" }}>
                                <Link href="https://Himanshu.com/returns" style={helpLink}>Easy Returns</Link>
                            </Column>
                            <Column style={{ textAlign: "right" }}>
                                <Text style={helpEmail}>support@Himanshu.com</Text>
                            </Column>
                        </Row>
                    </Section>
                </Container>

                {/* ── Footer ── */}
                <Section style={footerSec}>
                    <Text style={footerText}>© {new Date().getFullYear()} The Marketplace · All rights reserved.</Text>
                    <Text style={footerText}>You received this because you placed an order on Himanshu.</Text>
                </Section>
            </Body>
        </Html>
    )
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const body: React.CSSProperties         = { backgroundColor: "#f1f5f9", fontFamily: "'Segoe UI',Arial,sans-serif", margin: 0, padding: 0 }
const headerSec: React.CSSProperties    = { backgroundColor: BRAND, padding: "16px 32px" }
const brand: React.CSSProperties        = { color: "#FF6B35", fontSize: 22, fontWeight: "800", margin: 0 }
const container: React.CSSProperties   = { backgroundColor: "#ffffff", maxWidth: 600, margin: "24px auto", borderRadius: 12 }
const heroSec: React.CSSProperties      = { textAlign: "center", padding: "32px 32px 16px" }
const heroEmoji: React.CSSProperties    = { fontSize: 52, margin: "0 0 8px" }
const h1: React.CSSProperties           = { fontSize: 30, fontWeight: "800", color: "#18181b", margin: "0 0 12px", letterSpacing: "-0.5px" }
const heroSub: React.CSSProperties      = { color: "#52525b", fontSize: 15, lineHeight: "1.6", margin: 0 }
const progressSec: React.CSSProperties  = { padding: "14px 32px", backgroundColor: "#f8fafc", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }
const stepCol: React.CSSProperties      = { textAlign: "center", width: 70 }
const stepDiv: React.CSSProperties      = { borderTop: "2px solid #d1d5db", verticalAlign: "middle" }
const dotDone: React.CSSProperties      = { color: STEP_DONE, fontSize: 20, margin: "0 0 2px", lineHeight: "1" }
const dotActive: React.CSSProperties    = { color: STEP_ACTIVE, fontSize: 20, margin: "0 0 2px", lineHeight: "1" }
const dotIdle: React.CSSProperties      = { color: STEP_IDLE, fontSize: 20, margin: "0 0 2px", lineHeight: "1" }
const lblDone: React.CSSProperties      = { color: STEP_DONE, fontSize: 11, fontWeight: "700", margin: 0 }
const lblActive: React.CSSProperties    = { color: STEP_ACTIVE, fontSize: 11, fontWeight: "700", margin: 0 }
const lblIdle: React.CSSProperties      = { color: "#9ca3af", fontSize: 11, margin: 0 }
const trackCard: React.CSSProperties    = { margin: "16px 32px", backgroundColor: "#eff6ff", border: "2px solid #93c5fd", borderRadius: 10, padding: "20px 24px" }
const trackCardLabel: React.CSSProperties = { color: ACCENT, fontSize: 11, fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px" }
const trackCardAwb: React.CSSProperties = { color: "#1e3a8a", fontSize: 28, fontWeight: "800", margin: 0, letterSpacing: "0.04em", fontFamily: "monospace" }
const trackMeta: React.CSSProperties    = { color: "#3b82f6", fontSize: 13, margin: 0 }
const ctaBtn: React.CSSProperties       = { backgroundColor: ACCENT, color: "#ffffff", fontSize: 16, fontWeight: "700", borderRadius: 8, padding: "14px 40px", textDecoration: "none", display: "inline-block" }
const hr: React.CSSProperties           = { borderColor: "#e4e4e7", margin: 0 }
const sectionHead: React.CSSProperties  = { fontSize: 16, fontWeight: "700", color: "#18181b", margin: "20px 32px 10px", paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }
const itemRow: React.CSSProperties      = { padding: "6px 32px" }
const itemName: React.CSSProperties     = { color: "#18181b", fontSize: 14, fontWeight: "600", margin: "0 0 3px" }
const variantTag: React.CSSProperties   = { color: "#6b7280", fontSize: 12, backgroundColor: "#f1f5f9", padding: "2px 8px", borderRadius: 4, margin: 0, display: "inline-block" }
const itemQty: React.CSSProperties      = { color: "#52525b", fontSize: 14, fontWeight: "600", margin: 0 }
const addrCard: React.CSSProperties     = { margin: "8px 32px 16px", backgroundColor: "#f8fafc", borderRadius: 8, padding: "12px 16px" }
const addrText: React.CSSProperties     = { color: "#52525b", fontSize: 13, lineHeight: "1.7", whiteSpace: "pre-line", margin: 0 }
const helpSec: React.CSSProperties      = { padding: "12px 32px 24px" }
const helpTitle: React.CSSProperties    = { color: "#18181b", fontSize: 14, fontWeight: "700", margin: "0 0 8px" }
const helpLink: React.CSSProperties     = { color: ACCENT, fontSize: 13, textDecoration: "underline" }
const helpEmail: React.CSSProperties    = { color: "#52525b", fontSize: 13, margin: 0 }
const footerSec: React.CSSProperties    = { backgroundColor: BRAND, padding: "20px 32px", textAlign: "center" }
const footerText: React.CSSProperties   = { color: "#71717a", fontSize: 12, margin: "4px 0" }
