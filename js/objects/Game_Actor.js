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
    this.maxMp = actorData.maxMp;

    this.strength = actorData.strength;
    this.vitality = actorData.vitality;
    this.dexterity = actorData.dexterity;
    this.agility = actorData.agility;
    this.magic = actorData.magic;
    this.spirit = actorData.spirit;
    this.luck = actorData.luck;

    this.attack = actorData.attack;
    this.attackPercent = actorData.attackPercent;

    this.defense = actorData.defense;
    this.defensePercent = actorData.defensePercent;

    this.magicAttack = actorData.magicAttack;
    this.magicDefense = actorData.magicDefense;
    this.magicDefensePercent = actorData.magicDefensePercent;

    this.growth = actorData.growth;

    this.weaponId = 0;
    this.armorId = 0;

    this.skills = [];

    this.hp = this.maxHp;
    this.mp = this.maxMp;
  }

  // =====================================
  // EQUIPMENT MANAGEMENT
  // =====================================

  weapon() {
    if (this.weaponId <= 0) {
      return null;
    }
    return DatabaseManager.weapon(this.weaponId);
  }

  armor() {
    if (this.armorId <= 0) {
      return null;
    }

    return DatabaseManager.armor(this.armorId);
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

  // =====================================
  // SKILL MANAGEMENT
  // =====================================

  learnSkill(skillId) {
    if (!DatabaseManager.skill(skillId)) {
      console.warn(`Cannot learn skill ${skillId}: skill does not exist.`);
      return false;
    }

    if (this.knowsSkill(skillId)) {
      return false;
    }

    this.skills.push(skillId);

    console.log(`${this.name} learned ${DatabaseManager.skillName(skillId)}.`);

    return true;
  }

  forgetSkill(skillId) {
    const index = this.skills.indexOf(skillId);

    if (index === -1) {
      return false;
    }

    this.skills.splice(index, 1);

    console.log(`${this.name} forgot ${DatabaseManager.skillName(skillId)}.`);

    return true;
  }

  knowsSkill(skillId) {
    return this.skills.includes(skillId);
  }

  knownSkills() {
    return this.skills
      .map((skillId) => DatabaseManager.skill(skillId))
      .filter((skill) => skill !== null);
  }

  canUseSkill(skillId) {
    const skill = DatabaseManager.skill(skillId);

    if (!skill) {
      return false;
    }

    if (!this.knowsSkill(skillId)) {
      return false;
    }

    const mpCost = skill.mpCost || 0;

    if (!this.canPayMpCost(mpCost)) {
      return false;
    }

    return true;
  }

  useSkill(skillId, target = this) {
    const skill = DatabaseManager.skill(skillId);

    if (!skill) {
      console.warn(`Cannot use skill ${skillId}: skill does not exist.`);

      return false;
    }

    if (!this.canUseSkill(skillId)) {
      console.warn(`${this.name} cannot use ${skill.name}.`);

      return false;
    }

    if (!this.isValidSkillTarget(skill, target)) {
      console.warn(
        `${target?.name || "Target"} is not a valid target for ${skill.name}.`,
      );

      return false;
    }

    if (skill.effect === "heal") {
      if (typeof target.isFullHp === "function" && target.isFullHp()) {
        console.log(`${target.name} is already at full HP.`);

        return false;
      }

      const healAmount = this.magicHealing(skill);
      const paid = this.payMpCost(skill.mpCost || 0);

      if (!paid) {
        return false;
      }

      target.gainHp(healAmount);

      console.log(`${this.name} used ${skill.name} on ${target.name}.`);

      return true;
    }

    if (skill.effect === "damage") {
      if (!target || typeof target.loseHp !== "function") {
        console.warn(`${skill.name} has no valid damage target.`);

        return false;
      }

      const damage = this.magicDamage(skill, target);

      const paid = this.payMpCost(skill.mpCost || 0);

      if (!paid) {
        return false;
      }

      target.loseHp(damage);

      console.log(
        `${this.name} used ${skill.name} on ${target.name} for ${damage} damage.`,
      );

      return true;
    }

    console.warn(
      `${skill.name} effect "${skill.effect}" is not implemented yet.`,
    );
    return false;
  }

  magicHealing(skill) {
    if (!skill) {
      return 0;
    }

    const power = skill.power || 0;
    const level = this.level || 1;
    const magicAttack = this.totalMagicAttack();

    return power + level + magicAttack;
  }

  magicDamage(skill, target) {
    if (!skill) {
      return 0;
    }

    if (!target) {
      return 0;
    }

    const power = skill.power || 0;
    const level = this.level || 1;
    const magicAttack = this.totalMagicAttack();

    let magicDefense = 0;

    if (typeof target.totalMagicDefense === "function") {
      magicDefense = target.totalMagicDefense();
    } else if (typeof target.magicDefense === "number") {
      magicDefense = target.magicDefense;
    }

    const rawDamage = power + level + magicAttack - magicDefense;

    return Math.max(1, Math.floor(rawDamage));
  }

  isValidSkillTarget(skill, target) {
    if (!skill || !target) {
      return false;
    }

    const allowedTargets = Array.isArray(skill.target) ? skill.target : [];

    if (allowedTargets.length === 0) {
      return true;
    }

    if (allowedTargets.includes("self") && target === this) {
      return true;
    }

    if (allowedTargets.includes("ally") && target instanceof Game_Actor) {
      return true;
    }

    if (allowedTargets.includes("enemy") && target instanceof Game_Enemy) {
      return true;
    }

    return false;
  }

  // =====================================
  // HP MANAGEMENT
  // =====================================

  gainHp(amount) {
    this.hp += amount;

    this.hp = Math.min(this.hp, this.maxHp);

    console.log(`${this.name} recovered ${amount} HP.`);
  }

  loseHp(amount) {
    this.hp -= amount;

    this.hp = Math.max(this.hp, 0);

    console.log(`${this.name} lost ${amount} HP.`);
  }

  isDead() {
    return this.hp <= 0;
  }

  recoverAllHp() {
    this.hp = this.maxHp;

    console.log(`${this.name}'s HP was fully restored.`);
  }

  isFullHp() {
    return this.hp >= this.maxHp;
  }

  // =====================================
  // MP MANAGEMENT
  // =====================================

  gainMp(amount) {
    this.mp += amount;

    this.mp = Math.min(this.mp, this.maxMp);

    console.log(`${this.name} recovered ${amount} MP.`);
  }

  loseMp(amount) {
    this.mp -= amount;

    this.mp = Math.max(this.mp, 0);

    console.log(`${this.name} lost ${amount} MP.`);
  }

  canPayMpCost(cost) {
    return this.mp >= cost;
  }

  payMpCost(cost) {
    if (!this.canPayMpCost(cost)) {
      return false;
    }

    this.mp -= cost;

    console.log(`${this.name} used ${cost} MP.`);

    return true;
  }

  recoverAllMp() {
    this.mp = this.maxMp;

    console.log(`${this.name}'s MP was fully restored.`);
  }

  isFullMp() {
    return this.mp >= this.maxMp;
  }

  // =====================================
  // EXPERIENCE AND LEVEL MANAGEMENT
  // =====================================

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
    this.maxMp += this.growth.maxMp;

    this.strength += this.growth.strength;
    this.vitality += this.growth.vitality;
    this.dexterity += this.growth.dexterity;
    this.agility += this.growth.agility;
    this.magic += this.growth.magic;
    this.spirit += this.growth.spirit;
    this.luck += this.growth.luck;

    this.attack += this.growth.attack;
    this.defense += this.growth.defense;

    this.magicAttack += this.growth.magicAttack;
    this.magicDefense += this.growth.magicDefense;

    this.hp = this.maxHp;
    this.mp = this.maxMp;

    console.log(`${this.name} reached Level ${this.level}!`);

    console.log(`Max HP: ${this.maxHp}`);
    console.log(`Max MP: ${this.maxMp}`);

    console.log(`Strength: ${this.strength}`);
    console.log(`Vitality: ${this.vitality}`);
    console.log(`Dexterity: ${this.dexterity}`);
    console.log(`Agility: ${this.agility}`);
    console.log(`Magic: ${this.magic}`);
    console.log(`Spirit: ${this.spirit}`);
    console.log(`Luck: ${this.luck}`);

    console.log(`Attack: ${this.attack}`);
    console.log(`Defense: ${this.defense}`);

    console.log(`Magic Attack: ${this.magicAttack}`);
    console.log(`Magic Defense: ${this.magicDefense}`);
  }

  // =====================================
  // COMBAT STAT CALCULATIONS
  // =====================================

  attackWithWeapon(weapon) {
    const weaponAttack = weapon ? weapon.attack || 0 : 0;

    return this.attack + this.strength + weaponAttack;
  }

  totalAttack() {
    return this.attackWithWeapon(this.weapon());
  }

  defenseWithArmor(armor) {
    const armorDefense = armor ? armor.defense || 0 : 0;

    return this.defense + this.vitality + armorDefense;
  }

  totalDefense() {
    return this.defenseWithArmor(this.armor());
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
}
