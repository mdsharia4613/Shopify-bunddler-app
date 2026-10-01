import db from "../db.server";

export const loader = async () => {
  const bundles = await db.bundle.findMany({
    where: { status: "Active" },
    orderBy: { createdAt: "desc" },
  });

  const formatted = bundles.map((b) => {
    let parsedConfig = null;
    try {
      parsedConfig = JSON.parse(b.products);
    } catch (e) {}

    const discountMatch = b.discount?.match(/(\d+)%/);
    const discountNum = parsedConfig?.discountPercent || (discountMatch ? parseInt(discountMatch[1], 10) : 15);

    return {
      id: b.id,
      title: b.title,
      strategy: b.strategy,
      discount: b.discount,
      discountPercent: discountNum,
      config: parsedConfig,
      status: b.status,
    };
  });

  return new Response(JSON.stringify({ success: true, bundles: formatted }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
};
