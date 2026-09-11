"use strict";

class Game_Party {
  constructor(initialActors = []) {
    this.items = {};

    this.weapons = {};
    this.armors = {};

    // Party roster and active battle party are intentionally separate.
    // This lets the project grow into a larger roster later while keeping
    // a maximum of three active battle members.
    this._actors = [];
    this._battleActorIds = [];

    for (const actor of initialActors) {
      this.addActor(actor);
    }

    if (this._actors.length > 0 && this._battleActorIds.length === 0) {
      this._battleActorIds = this._actors
        .slice(0, 4)
        .map((actor) => actor.actorId);
    }
  }

  // =====================================
  // PARTY MEMBERS
  // =====================================

  members() {
    return [...this._actors];
  }

  actorById(actorId) {
    const id = Number(actorId);
    return this._actors.find((actor) => actor.actorId === id) || null;
  }

  leader() {
    return this._actors[0] || null;
  }

  addActor(actor) {
    if (!(actor instanceof Game_Actor)) {
      console.warn("Game_Party.addActor expects a Game_Actor instance.");
      return false;
    }

    if (this.actorById(actor.actorId)) {
      return false;
    }

    this._actors.push(actor);

    if (this._battleActorIds.length < 4) {
      this._battleActorIds.push(actor.actorId);
    }

    return true;
  }

  removeActor(actorId) {
    const id = Number(actorId);
    const index = this._actors.findIndex((actor) => actor.actorId === id);

    if (index < 0) {
      return false;
    }

    this._actors.splice(index, 1);
    this._battleActorIds = this._battleActorIds.filter(
      (memberId) => memberId !== id,
    );

    return true;
  }

  battleActorIds() {
    return [...this._battleActorIds];
  }

  setBattleActorIds(actorIds) {
    if (!Array.isArray(actorIds)) {
      return false;
    }

    const validIds = [];

    for (const actorId of actorIds) {
      const id = Number(actorId);

      if (
        !Number.isInteger(id) ||
        !this.actorById(id) ||
        validIds.includes(id)
      ) {
        continue;
      }

      validIds.push(id);

      if (validIds.length >= 4) {
        break;
      }
    }

    if (validIds.length === 0 && this.leader()) {
      validIds.push(this.leader().actorId);
    }

    this._battleActorIds = validIds;
    return this._battleActorIds.length > 0;
  }

  battleMembers() {
    return this._battleActorIds
      .map((actorId) => this.actorById(actorId))
      .filter((actor) => actor !== null);
  }

  livingBattleMembers() {
    return this.battleMembers().filter((actor) => actor.isAlive());
  }

  battleLeader() {
    return this.battleMembers()[0] || this.leader();
  }

  battleMemberIndex(actor) {
    return this.battleMembers().indexOf(actor);
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

    DebugManager.log(`${itemName}: ${this.itemCount(itemId)}`);
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
      DebugManager.log(`${item.name} cannot be used.`);

      return false;
    }

    switch (item.effect.type) {
      case "healHp":
        if ($gameActor.isFullHp()) {
          DebugManager.log(
            `${item.name} was not used because HP is already full.`,
          );

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

    DebugManager.log(`Used ${item.name}.`);

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

    DebugManager.log(`${armor.name}: ${this.armorCount(armorId)}`);
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

    DebugManager.log(`${weapon.name}: ${this.weaponCount(weaponId)}`);
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
