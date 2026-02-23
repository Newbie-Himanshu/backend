export const DIMENSION_DEFAULTS = {
    length: 15,
    breadth: 12,
    height: 10,
    weight: 0.5,
}

/**
 * Extracts Shiprocket-compatible dimensions for a single order item.
 * Reads from product.metadata, falling back to DIMENSION_DEFAULTS.
 */
export function extractItemDimensions(item: any) {
    const meta = item.variant?.product?.metadata ?? item.product?.metadata ?? {}
    return {
        length: Number(meta.shiprocket_length) || DIMENSION_DEFAULTS.length,
        breadth: Number(meta.shiprocket_breadth) || DIMENSION_DEFAULTS.breadth,
        height: Number(meta.shiprocket_height) || DIMENSION_DEFAULTS.height,
        weight: Number(meta.shiprocket_weight) || DIMENSION_DEFAULTS.weight,
    }
}

/**
 * Aggregates dimensions for a multi-item shipment.
 *
 * Rules:
 *  - Total weight = Σ (item.quantity × item_weight_per_unit)
 *  - Box dimensions = max of each axis across all items
 *    (simplified single-box packing — adequate for most catalog sizes)
 */
export function resolveShipmentDimensions(items: any[]): {
    length: number
    breadth: number
    height: number
    weight: number
} {
    let totalWeight = 0
    let maxLength = 0
    let maxBreadth = 0
    let maxHeight = 0

    for (const item of items) {
        const dims = extractItemDimensions(item)
        totalWeight += dims.weight * (item.quantity ?? 1)
        if (dims.length > maxLength) maxLength = dims.length
        if (dims.breadth > maxBreadth) maxBreadth = dims.breadth
        if (dims.height > maxHeight) maxHeight = dims.height
    }

    return {
        length: maxLength || DIMENSION_DEFAULTS.length,
        breadth: maxBreadth || DIMENSION_DEFAULTS.breadth,
        height: maxHeight || DIMENSION_DEFAULTS.height,
        weight: Math.max(totalWeight, 0.1), // Shiprocket minimum: 0.1 kg
    }
}
