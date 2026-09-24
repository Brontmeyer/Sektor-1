"use strict";

class Game_Party {
  constructor(initialActors = []) {
    this.items = {};
    this._gil = 0;

    this.weapons = {};
    this.armors = {};
    this.accessories = {};

    // Party roster and active battle party are intentionally separate.
    // This lets the project grow into a larger roster later while keeping
    // a maximum of four active battle members.
    this._actors = [];
    this._battleActorIds = [];
    this._battleFormationActorIds = [];
    this._battleRows = {};

    for (const actor of initialActors) {
      this.addActor(actor);
    }

    if (this._actors.length > 0 && this._battleActorIds.length === 0) {
      this._battleActorIds = this._actors
        .slice(0, 4)
        .map((actor) => actor.actorId);
    }
  }

  // =================================
  // Party Members
  // =================================

  members() {
    return [...this._actors];
  }

  leader() {
    return this._actors[0] || null;
  }

  actorById(actorId) {
    const id = Number(actorId);
    return this._actors.find((actor) => actor.actorId === id) || null;
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
    this._battleRows[actor.actorId] = this.normalizeBattleRow(
      this._battleRows[actor.actorId],
    );

    if (this._battleActorIds.length < 4) {
      this._battleActorIds.push(actor.actorId);
      this._battleFormationActorIds.push(actor.actorId);
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
    this._battleFormationActorIds = this._battleFormationActorIds.filter(
      (memberId) => memberId !== id,
    );
    delete this._battleRows[id];

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
    this.syncBattleFormationActorIds();
    return this._battleActorIds.length > 0;
  }

  battleLeader() {
    return this.battleMembers()[0] || this.leader();
  }

  battleMembers() {
    return this._battleActorIds
      .map((actorId) => this.actorById(actorId))
      .filter((actor) => actor !== null);
  }

  battleMemberIndex(actor) {
    return this.battleMembers().indexOf(actor);
  }

  syncBattleFormationActorIds() {
    const activeIds = this.battleActorIds();
    const orderedIds = this._battleFormationActorIds.filter(
      (actorId) => activeIds.includes(actorId),
    );

    for (const actorId of activeIds) {
      if (!orderedIds.includes(actorId)) {
        orderedIds.push(actorId);
      }
    }

    this._battleFormationActorIds = orderedIds.slice(0, 4);
    return [...this._battleFormationActorIds];
  }

  battleFormationActorIds() {
    return this.syncBattleFormationActorIds();
  }

  setBattleFormationActorIds(actorIds) {
    if (!Array.isArray(actorIds)) {
      return false;
    }

    const activeIds = this.battleActorIds();
    const orderedIds = [];

    for (const rawActorId of actorIds) {
      const actorId = Number(rawActorId);

      if (
        !Number.isInteger(actorId) ||
        !activeIds.includes(actorId) ||
        orderedIds.includes(actorId)
      ) {
        continue;
      }

      orderedIds.push(actorId);
    }

    for (const actorId of activeIds) {
      if (!orderedIds.includes(actorId)) {
        orderedIds.push(actorId);
      }
    }

    this._battleFormationActorIds = orderedIds.slice(0, 4);
    return this._battleFormationActorIds.length === activeIds.length;
  }

  battleFormationMembers() {
    return this.battleFormationActorIds()
      .map((actorId) => this.actorById(actorId))
      .filter((actor) => actor !== null);
  }

  battleFormationIndex(actor) {
    return this.battleFormationMembers().indexOf(actor);
  }

  swapBattleFormationSlots(firstIndex, secondIndex) {
    const first = Number(firstIndex);
    const second = Number(secondIndex);
    const members = this.battleFormationActorIds();

    if (
      !Number.isInteger(first) ||
      !Number.isInteger(second) ||
      first < 0 ||
      second < 0 ||
      first >= members.length ||
      second >= members.length ||
      first === second
    ) {
      return false;
    }

    [members[first], members[second]] = [members[second], members[first]];
    this._battleFormationActorIds = members;
    return true;
  }

  normalizeBattleRow(row) {
    return String(row || "front").toLowerCase() === "back"
      ? "back"
      : "front";
  }

  battleRow(actorOrId) {
    const actorId = Number(actorOrId?.actorId ?? actorOrId);

    if (!Number.isInteger(actorId) || !this.actorById(actorId)) {
      return "front";
    }

    return this.normalizeBattleRow(this._battleRows[actorId]);
  }

  setBattleRow(actorOrId, row) {
    const actorId = Number(actorOrId?.actorId ?? actorOrId);
    const normalizedRow = String(row || "").toLowerCase();

    if (
      !Number.isInteger(actorId) ||
      !this.actorById(actorId) ||
      !["front", "back"].includes(normalizedRow)
    ) {
      return false;
    }

    this._battleRows[actorId] = normalizedRow;
    return true;
  }

  toggleBattleRow(actorOrId) {
    const current = this.battleRow(actorOrId);
    return this.setBattleRow(actorOrId, current === "front" ? "back" : "front");
  }

  battleRows() {
    const rows = {};

    for (const actor of this._actors) {
      rows[actor.actorId] = this.battleRow(actor);
    }

    return rows;
  }

  setBattleRows(rows = {}) {
    const source = rows && typeof rows === "object" && !Array.isArray(rows)
      ? rows
      : {};

    for (const actor of this._actors) {
      this._battleRows[actor.actorId] = this.normalizeBattleRow(
        source[actor.actorId] ?? source[String(actor.actorId)],
      );
    }

    return true;
  }

  livingBattleMembers() {
    return this.battleMembers().filter((actor) => actor.isAlive());
  }

  // =================================
  // Currency
  // =================================

  gil() {
    return this._gil;
  }

  gainGil(amount) {
    const value = Number(amount);

    if (!Number.isInteger(value) || value < 0) {
      console.error(`Invalid Gil amount: ${amount}`);
      return false;
    }

    this._gil += value;
    return true;
  }

  spendGil(amount) {
    const value = Number(amount);

    if (!Number.isInteger(value) || value < 0 || value > this._gil) {
      return false;
    }

    this._gil -= value;
    return true;
  }

  setGil(amount) {
    const value = Number(amount);

    if (!Number.isInteger(value) || value < 0) {
      return false;
    }

    this._gil = value;
    return true;
  }

  // =================================
  // Items
  // =================================

  gainItem(itemId, amount = 1) {
    const item = DatabaseManager.item(itemId);

    if (!item) {
      console.error(`Unknown item ID: ${itemId}`);
      return false;
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount === 0) {
      console.error(`Invalid item amount: ${amount}`);
      return false;
    }

    const currentAmount = Number(this.itemCount(itemId));
    const safeCurrentAmount = Number.isFinite(currentAmount) ? currentAmount : 0;
    const newAmount = safeCurrentAmount + numericAmount;

    if (newAmount <= 0) {
      delete this.items[itemId];
    } else {
      this.items[itemId] = newAmount;
    }

    DebugManager.log(`${item.name}: ${this.itemCount(itemId)}`);
    return true;
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

  hasKeyItem(itemId, amount = 1) {
    const item = DatabaseManager.item(itemId);
    const quantity = Number(amount);

    if (!item || item.keyItem !== true) {
      return false;
    }

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return false;
    }

    return this.itemCount(itemId) >= quantity;
  }

  consumeKeyItem(itemId, amount = 1) {
    const item = DatabaseManager.item(itemId);
    const quantity = Number(amount);

    if (!item || item.keyItem !== true) {
      console.error(`Cannot consume non-key item ID ${itemId} as a key item.`);
      return false;
    }

    if (item.consumable !== true) {
      DebugManager.log(`${item.name} is a permanent key item and was not consumed.`);
      return false;
    }

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      console.error(`Invalid key item amount: ${amount}`);
      return false;
    }

    if (!this.hasKeyItem(itemId, quantity)) {
      DebugManager.log(`Not enough ${item.name} to consume.`);
      return false;
    }

    return this.gainItem(itemId, -quantity);
  }

