/**
 * Admin → FAQ Management
 * ────────────────────────────────────────────────────────────
 * Custom route: /app/faq-queries (enhanced)
 *
 * Tabbed interface for managing:
 *   1. FAQ Queries — customer-submitted support questions
 *   2. FAQ Articles — static help center FAQs (add/edit/delete/hide)
 *
 * Built following the Medusa v2 Admin Extension pattern
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { QuestionMarkCircle } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Select,
  Table,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../../lib/sdk"
import { faqArticlesAdminService, FaqArticlesResponse } from "../../services/faq-articles"

// ── Types ─────────────────────────────────────────────────────────────────────

type TabType = "queries" | "articles"
type QueryStatus = "pending" | "answered"
type Visibility = "all" | "visible" | "hidden"

type FaqQuery = {
  id: string
  customer_name: string
  customer_email: string
  subject: string
  question: string
  answer: string | null
  status: QueryStatus
  answered_at: string | null
  created_at: string
}

type FaqArticle = {
  id: string
  title: string
  description: string
  section: "buying" | "shipping" | "payments" | "account" | "community" | "trust"
  content: string
  is_visible: boolean
  display_order: number
  total_views: number
  created_at: string
  updated_at: string
}

type FaqQueriesResponse = {
  faq_queries: FaqQuery[]
  count: number
  offset: number
  limit: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<QueryStatus, "orange" | "green"> = {
  pending: "orange",
  answered: "green",
}

const SECTIONS = [
  { label: "Buying & Orders", value: "buying" },
  { label: "Shipping", value: "shipping" },
  { label: "Payments", value: "payments" },
  { label: "Account", value: "account" },
  { label: "Trust & Safety", value: "trust" },
]

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

// ── Main page ─────────────────────────────────────────────────────────────────

const FaqManagementPage = () => {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>("queries")

  // ── FAQ Queries States ────────────────────────────────────────────────────
  const [queryTab, setQueryTab] = useState<"all" | QueryStatus>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState("")

  // ── FAQ Articles States ───────────────────────────────────────────────────
  const [articleSection, setArticleSection] = useState("all")
  const [articleVisibility, setArticleVisibility] = useState<Visibility>("all")
  const [showArticleModal, setShowArticleModal] = useState(false)
  const [editingArticle, setEditingArticle] = useState<FaqArticle | null>(null)
  const [articleForm, setArticleForm] = useState({
    title: "",
    description: "",
    section: "buying",
    content: "",
    is_visible: true,
    display_order: 999,
  })

  // ── FAQ Queries Queries ───────────────────────────────────────────────────

  const { data: allQueriesData } = useQuery<FaqQueriesResponse>({
    queryKey: ["faq-queries", "all"],
    queryFn: () =>
      sdk.client.fetch<FaqQueriesResponse>(
        "/admin/faq-queries?limit=1000&offset=0"
      ),
    staleTime: 60 * 1000,
    retry: false,
  })

  const queryCounts = {
    pending:
      allQueriesData?.faq_queries.filter((q) => q.status === "pending")
        .length ?? 0,
    answered:
      allQueriesData?.faq_queries.filter((q) => q.status === "answered")
        .length ?? 0,
  }

  const { data: queriesData, isLoading: queriesLoading } =
    useQuery<FaqQueriesResponse>({
      queryKey: ["faq-queries", queryTab],
      queryFn: () => {
        const qs = new URLSearchParams({ limit: "100", offset: "0" })
        if (queryTab !== "all") qs.set("status", queryTab)
        return sdk.client.fetch<FaqQueriesResponse>(
          `/admin/faq-queries?${qs}`
        )
      },
      staleTime: 60 * 1000,
      retry: false,
    })

  // ── FAQ Articles Queries ──────────────────────────────────────────────────

  const { data: articlesData, isLoading: articlesLoading } =
    useQuery<FaqArticlesResponse>({
      queryKey: ["faq-articles", articleSection, articleVisibility],
      queryFn: () =>
        faqArticlesAdminService.listArticles({
          section: articleSection,
          visibility: articleVisibility,
          limit: 100,
          offset: 0,
        }),
      staleTime: 60 * 1000,
      retry: false,
      enabled: activeTab === "articles",
    })

  // ── Mutations ─────────────────────────────────────────────────────────────

  const answerMutation = useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: string }) =>
      sdk.client.fetch(`/admin/faq-queries/${id}`, {
        method: "PATCH",
        body: { answer },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faq-queries"] })
      setAnsweringId(null)
      setAnswerText("")
      toast.success("Answer posted — query marked as answered.")
    },
    onError: () => toast.error("Failed to post answer."),
  })

  const deleteQueryMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/faq-queries/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faq-queries"] })
      toast.success("Query deleted.")
    },
    onError: () => toast.error("Failed to delete query."),
  })

  // ── Article Mutations ─────────────────────────────────────────────────────

  const createArticleMutation = useMutation({
    mutationFn: (data: any) => faqArticlesAdminService.createArticle(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faq-articles"] })
      setShowArticleModal(false)
      setArticleForm({
        title: "",
        description: "",
        section: "buying",
        content: "",
        is_visible: true,
        display_order: 999,
      })
      toast.success("FAQ article created successfully.")
    },
    onError: () => toast.error("Failed to create article."),
  })

  const updateArticleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      faqArticlesAdminService.updateArticle(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faq-articles"] })
      setShowArticleModal(false)
      setEditingArticle(null)
      setArticleForm({
        title: "",
        description: "",
        section: "buying",
        content: "",
        is_visible: true,
        display_order: 999,
      })
      toast.success("FAQ article updated successfully.")
    },
    onError: () => toast.error("Failed to update article."),
  })

  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ id, is_visible }: { id: string; is_visible: boolean }) =>
      faqArticlesAdminService.toggleVisibility(id, is_visible),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faq-articles"] })
      toast.success("Article visibility toggled.")
    },
    onError: () => toast.error("Failed to toggle visibility."),
  })

  const deleteArticleMutation = useMutation({
    mutationFn: (id: string) => faqArticlesAdminService.deleteArticle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faq-articles"] })
      toast.success("Article deleted.")
    },
    onError: () => toast.error("Failed to delete article."),
  })

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveArticle = () => {
    if (!articleForm.title.trim() || !articleForm.description.trim() || !articleForm.content.trim()) {
      toast.error("Please fill in all required fields.")
      return
    }

    if (editingArticle) {
      updateArticleMutation.mutate({ id: editingArticle.id, data: articleForm })
    } else {
      createArticleMutation.mutate(articleForm)
    }
  }

  const handleEditArticle = (article: FaqArticle) => {
    setEditingArticle(article)
    setArticleForm({
      title: article.title,
      description: article.description,
      section: article.section,
      content: article.content,
      is_visible: article.is_visible,
      display_order: article.display_order,
    })
    setShowArticleModal(true)
  }

  const handleNewArticle = () => {
    setEditingArticle(null)
    setArticleForm({
      title: "",
      description: "",
      section: "buying",
      content: "",
      is_visible: true,
      display_order: 999,
    })
    setShowArticleModal(true)
  }

  // ── render ────────────────────────────────────────────────────────────────

  const queries = queriesData?.faq_queries ?? []
  const articles = articlesData?.articles ?? []

  const QUERY_TABS: {
    label: string
    value: "all" | QueryStatus
    count?: number
  }[] = [
    { label: "All", value: "all" },
    { label: "Pending", value: "pending", count: queryCounts.pending },
    { label: "Answered", value: "answered", count: queryCounts.answered },
  ]

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* ── Header with tabs ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Heading>FAQ Management</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Manage customer support questions and help center articles.
          </Text>
        </div>
      </div>

      {/* ── Main tabs: Queries vs Articles ── */}
      <div className="flex items-center gap-0 border-b border-ui-border-base">
        <button
          onClick={() => setActiveTab("queries")}
          className={[
            "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "queries"
              ? "border-ui-fg-base text-ui-fg-base"
              : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base",
          ].join(" ")}
        >
          FAQ Queries
          <Badge color="orange" size="xsmall">
            {queryCounts.pending}
          </Badge>
        </button>
        <button
          onClick={() => setActiveTab("articles")}
          className={[
            "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "articles"
              ? "border-ui-fg-base text-ui-fg-base"
              : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base",
          ].join(" ")}
        >
          FAQ Articles
        </button>
      </div>

      {/* ── FAQ Queries Tab ── */}
      {activeTab === "queries" && (
        <div className="flex flex-col gap-6">
          {/* Query status tabs */}
          <div className="flex items-center gap-0 border-b border-ui-border-base">
            {QUERY_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setQueryTab(t.value)}
                className={[
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                  queryTab === t.value
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

          {/* Queries table */}
          {queriesLoading ? (
            <Container>
              <div className="py-12 text-center">
                <Text className="text-ui-fg-subtle">Loading queries…</Text>
              </div>
            </Container>
          ) : queries.length === 0 ? (
            <Container>
              <div className="py-16 text-center flex flex-col items-center gap-3">
                <QuestionMarkCircle className="text-ui-fg-muted w-10 h-10" />
                <Text className="text-ui-fg-subtle">
                  {queryTab === "pending"
                    ? "No pending queries — all caught up! 🎉"
                    : "No queries in this category."}
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
                  {queries.map((q) => (
                    <div key={q.id}>
                      {/* Summary row */}
                      <Table.Row
                        className="cursor-pointer hover:bg-ui-bg-subtle-hover"
                        onClick={() =>
                          setExpandedId(expandedId === q.id ? null : q.id)
                        }
                      >
                        <Table.Cell>
                          <div>
                            <Text size="small" weight="plus">
                              {q.customer_name}
                            </Text>
                            <Text size="xsmall" className="text-ui-fg-muted">
                              {q.customer_email}
                            </Text>
                          </div>
                        </Table.Cell>

                        <Table.Cell className="max-w-[280px]">
                          <Text size="small" className="truncate">
                            {q.subject}
                          </Text>
                        </Table.Cell>

                        <Table.Cell>
                          <Text
                            size="small"
                            className="text-ui-fg-muted whitespace-nowrap"
                          >
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
                            onClick={(e) => e.stopPropagation()}
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
                                deleteQueryMutation.isPending &&
                                deleteQueryMutation.variables === q.id
                              }
                              onClick={() => deleteQueryMutation.mutate(q.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </Table.Cell>
                      </Table.Row>

                      {/* Expanded detail row */}
                      {expandedId === q.id && (
                        <tr className="border-b border-ui-border-base bg-ui-bg-subtle">
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

                              {/* Existing answer */}
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
                                    placeholder="Write a clear, helpful answer…"
                                    value={answerText}
                                    onChange={(e) =>
                                      setAnswerText(e.target.value)
                                    }
                                    rows={5}
                                  />
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="small"
                                      isLoading={
                                        answerMutation.isPending &&
                                        answerMutation.variables?.id === q.id
                                      }
                                      disabled={
                                        answerText.trim().length < 10
                                      }
                                      onClick={() =>
                                        answerMutation.mutate({
                                          id: q.id,
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
                                    <Text
                                      size="xsmall"
                                      className="text-ui-fg-muted ml-auto"
                                    >
                                      {answerText.trim().length} / 3000 chars
                                    </Text>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </div>
                  ))}
                </Table.Body>
              </Table>
            </Container>
          )}
        </div>
      )}

      {/* ── FAQ Articles Tab ── */}
      {activeTab === "articles" && (
        <div className="flex flex-col gap-6">
          {/* Filters and actions */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <Select
                value={articleSection}
                onValueChange={setArticleSection}
              >
                <Select.Trigger>
                  <Select.Value placeholder="All Sections" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All Sections</Select.Item>
                  {SECTIONS.map((s) => (
                    <Select.Item key={s.value} value={s.value}>
                      {s.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>

              <Select
                value={articleVisibility}
                onValueChange={setArticleVisibility as any}
              >
                <Select.Trigger>
                  <Select.Value placeholder="All Status" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All Status</Select.Item>
                  <Select.Item value="visible">Visible</Select.Item>
                  <Select.Item value="hidden">Hidden</Select.Item>
                </Select.Content>
              </Select>
            </div>

            <Button onClick={handleNewArticle}>+ Add Article</Button>
          </div>

          {/* Articles table */}
          {articlesLoading ? (
            <Container>
              <div className="py-12 text-center">
                <Text className="text-ui-fg-subtle">Loading articles…</Text>
              </div>
            </Container>
          ) : articles.length === 0 ? (
            <Container>
              <div className="py-16 text-center flex flex-col items-center gap-3">
                <QuestionMarkCircle className="text-ui-fg-muted w-10 h-10" />
                <Text className="text-ui-fg-subtle">
                  No articles found. Create one to get started!
                </Text>
              </div>
            </Container>
          ) : (
            <Container className="p-0 overflow-hidden">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Title</Table.HeaderCell>
                    <Table.HeaderCell>Section</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Views</Table.HeaderCell>
                    <Table.HeaderCell>Order</Table.HeaderCell>
                    <Table.HeaderCell>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>

                <Table.Body>
                  {articles.map((a) => (
                    <Table.Row key={a.id}>
                      <Table.Cell>
                        <div>
                          <Text size="small" weight="plus">
                            {a.title}
                          </Text>
                          <Text
                            size="xsmall"
                            className="text-ui-fg-muted"
                          >
                            {a.description.substring(0, 50)}...
                          </Text>
                        </div>
                      </Table.Cell>

                      <Table.Cell>
                        <Text size="small">{a.section}</Text>
                      </Table.Cell>

                      <Table.Cell>
                        <Badge
                          color={a.is_visible ? "green" : "orange"}
                          size="xsmall"
                        >
                          {a.is_visible ? "Visible" : "Hidden"}
                        </Badge>
                      </Table.Cell>

                      <Table.Cell>
                        <Text size="small">{a.total_views}</Text>
                      </Table.Cell>

                      <Table.Cell>
                        <Text size="small">{a.display_order}</Text>
                      </Table.Cell>

                      <Table.Cell>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => handleEditArticle(a)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            variant={a.is_visible ? "secondary" : "danger"}
                            isLoading={
                              toggleVisibilityMutation.isPending &&
                              toggleVisibilityMutation.variables?.id === a.id
                            }
                            onClick={() =>
                              toggleVisibilityMutation.mutate({
                                id: a.id,
                                is_visible: a.is_visible,
                              })
                            }
                          >
                            {a.is_visible ? "Hide" : "Show"}
                          </Button>
                          <Button
                            size="small"
                            variant="transparent"
                            className="text-ui-fg-error hover:text-ui-fg-error"
                            isLoading={
                              deleteArticleMutation.isPending &&
                              deleteArticleMutation.variables === a.id
                            }
                            onClick={() => deleteArticleMutation.mutate(a.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </Container>
          )}
        </div>
      )}

      {/* ── Article Modal ── */}
      {showArticleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="border-b border-ui-border-base p-6">
              <Heading className="text-lg">
                {editingArticle ? "Edit FAQ Article" : "Create New FAQ Article"}
              </Heading>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-4 p-6">
              <div>
                <Text size="small" weight="plus" className="mb-2">
                  Title *
                </Text>
                <Input
                  placeholder="e.g., How do I track my order?"
                  value={articleForm.title}
                  onChange={(e) =>
                    setArticleForm({ ...articleForm, title: e.target.value })
                  }
                />
              </div>

              <div>
                <Text size="small" weight="plus" className="mb-2">
                  Description *
                </Text>
                <Input
                  placeholder="Brief summary for the help center listing"
                  value={articleForm.description}
                  onChange={(e) =>
                    setArticleForm({
                      ...articleForm,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Text size="small" weight="plus" className="mb-2">
                    Section *
                  </Text>
                  <Select
                    value={articleForm.section}
                    onValueChange={(value) =>
                      setArticleForm({ ...articleForm, section: value as any })
                    }
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {SECTIONS.map((s) => (
                        <Select.Item key={s.value} value={s.value}>
                          {s.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>

                <div>
                  <Text size="small" weight="plus" className="mb-2">
                    Display Order
                  </Text>
                  <Input
                    type="number"
                    value={articleForm.display_order}
                    onChange={(e) =>
                      setArticleForm({
                        ...articleForm,
                        display_order: parseInt(e.target.value) || 999,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <Text size="small" weight="plus" className="mb-2">
                  Content (JSON or Markdown) *
                </Text>
                <Textarea
                  placeholder="Paste your article content in JSON or markdown format"
                  value={articleForm.content}
                  onChange={(e) =>
                    setArticleForm({ ...articleForm, content: e.target.value })
                  }
                  rows={8}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_visible"
                  checked={articleForm.is_visible}
                  onChange={(e) =>
                    setArticleForm({
                      ...articleForm,
                      is_visible: e.target.checked,
                    })
                  }
                />
                <label htmlFor="is_visible" className="text-sm cursor-pointer">
                  Make visible in help center
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-ui-border-base p-6 flex items-center gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => setShowArticleModal(false)}
              >
                Cancel
              </Button>
              <Button
                isLoading={
                  createArticleMutation.isPending ||
                  updateArticleMutation.isPending
                }
                onClick={handleSaveArticle}
              >
                {editingArticle ? "Update Article" : "Create Article"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Route metadata ───────────────────────────────────────────────────────────
export const config = defineRouteConfig({
  label: "FAQ Management",
  icon: QuestionMarkCircle,
})

export const handle = {
  breadcrumb: () => "FAQ Management",
}

export default FaqManagementPage
