import {
    Body, Button, Column, Container, Head, Heading,
    Hr, Html, Img, Link, Preview, Row, Section, Text,
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
const GREEN  = "#16a34a"
const ACCENT = "#FF6B35"

export function orderDeliveredEmail({ order }: { order: any }) {
    const currency = order?.currency_code || "INR"
    const name = order?.customer?.first_name || order?.shipping_address?.first_name || "Valued Customer"

    return (
        <Html>
            <Head />
            <Preview>📦 Your order #{order?.display_id} has been delivered! How was it?</Preview>
            <Body style={body}>
                {/* ── Header ── */}
                <Section style={headerSec}>
                    <Text style={brand}>Vridhira Marketplace</Text>
                </Section>

                <Container style={container}>
                    {/* ── Hero ── */}
                    <Section style={heroSec}>
                        <Text style={heroEmoji}>📦</Text>
                        <Heading style={h1}>Delivered!</Heading>
                        <Text style={heroSub}>
                            Hi {name}, your order #{order?.display_id} has arrived. We hope you love what you got!
                        </Text>
                    </Section>

                    {/* ── Progress Bar: All Done ── */}
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
                                <Text style={dotDone}>●</Text>
                                <Text style={lblDone}>Shipped</Text>
                            </Column>
                            <Column style={stepDiv} />
                            <Column style={stepCol}>
                                <Text style={dotDelivered}>●</Text>
                                <Text style={lblDelivered}>Delivered ✓</Text>
                            </Column>
                        </Row>
                    </Section>

                    {/* ── Order Summary Strip ── */}
                    <Section style={infoStrip}>
                        <Row>
                            <Column style={infoCell}>
                                <Text style={infoLabel}>Order</Text>
                                <Text style={infoVal}>#{order?.display_id}</Text>
                            </Column>
                            <Column style={infoCell}>
                                <Text style={infoLabel}>Total Paid</Text>
                                <Text style={infoVal}>{fmt(order?.total, currency)}</Text>
                            </Column>
                            <Column style={infoCell}>
                                <Text style={infoLabel}>Items</Text>
                                <Text style={infoVal}>{(order?.items || []).length}</Text>
                            </Column>
                        </Row>
                    </Section>

                    {/* ── Items Delivered ── */}
                    {(order?.items || []).length > 0 && (
                        <>
                            <Hr style={hr} />
                            <Text style={sectionHead}>Your Order</Text>
                            {(order.items || []).map((item: any) => (
                                <Section key={item.id} style={itemRow}>
                                    <Row>
                                        {item.thumbnail && (
                                            <Column style={{ width: 76, verticalAlign: "top" }}>
                                                <Img
                                                    src={item.thumbnail}
                                                    width={64} height={64}
                                                    alt={item.title}
                                                    style={thumbStyle}
                                                />
                                            </Column>
                                        )}
                                        <Column style={{ verticalAlign: "top" }}>
                                            <Text style={itemName}>{item.title || item.product_title}</Text>
                                            {item.variant_title && item.variant_title !== "Default Title" && (
                                                <Text style={variantTag}>{item.variant_title}</Text>
                                            )}
                                            <Text style={itemQty}>Qty: {item.quantity}</Text>
                                        </Column>
                                        <Column style={{ textAlign: "right", verticalAlign: "top" }}>
                                            <Text style={itemPrice}>{fmt(item.subtotal ?? (item.unit_price * item.quantity), currency)}</Text>
                                        </Column>
                                    </Row>
                                </Section>
                            ))}
                        </>
                    )}

                    <Hr style={hr} />

                    {/* ── Review CTA ── */}
                    <Section style={reviewBox}>
                        <Text style={reviewTitle}>⭐ Enjoyed your purchase?</Text>
                        <Text style={reviewText}>
                            Your review helps thousands of shoppers make better decisions.
                            Takes only 30 seconds!
                        </Text>
                        <Section style={{ textAlign: "center", marginTop: 12 }}>
                            <Button
                                href={`${process.env.STORE_URL || "https://vridhira.com"}/account/orders/${order?.id}/review`}
                                style={reviewBtn}
                            >
                                ★ Rate Your Order
                            </Button>
                        </Section>
                    </Section>

                    <Hr style={hr} />

                    {/* ── Shop Again CTA ── */}
                    <Section style={{ textAlign: "center", padding: "16px 32px 20px" }}>
                        <Button href={process.env.STORE_URL || "https://vridhira.com"} style={shopBtn}>
                            Shop Again →
                        </Button>
                    </Section>

                    <Hr style={hr} />

                    {/* ── Returns Notice ── */}
                    <Section style={returnsBox}>
                        <Row>
                            <Column style={{ width: 32 }}>
                                <Text style={returnsIcon}>↩</Text>
                            </Column>
                            <Column>
                                <Text style={returnsTitle}>Easy 7-Day Returns</Text>
                                <Text style={returnsText}>
                                    Something not right? Wrong item, damaged product, or a size issue?
                                    Contact us within <strong>7 days</strong> and we'll make it right.{" "}
                                    <Link href="https://vridhira.com/returns" style={returnsLink}>
                                        Start a Return
                                    </Link>
                                </Text>
                            </Column>
                        </Row>
                    </Section>

                    {/* ── Help ── */}
                    <Section style={helpSec}>
                        <Text style={helpText}>Questions? Write to us at{" "}
                            <Link href="mailto:support@vridhira.com" style={helpLink}>support@vridhira.com</Link>
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
const body: React.CSSProperties          = { backgroundColor: "#f1f5f9", fontFamily: "'Segoe UI',Arial,sans-serif", margin: 0, padding: 0 }
const headerSec: React.CSSProperties     = { backgroundColor: BRAND, padding: "16px 32px" }
const brand: React.CSSProperties         = { color: "#FF6B35", fontSize: 22, fontWeight: "800", margin: 0 }
const container: React.CSSProperties     = { backgroundColor: "#ffffff", maxWidth: 600, margin: "24px auto", borderRadius: 12 }
const heroSec: React.CSSProperties       = { textAlign: "center", padding: "32px 32px 16px" }
const heroEmoji: React.CSSProperties     = { fontSize: 52, margin: "0 0 8px" }
const h1: React.CSSProperties            = { fontSize: 30, fontWeight: "800", color: "#18181b", margin: "0 0 12px", letterSpacing: "-0.5px" }
const heroSub: React.CSSProperties       = { color: "#52525b", fontSize: 15, lineHeight: "1.6", margin: 0 }
const progressSec: React.CSSProperties   = { padding: "14px 32px", backgroundColor: "#f0fdf4", borderTop: "1px solid #bbf7d0", borderBottom: "1px solid #bbf7d0" }
const stepCol: React.CSSProperties       = { textAlign: "center", width: 70 }
const stepDiv: React.CSSProperties       = { borderTop: "2px solid #86efac", verticalAlign: "middle" }
const dotDone: React.CSSProperties       = { color: GREEN, fontSize: 20, margin: "0 0 2px", lineHeight: "1" }
const dotDelivered: React.CSSProperties  = { color: GREEN, fontSize: 24, margin: "0 0 2px", lineHeight: "1" }
const lblDone: React.CSSProperties       = { color: GREEN, fontSize: 11, fontWeight: "700", margin: 0 }
const lblDelivered: React.CSSProperties  = { color: GREEN, fontSize: 11, fontWeight: "800", margin: 0 }
const infoStrip: React.CSSProperties     = { padding: "12px 32px", backgroundColor: "#f8fafc", borderBottom: "1px solid #f1f5f9" }
const infoCell: React.CSSProperties      = { textAlign: "center", padding: "0 8px" }
const infoLabel: React.CSSProperties     = { color: "#71717a", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px" }
const infoVal: React.CSSProperties       = { color: "#18181b", fontSize: 14, fontWeight: "700", margin: 0 }
const hr: React.CSSProperties            = { borderColor: "#e4e4e7", margin: 0 }
const sectionHead: React.CSSProperties  = { fontSize: 16, fontWeight: "700", color: "#18181b", margin: "20px 32px 10px", paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }
const itemRow: React.CSSProperties       = { padding: "8px 32px" }
const thumbStyle: React.CSSProperties    = { borderRadius: 8, objectFit: "cover", border: "1px solid #f1f5f9" }
const itemName: React.CSSProperties      = { color: "#18181b", fontSize: 14, fontWeight: "600", margin: "0 0 3px" }
const variantTag: React.CSSProperties    = { color: "#6b7280", fontSize: 12, backgroundColor: "#f1f5f9", padding: "2px 8px", borderRadius: 4, margin: "0 0 3px", display: "inline-block" }
const itemQty: React.CSSProperties       = { color: "#9ca3af", fontSize: 12, margin: 0 }
const itemPrice: React.CSSProperties     = { color: "#18181b", fontSize: 14, fontWeight: "700", margin: 0 }
const reviewBox: React.CSSProperties     = { backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "16px 20px", margin: "16px 32px" }
const reviewTitle: React.CSSProperties   = { color: "#92400e", fontSize: 16, fontWeight: "800", margin: "0 0 6px" }
const reviewText: React.CSSProperties    = { color: "#78350f", fontSize: 14, lineHeight: "1.6", margin: 0 }
const reviewBtn: React.CSSProperties     = { backgroundColor: "#f59e0b", color: "#ffffff", fontSize: 15, fontWeight: "700", borderRadius: 8, padding: "12px 28px", textDecoration: "none" }
const shopBtn: React.CSSProperties       = { backgroundColor: ACCENT, color: "#ffffff", fontSize: 16, fontWeight: "700", borderRadius: 8, padding: "14px 40px", textDecoration: "none", display: "inline-block" }
const returnsBox: React.CSSProperties    = { backgroundColor: "#f8fafc", border: "1px solid #e4e4e7", borderRadius: 8, padding: "12px 16px", margin: "16px 32px" }
const returnsIcon: React.CSSProperties   = { color: "#6b7280", fontSize: 20, fontWeight: "700", margin: 0 }
const returnsTitle: React.CSSProperties  = { color: "#18181b", fontSize: 14, fontWeight: "700", margin: "0 0 4px" }
const returnsText: React.CSSProperties   = { color: "#52525b", fontSize: 13, lineHeight: "1.6", margin: 0 }
const returnsLink: React.CSSProperties   = { color: ACCENT, textDecoration: "underline" }
const helpSec: React.CSSProperties       = { padding: "8px 32px 24px", textAlign: "center" }
const helpText: React.CSSProperties      = { color: "#71717a", fontSize: 13, margin: 0 }
const helpLink: React.CSSProperties      = { color: ACCENT, textDecoration: "underline" }
const footerSec: React.CSSProperties     = { backgroundColor: BRAND, padding: "20px 32px", textAlign: "center" }
const footerText: React.CSSProperties    = { color: "#71717a", fontSize: 12, margin: "4px 0" }
