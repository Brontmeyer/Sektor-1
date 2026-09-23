"use strict";

class Input {
  static initialize() {
    this.keys = {};
    this.triggeredKeys = {};
    this.repeatStates = {};
    this.repeatedActions = {};
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

  static repeatDelaySeconds() {
    return 0.32;
  }

  static repeatIntervalSeconds() {
    return 0.085;
  }

  static repeatableActions() {
    if (
      typeof ConfigManager === "undefined" ||
      typeof ConfigManager.controlDefinitions !== "function"
    ) {
      return [];
    }

    return ConfigManager.controlDefinitions().map(
      (definition) => definition.action,
    );
  }

  static update(deltaTime) {
    if (!this.repeatStates) {
      this.repeatStates = {};
    }

    this.repeatedActions = {};
    const elapsed = Math.max(0, Number(deltaTime) || 0);

    for (const action of this.repeatableActions()) {
      const pressed = this.isActionPressed(action);
      const triggered = this.isActionTriggered(action);
      const state = this.repeatStates[action] || {
        active: false,
        elapsed: 0,
        nextRepeat: this.repeatDelaySeconds(),
      };

      if (!pressed) {
        state.active = false;
        state.elapsed = 0;
        state.nextRepeat = this.repeatDelaySeconds();
        this.repeatStates[action] = state;
        continue;
      }

      if (triggered || !state.active) {
        state.active = true;
        state.elapsed = 0;
        state.nextRepeat = this.repeatDelaySeconds();
        this.repeatStates[action] = state;
        continue;
      }

      state.elapsed += elapsed;

      if (state.elapsed >= state.nextRepeat) {
        this.repeatedActions[action] = true;

        while (state.nextRepeat <= state.elapsed) {
          state.nextRepeat += this.repeatIntervalSeconds();
        }
      }

      this.repeatStates[action] = state;
    }
  }

  static isActionRepeated(action) {
    return (
      this.isActionTriggered(action) ||
      this.repeatedActions?.[action] === true
    );
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
