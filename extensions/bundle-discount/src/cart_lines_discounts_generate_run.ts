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

  // Group by bundle group ID so we only discount when there are at least 2 bundle items
  const groups: { [key: string]: typeof bundleLines } = {};
  for (const line of bundleLines) {
    const gid = line.bundleGroup!.value!;
    if (!groups[gid]) groups[gid] = [];
    groups[gid].push(line);
  }

  const discountCandidates = [];

  for (const gid of Object.keys(groups)) {
    const lines = groups[gid];
    // Only apply discount if the bundle contains 2 or more products
    if (lines.length < 2) continue;

    const discountValue = parseFloat(lines[0].bundleDiscount?.value || '15');

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
