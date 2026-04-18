/**
 * Centralized logging utility
 * Provides structured logging with different levels and contexts
 */

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL = process.env.NEXT_PUBLIC_LOG_LEVEL || 'INFO'

function shouldLog(level: LogLevel): boolean {
  const currentLevel = LogLevel[LOG_LEVEL as keyof typeof LogLevel] ?? LogLevel.INFO
  return level >= currentLevel
}

interface LogContext {
  userId?: string
  sessionId?: string
  requestId?: string
  [key: string]: unknown
}

function formatMessage(level: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const contextStr = context ? ` ${JSON.stringify(context)}` : ''
  return `[${timestamp}] [${level}] ${message}${contextStr}`
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog(LogLevel.DEBUG)) {
      console.debug(formatMessage('DEBUG', message, context))
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog(LogLevel.INFO)) {
      console.info(formatMessage('INFO', message, context))
    }
  },

  warn(message: string, context?: LogContext): void {
    if (shouldLog(LogLevel.WARN)) {
      console.warn(formatMessage('WARN', message, context))
    }
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    if (shouldLog(LogLevel.ERROR)) {
      const errorStr = error instanceof Error
        ? ` ${error.message}\n${error.stack}`
        : error
          ? ` ${JSON.stringify(error)}`
          : ''
      console.error(formatMessage('ERROR', message + errorStr, context))
    }
  },

  // API-specific logging helpers
  api: {
    request(method: string, path: string, context?: LogContext): void {
      logger.info(`API Request: ${method} ${path}`, context)
    },

    response(method: string, path: string, status: number, duration: number, context?: LogContext): void {
      const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO
      if (shouldLog(level)) {
        logger.info(
          `API Response: ${method} ${path} ${status} (${duration}ms)`,
          context
        )
      }
    },

    error(method: string, path: string, error: unknown, context?: LogContext): void {
      logger.error(`API Error: ${method} ${path}`, error, context)
    },
  },

  // Auth-specific logging helpers
  auth: {
    login(userId: string, success: boolean, context?: LogContext): void {
      const level = success ? LogLevel.INFO : LogLevel.WARN
      if (shouldLog(level)) {
        logger.info(
          `Auth: Login ${success ? 'success' : 'failed'} for user ${userId}`,
          context
        )
      }
    },

    logout(userId: string, context?: LogContext): void {
      logger.info(`Auth: User ${userId} logged out`, context)
    },

    sessionExpired(context?: LogContext): void {
      logger.warn('Auth: Session expired', context)
    },
  },

  // Usage tracking logging
  usage: {
    increment(userId: string, action: string, context?: LogContext): void {
      logger.debug(`Usage: ${action} for user ${userId}`, context)
    },

    limitReached(userId: string, limitType: string, context?: LogContext): void {
      logger.warn(`Usage: ${limitType} limit reached for user ${userId}`, context)
    },
  },
}

export default logger
