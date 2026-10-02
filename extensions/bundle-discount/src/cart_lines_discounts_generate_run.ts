import {
  CartInput,
  CartLinesDiscountsGenerateRunResult,
  ProductDiscountSelectionStrategy,
} from '../generated/api';

export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  const operations: CartLinesDiscountsGenerateRunResult['operations'] = [];

  // Find all cart lines that belong to a bundle group
  const bundleLines = input.cart.lines.filter(
    (line) => line.bundleGroup && line.bundleGroup.value
  );

  if (!bundleLines.length) {
    return { operations: [] };
  }

  // Group by bundle group ID
  const groups: { [key: string]: typeof bundleLines } = {};
  for (const line of bundleLines) {
    const gid = line.bundleGroup!.value!;
    if (!groups[gid]) groups[gid] = [];
    groups[gid].push(line);
  }

  const discountCandidates = [];

  for (const gid of Object.keys(groups)) {
    const lines = groups[gid];
    // Calculate total quantity in this bundle group (supports both multi-product bundles and volume discounts)
    const totalQty = lines.reduce((sum, l) => sum + l.quantity, 0);
    if (totalQty < 2) continue;

    const discountValue = parseFloat(lines[0].bundleDiscount?.value || '15');
    if (discountValue <= 0) continue;

    for (const line of lines) {
      discountCandidates.push({
        message: `${discountValue}% BUNDLE DISCOUNT`,
        targets: [
          {
            cartLine: {
              id: line.id,
            },
          },
        ],
        value: {
          percentage: {
            value: discountValue,
          },
        },
      });
    }
  }

  if (discountCandidates.length > 0) {
    operations.push({
      productDiscountsAdd: {
        candidates: discountCandidates,
        selectionStrategy: ProductDiscountSelectionStrategy.All,
      },
    });
  }

  return { operations };
}
