import { useState } from "react"
import { Text, Badge, IconButton, Tooltip } from "@medusajs/ui"
import { ChevronDown, ChevronRight, Edit2, Trash2, Plus, Eye } from "lucide-react"
import { CategoryTree } from "../hooks/useCategoryManagement"

interface CategoryTreeViewProps {
  categories: CategoryTree[]
  onEdit?: (categoryId: string) => void
  onDelete?: (categoryId: string) => void
  onAddChild?: (parentId: string) => void
  onView?: (categoryId: string) => void
  expandAll?: boolean
  showActions?: boolean
  maxDepth?: number
}

/**
 * CategoryTreeView - Reusable tree view component for categories
 */
export const CategoryTreeView = ({
  categories,
  onEdit,
  onDelete,
  onAddChild,
  onView,
  expandAll = false,
  showActions = true,
  maxDepth = 6,
}: CategoryTreeViewProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    expandAll ? new Set(categories.map((c) => c.id)) : new Set()
  )

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const renderCategory = (
    category: CategoryTree,
    level: number = 0
  ): JSX.Element => {
    const showChildren =
      category.children && category.children.length > 0 && level < maxDepth

    return (
      <div key={category.id} className={`ml-${level * 4}`}>
        <div className="flex items-center gap-2 py-2 px-2 hover:bg-ui-bg-base-pressed rounded group transition-colors">
          {showChildren ? (
            <button
              onClick={() => toggleExpanded(category.id)}
              className="text-ui-fg-muted hover:text-ui-fg-base transition"
              aria-label={
                expandedIds.has(category.id) ? "Collapse" : "Expand"
              }
            >
              {expandedIds.has(category.id) ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}

          <div className="flex-1 min-w-0">
            <Text weight="plus" size="small" className="truncate">
              {category.name}
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle truncate">
              {category.handle}
            </Text>
          </div>

          <Badge size="small">
            L{category.level}
          </Badge>

          {showActions && (
            <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
              {onView && (
                <Tooltip content="View">
                  <IconButton
                    variant="transparent"
                    size="small"
                    onClick={() => onView(category.id)}
                  >
                    <Eye size={14} />
                  </IconButton>
                </Tooltip>
              )}

              {onAddChild && category.level < maxDepth && (
                <Tooltip content="Add subcategory">
                  <IconButton
                    variant="transparent"
                    size="small"
                    onClick={() => onAddChild(category.id)}
                  >
                    <Plus size={14} />
                  </IconButton>
                </Tooltip>
              )}

              {onEdit && (
                <Tooltip content="Edit">
                  <IconButton
                    variant="transparent"
                    size="small"
                    onClick={() => onEdit(category.id)}
                  >
                    <Edit2 size={14} />
                  </IconButton>
                </Tooltip>
              )}

              {onDelete && (
                <Tooltip content="Delete">
                  <IconButton
                    variant="transparent"
                    size="small"
                    onClick={() => onDelete(category.id)}
                  >
                    <Trash2 size={14} className="text-ui-fg-error" />
                  </IconButton>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {expandedIds.has(category.id) && showChildren && (
          <div className="border-l border-ui-border-base ml-2">
            {category.children!.map((child) =>
              renderCategory(child, level + 1)
            )}
          </div>
        )}
      </div>
    )
  }

  if (!categories || categories.length === 0) {
    return (
      <Text className="text-ui-fg-subtle text-center py-8">
        No categories to display
      </Text>
    )
  }

  return (
    <div className="space-y-1">
      {categories.map((category) => renderCategory(category))}
    </div>
  )
}

export default CategoryTreeView
