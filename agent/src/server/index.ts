import pino from "pino";
import { buildPinoOptions } from "../shared/pino.js";
import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? "3001");
const host = process.env.HOST ?? "127.0.0.1";

const app = buildApp();
const logger = pino(buildPinoOptions("server"));

app
  .listen({ port, host })
  .then(() => {
    logger.info({ host, port, event: "startup_succeeded" });
  })
  .catch((error: unknown) => {
    logger.error({
      event: "startup_failed",
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { message: String(error) },
    });
    process.exit(1);
  });
