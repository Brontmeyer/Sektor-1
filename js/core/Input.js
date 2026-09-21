"use strict";

class Input {
  static initialize() {
    this.keys = {};
    this.triggeredKeys = {};
    window.addEventListener("keydown", this.onKeyDown.bind(this));
    window.addEventListener("keyup", this.onKeyUp.bind(this));
    DebugManager.log("Input initialized.");
  }

  static isPressed(code) {
    return this.keys?.[code] === true;
  }

  static isTriggered(code) {
    return this.triggeredKeys?.[code] === true;
  }

  static actionCodes(action) {
    if (typeof ConfigManager === "undefined") {
      return [];
    }

    return ConfigManager.boundCodes(action);
  }

  static isActionPressed(action) {
    return this.actionCodes(action).some((code) => this.isPressed(code));
  }

  static isActionTriggered(action) {
    return this.actionCodes(action).some((code) => this.isTriggered(code));
  }

  static actionLabel(action) {
    if (typeof ConfigManager === "undefined") {
      return action;
    }

    return ConfigManager.bindingLabel(action);
  }

  static triggeredCodes() {
    return Object.keys(this.triggeredKeys || {}).filter(
      (code) => this.triggeredKeys[code] === true,
    );
  }

  static onKeyDown(event) {
    if (!this.keys[event.code]) {
      this.triggeredKeys[event.code] = true;
    }

    this.keys[event.code] = true;
  }

  static onKeyUp(event) {
    this.keys[event.code] = false;
  }

  static endFrame() {
    this.triggeredKeys = {};
  }
}
