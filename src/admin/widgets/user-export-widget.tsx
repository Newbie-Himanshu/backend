import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  FocusModal,
  Heading,
  Input,
  RadioGroup,
  Select,
  Text,
  toast,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../lib/sdk"

// ── Types ─────────────────────────────────────────────────────────────────────

type CustomerRow = {
  type: "customer"
  id: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  phone: string
  has_account: boolean
  address_count: number
  default_country: string
  customer_groups: string
  // ── Order stats ──────────────────────────────────────────────────────────
  total_orders: number
  total_spent: string
  currency: string
  avg_order_value: string
  last_order_date: string
  last_order_id: string
  last_order_status: string
  last_fulfillment_status: string
  last_payment_status: string
  // ─────────────────────────────────────────────────────────────────────────
  created_at: string
  updated_at: string
  metadata: string
}

type AdminRow = {
  type: "admin"
  id: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  avatar_url: string
  created_at: string
  updated_at: string
  metadata: string
}

type ExportResponse = {
  customers: CustomerRow[]
  admins: AdminRow[]
  total_customers: number
  total_admins: number
  exported_at: string
}

type FilterType = "all" | "customers" | "admins"
type ExportFormat = "json" | "csv"

// ── CSV helpers ───────────────────────────────────────────────────────────────

function escapeCell(val: unknown): string {
  const s = String(val ?? "")
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ""
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escapeCell(r[h])).join(",")),
  ]
  return lines.join("\n")
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ── Preview table ─────────────────────────────────────────────────────────────

const COLS_CUSTOMER: { key: keyof CustomerRow; label: string }[] = [
  { key: "type",                   label: "Type" },
  { key: "full_name",              label: "Name" },
  { key: "email",                  label: "Email" },
  { key: "phone",                  label: "Phone" },
  { key: "has_account",            label: "Account?" },
  { key: "total_orders",           label: "Orders" },
  { key: "total_spent",            label: "Total Spent" },
  { key: "avg_order_value",        label: "Avg Order" },
  { key: "last_order_id",          label: "Last Order" },
  { key: "last_order_status",      label: "Order Status" },
  { key: "last_fulfillment_status",label: "Fulfillment" },
  { key: "last_payment_status",    label: "Payment" },
  { key: "last_order_date",        label: "Last Order Date" },
  { key: "customer_groups",        label: "Groups" },
  { key: "address_count",          label: "Addresses" },
  { key: "default_country",        label: "Country" },
  { key: "created_at",             label: "Joined" },
]

