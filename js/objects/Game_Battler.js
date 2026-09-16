"use strict";

/**
 * Shared combat foundation for actors and enemies.
 *
 * Game_Battler owns the state and behavior that every combatant has in
 * common: HP/MP, core battle stats, derived stats, and alive/dead checks.
 * Actor-specific equipment/skills/EXP stay in Game_Actor, while enemy-
 * specific sprite/database behavior stays in Game_Enemy.
 */
class Game_Battler {
  constructor(data = {}) {
    this.name = data.name || "Battler";
    this.level = data.level ?? 1;

    this.maxHp = data.maxHp ?? 1;
    this.maxMp = data.maxMp ?? 0;

    this.hp = this.maxHp;
    this.mp = this.maxMp;

    this.strength = data.strength ?? 0;
    this.vitality = data.vitality ?? 0;
    this.dexterity = data.dexterity ?? 0;
    this.agility = data.agility ?? 0;
    this.magic = data.magic ?? 0;
    this.spirit = data.spirit ?? 0;
    this.luck = data.luck ?? 0;

    this.attack = data.attack ?? 0;
    this.attackPercent = data.attackPercent ?? 0;

    this.defense = data.defense ?? 0;
    this.defensePercent = data.defensePercent ?? 0;

    this.magicAttack = data.magicAttack ?? 0;
    this.magicDefense = data.magicDefense ?? 0;
    this.magicDefensePercent = data.magicDefensePercent ?? 0;

    this.elementRates = {
      ...(data.elementRates || {}),
    };

    this.statuses = [];
    this.defending = false;
  }

  // =====================================
  // Status Management
  // =====================================

  hasStatus(statusKey) {
    return this.statuses.some((status) => status.key === statusKey);
  }

  addStatus(statusKey) {
    if (this.hasStatus(statusKey)) {
      return false;
    }

    const definition = DatabaseManager.statuses.find(
      (status) => status?.key === statusKey,
    );

    if (!definition) {
      return false;
    }

    const runtimeStatus = {
      key: definition.key,
    };

    if (
      definition.duration.type === "turns" ||
      definition.duration.type === "countdown"
    ) {
      runtimeStatus.turnsRemaining = definition.duration.turns;
    }

    this.statuses.push(runtimeStatus);

    this.applyStatusEffects(statusKey);

    return true;
  }

  applyStatusEffects(statusKey) {
    const definition = DatabaseManager.statuses.find(
      (status) => status?.key === statusKey,
    );

    if (!definition) {
      return false;
    }

    if (definition.effects?.setsHpToZero === true) {
      this.hp = 0;
    }

    return true;
  }

  removeStatus(statusKey) {
    const index = this.statuses.findIndex((status) => status.key === statusKey);

    if (index === -1) {
      return false;
    }

    this.statuses.splice(index, 1);
    return true;
  }

  tickStatusDurations() {
    for (let index = this.statuses.length - 1; index >= 0; index--) {
      const status = this.statuses[index];

      if (
        !Number.isInteger(status.turnsRemaining) ||
        status.turnsRemaining <= 0
      ) {
        continue;
      }

      status.turnsRemaining--;

      if (status.turnsRemaining === 0) {
        const definition = DatabaseManager.statuses.find(
          (entry) => entry?.key === status.key,
        );

        if (definition?.duration?.type === "turns") {
          this.statuses.splice(index, 1);
        } else if (definition?.duration?.type === "countdown") {
          this.resolveStatusExpiration(status.key);
          this.statuses.splice(index, 1);
        }
      }
    }
  }

  resolveStatusExpiration(statusKey) {
    const definition = DatabaseManager.statuses.find(
      (status) => status?.key === statusKey,
    );

    if (!definition) {
      return false;
    }

    const onExpire = definition.effects?.onExpire;

    if (!onExpire) {
      return false;
    }

    if (onExpire.applyStatus) {
      return this.addStatus(onExpire.applyStatus);
    }

    return false;
  }

  // =====================================
  // Core Combat Stats
  // =====================================

  startDefending() {
    this.defending = true;
  }

  stopDefending() {
    this.defending = false;
  }

  isDefending() {
    return this.defending;
  }

  totalAttack() {
    return this.attack + this.strength;
  }

  attackPercentWithWeapon(weapon) {
    const weaponAttackPercent = weapon ? weapon.attackPercent || 0 : 0;

    return this.attackPercent + weaponAttackPercent;
  }

  totalAttackPercent() {
    return this.attackPercentWithWeapon(this.weapon());
  }

  totalDefense() {
    return this.defense + this.vitality;
  }

  totalMagicAttack() {
    return this.magicAttack + this.magic;
  }

  totalMagicDefense() {
    return this.magicDefense + this.spirit;
  }

  totalDefensePercent() {
    return this.defensePercent;
  }

  totalMagicDefensePercent() {
    return this.magicDefensePercent;
  }

  elementRate(element) {
    if (!element) {
      return 1;
    }

    const rate = Number(this.elementRates[element]);

    if (!Number.isFinite(rate)) {
      return 1;
    }

    return Math.max(0, rate);
  }

  // =====================================
  // HP Management
  // =====================================

  gainHp(amount) {
    const value = this._validAmount(amount);
    this.hp = Math.min(this.hp + value, this.maxHp);

    DebugManager.log(`${this.name} recovered ${value} HP.`);

    return value;
  }

  loseHp(amount) {
    const value = this._validAmount(amount);
    this.hp = Math.max(this.hp - value, 0);

    DebugManager.log(`${this.name} lost ${value} HP.`);

    return value;
  }

  recoverAllHp() {
    this.hp = this.maxHp;

    DebugManager.log(`${this.name}'s HP was fully restored.`);
  }

  isDead() {
    return this.hp <= 0;
  }

  isAlive() {
    return !this.isDead();
  }

  isFullHp() {
    return this.hp >= this.maxHp;
  }

  hpRate() {
    if (this.maxHp <= 0) {
      return 0;
    }

    return this.hp / this.maxHp;
  }

  // =====================================
  // MP Management
  // =====================================

  gainMp(amount) {
    const value = this._validAmount(amount);
    this.mp = Math.min(this.mp + value, this.maxMp);

    DebugManager.log(`${this.name} recovered ${value} MP.`);

    return value;
  }

  loseMp(amount) {
    const value = this._validAmount(amount);
    this.mp = Math.max(this.mp - value, 0);

    DebugManager.log(`${this.name} lost ${value} MP.`);

    return value;
  }

  canPayMpCost(cost) {
    const value = this._validAmount(cost);
    return this.mp >= value;
  }

  payMpCost(cost) {
    const value = this._validAmount(cost);

    if (!this.canPayMpCost(value)) {
      return false;
    }

    this.mp -= value;

    DebugManager.log(`${this.name} used ${value} MP.`);

    return true;
  }

  recoverAllMp() {
    this.mp = this.maxMp;

    DebugManager.log(`${this.name}'s MP was fully restored.`);
  }

  isFullMp() {
    return this.mp >= this.maxMp;
  }

  mpRate() {
    if (this.maxMp <= 0) {
      return 0;
    }

    return this.mp / this.maxMp;
  }

  // =====================================
  // Internal Helpers
  // =====================================

  _validAmount(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value) || value < 0) {
      return 0;
    }

    return value;
  }
}
