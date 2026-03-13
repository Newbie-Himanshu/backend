import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CategoryService } from "../../../../../../modules/product/services/category-service";

/**
 * GET /store/categories/[id]/children - Get direct children of a category
 * Query params:
 * - recursive: boolean - Get all descendants recursively
 * - level: number - If recursive=false, get children at specific level only
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const categoryService: CategoryService = req.scope.resolve(
    "categoryService"
  );
  const { id } = req.params;
  const { recursive, level } = req.query;

  try {
    if (!id) {
      return res.status(400).json({ error: "Category ID is required" });
    }

    let children;

    if (recursive === "true") {
      children = await categoryService.getAllDescendants(id as string);
    } else if (level) {
      children = await categoryService.getChildrenAtLevel(
        id as string,
        parseInt(level as string)
      );
    } else {
      children = await categoryService.getDirectChildren(id as string);
    }

    res.json({
      children,
      count: children.length,
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to fetch children",
    });
  }
}
