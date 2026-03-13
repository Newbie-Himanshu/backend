import pino from "pino"

/**
 * Shared structured logger for E-Commerce Backend.
 *
 * - Development:  pretty-printed, human-readable via pino-pretty
 * - Production:   newline-delimited JSON — pipe to any log aggregator (Datadog, Loki, etc.)
 *
 * Redaction:
 *   Any field named `otp`, `otp_hash`, `otp_salt`, `msg91_auth_key`, or `authkey` is
 *   replaced with "[REDACTED]" before the log line leaves the process so secrets never
 *   appear in log files or stdout.
 *
 * Usage:
 *   import logger from "../lib/logger"
 *   const log = logger.child({ module: "cod-payment" })
 *   log.info({ amount: 50000 }, "OTP initiated")
 *   log.error({ err }, "SMS send failed")
 */

const isDev = (process.env.NODE_ENV ?? "development") !== "production"

const baseOptions: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
        paths: [
            "*.otp",
            "*.otp_hash",
            "*.otp_salt",
            "otp",
            "otp_hash",
            "otp_salt",
            "*.msg91_auth_key",
            "*.authkey",
            "authkey",
        ],
        censor: "[REDACTED]",
    },
    serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
    },
}

const logger = isDev
    ? pino({
          ...baseOptions,
          transport: {
              target: "pino-pretty",
              options: {
                  colorize: true,
                  translateTime: "SYS:HH:MM:ss",
                  ignore: "pid,hostname",
                  messageFormat: "{module} | {msg}",
              },
          },
      })
    : pino(baseOptions)

export default logger
