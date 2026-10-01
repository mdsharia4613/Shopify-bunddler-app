import type {
  CartTransformRunInput,
  CartTransformRunResult,
  Operation,
} from "../generated/api";

const NO_CHANGES: CartTransformRunResult = {
  operations: [],
};

export function cartTransformRun(input: CartTransformRunInput): CartTransformRunResult {
  const operations: Operation[] = [];

  // Group cart lines by _bundle_group attribute
  const groups: { [groupId: string]: typeof input.cart.lines } = {};

  for (const line of input.cart.lines) {
    const groupId = line.bundleGroup?.value;
    if (groupId) {
      if (!groups[groupId]) {
        groups[groupId] = [];
      }
      groups[groupId].push(line);
    }
  }

  // Process each bundle group with 2 or more items
  for (const groupId of Object.keys(groups)) {
    const lines = groups[groupId];
    if (lines.length < 2) continue;

    const firstLine = lines[0];
    const parentVariantId = firstLine.bundleParentVariantId?.value;
    
    // We require a valid parent variant to perform linesMerge
    if (!parentVariantId) continue;

    // Collect titles of the component products
    const componentTitles = lines
      .map((l) => {
        if ('product' in l.merchandise && l.merchandise.product?.title) {
          return l.merchandise.product.title;
        }
        return ('title' in l.merchandise && l.merchandise.title) || "Product";
      })
      .join(" + ");

    // Bundle title format requested: "Bundle: product 1 + product 3"
    const title = firstLine.bundleTitle?.value || `Bundle: ${componentTitles}`;

    // Calculate discount percentage
    const discountRaw = firstLine.bundleDiscount?.value;
    const discountPercent = discountRaw ? parseFloat(discountRaw.replace('%', '')) : 0;

    // Sub-items string: "product 1, product 3"
    const includesList = firstLine.bundleComponents?.value || lines
      .map((l) => ('product' in l.merchandise && l.merchandise.product?.title) || ('title' in l.merchandise && l.merchandise.title) || "")
      .filter(Boolean)
      .join(", ");

    const imageUrl = firstLine.bundleImage?.value;

    operations.push({
      linesMerge: {
        parentVariantId,
        title,
        cartLines: lines.map((l) => ({
          cartLineId: l.id,
          quantity: l.quantity,
        })),
        price: discountPercent > 0 ? {
          percentageDecrease: {
            value: discountPercent,
          },
        } : undefined,
        attributes: [
          { key: "Includes", value: includesList },
          { key: "_bundle_group", value: groupId }
        ],
        image: imageUrl ? { url: imageUrl } : undefined,
      },
    });
  }

  return operations.length > 0 ? { operations } : NO_CHANGES;
}
