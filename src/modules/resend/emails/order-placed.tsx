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

const BRAND_COLOR = "#FF6B35"
const STEP_ACTIVE = "#FF6B35"
const STEP_DONE   = "#16a34a"
const STEP_IDLE   = "#d1d5db"

export function orderPlacedEmail({ order }: { order: any }) {
    const currency = order?.currency_code || "INR"
    const name = order?.customer?.first_name || order?.shipping_address?.first_name || "Valued Customer"
    const addr = order?.shipping_address
    const isPrepaid = order?.payments?.some(
        (p: any) => p.provider_id !== "pp_cod_cod" && p.provider_id !== "cod"
    )
    const estimatedDelivery = order?.created_at
        ? new Date(new Date(order.created_at).getTime() + 7 * 24 * 60 * 60 * 1000)
            .toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
        : "5–7 business days"

    return (
        <Html>
            <Head />
            <Preview>✅ Order #{order?.display_id} confirmed! Estimated delivery in 5–7 days</Preview>
            <Body style={body}>
                {/* ── Header ── */}
                <Section style={headerSec}>
                    <Text style={brand}>The Marketplace</Text>
                </Section>

                <Container style={container}>
                    {/* ── Hero ── */}
                    <Section style={heroSection}>
                        <Text style={heroEmoji}>🎉</Text>
                        <Heading style={h1}>Order Confirmed!</Heading>
                        <Section style={orderBadge}>
                            <Text style={orderBadgeText}>Order #{order?.display_id}</Text>
                        </Section>
                        <Text style={heroSub}>
                            Hi {name}, we received your order and are processing it now. You'll get another email when it ships.
                        </Text>
                    </Section>

                    {/* ── Progress Bar ── */}
                    <Section style={progressSection}>
                        <Row>
                            <Column style={stepCol}>
                                <Text style={dotDone}>●</Text>
                                <Text style={lblDone}>Ordered</Text>
                            </Column>
                            <Column style={stepDivider} />
                            <Column style={stepCol}>
                                <Text style={dotActive}>●</Text>
                                <Text style={lblActive}>Processing</Text>
                            </Column>
                            <Column style={stepDivider} />
                            <Column style={stepCol}>
                                <Text style={dotIdle}>●</Text>
                                <Text style={lblIdle}>Shipped</Text>
                            </Column>
                            <Column style={stepDivider} />
                            <Column style={stepCol}>
                                <Text style={dotIdle}>●</Text>
                                <Text style={lblIdle}>Delivered</Text>
                            </Column>
                        </Row>
                    </Section>

                    {/* ── Key Facts Grid ── */}
                    <Section style={factsGrid}>
                        <Row>
                            <Column style={factCell}>
                                <Text style={factLabel}>Order Date</Text>
                                <Text style={factValue}>
                                    {order?.created_at
                                        ? new Date(order.created_at).toLocaleDateString("en-IN")
                                        : new Date().toLocaleDateString("en-IN")}
                                </Text>
                            </Column>
                            <Column style={factCell}>
                                <Text style={factLabel}>Est. Delivery</Text>
                                <Text style={factValue}>{estimatedDelivery}</Text>
                            </Column>
                            <Column style={factCell}>
                                <Text style={factLabel}>Payment</Text>
                                <Text style={{ ...factValue, color: isPrepaid ? "#7c3aed" : "#0369a1" }}>
                                    {isPrepaid ? "Paid Online" : "Cash on Delivery"}
                                </Text>
                            </Column>
                        </Row>
                    </Section>

                    <Hr style={hr} />

                    {/* ── Items ── */}
                    <Text style={sectionHeading}>Items in Your Order</Text>
                    {(order?.items || []).map((item: any) => (
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
                                    <Text style={itemTotal}>{fmt(item.subtotal ?? (item.unit_price * item.quantity), currency)}</Text>
                                    <Text style={itemUnitCost}>{fmt(item.unit_price, currency)} each</Text>
                                </Column>
                            </Row>
                        </Section>
                    ))}

                    {/* ── Order Summary ── */}
                    <Section style={summaryBox}>
                        <SummaryRow label="Subtotal" value={fmt(order?.subtotal, currency)} />
                        {(order?.shipping_total ?? 0) > 0
                            ? <SummaryRow label="Shipping" value={fmt(order.shipping_total, currency)} />
                            : <SummaryRow label="Shipping" value="FREE" green />
                        }
                        {(order?.tax_total ?? 0) > 0 && (
                            <SummaryRow label="Tax (GST)" value={fmt(order.tax_total, currency)} />
                        )}
                        {(order?.discount_total ?? 0) > 0 && (
                            <SummaryRow label="Discount" value={`-${fmt(order.discount_total, currency)}`} green />
                        )}
                        <Hr style={thinHr} />
                        <Row>
                            <Column><Text style={grandTotalLabel}>Total</Text></Column>
                            <Column style={{ textAlign: "right" }}>
                                <Text style={grandTotalValue}>{fmt(order?.total, currency)}</Text>
                            </Column>
                        </Row>
                    </Section>

                    {/* ── Addresses ── */}
                    {addr && (
                        <>
                            <Hr style={hr} />
                            <Section style={{ padding: "0 32px 16px" }}>
                                <Row>
                                    <Column style={{ width: "54%", verticalAlign: "top", paddingRight: 12 }}>
                                        <Text style={addrHead}>📦 Shipping To</Text>
                                        <Text style={addrBody}>
                                            {`${addr.first_name || ""} ${addr.last_name || ""}`.trim()}{"\n"}
                                            {addr.address_1}{"\n"}
                                            {addr.address_2 ? addr.address_2 + "\n" : ""}
                                            {`${addr.city || ""}${addr.province ? `, ${addr.province}` : ""} – ${addr.postal_code || ""}`.trim()}
                                            {addr.phone ? `\n📞 ${addr.phone}` : ""}
                                        </Text>
                                    </Column>
                                    <Column style={{ width: "46%", verticalAlign: "top", paddingLeft: 12, borderLeft: "1px solid #e4e4e7" }}>
                                        <Text style={addrHead}>💳 Payment Method</Text>
                                        <Text style={addrBody}>
                                            {isPrepaid
                                                ? "Paid via Razorpay\n(UPI / Card / Net Banking)"
                                                : "Cash on Delivery\nPay when your order arrives"}
                                        </Text>
                                    </Column>
                                </Row>
                            </Section>
                        </>
                    )}

                    <Hr style={hr} />

                    {/* ── CTA Button ── */}
                    <Section style={{ textAlign: "center", padding: "8px 32px 20px" }}>
                        <Button
                            href={`${process.env.STORE_URL || "https://Himanshu.com"}/account/orders/${order?.id}`}
                            style={ctaBtn}
                        >
                            View Order Status →
                        </Button>
                    </Section>

                    <Hr style={hr} />

                    {/* ── Help Section ── */}
                    <Section style={helpBox}>
                        <Text style={helpTitle}>Need Help?</Text>
                        <Row>
                            <Column>
                                <Text style={helpText}>📧 support@Himanshu.com</Text>
                            </Column>
                            <Column style={{ textAlign: "right" }}>
                                <Link href="https://Himanshu.com/returns" style={helpLink}>
                                    Returns within 7 days
                                </Link>
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

function SummaryRow({ label, value, green }: { label: string; value: string; green?: boolean }) {
    return (
        <Row>
            <Column><Text style={summaryLabel}>{label}</Text></Column>
            <Column style={{ textAlign: "right" }}>
                <Text style={{ ...summaryValue, ...(green ? { color: "#16a34a", fontWeight: "700" } : {}) }}>
                    {value}
                </Text>
            </Column>
        </Row>
    )
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const body: React.CSSProperties           = { backgroundColor: "#f1f5f9", fontFamily: "'Segoe UI',Arial,sans-serif", margin: 0, padding: 0 }
const headerSec: React.CSSProperties      = { backgroundColor: "#18181b", padding: "16px 32px" }
const brand: React.CSSProperties          = { color: "#FF6B35", fontSize: 22, fontWeight: "800", margin: 0, letterSpacing: "-0.5px" }
const container: React.CSSProperties      = { backgroundColor: "#ffffff", maxWidth: 600, margin: "24px auto", borderRadius: 12 }
const heroSection: React.CSSProperties    = { textAlign: "center", padding: "32px 32px 16px" }
const heroEmoji: React.CSSProperties      = { fontSize: 48, margin: "0 0 8px" }
const h1: React.CSSProperties             = { fontSize: 30, fontWeight: "800", color: "#18181b", margin: "0 0 12px", letterSpacing: "-0.5px" }
const heroSub: React.CSSProperties        = { color: "#52525b", fontSize: 15, lineHeight: "1.6", margin: "12px 0 0" }
const orderBadge: React.CSSProperties     = { display: "inline-block", backgroundColor: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 20, padding: "4px 16px", margin: "0 auto" }
const orderBadgeText: React.CSSProperties = { color: "#c2410c", fontSize: 14, fontWeight: "700", margin: 0 }
const progressSection: React.CSSProperties = { padding: "16px 32px", backgroundColor: "#f8fafc", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }
const stepCol: React.CSSProperties        = { textAlign: "center", width: 70 }
const stepDivider: React.CSSProperties    = { borderTop: "2px solid #d1d5db", verticalAlign: "middle" }
const dotDone: React.CSSProperties        = { color: STEP_DONE, fontSize: 20, margin: "0 0 2px", lineHeight: "1" }
const dotActive: React.CSSProperties      = { color: STEP_ACTIVE, fontSize: 20, margin: "0 0 2px", lineHeight: "1" }
const dotIdle: React.CSSProperties        = { color: STEP_IDLE, fontSize: 20, margin: "0 0 2px", lineHeight: "1" }
const lblDone: React.CSSProperties        = { color: STEP_DONE, fontSize: 11, fontWeight: "700", margin: 0 }
const lblActive: React.CSSProperties      = { color: STEP_ACTIVE, fontSize: 11, fontWeight: "700", margin: 0 }
const lblIdle: React.CSSProperties        = { color: "#9ca3af", fontSize: 11, margin: 0 }
const factsGrid: React.CSSProperties      = { padding: "12px 32px", backgroundColor: "#f8fafc", borderBottom: "1px solid #f1f5f9" }
const factCell: React.CSSProperties       = { textAlign: "center", padding: "0 8px" }
const factLabel: React.CSSProperties      = { color: "#71717a", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px" }
const factValue: React.CSSProperties      = { color: "#18181b", fontSize: 14, fontWeight: "700", margin: 0 }
const hr: React.CSSProperties             = { borderColor: "#e4e4e7", margin: "0" }
const sectionHeading: React.CSSProperties = { fontSize: 16, fontWeight: "700", color: "#18181b", margin: "20px 32px 12px", borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }
const itemRow: React.CSSProperties        = { padding: "8px 32px" }
const thumbStyle: React.CSSProperties     = { borderRadius: 8, objectFit: "cover", border: "1px solid #f1f5f9" }
const itemName: React.CSSProperties       = { color: "#18181b", fontSize: 14, fontWeight: "600", margin: "0 0 3px" }
const variantTag: React.CSSProperties     = { color: "#6b7280", fontSize: 12, backgroundColor: "#f1f5f9", padding: "2px 8px", borderRadius: 4, margin: "0 0 3px", display: "inline-block" }
const itemQty: React.CSSProperties        = { color: "#9ca3af", fontSize: 12, margin: 0 }
const itemTotal: React.CSSProperties      = { color: "#18181b", fontSize: 15, fontWeight: "700", margin: "0 0 2px" }
const itemUnitCost: React.CSSProperties   = { color: "#9ca3af", fontSize: 12, margin: 0 }
const summaryBox: React.CSSProperties     = { margin: "16px 32px", padding: "16px", backgroundColor: "#f8fafc", borderRadius: 8, border: "1px solid #e4e4e7" }
const summaryLabel: React.CSSProperties   = { color: "#52525b", fontSize: 14, margin: "4px 0" }
const summaryValue: React.CSSProperties   = { color: "#18181b", fontSize: 14, margin: "4px 0" }
const thinHr: React.CSSProperties         = { borderColor: "#e4e4e7", margin: "10px 0" }
const grandTotalLabel: React.CSSProperties = { color: "#18181b", fontSize: 17, fontWeight: "800", margin: "4px 0" }
const grandTotalValue: React.CSSProperties = { color: BRAND_COLOR, fontSize: 20, fontWeight: "800", margin: "4px 0" }
const addrHead: React.CSSProperties       = { color: "#18181b", fontSize: 13, fontWeight: "700", margin: "0 0 6px" }
const addrBody: React.CSSProperties       = { color: "#52525b", fontSize: 13, lineHeight: "1.7", whiteSpace: "pre-line", margin: 0 }
const ctaBtn: React.CSSProperties         = { backgroundColor: BRAND_COLOR, color: "#ffffff", fontSize: 16, fontWeight: "700", borderRadius: 8, padding: "14px 40px", textDecoration: "none", display: "inline-block" }
const helpBox: React.CSSProperties        = { backgroundColor: "#f8fafc", border: "1px solid #e4e4e7", borderRadius: 8, padding: "12px 16px", margin: "0 32px 24px" }
const helpTitle: React.CSSProperties      = { color: "#18181b", fontSize: 14, fontWeight: "700", margin: "0 0 8px" }
const helpText: React.CSSProperties       = { color: "#52525b", fontSize: 13, margin: 0 }
const helpLink: React.CSSProperties       = { color: BRAND_COLOR, fontSize: 13, textDecoration: "underline" }
const footerSec: React.CSSProperties      = { backgroundColor: "#18181b", padding: "20px 32px", textAlign: "center" }
const footerText: React.CSSProperties     = { color: "#71717a", fontSize: 12, margin: "4px 0" }
