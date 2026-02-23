import {
    Body, Button, Column, Container, Head, Heading,
    Hr, Html, Link, Preview, Row, Section, Text,
} from "@react-email/components"

const fmt = (amount: any, currency = "INR") => {
    const num = typeof amount === "number" ? amount
        : typeof amount === "string" ? parseFloat(amount)
        : typeof amount?.value === "string" ? parseFloat(amount.value)
        : 0
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currency.toUpperCase(),
        maximumFractionDigits: 0,
    }).format(num)
}

const BRAND  = "#18181b"
const ACCENT = "#FF6B35"

export function orderCancelledEmail({ order }: { order: any }) {
    const currency = order?.currency_code || "INR"
    const name = order?.customer?.first_name || order?.shipping_address?.first_name || "Valued Customer"
    const isPrepaid = order?.payments?.some(
        (p: any) => p.provider_id !== "pp_cod_cod" && p.provider_id !== "cod"
    )

    return (
        <Html>
            <Head />
            <Preview>Order #{order?.display_id} cancelled{isPrepaid ? ` · Refund of ${fmt(order?.total, currency)} initiated` : ""}</Preview>
            <Body style={body}>
                {/* ── Header ── */}
                <Section style={headerSec}>
                    <Text style={brand}>Vridhira Marketplace</Text>
                </Section>

                <Container style={container}>
                    {/* ── Hero ── */}
                    <Section style={heroSec}>
                        <Section style={iconCircle}>
                            <Text style={iconText}>✕</Text>
                        </Section>
                        <Heading style={h1}>Order Cancelled</Heading>
                        <Text style={heroSub}>
                            Hi {name}, your order #{order?.display_id} has been successfully cancelled.
                        </Text>
                    </Section>

                    {/* ── Order Facts ── */}
                    <Section style={factsStrip}>
                        <Row>
                            <Column style={factCell}>
                                <Text style={factLabel}>Order Number</Text>
                                <Text style={factVal}>#{order?.display_id}</Text>
                            </Column>
                            <Column style={factCell}>
                                <Text style={factLabel}>Order Total</Text>
                                <Text style={factVal}>{fmt(order?.total, currency)}</Text>
                            </Column>
                            <Column style={factCell}>
                                <Text style={factLabel}>Cancelled On</Text>
                                <Text style={factVal}>{new Date().toLocaleDateString("en-IN")}</Text>
                            </Column>
                        </Row>
                    </Section>

                    {/* ── Refund / No Charge Notice ── */}
                    {isPrepaid ? (
                        <Section style={refundBox}>
                            <Row>
                                <Column style={{ width: 32 }}>
                                    <Text style={refundIcon}>💰</Text>
                                </Column>
                                <Column>
                                    <Text style={refundTitle}>Refund Initiated</Text>
                                    <Text style={refundText}>
                                        Your refund of <strong>{fmt(order?.total, currency)}</strong> has been initiated.
                                        It will reflect in your original payment method within{" "}
                                        <strong>5–7 business days</strong>.
                                    </Text>
                                </Column>
                            </Row>
                        </Section>
                    ) : (
                        <Section style={codBox}>
                            <Row>
                                <Column style={{ width: 32 }}>
                                    <Text style={codIcon}>✓</Text>
                                </Column>
                                <Column>
                                    <Text style={codTitle}>No Payment Charged</Text>
                                    <Text style={codText}>
                                        This was a Cash on Delivery order. No payment was collected,
                                        so no refund is needed.
                                    </Text>
                                </Column>
                            </Row>
                        </Section>
                    )}

                    {/* ── Cancelled Items ── */}
                    {(order?.items || []).length > 0 && (
                        <>
                            <Hr style={hr} />
                            <Text style={sectionHead}>Cancelled Items</Text>
                            {(order.items || []).map((item: any) => (
                                <Section key={item.id} style={itemRow}>
                                    <Row>
                                        <Column>
                                            <Text style={itemName}>{item.title || item.product_title}</Text>
                                            {item.variant_title && item.variant_title !== "Default Title" && (
                                                <Text style={variantTag}>{item.variant_title}</Text>
                                            )}
                                            <Text style={itemMeta}>Qty: {item.quantity}</Text>
                                        </Column>
                                        <Column style={{ textAlign: "right" }}>
                                            <Text style={itemPrice}>{fmt(item.subtotal ?? (item.unit_price * item.quantity), currency)}</Text>
                                        </Column>
                                    </Row>
                                </Section>
                            ))}
                        </>
                    )}

                    <Hr style={hr} />

                    {/* ── Shop Again CTA ── */}
                    <Section style={{ textAlign: "center", padding: "16px 32px 8px" }}>
                        <Text style={shopPrompt}>Ready to order again? Great deals are waiting!</Text>
                        <Button href={process.env.STORE_URL || "https://vridhira.com"} style={shopBtn}>
                            Continue Shopping →
                        </Button>
                    </Section>

                    <Hr style={hr} />

                    {/* ── Unintended Cancellation ── */}
                    <Section style={helpBox}>
                        <Text style={helpTitle}>Didn't request this cancellation?</Text>
                        <Text style={helpText}>
                            If you did not cancel this order, please contact us immediately at{" "}
                            <Link href="mailto:support@vridhira.com" style={helpLink}>
                                support@vridhira.com
                            </Link>{" "}
                            and we'll investigate right away.
                        </Text>
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

// ─── Styles ─────────────────────────────────────────────────────────────────────
const body: React.CSSProperties         = { backgroundColor: "#f1f5f9", fontFamily: "'Segoe UI',Arial,sans-serif", margin: 0, padding: 0 }
const headerSec: React.CSSProperties    = { backgroundColor: BRAND, padding: "16px 32px" }
const brand: React.CSSProperties        = { color: "#FF6B35", fontSize: 22, fontWeight: "800", margin: 0 }
const container: React.CSSProperties   = { backgroundColor: "#ffffff", maxWidth: 600, margin: "24px auto", borderRadius: 12 }
const heroSec: React.CSSProperties      = { textAlign: "center", padding: "32px 32px 16px" }
const iconCircle: React.CSSProperties   = { width: 56, height: 56, backgroundColor: "#fee2e2", borderRadius: "50%", margin: "0 auto 16px", display: "table" }
const iconText: React.CSSProperties     = { color: "#dc2626", fontSize: 26, fontWeight: "800", margin: 0, lineHeight: "56px" }
const h1: React.CSSProperties           = { fontSize: 28, fontWeight: "800", color: "#18181b", margin: "0 0 12px", letterSpacing: "-0.5px" }
const heroSub: React.CSSProperties      = { color: "#52525b", fontSize: 15, lineHeight: "1.6", margin: 0 }
const factsStrip: React.CSSProperties   = { padding: "12px 32px", backgroundColor: "#f8fafc", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }
const factCell: React.CSSProperties     = { textAlign: "center", padding: "0 8px" }
const factLabel: React.CSSProperties    = { color: "#71717a", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px" }
const factVal: React.CSSProperties      = { color: "#18181b", fontSize: 14, fontWeight: "700", margin: 0 }
const refundBox: React.CSSProperties    = { backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "14px 18px", margin: "16px 32px" }
const refundIcon: React.CSSProperties   = { fontSize: 20, margin: 0 }
const refundTitle: React.CSSProperties  = { color: "#15803d", fontSize: 14, fontWeight: "700", margin: "0 0 4px" }
const refundText: React.CSSProperties   = { color: "#166534", fontSize: 14, lineHeight: "1.6", margin: 0 }
const codBox: React.CSSProperties       = { backgroundColor: "#f8fafc", border: "1px solid #e4e4e7", borderRadius: 8, padding: "14px 18px", margin: "16px 32px" }
const codIcon: React.CSSProperties      = { color: "#16a34a", fontSize: 20, fontWeight: "800", margin: 0 }
const codTitle: React.CSSProperties     = { color: "#374151", fontSize: 14, fontWeight: "700", margin: "0 0 4px" }
const codText: React.CSSProperties      = { color: "#52525b", fontSize: 14, lineHeight: "1.6", margin: 0 }
const hr: React.CSSProperties           = { borderColor: "#e4e4e7", margin: 0 }
const sectionHead: React.CSSProperties  = { fontSize: 16, fontWeight: "700", color: "#18181b", margin: "20px 32px 10px", paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }
const itemRow: React.CSSProperties      = { padding: "6px 32px" }
const itemName: React.CSSProperties     = { color: "#9ca3af", fontSize: 14, fontWeight: "600", margin: "0 0 3px", textDecoration: "line-through" }
const variantTag: React.CSSProperties   = { color: "#9ca3af", fontSize: 12, backgroundColor: "#f1f5f9", padding: "2px 8px", borderRadius: 4, margin: "0 0 3px", display: "inline-block" }
const itemMeta: React.CSSProperties     = { color: "#d1d5db", fontSize: 12, margin: 0 }
const itemPrice: React.CSSProperties    = { color: "#9ca3af", fontSize: 14, fontWeight: "600", margin: 0, textDecoration: "line-through" }
const shopPrompt: React.CSSProperties   = { color: "#52525b", fontSize: 14, margin: "0 0 12px" }
const shopBtn: React.CSSProperties      = { backgroundColor: ACCENT, color: "#ffffff", fontSize: 16, fontWeight: "700", borderRadius: 8, padding: "14px 40px", textDecoration: "none", display: "inline-block" }
const helpBox: React.CSSProperties      = { backgroundColor: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "12px 16px", margin: "16px 32px 24px" }
const helpTitle: React.CSSProperties    = { color: "#92400e", fontSize: 14, fontWeight: "700", margin: "0 0 6px" }
const helpText: React.CSSProperties     = { color: "#78350f", fontSize: 13, lineHeight: "1.6", margin: 0 }
const helpLink: React.CSSProperties     = { color: ACCENT, textDecoration: "underline" }
const footerSec: React.CSSProperties    = { backgroundColor: BRAND, padding: "20px 32px", textAlign: "center" }
const footerText: React.CSSProperties   = { color: "#71717a", fontSize: 12, margin: "4px 0" }
