import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CategoryService } from "../../../../modules/product/services/category-service";

/**
 * GET /admin/categories - Get all categories (admin)
 * Query params:
 * - tree: boolean - Get full tree structure
 * - level: number - Get categories at specific level
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const categoryService: CategoryService = req.scope.resolve(
    "categoryService"
  );
  const { tree, level } = req.query;

  try {
    let result;

    if (tree === "true") {
      result = await categoryService.getFullCategoryTree(6);
    } else if (level) {
      result = await categoryService.getCategoriesByLevel(
        parseInt(level as string)
      );
    } else {
      result = await categoryService.getRootCategories();
    }

    res.json({ categories: result });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to fetch categories",
    });
  }
}

/**
 * POST /admin/categories - Create new category (admin)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const categoryService: CategoryService = req.scope.resolve(
    "categoryService"
  );
  const { name, handle, description, parent_category_id, sort_order } =
    req.body;

  try {
    if (!name || !handle) {
      return res
        .status(400)
        .json({ error: "Name and handle are required" });
    }

    const category = await categoryService.createCategory({
      name,
      handle,
      description,
      parent_category_id,
      sort_order,
    });

    const categoryWithPath = await categoryService.getCategoryWithFullPath(
      category.id
    );

    res.status(201).json({ category: categoryWithPath });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to create category",
    });
  }
}
