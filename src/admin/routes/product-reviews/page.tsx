import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Star } from "@medusajs/icons"
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../../lib/sdk"

// ── Types ─────────────────────────────────────────────────────────────────────

type ReviewStatus = "pending" | "approved" | "flagged"

type ProductReview = {
    id: string
    product_id: string
    product_title?: string
    customer_id?: string
    display_name: string
    rating: number
    content: string
    status: ReviewStatus
    created_at: string
    response?: {
        id: string
        content: string
        created_at: string
    } | null
}

type ReviewsResponse = {
    product_reviews: ProductReview[]
    count: number
    offset: number
    limit: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ReviewStatus, "orange" | "green" | "red"> = {
    pending:  "orange",
    approved: "green",
    flagged:  "red",
}

function StarRow({ rating }: { rating: number }) {
    return (
        <span className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <span
                    key={i}
                    className={
                        i < rating
                            ? "text-yellow-400"
                            : "text-ui-fg-muted opacity-30"
                    }
                >
                    ★
                </span>
            ))}
        </span>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type StatusFilter = "all" | ReviewStatus

const ProductReviewsPage = () => {
    const qc = useQueryClient()
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
    const [respondingId, setRespondingId] = useState<string | null>(null)
    const [responseText, setResponseText] = useState("")

    // ── fetch ────────────────────────────────────────────────────────────────
    const { data, isLoading, error } = useQuery<ReviewsResponse>({
        queryKey: ["product-reviews", statusFilter],
        queryFn: () => {
            const qs = new URLSearchParams({ limit: "100", offset: "0" })
            if (statusFilter !== "all") qs.set("status", statusFilter)
            return sdk.client.fetch<ReviewsResponse>(`/admin/product-reviews?${qs}`)
        },
        staleTime: 2 * 60 * 1000,
        retry: false,
    })

    // counts per status for tab badges
    const { data: allData } = useQuery<ReviewsResponse>({
        queryKey: ["product-reviews", "all"],
        queryFn: () =>
            sdk.client.fetch<ReviewsResponse>("/admin/product-reviews?limit=1000&offset=0"),
        staleTime: 2 * 60 * 1000,
        retry: false,
    })
    const counts = {
        pending:  allData?.product_reviews.filter(r => r.status === "pending").length  ?? 0,
        approved: allData?.product_reviews.filter(r => r.status === "approved").length ?? 0,
        flagged:  allData?.product_reviews.filter(r => r.status === "flagged").length  ?? 0,
    }

    // ── mutations ────────────────────────────────────────────────────────────
    const updateStatus = useMutation({
        mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) =>
            sdk.client.fetch(`/admin/product-reviews/${id}/status`, {
                method: "PUT",
                body: { status },
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["product-reviews"] })
            toast.success("Status updated")
        },
        onError: () => toast.error("Failed to update status"),
    })

    const createResponse = useMutation({
        mutationFn: ({ id, content }: { id: string; content: string }) =>
            sdk.client.fetch(`/admin/product-reviews/${id}/response`, {
                method: "POST",
                body: { content },
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["product-reviews"] })
            setRespondingId(null)
            setResponseText("")
            toast.success("Response posted")
        },
        onError: () => toast.error("Failed to post response"),
    })

    const deleteResponse = useMutation({
        mutationFn: (id: string) =>
            sdk.client.fetch(`/admin/product-reviews/${id}/response`, {
                method: "DELETE",
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["product-reviews"] })
            toast.success("Response deleted")
        },
        onError: () => toast.error("Failed to delete response"),
    })

    // ── render ────────────────────────────────────────────────────────────────
    const reviews = data?.product_reviews ?? []

    const TABS: { label: string; value: StatusFilter; count?: number }[] = [
        { label: "All",      value: "all" },
        { label: "Pending",  value: "pending",  count: counts.pending  },
        { label: "Approved", value: "approved", count: counts.approved },
        { label: "Flagged",  value: "flagged",  count: counts.flagged  },
    ]

    return (
        <div className="p-6 flex flex-col gap-6">
            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <Heading>Product Reviews</Heading>
                    <Text size="small" className="text-ui-fg-subtle mt-1">
                        Moderate reviews, approve or flag, and post admin responses
                    </Text>
                </div>
            </div>

            {/* ── Status tabs ── */}
            <div className="flex items-center gap-2 border-b border-ui-border-base pb-0">
                {TABS.map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => setStatusFilter(tab.value)}
                        className={[
                            "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                            statusFilter === tab.value
                                ? "border-ui-fg-base text-ui-fg-base"
                                : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base",
                        ].join(" ")}
                    >
                        {tab.label}
                        {tab.count != null && tab.count > 0 && (
                            <Badge
                                color={
                                    tab.value === "pending"  ? "orange" :
                                    tab.value === "flagged"  ? "red"    : "green"
                                }
                                size="xsmall"
                            >
                                {tab.count}
                            </Badge>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Body ── */}
            {isLoading ? (
                <Container>
                    <div className="py-12 text-center">
                        <Text className="text-ui-fg-subtle">Loading reviews…</Text>
                    </div>
                </Container>
            ) : error ? (
                <Container>
                    <div className="py-12 text-center">
                        <Text className="text-ui-fg-error">Failed to load reviews.</Text>
                    </div>
                </Container>
            ) : reviews.length === 0 ? (
                <Container>
                    <div className="py-12 text-center">
                        <Text className="text-ui-fg-subtle">No reviews in this category.</Text>
                    </div>
                </Container>
            ) : (
                <Container className="p-0 overflow-hidden">
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell>Product</Table.HeaderCell>
                                <Table.HeaderCell>Reviewer</Table.HeaderCell>
                                <Table.HeaderCell>Rating</Table.HeaderCell>
                                <Table.HeaderCell>Review</Table.HeaderCell>
                                <Table.HeaderCell>Date</Table.HeaderCell>
                                <Table.HeaderCell>Status</Table.HeaderCell>
                                <Table.HeaderCell>Actions</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {reviews.map(review => (
                                <>
                                    <Table.Row key={review.id}>
                                        <Table.Cell className="max-w-[140px]">
                                            <Text size="small" className="truncate">
                                                {review.product_title ?? review.product_id}
                                            </Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text size="small">{review.display_name}</Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <StarRow rating={review.rating} />
                                        </Table.Cell>
                                        <Table.Cell className="max-w-[260px]">
                                            <Text size="small" className="line-clamp-2 text-ui-fg-subtle">
                                                {review.content}
                                            </Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text size="small" className="text-ui-fg-muted whitespace-nowrap">
                                                {new Date(review.created_at).toLocaleDateString("en-IN", {
                                                    day: "2-digit", month: "short", year: "numeric",
                                                })}
                                            </Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge color={STATUS_COLOR[review.status]} size="xsmall">
                                                {review.status}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {review.status !== "approved" && (
                                                    <Button
                                                        size="small"
                                                        variant="secondary"
                                                        isLoading={
                                                            updateStatus.isPending &&
                                                            updateStatus.variables?.id === review.id
                                                        }
                                                        onClick={() =>
                                                            updateStatus.mutate({ id: review.id, status: "approved" })
                                                        }
                                                    >
                                                        Approve
                                                    </Button>
                                                )}
                                                {review.status !== "flagged" && (
                                                    <Button
                                                        size="small"
                                                        variant="secondary"
                                                        isLoading={
                                                            updateStatus.isPending &&
                                                            updateStatus.variables?.id === review.id
                                                        }
                                                        onClick={() =>
                                                            updateStatus.mutate({ id: review.id, status: "flagged" })
                                                        }
                                                    >
                                                        Flag
                                                    </Button>
                                                )}
                                                {review.response ? (
                                                    <Button
                                                        size="small"
                                                        variant="transparent"
                                                        className="text-ui-fg-error"
                                                        isLoading={
                                                            deleteResponse.isPending &&
                                                            deleteResponse.variables === review.id
                                                        }
                                                        onClick={() => deleteResponse.mutate(review.id)}
                                                    >
                                                        Del reply
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="small"
                                                        variant="transparent"
                                                        onClick={() => {
                                                            setRespondingId(review.id)
                                                            setResponseText("")
                                                        }}
                                                    >
                                                        Reply
                                                    </Button>
                                                )}
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>

                                    {/* Inline reply form */}
                                    {respondingId === review.id && (
                                        <tr key={`${review.id}-reply`} className="border-b border-ui-border-base">
                                            <td colSpan={7} className="bg-ui-bg-subtle px-4 py-3">
                                                <div className="flex flex-col gap-2">
                                                    <Text size="small" weight="plus">Post admin response</Text>
                                                    <Textarea
                                                        placeholder="Write your reply…"
                                                        value={responseText}
                                                        onChange={e => setResponseText(e.target.value)}
                                                        rows={3}
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            size="small"
                                                            isLoading={createResponse.isPending}
                                                            disabled={!responseText.trim()}
                                                            onClick={() =>
                                                                createResponse.mutate({
                                                                    id: review.id,
                                                                    content: responseText.trim(),
                                                                })
                                                            }
                                                        >
                                                            Post reply
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            variant="secondary"
                                                            onClick={() => setRespondingId(null)}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}

                                    {/* Existing admin response */}
                                    {review.response && (
                                        <tr key={`${review.id}-response`} className="border-b border-ui-border-base">
                                            <td colSpan={7} className="bg-ui-bg-subtle border-l-4 border-ui-border-interactive px-4 py-2">
                                                <Text size="small" weight="plus" className="text-ui-fg-subtle mb-1">
                                                    Admin response ·{" "}
                                                    {new Date(review.response.created_at).toLocaleDateString("en-IN", {
                                                        day: "2-digit", month: "short", year: "numeric",
                                                    })}
                                                </Text>
                                                <Text size="small">{review.response.content}</Text>
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

export const config = defineRouteConfig({
    label: "Product Reviews",
    icon: Star,
})

export const handle = {
    breadcrumb: () => "Product Reviews",
}

export default ProductReviewsPage
