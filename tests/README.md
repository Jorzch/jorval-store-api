Run the unit regression tests with `npm test`.

The HTTP/database tests are opt-in. Start PostgreSQL with `docker compose up -d`, configure `.env`, and initialize the schema with `npx prisma db push`. Then run:

```sh
TEST_DATABASE_URL="$DATABASE_URL" npm test
```

`DATABASE_URL` in that command must be exported in your shell; alternatively, supply the test database URL directly. Use a local demo database. The tests create uniquely named accounts and products and remove their own fixtures afterward. Without `TEST_DATABASE_URL`, the database tests are skipped.
