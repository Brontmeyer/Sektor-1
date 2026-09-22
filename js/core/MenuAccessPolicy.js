"use strict";

class MenuAccessPolicy {
  constructor({ debugMode = false, mapAccess = {}, commandStates = {} } = {}) {
    this.debugMode = Boolean(debugMode);
    this.mapAccess = this.normalizeMapAccess(mapAccess);
    this.commandStates = new Map();

    for (const [command, state] of Object.entries(commandStates || {})) {
      this.setCommandState(command, state);
    }
  }

  normalizeMapAccess(mapAccess) {
    const source = mapAccess && typeof mapAccess === "object" ? mapAccess : {};

    return {
      allowSave: source.allowSave !== false,
      allowLoad: source.allowLoad !== false,
    };
  }

  setCommandState(command, state = {}) {
    const name = String(command || "").trim();

    if (!name) {
      return false;
    }

    const normalized = {
      visible: state.visible !== false,
      enabled: state.enabled !== false,
      reason: String(state.reason || "").trim(),
    };

    this.commandStates.set(name, normalized);
    return true;
  }

  clearCommandState(command) {
    return this.commandStates.delete(String(command || "").trim());
  }

  mapState(command) {
    if (this.debugMode) {
      return { visible: true, enabled: true, reason: "" };
    }

    if (command === "Save" && !this.mapAccess.allowSave) {
      return {
        visible: true,
        enabled: false,
        reason: "Saving is not available in this area.",
      };
    }

    if (command === "Load" && !this.mapAccess.allowLoad) {
      return {
        visible: true,
        enabled: false,
        reason: "Loading is not available in this area.",
      };
    }

    return { visible: true, enabled: true, reason: "" };
  }

  state(command) {
    const name = String(command || "").trim();
    const mapState = this.mapState(name);
    const override = this.commandStates.get(name);

    if (!override) {
      return mapState;
    }

    return {
      visible: mapState.visible && override.visible,
      enabled: mapState.enabled && override.enabled,
      reason:
        !mapState.enabled && mapState.reason
          ? mapState.reason
          : override.enabled
            ? ""
            : override.reason,
    };
  }

  isVisible(command) {
    return this.state(command).visible;
  }

  isEnabled(command) {
    return this.state(command).enabled;
  }
}
