import type { Core } from '@strapi/strapi';

/**
 * Debug Logger Utility for magic-mark
 * Only logs messages when debug: true in plugin config
 * ALL logs (including errors/warnings) are hidden unless debug mode is enabled
 */

const PLUGIN_NAME = 'magic-mark';
const PREFIX = '[Magic-Mark]';

interface Logger {
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  forceError: (...args: unknown[]) => void;
}

/**
 * Format message with prefix - returns a formatted string
 */
function formatMessage(prefix: string, args: unknown[]): string {
  if (args.length === 0) return prefix;
  const parts = args.map(arg => 
    typeof arg === 'string' ? arg : JSON.stringify(arg)
  );
  return `${prefix} ${parts.join(' ')}`;
}

/**
 * Creates a logger instance that respects debug config
 * @param strapi - Strapi instance
 * @returns Logger with info, debug, warn, error methods
 */
export function createLogger(strapi: Core.Strapi): Logger {
  const getDebugMode = (): boolean => {
    try {
      const config = strapi.config.get(`plugin::${PLUGIN_NAME}`) as { debug?: boolean } || {};
      return config.debug === true;
    } catch {
      return false;
    }
  };

  return {
    /**
     * Log info - only when debug: true
     */
    info: (...args: unknown[]) => {
      if (getDebugMode()) {
        strapi.log.info(formatMessage(PREFIX, args));
      }
    },

    /**
     * Log debug - only when debug: true
     */
    debug: (...args: unknown[]) => {
      if (getDebugMode()) {
        strapi.log.debug(formatMessage(PREFIX, args));
      }
    },

    /**
     * Log warning - only when debug: true
     */
    warn: (...args: unknown[]) => {
      if (getDebugMode()) {
        strapi.log.warn(formatMessage(PREFIX, args));
      }
    },

    /**
     * Log error - only when debug: true
     */
    error: (...args: unknown[]) => {
      if (getDebugMode()) {
        strapi.log.error(formatMessage(PREFIX, args));
      }
    },

    /**
     * Force log - always logged (for critical errors only)
     */
    forceError: (...args: unknown[]) => {
      strapi.log.error(formatMessage(PREFIX, args));
    },
  };
}
