import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CategoryService } from "../../../../../modules/product/services/category-service";

/**
 * GET /store/categories/[id]/breadcrumb - Get breadcrumb path for a category
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

    const breadcrumb = await categoryService.getCategoryBreadcrumb(
      id as string
    );
    const breadcrumbString = await categoryService.getCategoryBreadcrumbString(
      id as string
    );

    res.json({
      breadcrumb,
      breadcrumb_string: breadcrumbString,
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to fetch breadcrumb",
    });
  }
}
