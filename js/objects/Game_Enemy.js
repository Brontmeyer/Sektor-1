"use strict";

class Game_Enemy {
  constructor(enemyId) {
    const enemyData = DatabaseManager.enemy(enemyId);

    if (!enemyData) {
      throw new Error(`Enemy ${enemyId} does not exist.`);
    }

    this.enemyId = enemyId;
    this.name = enemyData.name;
    this.level = enemyData.level;

    this.maxHp = enemyData.maxHp;
    this.maxMp = enemyData.maxMp;

    this.hp = this.maxHp;
    this.mp = this.maxMp;

    this.strength = enemyData.strength;
    this.vitality = enemyData.vitality;
    this.dexterity = enemyData.dexterity;
    this.agility = enemyData.agility;
    this.magic = enemyData.magic;
    this.spirit = enemyData.spirit;
    this.luck = enemyData.luck;

    this.attack = enemyData.attack;
    this.attackPercent = enemyData.attackPercent;

    this.defense = enemyData.defense;
    this.defensePercent = enemyData.defensePercent;

    this.magicAttack = enemyData.magicAttack;
    this.magicDefense = enemyData.magicDefense;

    this.magicDefensePercent = enemyData.magicDefensePercent;
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

  gainHp(amount) {
    this.hp += amount;

    this.hp = Math.min(this.hp, this.maxHp);
  }

  loseHp(amount) {
    this.hp -= amount;

    this.hp = Math.max(this.hp, 0);

    console.log(`${this.name} lost ${amount} HP.`);
  }

  isDead() {
    return this.hp <= 0;
  }

  isFullHp() {
    return this.hp >= this.maxHp;
  }
}
