"use strict";

class Game_Party {
  constructor() {
    this.items = {};

    this.weapons = {};
    this.armors = {};
  }

  // =====================================
  // ITEMS
  // =====================================

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

  itemCount(itemId) {
    return this.items[itemId] || 0;
  }
  
  hasItem(itemId) {
    return this.itemCount(itemId) > 0;
  }

  itemIds() {
    return Object.keys(this.items)
      .map(Number)
      .filter((itemId) => this.itemCount(itemId) > 0);
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

  // =====================================
  // ARMORS
  // =====================================

  armorCount(armorId) {
    return this.armors[armorId] || 0;
  }

  gainArmor(armorId, amount = 1) {
    const armor = DatabaseManager.armor(armorId);

    if (!armor) {
      console.error(`Unknown armor ID: ${armorId}`);

      return;
    }

    const newAmount = this.armorCount(armorId) + Number(amount);

    if (newAmount <= 0) {
      delete this.armors[armorId];
    } else {
      this.armors[armorId] = newAmount;
    }

    console.log(`${armor.name}: ${this.armorCount(armorId)}`);
  }

  loseArmor(armorId, amount = 1) {
    this.gainArmor(armorId, -amount);
  }

  hasArmor(armorId) {
    return this.armorCount(armorId) > 0;
  }

  // =====================================
  // WEAPONS
  // =====================================

  weaponCount(weaponId) {
    return this.weapons[weaponId] || 0;
  }

  gainWeapon(weaponId, amount = 1) {
    const weapon = DatabaseManager.weapon(weaponId);

    if (!weapon) {
      console.error(`Unknown weapon ID: ${weaponId}`);

      return;
    }

    const newAmount = this.weaponCount(weaponId) + Number(amount);

    if (newAmount <= 0) {
      delete this.weapons[weaponId];
    } else {
      this.weapons[weaponId] = newAmount;
    }

    console.log(`${weapon.name}: ${this.weaponCount(weaponId)}`);
  }

  loseWeapon(weaponId, amount = 1) {
    this.gainWeapon(weaponId, -amount);
  }

  hasWeapon(weaponId) {
    return this.weaponCount(weaponId) > 0;
  }

  clear() {
    this.items = {};
    this.weapons = {};
    this.armors = {};
  }
}
