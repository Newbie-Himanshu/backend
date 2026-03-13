/**
 * Example: Using Categories in a Product Creation Form
 * This demonstrates how to integrate the category management system
 * into your existing admin pages.
 *
 * Place this in: src/admin/routes/products/create/page.tsx
 */

import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../../lib/sdk"
import {
  CategorySelector,
  CategoryBreadcrumb,
  useCategoryManagement,
} from "../../lib/categories"

const CreateProductPage = () => {
  const qc = useQueryClient()
  const { rootCategories } = useCategoryManagement()

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sku: "",
    price: "",
    category_id: "",
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Create product mutation
  const { mutate: createProduct, isPending } = useMutation({
    mutationFn: (data: typeof formData) =>
      sdk.client.fetch("/admin/products", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] })
      toast.success("Product created successfully")
      setFormData({
        name: "",
        description: "",
        sku: "",
        price: "",
        category_id: "",
      })
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create product")
    },
  })

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!formData.name?.trim()) {
      errors.name = "Product name is required"
    }

    if (!formData.sku?.trim()) {
      errors.sku = "SKU is required"
    }

    if (!formData.price) {
      errors.price = "Price is required"
    }

    if (!formData.category_id) {
      errors.category_id = "Category is required"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.error("Please fix the errors below")
      return
    }

    createProduct(formData)
  }

  return (
    <Container>
      <div className="mb-6">
        <Heading level="h1">Create Product</Heading>
        <Text className="text-ui-fg-subtle">Add a new product to your store</Text>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* Product Name */}
        <div>
          <Label htmlFor="name">Product Name *</Label>
          <Input
            id="name"
            placeholder="e.g., Wireless Bluetooth Headphones"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            className={formErrors.name ? "border-red-500" : ""}
          />
          {formErrors.name && (
            <Text size="xsmall" className="text-red-500 mt-1">
              {formErrors.name}
            </Text>
          )}
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Product description..."
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            rows={4}
          />
        </div>

        {/* SKU */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="sku">SKU *</Label>
            <Input
              id="sku"
              placeholder="e.g., HEADPHONES-BT-001"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              className={formErrors.sku ? "border-red-500" : ""}
            />
            {formErrors.sku && (
              <Text size="xsmall" className="text-red-500 mt-1">
                {formErrors.sku}
              </Text>
            )}
          </div>

          {/* Price */}
          <div>
            <Label htmlFor="price">Price *</Label>
            <Input
              id="price"
              type="number"
              placeholder="0.00"
              value={formData.price}
              onChange={(e) =>
                setFormData({ ...formData, price: e.target.value })
              }
              className={formErrors.price ? "border-red-500" : ""}
            />
            {formErrors.price && (
              <Text size="xsmall" className="text-red-500 mt-1">
                {formErrors.price}
              </Text>
            )}
          </div>
        </div>

        {/* Category Selection */}
        <div>
          <CategorySelector
            value={formData.category_id}
            onChange={(id) => setFormData({ ...formData, category_id: id })}
            label="Product Category *"
            placeholder="Select a category..."
            error={formErrors.category_id}
            maxLevel={6}
          />
          {formData.category_id && (
            <div className="mt-3 p-3 bg-ui-bg-subtle rounded">
              <Text size="small" weight="plus" className="mb-2">
                Selected Category Path:
              </Text>
              <CategoryBreadcrumb categoryId={formData.category_id} />
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 pt-4 border-t border-ui-border-base">
          <Button variant="secondary" type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={isPending}
            disabled={isPending}
          >
            Create Product
          </Button>
        </div>
      </form>

      {/* Quick Stats */}
      <div className="mt-12 grid grid-cols-2 gap-4">
        <div className="p-4 border border-ui-border-base rounded">
          <Text size="small" className="text-ui-fg-subtle">
            Total Root Categories
          </Text>
          <Heading level="h2">{rootCategories?.length || 0}</Heading>
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Create Product",
})

export default CreateProductPage
