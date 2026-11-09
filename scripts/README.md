# Demo catalog

With the local PostgreSQL database running and `.env` configured, run:

```sh
npm run seed:demo
```

The TypeScript seed (`scripts/seed-demo.ts`) runs through the `tsx` loader. Use `npm run typecheck` to check it alongside the application and tests.

The seed creates nine home and lifestyle products in three categories. Re-running it updates those demo slugs and resets their demo prices and stock; it does not duplicate products. It removes serialization test products only when both their numbered title and exact temporary description match, along with their cart entries and any empty numbered serialization test categories. Other products, users, and orders are preserved. The entire operation is transactional, and the script refuses to run with `NODE_ENV=production`.

Product artwork is bundled in the sibling `jorval-store-web/public/demo` directory. Image paths default to `/demo/<slug>.svg`, resolved on the storefront's origin, so no external image service is required. To use a separate asset host, set `DEMO_ASSET_BASE_URL` to its public demo directory URL before seeding.
