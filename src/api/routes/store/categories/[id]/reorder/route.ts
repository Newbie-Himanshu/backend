import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CategoryService } from "../../../../../../modules/product/services/category-service";

/**
 * POST /store/categories/[id]/reorder - Reorder category children
 * Body:
 * {
 *   "children": [
 *     { "id": "cat-1", "sort_order": 0 },
 *     { "id": "cat-2", "sort_order": 1 }
 *   ]
 * }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const categoryService: CategoryService = req.scope.resolve(
    "categoryService"
  );
  const { id } = req.params;
  const { children } = req.body as any;

  try {
    if (!id) {
      return res.status(400).json({ error: "Category ID is required" });
    }

    if (!children || !Array.isArray(children)) {
      return res
        .status(400)
        .json({ error: "Children array is required in body" });
    }

    await categoryService.reorderCategories(children);

    const updatedChildren = await categoryService.getDirectChildren(
      id as string
    );

    res.json({
      message: "Categories reordered successfully",
      children: updatedChildren,
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to reorder categories",
    });
  }
}
