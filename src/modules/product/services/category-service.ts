import { MedusaService } from "@medusajs/framework/utils"
import ProductCategory from "../models/category"

interface CategoryTree {
  id: string
  name: string
  handle: string
  level: number
  children?: CategoryTree[]
}

interface CategoryBreadcrumb {
  id: string
  name: string
  handle: string
  level: number
}

export type CategoryDTO = {
  id?: string
  name: string
  handle: string
  description?: string
  parent_category_id?: string | null
  sort_order?: number
  level?: number
  path?: string
}

export class CategoryService extends MedusaService({
  ProductCategory,
}) {
  /**
   * Get all root categories (level 0)
   */
  async getRootCategories() {
    return this.listProductCategories(
      { parent_category_id: null } as any,
      { order: { sort_order: "ASC", name: "ASC" } } as any
    )
  }

  /**
   * Get category with all its descendants (recursive)
   * Supports up to 6 levels deep
   */
  async getCategoryTree(
    categoryId: string,
    maxDepth: number = 6
  ): Promise<CategoryTree> {
    const category = await this.retrieveProductCategory(categoryId)

    const tree: CategoryTree = {
      id: category.id,
      name: category.name as string,
      handle: category.handle as string,
      level: category.level as number,
    }

    if ((category.level as number) < maxDepth) {
      const children = await this.listProductCategories(
        { parent_category_id: categoryId } as any,
        { order: { sort_order: "ASC", name: "ASC" } } as any
      )

      if (children.length > 0) {
        tree.children = await Promise.all(
          children.map((child) =>
            this.getCategoryTree(child.id, maxDepth).then((childTree) => ({
              ...childTree,
              children: childTree.children,
            }))
          )
        )
      }
    }

    return tree
  }

  /**
   * Get full category tree from root with all descendants
   */
  async getFullCategoryTree(maxDepth: number = 6): Promise<CategoryTree[]> {
    const rootCategories = await this.getRootCategories()
    return Promise.all(
      rootCategories.map((cat) => this.getCategoryTree(cat.id, maxDepth))
    )
  }

  /**
   * Get all children at a specific level below a category
   */
  async getChildrenAtLevel(parentId: string, childLevel: number) {
    return this.listProductCategories(
      { parent_category_id: parentId, level: childLevel } as any,
      { order: { sort_order: "ASC", name: "ASC" } } as any
    )
  }

  /**
   * Get direct children of a category
   */
  async getDirectChildren(parentId: string) {
    return this.listProductCategories(
      { parent_category_id: parentId } as any,
      { order: { sort_order: "ASC", name: "ASC" } } as any
    )
  }

  /**
   * Get all descendants of a category (flat list)
   */
  async getAllDescendants(categoryId: string) {
    const descendants: any[] = []

    const traverse = async (parentId: string) => {
      const children = await this.getDirectChildren(parentId)
      descendants.push(...children)

      for (const child of children) {
        await traverse(child.id)
      }
    }

    await traverse(categoryId)
    return descendants
  }

  /**
   * Get breadcrumb path for a category
   */
  async getCategoryBreadcrumb(categoryId: string): Promise<CategoryBreadcrumb[]> {
    const breadcrumb: CategoryBreadcrumb[] = []
    let currentId: string | null = categoryId

    while (currentId) {
      const category = await this.retrieveProductCategory(currentId)
      breadcrumb.unshift({
        id: category.id,
        name: category.name as string,
        handle: category.handle as string,
        level: category.level as number,
      })
      currentId = category.parent_category_id as string | null
    }

    return breadcrumb
  }

  /**
   * Get breadcrumb as string (e.g., "Electronics > Computers > Laptops")
   */
  async getCategoryBreadcrumbString(categoryId: string): Promise<string> {
    const breadcrumb = await this.getCategoryBreadcrumb(categoryId)
    return breadcrumb.map((b) => b.name).join(" > ")
  }

  /**
   * Create category with automatic level calculation
   */
  async createCategory(data: {
    name: string
    handle: string
    description?: string
    parent_category_id?: string
    sort_order?: number
  }) {
    let level = 0
    let path = `/`

    if (data.parent_category_id) {
      const parent = await this.retrieveProductCategory(data.parent_category_id)
      level = (parent.level as number) + 1
      path = `${parent.path}${parent.id}/`

      if (level > 6) {
        throw new Error(
          "Cannot create category deeper than 6 levels. Maximum depth reached."
        )
      }
    }

    return this.createProductCategories({
      name: data.name,
      handle: data.handle,
      description: data.description,
      parent_category_id: data.parent_category_id || null,
      level,
      path,
      sort_order: data.sort_order || 0,
    } as any)
  }

  /**
   * Update category and recalculate descendants if parent changes
   */
  async updateCategory(categoryId: string, data: Partial<CategoryDTO>) {
    const category = await this.retrieveProductCategory(categoryId)

    if (
      data.parent_category_id &&
      data.parent_category_id !== category.parent_category_id
    ) {
      const newParent = await this.retrieveProductCategory(data.parent_category_id)

      if ((newParent.level as number) >= 6) {
        throw new Error("Cannot move category: parent is at maximum depth")
      }

      const newLevel = (newParent.level as number) + 1
      const newPath = `${newParent.path}${newParent.id}/`

      await this.updateProductCategories([{
        id: categoryId,
        ...data,
        level: newLevel,
        path: newPath,
      }] as any)

      await this.recalculateDescendantLevelsAndPaths(categoryId)
    } else {
      await this.updateProductCategories([{ id: categoryId, ...data }] as any)
    }

    return this.retrieveProductCategory(categoryId)
  }

  /**
   * Recalculate levels and paths for all descendants
   */
  private async recalculateDescendantLevelsAndPaths(categoryId: string): Promise<void> {
    const children = await this.getDirectChildren(categoryId)

    for (const child of children) {
      const parent = await this.retrieveProductCategory(categoryId)
      const newLevel = (parent.level as number) + 1
      const newPath = `${parent.path}${parent.id}/`

      await this.updateProductCategories([{
        id: child.id,
        level: newLevel,
        path: newPath,
      }] as any)

      await this.recalculateDescendantLevelsAndPaths(child.id)
    }
  }

  /**
   * Delete category and cascade delete all descendants
   */
  async deleteCategory(categoryId: string): Promise<void> {
    const descendants = await this.getAllDescendants(categoryId)

    for (const descendant of descendants) {
      await this.deleteProductCategories([descendant.id] as any)
    }

    await this.deleteProductCategories([categoryId] as any)
  }

  /**
   * Search categories by name or handle (case-insensitive substring match)
   */
  async searchCategories(query: string) {
    const all = await (this as any).listProductCategories({}, {})
    const q = query.toLowerCase()
    return (all as any[]).filter(
      (cat: any) =>
        cat.name?.toLowerCase().includes(q) ||
        cat.handle?.toLowerCase().includes(q)
    )
  }

  /**
   * Get categories by level
   */
  async getCategoriesByLevel(level: number) {
    return this.listProductCategories(
      { level } as any,
      { order: { sort_order: "ASC", name: "ASC" } } as any
    )
  }

  /**
   * Get category with full path info (for response serialization)
   */
  async getCategoryWithFullPath(categoryId: string): Promise<any> {
    const category = await this.retrieveProductCategory(categoryId)
    const breadcrumb = await this.getCategoryBreadcrumb(categoryId)
    const directChildren = await this.getDirectChildren(categoryId)

    return {
      ...category,
      breadcrumb,
      breadcrumb_string: breadcrumb.map((b) => b.name).join(" > "),
      direct_children_count: directChildren.length,
      all_descendants_count: (await this.getAllDescendants(categoryId)).length,
    }
  }

  /**
   * Reorder categories (update sort_order)
   */
  async reorderCategories(
    categoryUpdates: Array<{ id: string; sort_order: number }>
  ): Promise<void> {
    for (const { id, sort_order } of categoryUpdates) {
      await this.updateProductCategories([{ id, sort_order }] as any)
    }
  }
}

export default CategoryService