const COLS_ADMIN: { key: keyof AdminRow; label: string }[] = [
  { key: "type", label: "Type" },
  { key: "full_name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "created_at", label: "Created" },
]

function PreviewTable({
  filter,
  searchRows,
}: {
  data: ExportResponse
  filter: FilterType
  searchRows: Record<string, unknown>[]
}) {
  const rows = (searchRows as (CustomerRow | AdminRow)[]).slice(0, 20)
  const totalInSet = searchRows.length

  const showCustomerCols = filter !== "admins"

  return (
    <div className="overflow-x-auto rounded-lg border border-ui-border-base mt-4">
      <table className="w-full text-xs text-left">
        <thead className="bg-ui-bg-subtle border-b border-ui-border-base">
          <tr>
            {showCustomerCols
              ? COLS_CUSTOMER.map((c) => (
                  <th key={c.key} className="px-3 py-2 font-semibold text-ui-fg-subtle whitespace-nowrap">
                    {c.label}
                  </th>
                ))
              : COLS_ADMIN.map((c) => (
                  <th key={c.key} className="px-3 py-2 font-semibold text-ui-fg-subtle whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ui-border-base">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-ui-bg-subtle transition-colors">
              {showCustomerCols
                ? COLS_CUSTOMER.map((c) => {
                    const val = (r as CustomerRow)[c.key]
                    return (
                      <td key={c.key} className="px-3 py-2 text-ui-fg-base whitespace-nowrap max-w-[200px] truncate">
                        {c.key === "type" ? (
                          <Badge color={r.type === "admin" ? "purple" : "blue"} size="xsmall">
                            {r.type}
                          </Badge>
                        ) : c.key === "has_account" ? (
                          <Badge color={val ? "green" : "grey"} size="xsmall">
                            {val ? "Yes" : "No"}
                          </Badge>
                        ) : c.key === "total_orders" ? (
                          <Badge color={Number(val) > 0 ? "green" : "grey"} size="xsmall">
                            {String(val ?? "0")}
                          </Badge>
                        ) : c.key === "total_spent" || c.key === "avg_order_value" ? (
                          <span className="font-medium text-ui-fg-base">
                            {(r as CustomerRow).currency && val !== "N/A"
                              ? `${(r as CustomerRow).currency} ${val}`
                              : String(val ?? "—")}
                          </span>
                        ) : c.key === "last_order_status" || c.key === "last_fulfillment_status" || c.key === "last_payment_status" ? (
                          val && val !== "N/A" && val !== "" ? (
                            <Badge
                              color={
                                String(val).includes("complet") || String(val).includes("paid") || String(val).includes("fulfilled")
                                  ? "green"
                                  : String(val).includes("cancel") || String(val).includes("refund")
                                  ? "red"
                                  : String(val).includes("pending") || String(val).includes("not_")
                                  ? "orange"
                                  : "grey"
                              }
                              size="xsmall"
                            >
                              {String(val).replace(/_/g, " ")}
                            </Badge>
                          ) : <span className="text-ui-fg-muted">—</span>
                        ) : c.key === "created_at" || c.key === "last_order_date" ? (
                          val ? formatDate(val as string) : "—"
                        ) : (
                          String(val ?? "—")
                        )}
                      </td>
                    )
                  })
                : COLS_ADMIN.map((c) => {
                    const val = (r as AdminRow)[c.key]
                    return (
                      <td key={c.key} className="px-3 py-2 text-ui-fg-base whitespace-nowrap max-w-[200px] truncate">
                        {c.key === "type" ? (
                          <Badge color="purple" size="xsmall">admin</Badge>
                        ) : c.key === "created_at" ? (
                          formatDate(val as string)
                        ) : (
                          String(val ?? "—")
                        )}
                      </td>
                    )
                  })}
            </tr>
          ))}
        </tbody>
      </table>
      {totalInSet > 20 && (
        <p className="px-3 py-2 text-xs text-ui-fg-muted border-t border-ui-border-base">
          Showing 20 of {totalInSet} rows — all rows are included in the export.
        </p>
      )}
    </div>
  )
}

// ── Export FocusModal ─────────────────────────────────────────────────────────
// Medusa-style FocusModal that lets the admin choose which user group to export
// before the actual download fires.

const TYPE_OPTIONS: { value: FilterType; label: string; desc: string }[] = [
  { value: "all",       label: "All Users",      desc: "Customers + Admin accounts" },
  { value: "customers", label: "Customers Only",  desc: "All registered / guest customers" },
  { value: "admins",    label: "Admins Only",     desc: "All admin panel users" },
]

type ExportModalProps = {
  open: boolean
  format: ExportFormat | null
  onClose: () => void
  onConfirm: (type: FilterType, format: ExportFormat) => void
  totalCustomers: number
  totalAdmins: number
}

function ExportModal({
  open,
  format,
  onClose,
  onConfirm,
  totalCustomers,
  totalAdmins,
}: ExportModalProps) {
  const [selectedType, setSelectedType] = useState<FilterType>("all")

  const countFor = (v: FilterType) =>
    v === "all" ? totalCustomers + totalAdmins
    : v === "customers" ? totalCustomers
    : totalAdmins

  const handleConfirm = () => {
    if (!format) return
    onConfirm(selectedType, format)
    onClose()
  }

  return (
    <FocusModal open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <FocusModal.Content className="max-w-md">
        <FocusModal.Header>
          <FocusModal.Title>
            Export {format === "json" ? "JSON" : "CSV"}
          </FocusModal.Title>
          <Text size="small" className="text-ui-fg-muted mt-1">
            Choose which user group to include in the export.
          </Text>
        </FocusModal.Header>

        <FocusModal.Body className="py-6 px-6">
          {/* Group selection */}
          <RadioGroup
            value={selectedType}
            onValueChange={(v) => setSelectedType(v as FilterType)}
            className="flex flex-col gap-y-3"
          >
            {TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                htmlFor={`export-type-${opt.value}`}
                className={[
                  "flex items-center gap-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                  selectedType === opt.value
                    ? "border-ui-border-interactive bg-ui-bg-field-component"
                    : "border-ui-border-base hover:bg-ui-bg-subtle",
                ].join(" ")}
              >
                <RadioGroup.Item
                  value={opt.value}
                  id={`export-type-${opt.value}`}
                />
                <div className="flex flex-col gap-y-0.5 flex-1">
                  <span className="text-sm font-medium text-ui-fg-base">
                    {opt.label}
                    <Badge color="grey" size="xsmall" className="ml-2">
                      {countFor(opt.value)} records
                    </Badge>
                  </span>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {opt.desc}
                  </Text>
                </div>
              </label>
            ))}
          </RadioGroup>

          {/* Summary strip */}
          <div className="mt-5 rounded-md bg-ui-bg-subtle border border-ui-border-base px-3 py-2.5">
            <Text size="xsmall" className="text-ui-fg-muted">
              The file will contain{" "}
              <span className="font-semibold text-ui-fg-base">
                {countFor(selectedType)} records
              </span>{" "}
              in{" "}
              <span className="font-semibold text-ui-fg-base uppercase">{format}</span>{" "}
              format.
            </Text>
          </div>
        </FocusModal.Body>

        <div className="flex justify-end items-center gap-x-2 px-6 pb-6 pt-0">
          <FocusModal.Close asChild>
            <Button variant="secondary" size="small" onClick={onClose}>
              Cancel
            </Button>
          </FocusModal.Close>
          <Button size="small" onClick={handleConfirm}>
            Download {format?.toUpperCase()}
          </Button>
        </div>
      </FocusModal.Content>
    </FocusModal>
  )
}

