"use strict";

class UIResourcePalette {
  static resource(resourceName) {
    const key = String(resourceName || "").trim().toLowerCase();
    return this.RESOURCES[key] || this.FALLBACK;
  }

  static text(resourceName, { ready = false } = {}) {
    const colors = this.resource(resourceName);
    return ready && colors.readyText ? colors.readyText : colors.text;
  }

  static valueText() {
    return "#ffffff";
  }

  static fill(resourceName, { ready = false } = {}) {
    const colors = this.resource(resourceName);
    return ready && colors.readyFill ? colors.readyFill : colors.fill;
  }
}

UIResourcePalette.FALLBACK = Object.freeze({
  text: "#f0f3f7",
  fill: "#9aa8b8",
});

UIResourcePalette.RESOURCES = Object.freeze({
  hp: Object.freeze({
    text: "#66d7ff",
    fill: "#4db8ff",
  }),
  mp: Object.freeze({
    text: "#78ef91",
    fill: "#4fd46b",
  }),
  valor: Object.freeze({
    text: "#e3a0ff",
    fill: "#c06cff",
    readyText: "#f0c4ff",
    readyFill: "#d98cff",
  }),
  time: Object.freeze({
    text: "#ffd166",
    fill: "#e9b949",
    readyText: "#ffe29a",
    readyFill: "#ffd166",
  }),
});
