import { Text, Button } from "@medusajs/ui"
import { ChevronRight } from "lucide-react"
import { useCategoryManagement } from "../hooks/useCategoryManagement"

interface CategoryBreadcrumbProps {
  categoryId: string
  onCategoryClick?: (categoryId: string) => void
  className?: string
}

/**
 * CategoryBreadcrumb - Display full category path
 * Shows: Electronics > Computers > Laptops > Gaming Laptops
 */
export const CategoryBreadcrumb = ({
  categoryId,
  onCategoryClick,
  className = "",
}: CategoryBreadcrumbProps) => {
  const { fetchBreadcrumb } = useCategoryManagement()
  const { data, isLoading, error } = fetchBreadcrumb(categoryId)

  if (isLoading) {
    return <Text size="small" className="text-ui-fg-subtle">Loading...</Text>
  }

  if (error || !data?.breadcrumb) {
    return <Text size="small" className="text-ui-fg-error">Failed to load breadcrumb</Text>
  }

  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {data.breadcrumb.map((item, index) => (
        <div key={item.id} className="flex items-center gap-1">
          {index > 0 && <ChevronRight size={14} className="text-ui-fg-muted" />}

          {onCategoryClick ? (
            <Button
              variant="transparent"
              size="small"
              onClick={() => onCategoryClick(item.id)}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
            >
              <Text size="small">{item.name}</Text>
            </Button>
          ) : (
            <Text size="small" weight="plus">
              {item.name}
            </Text>
          )}
        </div>
      ))}
    </div>
  )
}

export default CategoryBreadcrumb
