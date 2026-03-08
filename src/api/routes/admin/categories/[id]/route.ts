import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CategoryService } from "../../../../../modules/product/services/category-service";

/**
 * GET /admin/categories/[id] - Get category details (admin)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const categoryService: CategoryService = req.scope.resolve(
    "categoryService"
  );
  const { id } = req.params;

  try {
    if (!id) {
      return res.status(400).json({ error: "Category ID is required" });
    }

    const categoryWithPath = await categoryService.getCategoryWithFullPath(
      id as string
    );
    res.json({ category: categoryWithPath });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to fetch category",
    });
  }
}

/**
 * PUT /admin/categories/[id] - Update category (admin)
 */
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const categoryService: CategoryService = req.scope.resolve(
    "categoryService"
  );
  const { id } = req.params;
  const updates = req.body;

  try {
    if (!id) {
      return res.status(400).json({ error: "Category ID is required" });
    }

    const updatedCategory = await categoryService.updateCategory(
      id as string,
      updates
    );
    const categoryWithPath = await categoryService.getCategoryWithFullPath(
      updatedCategory.id
    );

    res.json({ category: categoryWithPath });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to update category",
    });
  }
}

/**
 * DELETE /admin/categories/[id] - Delete category and all descendants (admin)
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const categoryService: CategoryService = req.scope.resolve(
    "categoryService"
  );
  const { id } = req.params;

  try {
    if (!id) {
      return res.status(400).json({ error: "Category ID is required" });
    }

    const descendants = await categoryService.getAllDescendants(id as string);

    await categoryService.deleteCategory(id as string);

    res.json({
      message: "Category and all descendants deleted successfully",
      deleted_count: descendants.length + 1,
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to delete category",
    });
  }
}
