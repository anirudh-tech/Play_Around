-- Runs once when the MySQL volume is first created.
-- Test database for integration tests, and the shadow database used by `prisma migrate dev`.
CREATE DATABASE IF NOT EXISTS playaround_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON playaround_test.* TO 'playaround'@'%';
GRANT CREATE, ALTER, DROP, REFERENCES ON *.* TO 'playaround'@'%';
FLUSH PRIVILEGES;
