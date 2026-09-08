"use strict";

class Game_Variables {
  constructor() {
    this.data = {};
  }

  addValue(id, amount) {
    const newValue = this.value(id) + amount;

    this.setValue(id, newValue);
  }

  setValue(id, value) {
    this.data[id] = value;

    console.log(`Variable "${id}" = ${value}`);
  }

  value(id) {
    if (this.data[id] === undefined) {
      return 0;
    }

    return this.data[id];
  }

  clear() {
    this.data = {};
  }
}