// ── Main Widget ───────────────────────────────────────────────────────────────

const UserExportWidget = () => {
  const [filter, setFilter] = useState<FilterType>("all")
  const [search, setSearch] = useState("")  // ← search/filter text

  // ── Export dialog state ────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null)

  const openExportDialog = (fmt: ExportFormat) => {
    setPendingFormat(fmt)
    setDialogOpen(true)
  }

  const { data, isLoading, isError, refetch, isFetching } = useQuery<ExportResponse>({
    queryKey: ["user-export", filter],
    queryFn: () =>
      sdk.client.fetch<ExportResponse>(`/admin/custom/user-export?type=${filter}&limit=10000`),
    staleTime: 60_000,
    retry: false,
  })

  // ── Downloads (called from modal confirm) ─────────────────────────────
  const handleDownloadJson = (exportFilter: FilterType = filter) => {
    if (!data) return
    const customerRows = exportFilter !== "admins" ? data.customers : []
    const adminRows    = exportFilter !== "customers" ? data.admins : []
    const merged = [...customerRows, ...adminRows]
    const payload = {
      exported_at: data.exported_at,
      filter: exportFilter,
      total_customers: data.total_customers,
      total_admins: data.total_admins,
      total_records: merged.length,
      customers: customerRows,
      admins: adminRows,
    }
    const filename = `Himanshu-users-${exportFilter}-${new Date().toISOString().split("T")[0]}.json`
    downloadFile(JSON.stringify(payload, null, 2), filename, "application/json")
    toast.success("JSON export downloaded", { description: `${merged.length} records` })
  }

  const handleDownloadCsv = (exportFilter: FilterType = filter) => {
    if (!data) return
    const customerRows = exportFilter !== "admins" ? data.customers : []
    const adminRows    = exportFilter !== "customers" ? data.admins : []
    const merged = [...customerRows, ...adminRows] as Record<string, unknown>[]
    if (!merged.length) return
    const csv = rowsToCsv(merged)
    const filename = `Himanshu-users-${exportFilter}-${new Date().toISOString().split("T")[0]}.csv`
    downloadFile(csv, filename, "text/csv;charset=utf-8;")
    toast.success("CSV export downloaded", { description: `${merged.length} records` })
  }

  // ── Modal confirm dispatcher ──────────────────────────────────────────
  const handleModalConfirm = (type: FilterType, fmt: ExportFormat) => {
    if (fmt === "json") handleDownloadJson(type)
    else handleDownloadCsv(type)
  }

  // ── Helper: merged rows for the widget badge counter ──────────────────
  const getMergedRows = (): Record<string, unknown>[] => {
    if (!data) return []
    const customerRows = filter !== "admins" ? data.customers : []
    const adminRows = filter !== "customers" ? data.admins : []
    return [...customerRows, ...adminRows] as Record<string, unknown>[]
  }

  const totalRecords = data ? getMergedRows().length : 0

  // ── Search-filtered rows for the preview table ────────────────────────
  const filteredRows = (() => {
    const rows = getMergedRows() as Record<string, unknown>[]
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      String(r.full_name    ?? "").toLowerCase().includes(q) ||
      String(r.email        ?? "").toLowerCase().includes(q) ||
      String(r.phone        ?? "").toLowerCase().includes(q) ||
      String(r.customer_groups ?? "").toLowerCase().includes(q) ||
      String(r.last_order_id   ?? "").toLowerCase().includes(q) ||
      String(r.type         ?? "").toLowerCase().includes(q)
    )
  })()

  return (
    <>
      <Container className="divide-y p-0">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 flex-wrap gap-3">
          <div>
            <Heading level="h2">User Export</Heading>
            <Text size="small" className="text-ui-fg-muted mt-0.5">
              Export all customers and admin users as JSON or CSV.
            </Text>
          </div>
          <Button
            variant="secondary"
            size="small"
            onClick={() => refetch()}
            isLoading={isFetching}
          >
            Refresh
          </Button>
        </div>

        {/* Filter + stats */}
        <div className="px-6 py-4 flex flex-wrap items-center gap-3">
          {/* Type selector */}
          <div className="flex items-center gap-2">
            <Text size="small" weight="plus" className="text-ui-fg-subtle">
              Show:
            </Text>
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <Select.Trigger className="w-36">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All Users</Select.Item>
                <Select.Item value="customers">Customers Only</Select.Item>
                <Select.Item value="admins">Admins Only</Select.Item>
              </Select.Content>
            </Select>
          </div>

          {/* Search input */}
          <div className="relative flex items-center">
            <Input
              placeholder="Search name, email, phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="small"
              className="w-56 pr-7"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 text-ui-fg-muted hover:text-ui-fg-base text-xs"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {search && (
            <Text size="xsmall" className="text-ui-fg-muted">
              {filteredRows.length} matching
            </Text>
          )}

          {data && (
            <div className="flex items-center gap-3 ml-auto flex-wrap">
              <Badge color="blue" size="xsmall">
                {data.total_customers} customers
              </Badge>
              <Badge color="purple" size="xsmall">
                {data.total_admins} admins
              </Badge>
              <Badge color="grey" size="xsmall">
                {totalRecords} total records
              </Badge>
            </div>
          )}
        </div>

        {/* State messages */}
        <div className="px-6 py-4">
          {isLoading && (
            <Text size="small" className="text-ui-fg-muted">
              Loading user data…
            </Text>
          )}

          {isError && !isLoading && (
            <div className="rounded-lg border border-ui-border-strong bg-ui-bg-subtle p-4">
              <Text size="small" className="text-ui-fg-subtle">
                Failed to load user data. Make sure the backend is running.
              </Text>
            </div>
          )}

          {/* Preview table */}
          {data && !isLoading && totalRecords > 0 && (
            <PreviewTable data={data} filter={filter} searchRows={filteredRows} />
          )}

          {data && !isLoading && totalRecords === 0 && (
            <Text size="small" className="text-ui-fg-muted">
              No records found for the selected filter.
            </Text>
          )}
        </div>

        {/* Export actions */}
        {data && totalRecords > 0 && (
          <div className="px-6 py-4 flex flex-wrap gap-3 items-center">
            <Text size="small" weight="plus" className="text-ui-fg-subtle mr-1">
              Download:
            </Text>

            <Button
              variant="secondary"
              size="small"
              onClick={() => openExportDialog("json")}
              disabled={isLoading || isFetching}
            >
              ↓ Export JSON
            </Button>

            <Button
              variant="secondary"
              size="small"
              onClick={() => openExportDialog("csv")}
              disabled={isLoading || isFetching}
            >
              ↓ Export CSV
            </Button>

            <Text size="xsmall" className="text-ui-fg-muted ml-1">
              Last fetched:{" "}
              {data?.exported_at ? formatDate(data.exported_at) : "—"}
            </Text>
          </div>
        )}
      </Container>

      {/* Export confirmation modal */}
      {data && (
        <ExportModal
          open={dialogOpen}
          format={pendingFormat}
          onClose={() => { setDialogOpen(false); setPendingFormat(null) }}
          onConfirm={handleModalConfirm}
          totalCustomers={data.total_customers}
          totalAdmins={data.total_admins}
        />
      )}
    </>
  )
}

// ── Widget config ─────────────────────────────────────────────────────────────
// Injected at the top of the Customers list page.
export const config = defineWidgetConfig({
  zone: "customer.list.before",
})

export default UserExportWidget
