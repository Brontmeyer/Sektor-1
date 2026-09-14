"use strict";

class Game_Variables {
  constructor() {
    this.data = {};
  }

  value(id) {
    if (this.data[id] === undefined) {
      return 0;
    }

    return this.data[id];
  }

  addValue(id, amount) {
    const newValue = this.value(id) + amount;

    this.setValue(id, newValue);
  }

  setValue(id, value) {
    this.data[id] = value;

    DebugManager.log(`Variable "${id}" = ${value}`);
  }

  clear() {
    this.data = {};
  }
}
