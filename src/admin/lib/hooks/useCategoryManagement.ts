import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "@medusajs/ui"
import { sdk } from "../../lib/sdk"

export interface Category {
  id: string
  name: string
  handle: string
  description?: string
  level: number
  parent_category_id?: string
  sort_order: number
  children?: Category[]
  breadcrumb?: Array<{ id: string; name: string; level: number }>
  breadcrumb_string?: string
  direct_children_count?: number
  all_descendants_count?: number
}

export interface CategoryTree {
  id: string
  name: string
  handle: string
  level: number
  children?: CategoryTree[]
}

/**
 * Hook for managing category operations
 */
export const useCategoryManagement = () => {
  const qc = useQueryClient()

  // Fetch full category tree
  const { data: tree, isLoading: isTreeLoading } = useQuery<{
    categories: CategoryTree[]
  }>({
    queryKey: ["category-tree"],
    queryFn: () => sdk.client.fetch("/admin/categories?tree=true"),
  })

  // Fetch root categories
  const { data: rootCategories, isLoading: isRootLoading } = useQuery<{
    categories: Category[]
  }>({
    queryKey: ["root-categories"],
    queryFn: () => sdk.client.fetch("/admin/categories"),
  })

  // Fetch category details
  const fetchCategory = (categoryId: string) => {
    return useQuery<{ category: Category }>({
      queryKey: ["category", categoryId],
      queryFn: () => sdk.client.fetch(`/admin/categories/${categoryId}`),
    })
  }

  // Fetch category breadcrumb
  const fetchBreadcrumb = (categoryId: string) => {
    return useQuery<{ breadcrumb: Category[] }>({
      queryKey: ["breadcrumb", categoryId],
      queryFn: () =>
        sdk.client.fetch(`/admin/categories/${categoryId}/breadcrumb`),
    })
  }

  // Create category
  const createCategory = useMutation({
    mutationFn: (data: Partial<Category>) =>
      sdk.client.fetch("/admin/categories", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["category-tree"] })
      qc.invalidateQueries({ queryKey: ["root-categories"] })
      toast.success("Category created successfully")
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create category")
    },
  })

  // Update category
  const updateCategory = useMutation({
    mutationFn: (data: { id: string; updates: Partial<Category> }) =>
      sdk.client.fetch(`/admin/categories/${data.id}`, {
        method: "PUT",
        body: data.updates,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["category-tree"] })
      qc.invalidateQueries({ queryKey: ["root-categories"] })
      toast.success("Category updated successfully")
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update category")
    },
  })

  // Delete category
  const deleteCategory = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/categories/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["category-tree"] })
      qc.invalidateQueries({ queryKey: ["root-categories"] })
      toast.success("Category deleted successfully")
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete category")
    },
  })

  // Get category tree for a specific category
  const getCategoryTree = (categoryId: string) => {
    return useQuery<{ category_tree: CategoryTree }>({
      queryKey: ["category-tree", categoryId],
      queryFn: () =>
        sdk.client.fetch(`/admin/categories/${categoryId}/tree`),
    })
  }

  // Get direct children of a category
  const getChildren = (categoryId: string) => {
    return useQuery<{ children: Category[] }>({
      queryKey: ["children", categoryId],
      queryFn: () =>
        sdk.client.fetch(`/admin/categories/${categoryId}/children`),
    })
  }

  // Get all descendants (recursive)
  const getDescendants = (categoryId: string) => {
    return useQuery<{ descendants: Category[] }>({
      queryKey: ["descendants", categoryId],
      queryFn: () =>
        sdk.client.fetch(
          `/admin/categories/${categoryId}/children?recursive=true`
        ),
    })
  }

  // Reorder categories
  const reorderCategories = useMutation({
    mutationFn: (data: { parentId: string; children: { id: string; sort_order: number }[] }) =>
      sdk.client.fetch(`/admin/categories/${data.parentId}/reorder`, {
        method: "POST",
        body: { children: data.children },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["category-tree"] })
      toast.success("Categories reordered successfully")
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reorder categories")
    },
  })

  return {
    // Data
    tree: tree?.categories,
    rootCategories: rootCategories?.categories,
    isTreeLoading,
    isRootLoading,

    // Single operations
    fetchCategory,
    fetchBreadcrumb,
    getCategoryTree,
    getChildren,
    getDescendants,

    // Mutations
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
  }
}

/**
 * Hook to search categories
 */
export const useCategorySearch = (query: string) => {
  return useQuery<{ categories: Category[] }>(
    {
      queryKey: ["categories-search", query],
      queryFn: () =>
        sdk.client.fetch(`/admin/categories?search=${encodeURIComponent(query)}`),
    },
    { enabled: !!query }
  )
}

/**
 * Hook to get categories by level
 */
export const useCategoriesByLevel = (level: number) => {
  return useQuery<{ categories: Category[] }>({
    queryKey: ["categories-level", level],
    queryFn: () => sdk.client.fetch(`/admin/categories?level=${level}`),
  })
}
