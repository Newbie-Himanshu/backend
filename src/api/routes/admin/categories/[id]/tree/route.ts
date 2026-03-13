import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CategoryService } from "../../../../../../modules/product/services/category-service";

/**
 * GET /admin/categories/[id]/tree - Get full category tree with descendants (admin)
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

    const categoryTree = await categoryService.getCategoryTree(id as string);
    res.json({ category_tree: categoryTree });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to fetch category tree",
    });
  }
}
