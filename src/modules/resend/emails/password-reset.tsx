import {
    Body, Button, Container, Head, Heading,
    Hr, Html, Link, Preview, Section, Text,
} from "@react-email/components"

const BRAND = "#18181b"

export function passwordResetEmail({
    name,
    reset_url,
    expiry_minutes = 15,
}: {
    name?: string
    reset_url: string
    expiry_minutes?: number
}) {
    const displayName = name || "there"

    return (
        <Html>
            <Head />
            <Preview>Reset your The Marketplace password</Preview>
            <Body style={body}>
                <Section style={headerSec}>
                    <Text style={brand}>The Marketplace</Text>
                </Section>
                <Container style={container}>
                    <Section style={{ padding: "32px 0 16px" }}>
                        <Text style={emoji}>🔐</Text>
                        <Heading style={h1}>Reset your password</Heading>
                        <Text style={para}>
                            Hi {displayName}, we received a request to reset the password for your Himanshu
                            Marketplace account. Click the button below to choose a new password.
                        </Text>
                    </Section>

                    <Section style={{ textAlign: "center" as const, padding: "16px 0 24px" }}>
                        <Button href={reset_url} style={btn}>
                            Reset Password
                        </Button>
                    </Section>

                    <Hr style={hr} />

                    <Text style={smallNote}>
                        This link expires in <strong>{expiry_minutes} minutes</strong>. If you didn&apos;t
                        request a password reset, you can safely ignore this email — your password will not
                        change.
                    </Text>

                    <Text style={smallNote}>
                        Or copy and paste this URL into your browser:{" "}
                        <Link href={reset_url} style={{ color: BRAND }}>
                            {reset_url}
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
const btn        = { backgroundColor: BRAND, color: "#ffffff", borderRadius: "6px", padding: "12px 28px", fontSize: "15px", fontWeight: "600" as const, textDecoration: "none" }
const hr         = { borderColor: "#e4e4e7", margin: "24px 0" }
const smallNote  = { fontSize: "13px", color: "#71717a", lineHeight: "1.6", margin: "0 0 12px" }
const footer     = { fontSize: "12px", color: "#a1a1aa", textAlign: "center" as const, margin: "8px 0 0" }
