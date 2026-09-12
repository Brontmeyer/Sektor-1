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

    this.defending = false;
  }

  // =====================================
  // CORE COMBAT STATS
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

  totalDefense() {
    return this.defense + this.vitality;
  }

  totalMagicAttack() {
    return this.magicAttack + this.magic;
  }

  totalMagicDefense() {
    return this.magicDefense + this.spirit;
  }

  totalAttackPercent() {
    return this.attackPercent;
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
  // HP MANAGEMENT
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
  // MP MANAGEMENT
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
  // INTERNAL HELPERS
  // =====================================

  _validAmount(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value) || value < 0) {
      return 0;
    }

    return value;
  }
}
