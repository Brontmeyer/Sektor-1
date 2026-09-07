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

  setValue(id, value) {
    this.data[id] = value;

    console.log(`Variable "${id}" = ${value}`);
  }

  addValue(id, amount) {
    const newValue = this.value(id) + amount;

    this.setValue(id, newValue);
  }

  clear() {
    this.data = {};
  }
}
