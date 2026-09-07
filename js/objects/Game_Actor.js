"use strict";

class Game_Actor {
  constructor(actorId = 1) {
    this.actorId = actorId;

    const actorData = DatabaseManager.actor(actorId);

    if (!actorData) {
      throw new Error(`Actor ID ${actorId} does not exist.`);
    }

    this.name = actorData.name;
    this.level = actorData.level;
    this.exp = actorData.exp;

    this.maxHp = actorData.maxHp;
    this.attack = actorData.attack;
    this.defense = actorData.defense;
    this.growth = actorData.growth;

    this.weaponId = 0;
    this.armorId = 0;

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

  gainExp(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      console.error(`Invalid EXP amount: ${amount}`);

      return 0;
    }

    this.exp += value;

    console.log(`${this.name} gained ${value} EXP.`);

    const oldLevel = this.level;

    this.checkLevelUp();

    return this.level - oldLevel;
  }

  expForNextLevel() {
    return this.level * 100;
  }

  checkLevelUp() {
    while (this.exp >= this.expForNextLevel()) {
      const requiredExp = this.expForNextLevel();

      this.exp -= requiredExp;

      this.levelUp();
    }
  }

  levelUp() {
    this.level++;

    this.maxHp += this.growth.maxHp;
    this.attack += this.growth.attack;
    this.defense += this.growth.defense;

    this.hp = this.maxHp;

    console.log(`${this.name} reached Level ${this.level}!`);

    console.log(`Max HP: ${this.maxHp}`);
    console.log(`Attack: ${this.attack}`);
    console.log(`Defense: ${this.defense}`);
  }

  weapon() {
    if (this.weaponId <= 0) {
      return null;
    }

    return DatabaseManager.weapon(this.weaponId);
  }

  equipWeapon(weaponId) {
    const weapon = DatabaseManager.weapon(weaponId);

    if (!weapon) {
      console.error(`Weapon ID ${weaponId} does not exist.`);

      return false;
    }

    this.weaponId = weaponId;

    console.log(`${this.name} equipped ${weapon.name}.`);

    return true;
  }

  totalAttack() {
    let value = this.attack;

    const weapon = this.weapon();

    if (weapon) {
      value += Number(weapon.attack || 0);
    }

    return value;
  }

  armor() {
    if (this.armorId <= 0) {
      return null;
    }

    return DatabaseManager.armor(this.armorId);
  }

  equipArmor(armorId) {
    const armor = DatabaseManager.armor(armorId);

    if (!armor) {
      console.error(`Armor ID ${armorId} does not exist.`);

      return false;
    }

    this.armorId = armorId;

    console.log(`${this.name} equipped ${armor.name}.`);

    return true;
  }

  totalDefense() {
    let value = this.defense;

    const armor = this.armor();

    if (armor) {
      value += Number(armor.defense || 0);
    }

    return value;
  }
}
