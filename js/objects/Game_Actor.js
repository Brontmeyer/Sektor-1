"use strict";

class Game_Actor {
  constructor() {
    this.maxHp = 100;
    this.hp = this.maxHp;
  }

  gainHp(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value)) {
      console.error(`Invalid HP amount: ${amount}`);

      return;
    }

    this.hp += value;

    if (this.hp > this.maxHp) {
      this.hp = this.maxHp;
    }

    if (this.hp < 0) {
      this.hp = 0;
    }

    console.log(`HP: ${this.hp}/${this.maxHp}`);
  }

  isFullHp() {
    return this.hp >= this.maxHp;
  }
}
