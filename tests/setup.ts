// Configure test defaults before importing application modules, which read env at load time.
process.env.JWT_SECRET ||= "test-secret";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://unused:unused@localhost:5432/unused";
export {};
