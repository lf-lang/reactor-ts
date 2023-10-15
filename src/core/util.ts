import pino, {type Logger} from "pino";

/**
 * Utilities for the reactor runtime.
 *
 * @author Marten Lohstroh (marten@berkeley.edu)
 */

/**
 * Global logging facility that has multiple levels of severity.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Log {
  /**
   * Log levels for `Log`.
   * This LogLevel is inherited from ULog and is kept for compatibility/abstraction purposes.
   * As we switch to pinojs, it adds `fatal` but lacks `log`.
   * @see Log
   */
  export enum LogLevel {
    FATAL = "fatal",
    ERROR = "error",
    WARN = "warn",
    INFO = "info",
    DEBUG = "debug"
  }

  /**
   * Global instance of ulog that performs the logging.
   */
  export const globalLogger = pino({
    name: "reactor-ts",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        sync: true,
        ignore: "pid,hostname,time"
      }
    }
  });

  /**
   * Horizontal rule.
   */
  export const hr = "=".repeat(80);

  /**
   * Map that keeps track of active loggers.
   */
  const loggers = new Map<string, Logger>();

  /**
   * Get the logger instance associated with the given module.
   * If it does not exist, it is created.
   * @param module The name associated with the logger
   */
  export function getInstance(module: string): Logger {
    let logger = loggers.get(module);
    if (logger == null) {
      logger = globalLogger.child({module});
      loggers.set(module, logger);
    }
    return logger;
  }

  export function setLevel(severity: LogLevel, module?: string): void {
    if (module != null) {
      const logger = loggers.get(module);
      if (logger != null) {
        logger.level = severity.valueOf();
      }
      return;
    }
    globalLogger.level = severity.valueOf();
  }

  /**
   * Log a message with severity `severity`. The `message` callback
   * is only invoked if the ulog instance has a log level higher than
   * `severity`.
   * @param obj The object to call the message callback on.
   * @param message Callback that returns a message string.
   * @param module The name associated with the logger.
   * @see LogLevel
   */
  const logWithSeverity = (
    severity: LogLevel,
    obj: unknown,
    message: () => string,
    module?: string
  ): void => {
    const logger = module != null ? getInstance(module) : globalLogger;
    if (!logger.isLevelEnabled(severity.valueOf())) {
      return;
    }
    switch (severity) {
      case LogLevel.FATAL: {
        logger.fatal(message.call(obj));
        break;
      }
      case LogLevel.ERROR: {
        logger.error(message.call(obj));
        break;
      }
      case LogLevel.WARN: {
        logger.warn(message.call(obj));
        break;
      }
      case LogLevel.INFO: {
        logger.info(message.call(obj));
        break;
      }
      case LogLevel.DEBUG: {
        logger.debug(message.call(obj));
        break;
      }
    }
  };

  export function fatal(
    obj: unknown,
    message: () => string,
    module?: string
  ): void {
    logWithSeverity(LogLevel.FATAL, obj, message, module);
  }

  export function error(
    obj: unknown,
    message: () => string,
    module?: string
  ): void {
    logWithSeverity(LogLevel.ERROR, obj, message, module);
  }

  export function warn(
    obj: unknown,
    message: () => string,
    module?: string
  ): void {
    logWithSeverity(LogLevel.WARN, obj, message, module);
  }

  export function info(
    obj: unknown,
    message: () => string,
    module?: string
  ): void {
    logWithSeverity(LogLevel.INFO, obj, message, module);
  }

  export function log(
    obj: unknown,
    message: () => string,
    module?: string
  ): void {
    logWithSeverity(LogLevel.INFO, obj, message, module);
  }

  export function debug(
    obj: unknown,
    message: () => string,
    module?: string
  ): void {
    logWithSeverity(LogLevel.DEBUG, obj, message, module);
  }
}
