"use strict";

class Game_Party {
  constructor() {
    this.items = {};
  }

  itemCount(itemId) {
    return this.items[itemId] || 0;
  }

  gainItem(itemId, amount = 1) {
    const currentAmount = this.itemCount(itemId);

    const newAmount = currentAmount + amount;

    if (newAmount <= 0) {
      delete this.items[itemId];
    } else {
      this.items[itemId] = newAmount;
    }

    const itemName = DatabaseManager.itemName(itemId);

    console.log(`${itemName}: ${this.itemCount(itemId)}`);
  }

  loseItem(itemId, amount = 1) {
    this.gainItem(itemId, -amount);
  }

  hasItem(itemId) {
    return this.itemCount(itemId) > 0;
  }

  useItem(itemId) {
    const item = DatabaseManager.item(itemId);

    if (!item) {
      console.error(`Cannot use unknown item ID ${itemId}.`);

      return false;
    }

    if (!item.effect) {
      console.log(`${item.name} cannot be used.`);

      return false;
    }

    switch (item.effect.type) {
      case "healHp":
        if ($gameActor.isFullHp()) {
          console.log(`${item.name} was not used because HP is already full.`);

          return false;
        }

        const healAmount = Number(item.effect.value);

        if (!Number.isFinite(healAmount) || healAmount <= 0) {
          console.error(
            `${item.name} has an invalid healHp value: ${item.effect.value}`,
          );

          return false;
        }

        $gameActor.gainHp(healAmount);

        break;

      default:
        console.warn(`Unknown item effect: ${item.effect.type}`);

        return false;
    }

    if (item.consumable === true) {
      this.loseItem(itemId, 1);
    }

    console.log(`Used ${item.name}.`);

    return true;
  }

  clear() {
    this.items = {};
  }
}
