import {
    Body, Button, Container, Head, Heading,
    Hr, Html, Link, Preview, Section, Text,
} from "@react-email/components"

const BRAND = "#18181b"
const GREEN = "#16a34a"

export function emailVerificationEmail({
    name,
    verify_url,
    expiry_hours = 24,
}: {
    name?: string
    verify_url: string
    expiry_hours?: number
}) {
    const displayName = name || "there"

    return (
        <Html>
            <Head />
            <Preview>Verify your email address for The Marketplace</Preview>
            <Body style={body}>
                <Section style={headerSec}>
                    <Text style={brand}>The Marketplace</Text>
                </Section>
                <Container style={container}>
                    <Section style={{ padding: "32px 0 16px" }}>
                        <Text style={emoji}>✉️</Text>
                        <Heading style={h1}>Verify your email address</Heading>
                        <Text style={para}>
                            Hi {displayName}, thanks for joining The Marketplace! Please verify your
                            email address by clicking the button below to activate your account.
                        </Text>
                    </Section>

                    <Section style={{ textAlign: "center" as const, padding: "16px 0 24px" }}>
                        <Button href={verify_url} style={btn}>
                            Verify Email Address
                        </Button>
                    </Section>

                    <Hr style={hr} />

                    <Text style={smallNote}>
                        This link expires in <strong>{expiry_hours} hours</strong>. If you didn&apos;t
                        create a The Marketplace account, you can safely ignore this email.
                    </Text>

                    <Text style={smallNote}>
                        Or copy and paste this URL into your browser:{" "}
                        <Link href={verify_url} style={{ color: BRAND }}>
                            {verify_url}
                        </Link>
                    </Text>

                    <Hr style={hr} />
                    <Text style={footer}>
                        © {new Date().getFullYear()} The Marketplace · India
                    </Text>
                </Container>
            </Body>
        </Html>
    )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const body       = { backgroundColor: "#f4f4f5", fontFamily: "Inter,Arial,sans-serif", margin: 0 }
const headerSec  = { backgroundColor: BRAND, padding: "16px 32px" }
const brand      = { color: "#ffffff", fontWeight: "700" as const, fontSize: "18px", margin: 0 }
const container  = { backgroundColor: "#ffffff", borderRadius: "8px", maxWidth: "520px", margin: "24px auto", padding: "0 32px 32px" }
const h1         = { fontSize: "22px", fontWeight: "700" as const, color: BRAND, margin: "0 0 12px" }
const emoji      = { fontSize: "40px", margin: "0 0 8px" }
const para       = { fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 16px" }
const btn        = { backgroundColor: GREEN, color: "#ffffff", borderRadius: "6px", padding: "12px 28px", fontSize: "15px", fontWeight: "600" as const, textDecoration: "none" }
const hr         = { borderColor: "#e4e4e7", margin: "24px 0" }
const smallNote  = { fontSize: "13px", color: "#71717a", lineHeight: "1.6", margin: "0 0 12px" }
const footer     = { fontSize: "12px", color: "#a1a1aa", textAlign: "center" as const, margin: "8px 0 0" }
