// Runs before every test file (via jest setupFiles).
// Sets required env vars so envalid's cleanEnv() doesn't throw on module load.
process.env["NODE_ENV"] = "test";
process.env["JWT_SECRET"] = "test-secret-super-long-string-32ch";
process.env["JWT_EXPIRES_IN"] = "7d";
process.env["MONGODB_URI"] = "mongodb://localhost:27017/test";
process.env["POSTGRES_HOST"] = "localhost";
process.env["POSTGRES_PORT"] = "5432";
process.env["POSTGRES_DB"] = "test";
process.env["POSTGRES_USER"] = "test";
process.env["POSTGRES_PASSWORD"] = "test";
process.env["REDIS_URL"] = "redis://localhost:6379";
process.env["CORS_ORIGIN"] = "http://localhost:5173";
process.env["BASE_URL"] = "http://localhost:3000";
process.env["STRIPE_SECRET_KEY"] = "";
process.env["STRIPE_WEBHOOK_SECRET"] = "";
process.env["ANTHROPIC_API_KEY"] = "";
process.env["WORKER_CONCURRENCY"] = "2";
process.env["INVITE_SECRET"] = "test-invite-secret-32chars-long!!";
process.env["MARKETPLACE_UPLOAD_DIR"] = "/tmp/marketplace-test";
process.env["MASTER_ENCRYPTION_KEY"] = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
process.env["AUDIT_LOG_RETENTION_DAYS"] = "365";
process.env["LOKI_URL"] = "";
