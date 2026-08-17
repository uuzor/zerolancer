import { loadEnv } from "@zerolance/config/env";
import { backendEnvSchema } from "./env-schema.js";
import { createApp } from "./server.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger("main");

loadEnv();
if (process.env.PORT) {
  process.env.ZERO_PORT = process.env.ZERO_PORT ?? process.env.PORT;
}

const env = backendEnvSchema.parse(process.env);

createApp(env).catch((err) => {
  log.error("fatal startup error", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
