/**
 * Admin → FAQ Queries
 * ────────────────────────────────────────────────────────────
 * Custom route: /app/faq-queries
 *
 * Displays all customer-submitted support questions.
 * Admins can:
 *   • Filter by status (Pending / Answered)
 *   • Expand a row to read the full question
 *   • Post an answer inline (sets status → answered)
 *   • Delete a query
 *
 * Built following the Medusa v2 Admin Extension pattern:
 *   https://docs.medusajs.com/learn/fundamentals/admin/route
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { QuestionMarkCircle } from "@medusajs/icons"
import {
    Badge,
    Button,
    Container,
    Heading,
    Table,
    Text,
    Textarea,
    toast,
} from "@medusajs/ui"
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../../lib/sdk"

// ── Types ─────────────────────────────────────────────────────────────────────

type QueryStatus = "pending" | "answered"

type FaqQuery = {
    id: string
    customer_name:  string
    customer_email: string
    subject:        string
    question:       string
    answer:         string | null
    status:         QueryStatus
    answered_at:    string | null
    created_at:     string
}

type FaqQueriesResponse = {
    faq_queries: FaqQuery[]
    count:  number
    offset: number
    limit:  number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<QueryStatus, "orange" | "green"> = {
    pending:  "orange",
    answered: "green",
}

function fmt(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", {
        day:   "2-digit",
        month: "short",
        year:  "numeric",
    })
}

// ── Main page ─────────────────────────────────────────────────────────────────

type TabValue = "all" | QueryStatus

const FaqQueriesPage = () => {
    const qc = useQueryClient()
    const [tab,           setTab]          = useState<TabValue>("all")
    const [expandedId,    setExpandedId]   = useState<string | null>(null)
    const [answeringId,   setAnsweringId]  = useState<string | null>(null)
    const [answerText,    setAnswerText]   = useState("")

    // ── fetch all for tab counts ─────────────────────────────────────────────
    const { data: allData } = useQuery<FaqQueriesResponse>({
        queryKey: ["faq-queries", "all"],
        queryFn:  () =>
            sdk.client.fetch<FaqQueriesResponse>(
                "/admin/faq-queries?limit=1000&offset=0"
            ),
        staleTime: 60 * 1000,
        retry: false,
    })

    const counts = {
        pending:  allData?.faq_queries.filter(q => q.status === "pending").length  ?? 0,
        answered: allData?.faq_queries.filter(q => q.status === "answered").length ?? 0,
    }

    // ── fetch filtered list ──────────────────────────────────────────────────
    const { data, isLoading, error } = useQuery<FaqQueriesResponse>({
        queryKey: ["faq-queries", tab],
        queryFn:  () => {
            const qs = new URLSearchParams({ limit: "100", offset: "0" })
            if (tab !== "all") qs.set("status", tab)
            return sdk.client.fetch<FaqQueriesResponse>(
                `/admin/faq-queries?${qs}`
            )
        },
        staleTime: 60 * 1000,
        retry: false,
    })

    // ── mutations ────────────────────────────────────────────────────────────

    const answerMutation = useMutation({
        mutationFn: ({ id, answer }: { id: string; answer: string }) =>
            sdk.client.fetch(`/admin/faq-queries/${id}`, {
                method: "PATCH",
                body:   { answer },
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["faq-queries"] })
            setAnsweringId(null)
            setAnswerText("")
            toast.success("Answer posted — the query is now marked as answered.")
        },
        onError: () => toast.error("Failed to post answer. Please try again."),
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) =>
            sdk.client.fetch(`/admin/faq-queries/${id}`, { method: "DELETE" }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["faq-queries"] })
            toast.success("Query deleted.")
        },
        onError: () => toast.error("Failed to delete query."),
    })

    // ── render ────────────────────────────────────────────────────────────────
    const queries = data?.faq_queries ?? []

    const TABS: { label: string; value: TabValue; count?: number }[] = [
        { label: "All",      value: "all" },
        { label: "Pending",  value: "pending",  count: counts.pending  },
        { label: "Answered", value: "answered", count: counts.answered },
    ]

    return (
        <div className="p-6 flex flex-col gap-6">

            {/* ── Page header ── */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <Heading>FAQ Queries</Heading>
                    <Text size="small" className="text-ui-fg-subtle mt-1">
                        Questions submitted by customers via the Help Center. Post answers to mark them as resolved.
                    </Text>
                </div>
                <Badge color={counts.pending > 0 ? "orange" : "green"} size="base">
                    {counts.pending} pending
                </Badge>
            </div>

            {/* ── Status tabs ── */}
            <div className="flex items-center gap-0 border-b border-ui-border-base">
                {TABS.map(t => (
                    <button
                        key={t.value}
                        onClick={() => setTab(t.value)}
                        className={[
                            "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                            tab === t.value
                                ? "border-ui-fg-base text-ui-fg-base"
                                : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base",
                        ].join(" ")}
                    >
                        {t.label}
                        {t.count != null && t.count > 0 && (
                            <Badge
                                color={t.value === "pending" ? "orange" : "green"}
                                size="xsmall"
                            >
                                {t.count}
                            </Badge>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Body ── */}
            {isLoading ? (
                <Container>
                    <div className="py-12 text-center">
                        <Text className="text-ui-fg-subtle">Loading queries…</Text>
                    </div>
                </Container>
            ) : error ? (
                <Container>
                    <div className="py-12 text-center">
                        <Text className="text-ui-fg-error">Failed to load queries.</Text>
                    </div>
                </Container>
            ) : queries.length === 0 ? (
                <Container>
                    <div className="py-16 text-center flex flex-col items-center gap-3">
                        <QuestionMarkCircle className="text-ui-fg-muted w-10 h-10" />
                        <Text className="text-ui-fg-subtle">
                            {tab === "pending" ? "No pending queries — all caught up! 🎉" : "No queries in this category."}
                        </Text>
                    </div>
                </Container>
            ) : (
                <Container className="p-0 overflow-hidden">
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell>Customer</Table.HeaderCell>
                                <Table.HeaderCell>Subject</Table.HeaderCell>
                                <Table.HeaderCell>Date</Table.HeaderCell>
                                <Table.HeaderCell>Status</Table.HeaderCell>
                                <Table.HeaderCell>Actions</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>

                        <Table.Body>
                            {queries.map(q => (
                                <>
                                    {/* ── Summary row ── */}
                                    <Table.Row
                                        key={q.id}
                                        className="cursor-pointer hover:bg-ui-bg-subtle-hover"
                                        onClick={() =>
                                            setExpandedId(
                                                expandedId === q.id ? null : q.id
                                            )
                                        }
                                    >
                                        <Table.Cell>
                                            <div>
                                                <Text size="small" weight="plus">{q.customer_name}</Text>
                                                <Text size="xsmall" className="text-ui-fg-muted">{q.customer_email}</Text>
                                            </div>
                                        </Table.Cell>

                                        <Table.Cell className="max-w-[280px]">
                                            <Text size="small" className="truncate">{q.subject}</Text>
                                        </Table.Cell>

                                        <Table.Cell>
                                            <Text size="small" className="text-ui-fg-muted whitespace-nowrap">
                                                {fmt(q.created_at)}
                                            </Text>
                                        </Table.Cell>

                                        <Table.Cell>
                                            <Badge color={STATUS_COLOR[q.status]} size="xsmall">
                                                {q.status}
                                            </Badge>
                                        </Table.Cell>

                                        <Table.Cell>
                                            <div
                                                className="flex items-center gap-1.5"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                {q.status === "pending" && (
                                                    <Button
                                                        size="small"
                                                        variant="secondary"
                                                        onClick={() => {
                                                            setAnsweringId(q.id)
                                                            setAnswerText(q.answer ?? "")
                                                            setExpandedId(q.id)
                                                        }}
                                                    >
                                                        Answer
                                                    </Button>
                                                )}
                                                {q.status === "answered" && (
                                                    <Button
                                                        size="small"
                                                        variant="secondary"
                                                        onClick={() => {
                                                            setAnsweringId(q.id)
                                                            setAnswerText(q.answer ?? "")
                                                            setExpandedId(q.id)
                                                        }}
                                                    >
                                                        Edit answer
                                                    </Button>
                                                )}
                                                <Button
                                                    size="small"
                                                    variant="transparent"
                                                    className="text-ui-fg-error hover:text-ui-fg-error"
                                                    isLoading={
                                                        deleteMutation.isPending &&
                                                        deleteMutation.variables === q.id
                                                    }
                                                    onClick={() => deleteMutation.mutate(q.id)}
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>

                                    {/* ── Expanded detail row (question + answer form) ── */}
                                    {expandedId === q.id && (
                                        <tr key={`${q.id}-detail`} className="border-b border-ui-border-base bg-ui-bg-subtle">
                                            <td colSpan={5} className="px-6 py-4">
                                                <div className="flex flex-col gap-4 max-w-2xl">

                                                    {/* Question */}
                                                    <div>
                                                        <Text
                                                            size="xsmall"
                                                            weight="plus"
                                                            className="text-ui-fg-muted uppercase tracking-wider mb-1"
                                                        >
                                                            Customer Question
                                                        </Text>
                                                        <div className="bg-ui-bg-base border border-ui-border-base rounded-md px-4 py-3">
                                                            <Text size="small">{q.question}</Text>
                                                        </div>
                                                    </div>

                                                    {/* Existing answer (when not editing) */}
                                                    {q.answer && answeringId !== q.id && (
                                                        <div>
                                                            <Text
                                                                size="xsmall"
                                                                weight="plus"
                                                                className="text-ui-fg-muted uppercase tracking-wider mb-1"
                                                            >
                                                                Admin Answer
                                                                {q.answered_at && (
                                                                    <span className="ml-2 normal-case font-normal">
                                                                        · {fmt(q.answered_at)}
                                                                    </span>
                                                                )}
                                                            </Text>
                                                            <div className="bg-ui-bg-base border-l-4 border-ui-border-interactive border border-ui-border-base rounded-md px-4 py-3">
                                                                <Text size="small">{q.answer}</Text>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Answer form */}
                                                    {answeringId === q.id && (
                                                        <div className="flex flex-col gap-2">
                                                            <Text
                                                                size="xsmall"
                                                                weight="plus"
                                                                className="text-ui-fg-muted uppercase tracking-wider"
                                                            >
                                                                {q.answer ? "Edit your answer" : "Post an answer"}
                                                            </Text>
                                                            <Textarea
                                                                placeholder="Write a clear, helpful answer for this customer…"
                                                                value={answerText}
                                                                onChange={e => setAnswerText(e.target.value)}
                                                                rows={5}
                                                            />
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    size="small"
                                                                    isLoading={
                                                                        answerMutation.isPending &&
                                                                        answerMutation.variables?.id === q.id
                                                                    }
                                                                    disabled={answerText.trim().length < 10}
                                                                    onClick={() =>
                                                                        answerMutation.mutate({
                                                                            id:     q.id,
                                                                            answer: answerText.trim(),
                                                                        })
                                                                    }
                                                                >
                                                                    {q.answer ? "Update answer" : "Post answer"}
                                                                </Button>
                                                                <Button
                                                                    size="small"
                                                                    variant="secondary"
                                                                    onClick={() => {
                                                                        setAnsweringId(null)
                                                                        setAnswerText("")
                                                                    }}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                                <Text size="xsmall" className="text-ui-fg-muted ml-auto">
                                                                    {answerText.trim().length} / 3000 chars
                                                                </Text>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </Table.Body>
                    </Table>
                </Container>
            )}
        </div>
    )
}

// ── Route metadata — registers this page in the Medusa Admin sidebar ─────────
export const config = defineRouteConfig({
    label: "FAQ Queries",
    icon:  QuestionMarkCircle,
})

export const handle = {
    breadcrumb: () => "FAQ Queries",
}

export default FaqQueriesPage
