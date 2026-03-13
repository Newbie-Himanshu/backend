import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CategoryService } from "../../../../../modules/product/services/category-service";

/**
 * GET /store/categories/[id] - Get category with full hierarchy info
 * Query params:
 * - tree: boolean - Include full subtree
 * - descendants: boolean - Include all descendants (flat)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const categoryService: CategoryService = req.scope.resolve(
    "categoryService"
  );
  const { id } = req.params;
  const { tree, descendants } = req.query;

  try {
    if (!id) {
      return res.status(400).json({ error: "Category ID is required" });
    }

    if (tree === "true") {
      const categoryTree = await categoryService.getCategoryTree(id as string);
      return res.json({ category_tree: categoryTree });
    }

    if (descendants === "true") {
      const descendants_list = await categoryService.getAllDescendants(
        id as string
      );
      return res.json({ descendants: descendants_list });
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
 * PUT /store/categories/[id] - Update category
 */
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const categoryService: CategoryService = req.scope.resolve(
    "categoryService"
  );
  const { id } = req.params;
  const updates = req.body as any;

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
 * DELETE /store/categories/[id] - Delete category and all descendants
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

    await categoryService.deleteCategory(id as string);
    res.json({ message: "Category and all descendants deleted successfully" });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to delete category",
    });
  }
}