  itemIds() {
    return Object.keys(this.items)
      .map(Number)
      .filter((itemId) => this.itemCount(itemId) > 0);
  }

  useItem(itemId, target = null) {
    const item = DatabaseManager.item(itemId);

    if (!item) {
      console.error(`Cannot use unknown item ID ${itemId}.`);

      return false;
    }

    if (!item.effect) {
      DebugManager.log(`${item.name} cannot be used.`);

      return false;
    }

    const resolvedTarget = target || this.leader();

    if (!resolvedTarget) {
      console.error(`${item.name} has no valid party target.`);
      return false;
    }

    switch (item.effect.type) {
      case "healHp":
        if (resolvedTarget.isFullHp()) {
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

        resolvedTarget.gainHp(healAmount);

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

  // =================================
  // Equipment Inventory
  // =================================

  equipmentCount(collection, equipmentId) {
    return collection[equipmentId] || 0;
  }

  gainEquipment(collection, lookup, equipmentId, amount = 1) {
    const equipment = lookup(equipmentId);

    if (!equipment) {
      console.error(`Unknown equipment ID: ${equipmentId}`);
      return false;
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount === 0) {
      console.error(`Invalid equipment amount: ${amount}`);
      return false;
    }

    const newAmount =
      this.equipmentCount(collection, equipmentId) + numericAmount;

    if (newAmount <= 0) {
      delete collection[equipmentId];
    } else {
      collection[equipmentId] = newAmount;
    }

    DebugManager.log(
      `${equipment.name}: ${this.equipmentCount(collection, equipmentId)}`,
    );
    return true;
  }

  armorCount(armorId) {
    return this.equipmentCount(this.armors, armorId);
  }

  gainArmor(armorId, amount = 1) {
    return this.gainEquipment(
      this.armors,
      (id) => DatabaseManager.armor(id),
      armorId,
      amount,
    );
  }

  loseArmor(armorId, amount = 1) {
    return this.gainArmor(armorId, -amount);
  }

  hasArmor(armorId) {
    return this.armorCount(armorId) > 0;
  }

  weaponCount(weaponId) {
    return this.equipmentCount(this.weapons, weaponId);
  }

  gainWeapon(weaponId, amount = 1) {
    return this.gainEquipment(
      this.weapons,
      (id) => DatabaseManager.weapon(id),
      weaponId,
      amount,
    );
  }

  loseWeapon(weaponId, amount = 1) {
    return this.gainWeapon(weaponId, -amount);
  }

  hasWeapon(weaponId) {
    return this.weaponCount(weaponId) > 0;
  }

  accessoryCount(accessoryId) {
    return this.equipmentCount(this.accessories, accessoryId);
  }

  gainAccessory(accessoryId, amount = 1) {
    return this.gainEquipment(
      this.accessories,
      (id) => DatabaseManager.accessory(id),
      accessoryId,
      amount,
    );
  }

  loseAccessory(accessoryId, amount = 1) {
    return this.gainAccessory(accessoryId, -amount);
  }

  hasAccessory(accessoryId) {
    return this.accessoryCount(accessoryId) > 0;
  }

  // =================================
  // Merchandise / Shop Transactions
  // =================================

  merchandiseRecord(type, id) {
    switch (type) {
      case "item":
        return DatabaseManager.item(id);
      case "weapon":
        return DatabaseManager.weapon(id);
      case "armor":
        return DatabaseManager.armor(id);
      case "accessory":
        return DatabaseManager.accessory(id);
      default:
        return null;
    }
  }

  merchandiseCount(type, id) {
    switch (type) {
      case "item":
        return this.itemCount(id);
      case "weapon":
        return this.weaponCount(id);
      case "armor":
        return this.armorCount(id);
      case "accessory":
        return this.accessoryCount(id);
      default:
        return 0;
    }
  }

  gainMerchandise(type, id, amount = 1) {
    switch (type) {
      case "item":
        return this.gainItem(id, amount);
      case "weapon":
        return this.gainWeapon(id, amount);
      case "armor":
        return this.gainArmor(id, amount);
      case "accessory":
        return this.gainAccessory(id, amount);
      default:
        console.error(`Unknown merchandise type: ${type}`);
        return false;
    }
  }

  loseMerchandise(type, id, amount = 1) {
    return this.gainMerchandise(type, id, -Math.abs(Number(amount) || 0));
  }

  merchandiseSellPrice(type, id) {
    const record = this.merchandiseRecord(type, id);

    if (!record || record.sellable === false) {
      return 0;
    }

    const unitPrice = Number(record.price);

    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) {
      return 0;
    }

    return Math.max(0, Math.floor(unitPrice / 2));
  }

  equippedMerchandiseCount(type, id) {
    const merchandiseId = Number(id);

    if (!Number.isInteger(merchandiseId) || merchandiseId <= 0) {
      return 0;
    }

    if (type === "item") {
      return 0;
    }

    return this.members().reduce((count, actor) => {
      if (!actor) {
        return count;
      }

      if (type === "weapon" && Number(actor.weaponId) === merchandiseId) {
        return count + 1;
      }

      if (type === "armor" && Number(actor.armorId) === merchandiseId) {
        return count + 1;
      }

      if (type === "accessory" && Number(actor.accessoryId) === merchandiseId) {
        return count + 1;
      }

      return count;
    }, 0);
  }

  sellableMerchandiseCount(type, id) {
    const record = this.merchandiseRecord(type, id);

    if (!record || record.sellable === false) {
      return 0;
    }

    const owned = Math.max(0, Number(this.merchandiseCount(type, id)) || 0);
    const equipped = Math.max(0, this.equippedMerchandiseCount(type, id));
    return Math.max(0, owned - equipped);
  }

  actorEquipmentId(actor, type) {
    if (!actor) {
      return 0;
    }

    if (type === "weapon") {
      return Number(actor.weaponId) || 0;
    }

    if (type === "armor") {
      return Number(actor.armorId) || 0;
    }

    if (type === "accessory") {
      return Number(actor.accessoryId) || 0;
    }

    return 0;
  }

  availableEquipmentCount(type, id, actor = null) {
    const equipmentId = Number(id);

    if (
      !["weapon", "armor", "accessory"].includes(type) ||
      !Number.isInteger(equipmentId) ||
      equipmentId <= 0
    ) {
      return 0;
    }

    const owned = Math.max(0, Number(this.merchandiseCount(type, equipmentId)) || 0);
    const equippedByOthers = this.members().reduce((count, member) => {
      if (!member || member === actor) {
        return count;
      }

      return count + (this.actorEquipmentId(member, type) === equipmentId ? 1 : 0);
    }, 0);

    return Math.max(0, owned - equippedByOthers);
  }

  canActorEquipMerchandise(actor, type, id) {
    const equipmentId = Number(id);

    if (!this.members().includes(actor)) {
      return false;
    }

    if (equipmentId === 0) {
      return ["weapon", "armor", "accessory"].includes(type);
    }

    if (!this.merchandiseRecord(type, equipmentId)) {
      return false;
    }

    if (this.actorEquipmentId(actor, type) === equipmentId) {
      return true;
    }

    return this.availableEquipmentCount(type, equipmentId, actor) > 0;
  }

  equipActorMerchandise(actor, type, id) {
    const equipmentId = Number(id);

    if (!this.canActorEquipMerchandise(actor, type, equipmentId)) {
      return false;
    }

    if (equipmentId === 0) {
      if (type === "weapon") {
        return actor.weaponId > 0 ? actor.unequipWeapon() : true;
      }

      if (type === "armor") {
        return actor.armorId > 0 ? actor.unequipArmor() : true;
      }

      if (type === "accessory") {
        return actor.accessoryId > 0 ? actor.unequipAccessory() : true;
      }

      return false;
    }

    if (this.actorEquipmentId(actor, type) === equipmentId) {
      return true;
    }

    if (type === "weapon") {
      return actor.equipWeapon(equipmentId);
    }

    if (type === "armor") {
      return actor.equipArmor(equipmentId);
    }

    if (type === "accessory") {
      return actor.equipAccessory(equipmentId);
    }

    return false;
  }

  reconcileEquipmentOwnership() {
    for (const type of ["weapon", "armor", "accessory"]) {
      const usedById = new Map();

      for (const actor of this.members()) {
        const equipmentId = this.actorEquipmentId(actor, type);

        if (equipmentId <= 0) {
          continue;
        }

        const owned = Math.max(0, Number(this.merchandiseCount(type, equipmentId)) || 0);
        const used = usedById.get(equipmentId) || 0;

        if (used < owned) {
          usedById.set(equipmentId, used + 1);
          continue;
        }

        if (type === "weapon") {
          actor.unequipWeapon();
        } else if (type === "armor") {
          actor.unequipArmor();
        } else if (type === "accessory") {
          actor.unequipAccessory();
        }
      }
    }

    return true;
  }

  purchaseMerchandise(type, id, amount = 1) {
    const record = this.merchandiseRecord(type, id);
    const quantity = Number(amount);

    if (!record) {
      return { success: false, reason: "unknownMerchandise" };
    }

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { success: false, reason: "invalidQuantity" };
    }

    const unitPrice = Number(record.price);

    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) {
      return { success: false, reason: "invalidPrice" };
    }

    const totalPrice = unitPrice * quantity;

    if (!Number.isSafeInteger(totalPrice)) {
      return { success: false, reason: "invalidPrice" };
    }

    if (totalPrice > this._gil) {
      return {
        success: false,
        reason: "insufficientGil",
        requiredGil: totalPrice,
        gil: this._gil,
      };
    }

    if (!this.gainMerchandise(type, id, quantity)) {
      return { success: false, reason: "inventoryRejected" };
    }

    if (!this.spendGil(totalPrice)) {
      this.gainMerchandise(type, id, -quantity);
      return { success: false, reason: "paymentRejected" };
    }

    return {
      success: true,
      type,
      id: Number(id),
      quantity,
      unitPrice,
      totalPrice,
      gil: this._gil,
      owned: this.merchandiseCount(type, id),
    };
  }

