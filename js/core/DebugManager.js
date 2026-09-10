"use strict";

/**
 * Central switch for normal development logging.
 *
 * Warnings and errors still use console.warn/error directly so important
 * problems remain visible even when debug logging is disabled.
 */
class DebugManager {
  static enabled = true;

  static setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  static log(...args) {
    if (this.enabled) {
      console.log(...args);
    }
  }
}
