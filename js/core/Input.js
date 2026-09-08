"use strict";

class Input {
  static initialize() {
    this.keys = {};

    this.triggeredKeys = {};

    window.addEventListener("keydown", this.onKeyDown.bind(this));

    window.addEventListener("keyup", this.onKeyUp.bind(this));

    console.log("Input initialized.");
  }

  static endFrame() {
    this.triggeredKeys = {};
  }

  static isPressed(code) {
    return this.keys[code] === true;
  }
  
  static isTriggered(code) {
    return this.triggeredKeys[code] === true;
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
}
