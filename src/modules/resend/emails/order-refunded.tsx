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

const BRAND = "#18181b"
const GREEN = "#16a34a"
const IDLE  = "#d1d5db"

export function orderRefundedEmail({ order, refund_amount }: {
    order: any
    refund_amount?: any
}) {
    const currency   = order?.currency_code || "INR"
    const name       = order?.customer?.first_name || order?.shipping_address?.first_name || "Valued Customer"
    const refundAmt  = refund_amount ?? order?.total ?? 0
    const isCod      = order?.payments?.every(
        (p: any) => p.provider_id === "pp_cod_cod" || p.provider_id === "cod"
    )

    return (
        <Html>
            <Head />
            <Preview>💰 Refund of {fmt(refundAmt, currency)} initiated for order #{order?.display_id}</Preview>
            <Body style={body}>
                {/* ── Header ── */}
                <Section style={headerSec}>
                    <Text style={brand}>The Marketplace</Text>
                </Section>

                <Container style={container}>
                    {/* ── Hero: Refund Amount ── */}
                    <Section style={heroSec}>
                        <Text style={heroEmoji}>💰</Text>
                        <Heading style={h1}>Refund Initiated</Heading>
                        <Text style={heroSub}>
                            Hi {name}, your refund request for order #{order?.display_id} has been received and processed.
                        </Text>
                    </Section>

                    {/* ── Refund Amount Card ── */}
                    <Section style={amountCard}>
                        <Text style={amountLabel}>REFUND AMOUNT</Text>
                        <Text style={amountValue}>{fmt(refundAmt, currency)}</Text>
                        <Text style={amountSub}>Initiated on {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</Text>
                    </Section>

                    {/* ── 3-Step Refund Progress ── */}
                    <Section style={progressSec}>
                        <Row>
                            <Column style={stepCol}>
                                <Text style={dotDone}>●</Text>
                                <Text style={lblDone}>Initiated ✓</Text>
                            </Column>
                            <Column style={stepDiv} />
                            <Column style={stepCol}>
                                <Text style={dotActive}>●</Text>
                                <Text style={lblActive}>Processing</Text>
                            </Column>
                            <Column style={stepDiv} />
                            <Column style={stepCol}>
                                <Text style={dotIdle}>●</Text>
                                <Text style={lblIdle}>Credited</Text>
                            </Column>
                        </Row>
                    </Section>

                    {/* ── Payment-Specific Instructions ── */}
                    {isCod ? (
                        <Section style={codBox}>
                            <Row>
                                <Column style={{ width: 32 }}>
                                    <Text style={boxIcon}>🏦</Text>
                                </Column>
                                <Column>
                                    <Text style={codTitle}>Bank Transfer for COD Refund</Text>
                                    <Text style={codText}>
                                        Since this was a Cash on Delivery order, your refund will be
                                        transferred directly to your bank account. Our team will contact
                                        you within <strong>24 hours</strong> to collect your bank details.
                                    </Text>
                                    <Text style={{ ...codText, marginTop: 6 }}>
                                        Alternatively, email us at{" "}
                                        <Link href="mailto:support@Himanshu.com" style={inlineLink}>
                                            support@Himanshu.com
                                        </Link>{" "}
                                        with your bank account details to speed up the process.
                                    </Text>
                                </Column>
                            </Row>
                        </Section>
                    ) : (
                        <Section style={razorpayBox}>
                            <Row>
                                <Column style={{ width: 32 }}>
                                    <Text style={boxIcon}>💳</Text>
                                </Column>
                                <Column>
                                    <Text style={razorpayTitle}>Razorpay / UPI Refund Timeline</Text>
                                    <Text style={razorpayText}>
                                        Your refund has been submitted to Razorpay. It will be credited to
                                        your original payment method (UPI / Card / Net Banking) within{" "}
                                        <strong>5–7 business days</strong>. Bank processing times may vary.
                                    </Text>
                                </Column>
                            </Row>
                        </Section>
                    )}

                    <Hr style={hr} />

                    {/* ── Reference Details ── */}
                    <Text style={sectionHead}>Refund Reference</Text>
                    <Section style={refDetailsRow}>
                        <Row>
                            <Column style={detailCell}>
                                <Text style={detailLabel}>Order Number</Text>
                                <Text style={detailVal}>#{order?.display_id}</Text>
                            </Column>
                            <Column style={detailCell}>
                                <Text style={detailLabel}>Refund Amount</Text>
                                <Text style={{ ...detailVal, color: GREEN }}>{fmt(refundAmt, currency)}</Text>
                            </Column>
                        </Row>
                    </Section>

                    {/* ── Returned Items ── */}
                    {(order?.items || []).length > 0 && (
                        <>
                            <Hr style={hr} />
                            <Text style={sectionHead}>Returned Items</Text>
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
                                    </Row>
                                </Section>
                            ))}
                        </>
                    )}

                    <Hr style={hr} />

                    {/* ── CTA ── */}
                    <Section style={{ textAlign: "center", padding: "16px 32px 8px" }}>
                        <Button href={process.env.STORE_URL || "https://Himanshu.com"} style={shopBtn}>
                            Continue Shopping →
                        </Button>
                    </Section>

                    {/* ── Help ── */}
                    <Section style={helpSec}>
                        <Text style={helpText}>
                            Questions about your refund?{" "}
                            <Link href="mailto:support@Himanshu.com" style={helpLink}>
                                support@Himanshu.com
                            </Link>
                        </Text>
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
const body: React.CSSProperties          = { backgroundColor: "#f1f5f9", fontFamily: "'Segoe UI',Arial,sans-serif", margin: 0, padding: 0 }
const headerSec: React.CSSProperties     = { backgroundColor: BRAND, padding: "16px 32px" }
const brand: React.CSSProperties         = { color: "#FF6B35", fontSize: 22, fontWeight: "800", margin: 0 }
const container: React.CSSProperties     = { backgroundColor: "#ffffff", maxWidth: 600, margin: "24px auto", borderRadius: 12 }
const heroSec: React.CSSProperties       = { textAlign: "center", padding: "32px 32px 16px" }
const heroEmoji: React.CSSProperties     = { fontSize: 52, margin: "0 0 8px" }
const h1: React.CSSProperties            = { fontSize: 28, fontWeight: "800", color: "#18181b", margin: "0 0 12px", letterSpacing: "-0.5px" }
const heroSub: React.CSSProperties       = { color: "#52525b", fontSize: 15, lineHeight: "1.6", margin: 0 }
const amountCard: React.CSSProperties    = { backgroundColor: "#f0fdf4", border: "2px solid #86efac", borderRadius: 10, padding: "20px", textAlign: "center", margin: "16px 32px" }
const amountLabel: React.CSSProperties   = { color: "#15803d", fontSize: 11, fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px" }
const amountValue: React.CSSProperties   = { color: GREEN, fontSize: 40, fontWeight: "800", margin: "0 0 4px", letterSpacing: "-1px" }
const amountSub: React.CSSProperties     = { color: "#4ade80", fontSize: 13, margin: 0 }
const progressSec: React.CSSProperties   = { padding: "14px 64px", backgroundColor: "#f8fafc", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }
const stepCol: React.CSSProperties       = { textAlign: "center", width: 80 }
const stepDiv: React.CSSProperties       = { borderTop: "2px solid #d1d5db", verticalAlign: "middle" }
const dotDone: React.CSSProperties       = { color: GREEN, fontSize: 20, margin: "0 0 2px", lineHeight: "1" }
const dotActive: React.CSSProperties     = { color: "#f59e0b", fontSize: 20, margin: "0 0 2px", lineHeight: "1" }
const dotIdle: React.CSSProperties       = { color: IDLE, fontSize: 20, margin: "0 0 2px", lineHeight: "1" }
const lblDone: React.CSSProperties       = { color: GREEN, fontSize: 11, fontWeight: "700", margin: 0 }
const lblActive: React.CSSProperties     = { color: "#d97706", fontSize: 11, fontWeight: "700", margin: 0 }
const lblIdle: React.CSSProperties       = { color: "#9ca3af", fontSize: 11, margin: 0 }
const codBox: React.CSSProperties        = { backgroundColor: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, padding: "14px 18px", margin: "16px 32px" }
const codTitle: React.CSSProperties      = { color: "#1e40af", fontSize: 14, fontWeight: "700", margin: "0 0 4px" }
const codText: React.CSSProperties       = { color: "#1e3a8a", fontSize: 14, lineHeight: "1.6", margin: 0 }
const razorpayBox: React.CSSProperties   = { backgroundColor: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 8, padding: "14px 18px", margin: "16px 32px" }
const razorpayTitle: React.CSSProperties = { color: "#6b21a8", fontSize: 14, fontWeight: "700", margin: "0 0 4px" }
const razorpayText: React.CSSProperties  = { color: "#581c87", fontSize: 14, lineHeight: "1.6", margin: 0 }
const boxIcon: React.CSSProperties       = { fontSize: 20, margin: 0 }
const inlineLink: React.CSSProperties    = { color: "#2563eb", textDecoration: "underline" }
const hr: React.CSSProperties            = { borderColor: "#e4e4e7", margin: 0 }
const sectionHead: React.CSSProperties   = { fontSize: 16, fontWeight: "700", color: "#18181b", margin: "20px 32px 10px", paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }
const refDetailsRow: React.CSSProperties = { padding: "8px 32px 16px" }
const detailCell: React.CSSProperties    = { width: "50%", padding: "0 8px" }
const detailLabel: React.CSSProperties   = { color: "#71717a", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }
const detailVal: React.CSSProperties     = { color: "#18181b", fontSize: 16, fontWeight: "700", margin: 0 }
const itemRow: React.CSSProperties       = { padding: "6px 32px" }
const itemName: React.CSSProperties      = { color: "#18181b", fontSize: 14, fontWeight: "600", margin: "0 0 3px" }
const variantTag: React.CSSProperties    = { color: "#6b7280", fontSize: 12, backgroundColor: "#f1f5f9", padding: "2px 8px", borderRadius: 4, margin: "0 0 3px", display: "inline-block" }
const itemMeta: React.CSSProperties      = { color: "#9ca3af", fontSize: 12, margin: 0 }
const shopBtn: React.CSSProperties       = { backgroundColor: "#FF6B35", color: "#ffffff", fontSize: 16, fontWeight: "700", borderRadius: 8, padding: "14px 40px", textDecoration: "none", display: "inline-block" }
const helpSec: React.CSSProperties       = { padding: "8px 32px 24px", textAlign: "center" }
const helpText: React.CSSProperties      = { color: "#71717a", fontSize: 13, margin: 0 }
const helpLink: React.CSSProperties      = { color: "#FF6B35", textDecoration: "underline" }
const footerSec: React.CSSProperties     = { backgroundColor: BRAND, padding: "20px 32px", textAlign: "center" }
const footerText: React.CSSProperties    = { color: "#71717a", fontSize: 12, margin: "4px 0" }
