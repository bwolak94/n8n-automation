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
process.env["STRIPE_SECRET_KEY"] = "";
process.env["STRIPE_WEBHOOK_SECRET"] = "";
process.env["ANTHROPIC_API_KEY"] = "";
process.env["WORKER_CONCURRENCY"] = "2";
process.env["INVITE_SECRET"] = "test-invite-secret-32chars-long!!";
process.env["MARKETPLACE_UPLOAD_DIR"] = "/tmp/marketplace-test";
