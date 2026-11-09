Run the TypeScript unit regression tests with `npm test`. Tests use Node’s test runner with the `tsx` loader; `tests/setup.ts` sets test environment defaults before application modules load.

Run `npm run typecheck` to check application code, tests, and seed scripts. `npm run build` emits only the application under `src/` to `dist/`.

The HTTP/database tests are opt-in. Start PostgreSQL with `docker compose up -d`, configure `.env`, and initialize the schema with `npx prisma db push`. Then run:

```sh
TEST_DATABASE_URL="$DATABASE_URL" npm test
```

`DATABASE_URL` in that command must be exported in your shell; alternatively, supply the test database URL directly. Use a local demo database. The tests create uniquely named accounts and products and remove their own fixtures afterward. Without `TEST_DATABASE_URL`, the database tests are skipped.
