import { MedusaService } from "@medusajs/framework/utils"
import CategoryMedia from "../models/category-media"

type MediaDTO = {
  category_id: string
  media_type: "image" | "icon" | "banner" | "thumbnail"
  url: string
  alt_text?: string
  mime_type?: string
  file_size?: number
  width?: number
  height?: number
  is_primary?: boolean
  sort_order?: number
}

export class CategoryMediaService extends MedusaService({
  CategoryMedia,
}) {
  /**
   * Upload media for category
   */
  async uploadMedia(data: {
    category_id: string
    media_type: "image" | "icon" | "banner" | "thumbnail"
    url: string
    alt_text?: string
    mime_type?: string
    file_size?: number
    width?: number
    height?: number
    is_primary?: boolean
  }) {
    if (data.is_primary) {
      const existing = await (this as any).listCategoryMedias(
        { category_id: data.category_id, is_primary: true } as any
      ) as any[]
      await Promise.all(
        existing.map((m: any) =>
          (this as any).updateCategoryMedias([{ id: m.id, is_primary: false }])
        )
      )
    }

    return (this as any).createCategoryMedias({
      ...data,
      is_primary: data.is_primary || false,
      sort_order: 0,
    })
  }

  /**
   * Get media by category
   */
  async getMediaByCategory(categoryId: string) {
    return (this as any).listCategoryMedias(
      { category_id: categoryId } as any,
      { order: { sort_order: "ASC", created_at: "DESC" } } as any
    )
  }

  /**
   * Get primary image for category
   */
  async getPrimaryImage(categoryId: string) {
    const media = await (this as any).listCategoryMedias({
      category_id: categoryId,
      media_type: "image",
      is_primary: true,
    } as any) as any[]

    return media.length > 0 ? media[0] : null
  }

  /**
   * Get icon for category
   */
  async getIcon(categoryId: string) {
    const icons = await (this as any).listCategoryMedias({
      category_id: categoryId,
      media_type: "icon",
      is_primary: true,
    } as any) as any[]

    return icons.length > 0 ? icons[0] : null
  }

  /**
   * Get banner for category
   */
  async getBanner(categoryId: string) {
    const banners = await (this as any).listCategoryMedias({
      category_id: categoryId,
      media_type: "banner",
    } as any) as any[]

    return banners.length > 0 ? banners[0] : null
  }

  /**
   * Set primary media
   */
  async setPrimaryMedia(mediaId: string, categoryId: string): Promise<void> {
    const allMedia = await (this as any).listCategoryMedias({
      category_id: categoryId,
      is_primary: true,
    } as any) as any[]

    for (const media of allMedia) {
      await (this as any).updateCategoryMedias([{ id: media.id, is_primary: false }])
    }

    await (this as any).updateCategoryMedias([{ id: mediaId, is_primary: true }])
  }

  /**
   * Delete media
   */
  async deleteMedia(mediaId: string): Promise<void> {
    await (this as any).deleteCategoryMedias([mediaId])
  }

  /**
   * Reorder media
   */
  async reorderMedia(
    mediaUpdates: Array<{ id: string; sort_order: number }>
  ): Promise<void> {
    for (const { id, sort_order } of mediaUpdates) {
      await (this as any).updateCategoryMedias([{ id, sort_order }])
    }
  }

  /**
   * Get responsive image variants
   */
  async getResponsiveImages(categoryId: string): Promise<{
    thumbnail?: string
    small?: string
    medium?: string
    large?: string
    original?: string
  }> {
    const image = await this.getPrimaryImage(categoryId)

    if (!image) {
      return {}
    }

    return {
      original: image.url,
      thumbnail: `${image.url}?size=thumbnail`,
      small: `${image.url}?size=small`,
      medium: `${image.url}?size=medium`,
      large: `${image.url}?size=large`,
    }
  }

  /**
   * Validate image
   */
  validateImage(
    mimeType?: string,
    fileSize?: number,
    maxSizeInMB: number = 5
  ): { valid: boolean; error?: string } {
    const validMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/svg+xml",
    ]

    if (mimeType && !validMimeTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `Invalid file type. Accepted: ${validMimeTypes.join(", ")}`,
      }
    }

    if (fileSize) {
      const maxSizeInBytes = maxSizeInMB * 1024 * 1024
      if (fileSize > maxSizeInBytes) {
        return {
          valid: false,
          error: `File size exceeds ${maxSizeInMB}MB limit`,
        }
      }
    }

    return { valid: true }
  }
}

export default CategoryMediaService
