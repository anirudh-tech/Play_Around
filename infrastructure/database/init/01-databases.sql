-- Runs once when the Postgres volume is first created.
-- Test database for integration tests (`prisma migrate dev` can also create a shadow DB).
CREATE DATABASE playaround_test OWNER playaround;
