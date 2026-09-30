import db from "../db.server";

export const loader = async () => {
  const bundles = await db.bundle.findMany({
    where: { status: "Active" },
    orderBy: { createdAt: "desc" },
  });

  return new Response(JSON.stringify({ success: true, bundles }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
};
