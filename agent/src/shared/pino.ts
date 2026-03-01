import type { LoggerOptions } from "pino";

const redactPaths = [
  "*.secret",
  "*.token",
  "*.authorization",
  "*.password",
  "*.api_key",
  "*.apiKey",
  "*.x-secret-key",
  "secret",
  "token",
  "authorization",
  "password",
  "api_key",
  "apiKey",
  "x-secret-key",
];

export const buildPinoOptions = (component: string): LoggerOptions => ({
  level: process.env.LOG_LEVEL ?? "info",
  base: { component },
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
  ...(process.env.LOG_PRETTY === "1"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : {}),
});
