import "dotenv/config";
import { runHost } from "./bootstrap/run-host";
import { logError } from "./observability/logger";

void runHost().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown startup error";
  logError("host fatal error", { message });
  process.exit(1);
});
