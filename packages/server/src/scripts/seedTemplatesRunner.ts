import mongoose from "mongoose";
import { seedTemplates } from "../seeds/seedTemplates.js";

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/automation-hub";

async function run(): Promise<void> {
  console.log(`[seed] Connecting to ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);
  console.log("[seed] Connected.");

  await seedTemplates();

  await mongoose.disconnect();
  console.log("[seed] Done.");
}

run().catch((err: unknown) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
