"use strict";

class Game_Switches {
  constructor() {
    this.data = {};
  }

  value(id) {
    return this.data[id] === true;
  }

  setValue(id, value) {
    this.data[id] = Boolean(value);

    DebugManager.log(`Switch "${id}" = ${this.data[id]}`);
  }

  clear() {
    this.data = {};
  }
}
