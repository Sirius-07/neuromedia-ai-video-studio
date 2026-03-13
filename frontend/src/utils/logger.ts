/**
 * 日志工具类
 * 在生产环境自动禁用调试日志，在开发环境提供可控制的日志输出
 */

const isDev = import.meta.env.DEV;

// 可以通过这个开关控制是否在开发环境输出详细日志
const ENABLE_VERBOSE_LOGS = false; // 改为 true 可以看到所有详细日志

export const logger = {
  /**
   * 详细日志 - 只在开发环境且启用详细日志时输出
   */
  verbose: (...args: any[]) => {
    if (isDev && ENABLE_VERBOSE_LOGS) {
      console.log(...args);
    }
  },

  /**
   * 调试日志 - 只在开发环境输出
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * 信息日志 - 总是输出
   */
  info: (...args: any[]) => {
    console.log(...args);
  },

  /**
   * 警告日志 - 总是输出
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  /**
   * 错误日志 - 总是输出
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * 成功日志 - 只在开发环境输出
   */
  success: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  }
};

/**
 * 创建带命名空间的日志器
 */
export const createLogger = (namespace: string) => ({
  verbose: (...args: any[]) => logger.verbose(`[${namespace}]`, ...args),
  debug: (...args: any[]) => logger.debug(`[${namespace}]`, ...args),
  info: (...args: any[]) => logger.info(`[${namespace}]`, ...args),
  warn: (...args: any[]) => logger.warn(`[${namespace}]`, ...args),
  error: (...args: any[]) => logger.error(`[${namespace}]`, ...args),
  success: (...args: any[]) => logger.success(`[${namespace}]`, ...args),
});
