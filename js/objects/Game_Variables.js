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
    const currentValue = Number(this.value(id));
    const numericAmount = Number(amount);

    if (!Number.isFinite(currentValue) || !Number.isFinite(numericAmount)) {
      console.error(
        `Cannot add non-numeric value to variable "${id}": ${amount}`,
      );
      return false;
    }

    this.setValue(id, currentValue + numericAmount);
    return true;
  }

  setValue(id, value) {
    this.data[id] = value;

    DebugManager.log(`Variable "${id}" = ${value}`);
  }

  clear() {
    this.data = {};
  }
}
