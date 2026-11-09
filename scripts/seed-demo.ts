import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();
// Root-relative URLs keep the bundled storefront artwork working on any host.
const assetBase = (process.env.DEMO_ASSET_BASE_URL || "/demo").replace(
  /\/$/,
  "",
);
const products = [
  {
    slug: "arc-vase",
    title: "Arc ceramic vase",
    description:
      "A sculptural terracotta silhouette for dried stems, fresh flowers, or a quiet corner of your home.",
    price: 38,
    stock: 24,
    category: "Home objects",
  },
  {
    slug: "sunday-mug",
    title: "Sunday stoneware mug",
    description:
      "A generous sage-green mug with a comfortable handle. Made for slow mornings and second cups.",
    price: 24,
    stock: 36,
    category: "Home objects",
  },
  {
    slug: "linen-throw",
    title: "Slow living linen throw",
    description:
      "An oat-and-caramel woven throw with a soft fringe. An easy extra layer for the sofa or the end of your bed.",
    price: 78,
    stock: 18,
    category: "Soft living",
  },
  {
    slug: "form-table-lamp",
    title: "Form table lamp",
    description:
      "A softly shaded table lamp in warm olive and ivory. A gentle glow for reading nooks and bedside rituals.",
    price: 96,
    stock: 12,
    category: "Home objects",
  },
  {
    slug: "everyday-tote",
    title: "Everyday canvas tote",
    description:
      "Natural canvas, olive handles, and a handy front pocket. Your everyday companion for markets, books, and little detours.",
    price: 32,
    stock: 30,
    category: "Everyday carry",
  },
  {
    slug: "cedar-candle",
    title: "Cedar & fig candle",
    description:
      "An amber candle with notes of cedarwood, green fig, and warm earth. A little atmosphere for your evening wind-down.",
    price: 28,
    stock: 28,
    category: "Home objects",
  },
  {
    slug: "river-bowl",
    title: "River serving bowl",
    description:
      "A wide, softly curved bowl in a moss-green glaze. Bring a little calm to salads, shared meals, and everyday gatherings.",
    price: 46,
    stock: 20,
    category: "Home objects",
  },
  {
    slug: "pocket-notebooks",
    title: "Good ideas notebook duo",
    description:
      "Two pocket-sized notebooks in olive and clay. Keep a little space for sketches, lists, and ideas worth remembering.",
    price: 18,
    stock: 40,
    category: "Everyday carry",
  },
  {
    slug: "cloud-cushion",
    title: "Cloud linen cushion",
    description:
      "A softly textured cushion in warm oat, finished with a simple stitched edge. Instant comfort for your favorite spot.",
    price: 42,
    stock: 22,
    category: "Soft living",
  },
];

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seeding is only supported outside production.");
  const result = await prisma.$transaction(async (tx) => {
    const candidates = await tx.product.findMany({
      where: {
        title: { startsWith: "Serialization Test " },
        description: "Temporary product for serialization verification",
      },
      select: { id: true, title: true },
    });
    const ids = candidates
      .filter((p) => /^Serialization Test \d+$/.test(p.title))
      .map((p) => p.id);
    if (ids.length) {
      await tx.cartItem.deleteMany({ where: { productId: { in: ids } } });
      await tx.product.deleteMany({ where: { id: { in: ids } } });
    }
    const emptyTestCategories = await tx.category.findMany({
      where: {
        name: { startsWith: "Serialization Test " },
        Product: { none: {} },
      },
    });
    for (const c of emptyTestCategories) {
      if (/^Serialization Test \d+$/.test(c.name))
        await tx.category.delete({ where: { id: c.id } });
    }
    const categories = new Map<string, string>();
    for (const name of new Set(products.map((p) => p.category))) {
      const category = await tx.category.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      categories.set(name, category.id);
    }
    for (const { category, ...product } of products) {
      const categoryId = categories.get(category);
      if (!categoryId) throw new Error(`Missing demo category: ${category}`);
      const data = {
        ...product,
        categoryId,
        images: [`${assetBase}/${product.slug}.svg`],
      } satisfies Prisma.ProductUncheckedCreateInput;
      await tx.product.upsert({
        where: { slug: product.slug },
        create: data,
        update: data,
      });
    }
    return {
      removedTestProducts: ids.length,
      demoProducts: products.length,
      categories: categories.size,
    };
  });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
