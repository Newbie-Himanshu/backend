import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { CategoryService } from "../../../../modules/product/services/category-service";

/**
 * GET /store/categories - Get full category tree or root categories
 * Query params:
 * - tree: boolean - Get full tree structure
 * - parent_id: string - Get children of specific parent
 * - level: number - Get categories at specific level
 * - search: string - Search categories by name or handle
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const categoryService: CategoryService = req.scope.resolve(
    "categoryService"
  );
  const { tree, parent_id, level, search } = req.query;

  try {
    let result;

    if (search) {
      result = await categoryService.searchCategories(search as string);
    } else if (tree === "true") {
      result = await categoryService.getFullCategoryTree(6);
    } else if (parent_id) {
      result = await categoryService.getDirectChildren(parent_id as string);
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
 * POST /store/categories - Create new category
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const categoryService: CategoryService = req.scope.resolve(
    "categoryService"
  );
  const { name, handle, description, parent_category_id, sort_order } =
    req.body as any;

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
