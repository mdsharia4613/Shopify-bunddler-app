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
    const parentVariantId = firstLine.bundleParentVariantId?.value || ('id' in firstLine.merchandise ? firstLine.merchandise.id : null);
    
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

    // Calculate discount percentage
    const discountRaw = firstLine.bundleDiscount?.value;
    const discountPercent = discountRaw ? parseFloat(discountRaw.replace('%', '')) : 0;

    // Bundle title: if provided (e.g. "product 1 (Duo)"), use it; else fallback
    const title = firstLine.bundleTitle?.value || `Bundle: ${componentTitles}`;

    // Sub-items string: "product 1, product 3" or "product 1 x 2"
    const includesList = firstLine.bundleComponents?.value || lines
      .map((l) => ('product' in l.merchandise && l.merchandise.product?.title) || ('title' in l.merchandise && l.merchandise.title) || "")
      .filter(Boolean)
      .join(", ");

    const imageUrl = firstLine.bundleImage?.value;

    // Attributes to retain on the merged line
    const attributes: { key: string; value: string }[] = [
      { key: "Includes", value: includesList },
      { key: "_bundle_group", value: groupId }
    ];

    if (firstLine.bundleTitle?.value) {
      attributes.push({ key: "_bundle_title", value: firstLine.bundleTitle.value });
    }
    if (firstLine.bundleDiscount?.value) {
      attributes.push({ key: "_bundle_discount", value: firstLine.bundleDiscount.value });
    }
    if (discountPercent > 0) {
      attributes.push({ key: "_bundle_discount_num", value: discountPercent.toString() });
    }
    if (firstLine.bundleComponents?.value) {
      attributes.push({ key: "_bundle_components", value: firstLine.bundleComponents.value });
    }
    if (imageUrl) {
      attributes.push({ key: "_bundle_image", value: imageUrl });
    }
    if (firstLine.bundleType?.value) {
      attributes.push({ key: "_bundle_type", value: firstLine.bundleType.value });
    }
    if (firstLine.volumeTier?.value) {
      attributes.push({ key: "_volume_tier", value: firstLine.volumeTier.value });
    }

    // Original and discounted cents for UI display
    const totalOriginalCents = lines.reduce((sum, l) => {
      const amt = parseFloat(l.cost.amountPerQuantity.amount || "0");
      return sum + Math.round(amt * 100) * l.quantity;
    }, 0);
    const discountedCents = Math.round(totalOriginalCents * (1 - discountPercent / 100));

    const origCentsVal = firstLine.bundleOriginalCents?.value || totalOriginalCents.toString();
    const discCentsVal = firstLine.bundleDiscountedCents?.value || discountedCents.toString();
    attributes.push({ key: "_bundle_original_cents", value: origCentsVal });
    attributes.push({ key: "_bundle_discounted_cents", value: discCentsVal });

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
        attributes,
        image: imageUrl ? { url: imageUrl } : undefined,
      },
    });
  }

  return operations.length > 0 ? { operations } : NO_CHANGES;
}
