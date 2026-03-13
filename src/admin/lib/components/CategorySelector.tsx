import { useState } from "react"
import {
  Button,
  Input,
  Text,
  Badge,
  IconButton,
  Tooltip,
} from "@medusajs/ui"
import { ChevronDown, ChevronRight, Search, X } from "lucide-react"
import { useCategoryManagement, Category } from "../hooks/useCategoryManagement"

interface CategorySelectorProps {
  value?: string
  onChange: (categoryId: string) => void
  onBlur?: () => void
  maxLevel?: number
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  allowMultiple?: boolean
}

/**
 * CategorySelector - Dropdown component to select a category
 * Can be used in forms to assign categories to products
 */
export const CategorySelector = ({
  value,
  onChange,
  onBlur,
  maxLevel = 6,
  label = "Category",
  placeholder = "Select a category...",
  error,
  disabled = false,
  allowMultiple = false,
}: CategorySelectorProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    value ? new Set([value]) : new Set()
  )

  const { tree, isTreeLoading } = useCategoryManagement()

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

  const handleSelect = (categoryId: string) => {
    if (allowMultiple) {
      const newSet = new Set(selectedIds)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      setSelectedIds(newSet)
      // For multiple, you'd need to handle differently
    } else {
      setSelectedIds(new Set([categoryId]))
      onChange(categoryId)
      setIsOpen(false)
    }
  }

  const renderTree = (
    categories: any[],
    level: number = 0
  ): JSX.Element => {
    if (!categories || categories.length === 0) {
      return <p className="text-ui-fg-subtle text-sm py-2">No categories</p>
    }

    return (
      <div className="space-y-1">
        {categories
          .filter((cat) =>
            cat.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((category) => (
            <div key={category.id}>
              <div className="flex items-center gap-2 py-2 px-2 hover:bg-ui-bg-base-pressed rounded cursor-pointer group">
                {category.children && category.children.length > 0 ? (
                  <button
                    onClick={() => toggleExpanded(category.id)}
                    className="text-ui-fg-muted hover:text-ui-fg-base"
                  >
                    {expandedIds.has(category.id) ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </button>
                ) : (
                  <div className="w-4" />
                )}

                <input
                  type="radio"
                  name="category"
                  value={category.id}
                  checked={selectedIds.has(category.id)}
                  onChange={() => handleSelect(category.id)}
                  disabled={level > maxLevel || disabled}
                  className="cursor-pointer"
                />

                <div
                  className="flex-1"
                  onClick={() => handleSelect(category.id)}
                >
                  <Text weight="plus" size="small">
                    {category.name}
                  </Text>
                </div>

                <Badge size="small">
                  L{category.level}
                </Badge>
              </div>

              {expandedIds.has(category.id) &&
                category.children &&
                category.children.length > 0 && (
                  <div className="ml-2">
                    {renderTree(category.children, level + 1)}
                  </div>
                )}
            </div>
          ))}
      </div>
    )
  }

  const selectedCategory = tree?.find((cat) =>
    findCategoryById(cat, Array.from(selectedIds)[0])
  )

  return (
    <div>
      {label && <Text weight="plus" size="small" className="mb-2">{label}</Text>}

      <div className="relative">
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onBlur={onBlur}
          disabled={disabled}
          className={`w-full px-3 py-2 rounded border flex items-center justify-between ${
            error
              ? "border-ui-border-error bg-ui-bg-error-light"
              : "border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-base-pressed"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span className="text-ui-fg-base text-sm">
            {selectedCategory?.name || placeholder}
          </span>
          <ChevronDown size={16} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-ui-bg-base border border-ui-border-base rounded shadow-lg z-50 max-h-96 overflow-y-auto">
            <div className="p-3 border-b border-ui-border-base sticky top-0 bg-ui-bg-base">
              <Input
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                type="text"
              />
            </div>

            <div className="p-3">
              {isTreeLoading ? (
                <Text className="text-ui-fg-subtle text-sm">Loading...</Text>
              ) : tree && tree.length > 0 ? (
                renderTree(tree)
              ) : (
                <Text className="text-ui-fg-subtle text-sm">
                  No categories available
                </Text>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <Text size="xsmall" className="text-ui-fg-error mt-1">
          {error}
        </Text>
      )}
    </div>
  )
}

// Helper to find category in tree
const findCategoryById = (category: any, id: string): boolean => {
  if (category.id === id) return true
  if (category.children) {
    return category.children.some((child: any) => findCategoryById(child, id))
  }
  return false
}

export default CategorySelector