  sellMerchandise(type, id, amount = 1) {
    const record = this.merchandiseRecord(type, id);
    const quantity = Number(amount);

    if (!record) {
      return { success: false, reason: "unknownMerchandise" };
    }

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { success: false, reason: "invalidQuantity" };
    }

    if (record.sellable === false) {
      return { success: false, reason: "unsellable" };
    }

    const owned = this.merchandiseCount(type, id);
    const available = this.sellableMerchandiseCount(type, id);

    if (available < quantity) {
      return {
        success: false,
        reason: "insufficientInventory",
        owned,
        available,
        requested: quantity,
      };
    }

    const unitPrice = this.merchandiseSellPrice(type, id);
    const totalPrice = unitPrice * quantity;

    if (!Number.isSafeInteger(totalPrice) || totalPrice < 0) {
      return { success: false, reason: "invalidPrice" };
    }

    if (!this.loseMerchandise(type, id, quantity)) {
      return { success: false, reason: "inventoryRejected" };
    }

    if (!this.gainGil(totalPrice)) {
      this.gainMerchandise(type, id, quantity);
      return { success: false, reason: "paymentRejected" };
    }

    return {
      success: true,
      type,
      id: Number(id),
      quantity,
      unitPrice,
      totalPrice,
      gil: this._gil,
      owned: this.merchandiseCount(type, id),
    };
  }

  clearInventory() {
    this.items = {};
    this.weapons = {};
    this.armors = {};
    this.accessories = {};
  }
}
