import pino, {type Logger} from "pino";

/**
 * Utilities for the reactor runtime.
 *
 * @author Marten Lohstroh (marten@berkeley.edu)
 */

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
  LOG = "info",
  DEBUG = "debug"
}

/**
 * Global logging facility that has multiple levels of severity.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Log {
  /**
   * Available log levels.
   */
  public static levels = LogLevel;

  /**
   * Global instance of ulog that performs the logging.
   */
  public static global = pino({
    name: "reactor-ts"
  });

  /**
   * Horizontal rule.
   */
  public static hr = "=".repeat(80);

  /**
   * Map that keeps track of active loggers.
   */
  private static readonly loggers = new Map<string, Logger>();

  /**
   * Get the logger instance associated with the given module.
   * If it does not exist, it is created.
   * @param module The name associated with the logger
   */
  public static getInstance(module: string): Logger {
    let logger = Log.loggers.get(module);
    if (logger == null) {
      logger = this.global.child({module});
      Log.loggers.set(module, logger);
    }
    return logger;
  }

  /**
   * Log a message with severity `LogLevel.DEBUG`. The `message` callback
   * is only invoked if the ulog instance has a log level higher than
   * `LogLevel.DEBUG`.
   * @param obj The object to call the message callback on.
   * @param message Callback that returns a message string.
   * @param module The name associated with the logger.
   * @see LogLevel
   */
  public static debug(
    obj: unknown,
    message: () => string,
    module?: string
  ): void {
    if (module != null) {
      if (Log.global.level >= LogLevel.DEBUG) {
        Log.getInstance(module).debug(message.call(obj));
      }
    } else {
      if (Log.global.level >= LogLevel.DEBUG) {
        Log.global.debug(message.call(obj));
      }
    }
  }

  /**
   * Log a message with severity `LogLevel.ERROR`. The `message` callback
   * is only invoked if the ulog instance has a log level higher than
   * `LogLevel.ERROR`.
   * @param obj The object to call the message callback on.
   * @param message Callback that returns a message string.
   * @param module The name associated with the logger.
   * @see LogLevel
   */
  public static error(
    obj: unknown,
    message: () => string,
    module?: string
  ): void {
    if (module != null) {
      if (Log.global.level >= LogLevel.ERROR) {
        Log.getInstance(module).error(message.call(obj));
      }
    } else {
      if (Log.global.level >= LogLevel.ERROR) {
        // Log.global.error(message.call(obj));
        console.error(message.call(obj));
      }
    }
  }

  /**
   * Log a message with severity `LogLevel.INFO`. The `message` callback
   * is only invoked if the ulog instance has a log level higher than
   * `LogLevel.INFO`.
   * @param obj The object to call the message callback on.
   * @param message Callback that returns a message string.
   * @param module The name associated with the logger.
   * @see LogLevel
   */
  public static info(
    obj: unknown,
    message: () => string,
    module?: string
  ): void {
    if (module != null) {
      if (Log.global.level >= LogLevel.INFO) {
        Log.getInstance(module).info(message.call(obj));
      }
    } else {
      if (Log.global.level >= LogLevel.INFO) {
        Log.global.info(message.call(obj));
      }
    }
  }

  /**
   * Log a message with severity `LogLevel.LOG`. The `message` callback
   * is only invoked if the ulog instance has a log level higher than
   * `LogLevel.LOG`.
   * @param obj The object to call the message callback on.
   * @param message Callback that returns a message string.
   * @param module The name associated with the logger.
   * @see LogLevel
   */
  public static log(
    obj: unknown,
    message: () => string,
    module?: string
  ): void {
    if (module != null) {
      if (Log.global.level >= LogLevel.LOG) {
        Log.getInstance(module).info(message.call(obj));
      }
    } else {
      if (Log.global.level >= LogLevel.LOG) {
        Log.global.info(message.call(obj));
      }
    }
  }

  /**
   * Log a message with severity `LogLevel.WARN`. The `message` callback
   * is only invoked if the ulog instance has a log level higher than
   * `LogLevel.WARN`.
   * @param obj The object to call the message callback on.
   * @param message Callback that returns a message string.
   * @param module The name associated with the logger.
   * @see LogLevel
   */
  public static warn(
    obj: unknown,
    message: () => string,
    module?: string
  ): void {
    if (module != null) {
      if (Log.global.level >= LogLevel.WARN) {
        Log.getInstance(module).warn(message.call(obj));
      }
    } else {
      if (Log.global.level >= LogLevel.WARN) {
        Log.global.warn(message.call(obj));
      }
    }
  }
}
