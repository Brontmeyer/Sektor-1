"use strict";

class UIThemePalette {
  static COLORS = Object.freeze({
    focus: "#ffd75a",
    accent: "#7ff0d5",
    positive: "#7dff8a",
    negative: "#ff6b6b",
    primary: "#ffffff",
    secondary: "#aebbd0",
    muted: "#8897ac",
    hint: "#c7a7ff",
    keyItem: "#ff9ed8",
    backdrop: "#0b0e13",
    portraitFill: "#0c172d",
    portraitBorder: "#89b6eb",
  });

  static color(role, fallback = "#ffffff") {
    return this.COLORS[role] || fallback;
  }

  static focus() {
    return this.color("focus", "#ffd75a");
  }

  static accent() {
    return this.color("accent", "#7ff0d5");
  }

  static positive() {
    return this.color("positive", "#7dff8a");
  }

  static negative() {
    return this.color("negative", "#ff6b6b");
  }

  static primary() {
    return this.color("primary", "#ffffff");
  }

  static secondary() {
    return this.color("secondary", "#aebbd0");
  }

  static muted() {
    return this.color("muted", "#8897ac");
  }

  static hint() {
    return this.color("hint", "#c7a7ff");
  }

  static keyItem() {
    return this.color("keyItem", "#ff9ed8");
  }

  static backdrop() {
    return this.color("backdrop", "#0b0e13");
  }
}
