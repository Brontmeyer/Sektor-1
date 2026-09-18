"use strict";

class Game_Actor extends Game_Battler {
  constructor(actorId = 1) {
    const actorData = DatabaseManager.actor(actorId);

    if (!actorData) {
      throw new Error(`Actor ID ${actorId} does not exist.`);
    }

    super(actorData);

    this.actorId = actorId;
    this.sideBattleSprite = actorData.sideBattleSprite || null;
    this.battleSpriteWidth = actorData.battleSpriteWidth || 96;
    this.battleSpriteHeight = actorData.battleSpriteHeight || 128;
    this.battleSpriteFrames = actorData.battleSpriteFrames || 1;
    this.battleSpriteRows = actorData.battleSpriteRows || 1;

    this.exp = actorData.exp;
    this.growth = actorData.growth;

    this.weaponId = 0;
    this.armorId = 0;

    this.skills = [];
  }

  // =====================================
  // Equipment Management
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

    DebugManager.log(`${this.name} equipped ${weapon.name}.`);

    return true;
  }

  equipArmor(armorId) {
    const armor = DatabaseManager.armor(armorId);

    if (!armor) {
      console.error(`Armor ID ${armorId} does not exist.`);

      return false;
    }
    this.armorId = armorId;

    DebugManager.log(`${this.name} equipped ${armor.name}.`);

    return true;
  }

  // =====================================
  // Skill Management
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

    DebugManager.log(
      `${this.name} learned ${DatabaseManager.skillName(skillId)}.`,
    );

    return true;
  }

  forgetSkill(skillId) {
    const index = this.skills.indexOf(skillId);

    if (index === -1) {
      return false;
    }

    this.skills.splice(index, 1);

    DebugManager.log(
      `${this.name} forgot ${DatabaseManager.skillName(skillId)}.`,
    );

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

    if (!this.canUseSkillDefinition(skill)) {
      return false;
    }

    const mpCost = skill.mpCost || 0;

    if (!this.canPayMpCost(mpCost)) {
      return false;
    }

    return true;
  }

  skillStatusChance(skill, target, baseChance) {
    const fallbackChance = Number(baseChance);
    let chance = Number.isFinite(fallbackChance) ? fallbackChance : 0;

    if (
      target instanceof Game_Actor &&
      Number.isFinite(Number(skill?.allyStatusChance))
    ) {
      chance = Number(skill.allyStatusChance);
    }

    return Math.max(0, Math.min(1, chance));
  }

  resolveSkillStatusEffects(skill, target, random = Math.random) {
    const statusPayload = skill?.status;

    if (
      !target ||
      !statusPayload ||
      typeof statusPayload !== "object" ||
      Array.isArray(statusPayload)
    ) {
      return [];
    }

    const results = [];

    for (const [statusKey, baseChance] of Object.entries(statusPayload)) {
      const chance = this.skillStatusChance(skill, target, baseChance);
      const definition =
        typeof target.statusDefinition === "function"
          ? target.statusDefinition(statusKey)
          : null;
      const statusName = definition?.name || statusKey;

      if (typeof target.statusDefinition === "function" && !definition) {
        results.push({
          key: statusKey,
          name: statusName,
          applied: false,
          refreshed: false,
          removed: false,
          reason: "unknownStatus",
          chance: 0,
        });
        continue;
      }

      if (skill.effect === "removeStatus") {
        const roll = typeof random === "function" ? random() : Math.random();

        if (chance <= 0 || roll >= chance) {
          results.push({
            key: statusKey,
            name: statusName,
            applied: false,
            refreshed: false,
            removed: false,
            reason: "missed",
            chance,
          });
          continue;
        }

        const removed =
          typeof target.removeStatus === "function"
            ? target.removeStatus(statusKey)
            : false;

        results.push({
          key: statusKey,
          name: statusName,
          applied: false,
          refreshed: false,
          removed,
          reason: removed ? "removed" : "unchanged",
          chance,
        });
        continue;
      }

      if (
        skill.toggleStatus === true &&
        typeof target.hasStatus === "function" &&
        target.hasStatus(statusKey)
      ) {
        const roll = typeof random === "function" ? random() : Math.random();

        if (chance <= 0 || roll >= chance) {
          results.push({
            key: statusKey,
            name: statusName,
            applied: false,
            refreshed: false,
            removed: false,
            reason: "missed",
            chance,
          });
          continue;
        }

        const removed =
          typeof target.removeStatus === "function"
            ? target.removeStatus(statusKey)
            : false;

        results.push({
          key: statusKey,
          name: statusName,
          applied: false,
          refreshed: false,
          removed,
          reason: removed ? "removed" : "unchanged",
          chance,
        });
        continue;
      }

      if (typeof target.tryAddStatus !== "function") {
        results.push({
          key: statusKey,
          name: statusName,
          applied: false,
          refreshed: false,
          removed: false,
          reason: "unsupportedTarget",
          chance: 0,
        });
        continue;
      }

      const application = target.tryAddStatus(statusKey, chance, random);

      results.push({
        key: statusKey,
        name: statusName,
        removed: false,
        ...application,
      });
    }

    return results;
  }

  skillStatusResults() {
    return Array.isArray(this._lastSkillStatusResults)
      ? this._lastSkillStatusResults.map((result) => ({ ...result }))
      : [];
  }

  useSkill(
    skillId,
    target = this,
    payCost = true,
    scope = "single",
    random = Math.random,
    options = {},
  ) {
    const skill = DatabaseManager.skill(skillId);

    this._lastSkillStatusResults = [];

    if (!skill) {
      console.warn(`Cannot use skill ${skillId}: skill does not exist.`);

      return false;
    }

    if (payCost && !this.canUseSkill(skillId)) {
      console.warn(`${this.name} cannot use ${skill.name}.`);

      return false;
    }

    const reflected = options?.reflected === true;

    if (!reflected && !this.isValidSkillTarget(skill, target)) {
      console.warn(
        `${target?.name || "Target"} is not a valid target for ${skill.name}.`,
      );

      return false;
    }

    const paySkillCost = () => {
      if (!payCost) {
        return true;
      }

      return this.payMpCost(skill.mpCost || 0);
    };

    // HEALING EFFECT
    if (skill.effect === "heal") {
      if (
        !reflected &&
        typeof target.isFullHp === "function" &&
        target.isFullHp()
      ) {
        DebugManager.log(`${target.name} is already at full HP.`);

        return false;
      }

      const healAmount = this.magicHealing(skill, scope);

      if (!paySkillCost()) {
        return false;
      }

      target.gainHp(healAmount);
      this._lastSkillStatusResults = this.resolveSkillStatusEffects(
        skill,
        target,
        random,
      );

      DebugManager.log(`${this.name} used ${skill.name} on ${target.name}.`);

      return true;
    }

    // DAMAGE EFFECT
    if (skill.effect === "damage") {
      if (!target || typeof target.loseHp !== "function") {
        console.warn(`${skill.name} has no valid damage target.`);

        return false;
      }

      const damage = this.magicDamage(skill, target, scope);

      if (!paySkillCost()) {
        return false;
      }

      const damageResult =
        typeof target.receiveDamage === "function"
          ? target.receiveDamage(damage, {
              category: "magical",
              element: skill.element,
            })
          : null;

      if (!damageResult) {
        target.loseHp(damage);
      }

      this._lastSkillStatusResults = this.resolveSkillStatusEffects(
        skill,
        target,
        random,
      );

      const resolvedDamage = damageResult?.damage ?? damage;
      const resolvedHealing = damageResult?.healing ?? 0;

      if (damageResult?.absorbed) {
        DebugManager.log(
          `${this.name} used ${skill.name} on ${target.name}; ` +
            `${target.name} absorbed it for ${resolvedHealing} HP.`,
        );
      } else {
        DebugManager.log(
          `${this.name} used ${skill.name} on ${target.name} for ${resolvedDamage} damage.`,
        );
      }

      return true;
    }

    // STATUS APPLICATION / REMOVAL EFFECTS
    if (skill.effect === "inflictStatus" || skill.effect === "removeStatus") {
      if (!paySkillCost()) {
        return false;
      }

      this._lastSkillStatusResults = this.resolveSkillStatusEffects(
        skill,
        target,
        random,
      );

      DebugManager.log(`${this.name} used ${skill.name} on ${target.name}.`);

      return true;
    }

    console.warn(
      `${skill.name} effect "${skill.effect}" is not implemented yet.`,
    );
    return false;
  }

  skillScopeMultiplier(skill, scope = "single") {
    if (!skill?.scopePower) {
      return 1;
    }

    const multiplier = Number(skill.scopePower[scope]);

    return Number.isFinite(multiplier) ? multiplier : 1;
  }

  magicHealing(skill, scope = "single") {
    if (!skill) {
      return 0;
    }

    const power = skill.power || 0;
    const level = this.level || 1;
    const magicAttack = this.totalMagicAttack();

    // FF7 restorative magic formula:
    // (Spell Power × 22) + [(Level + Magic Attack) × 6]
    const rawHealing = power * 22 + (level + magicAttack) * 6;

    const scopeMultiplier = this.skillScopeMultiplier(skill, scope);

    return Math.max(1, Math.floor(rawHealing * scopeMultiplier));
  }

  magicDamage(skill, target, scope = "single") {
    if (!skill || !target) {
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

    // CALCULATE MAGICAL DAMAGE BASED ON FF7 FORMULA
    // 6 × (Magic Attack + Level)
    const baseDamage = 6 * (magicAttack + level);

    // ABILITY POWER AND MAGIC DEFENSE BASED ON FF7 FORMULA
    const defenseMultiplier = Math.max(0, 512 - magicDefense) / 512;

    const rawDamage = (power / 16) * baseDamage * defenseMultiplier;

    const elementMultiplier =
      typeof target.elementRate === "function"
        ? target.elementRate(skill.element)
        : 1;

    const scopeMultiplier = this.skillScopeMultiplier(skill, scope);

    return Math.max(
      0,
      Math.floor(rawDamage * elementMultiplier * scopeMultiplier),
    );
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
  // Experience and Level Management
  // =====================================

  gainExp(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      console.error(`Invalid EXP amount: ${amount}`);

      return 0;
    }

    this.exp += value;
    DebugManager.log(`${this.name} gained ${value} EXP.`);
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

    DebugManager.log(`${this.name} reached Level ${this.level}!`);

    DebugManager.log(`Max HP: ${this.maxHp}`);
    DebugManager.log(`Max MP: ${this.maxMp}`);

    DebugManager.log(`Strength: ${this.strength}`);
    DebugManager.log(`Vitality: ${this.vitality}`);
    DebugManager.log(`Dexterity: ${this.dexterity}`);
    DebugManager.log(`Agility: ${this.agility}`);
    DebugManager.log(`Magic: ${this.magic}`);
    DebugManager.log(`Spirit: ${this.spirit}`);
    DebugManager.log(`Luck: ${this.luck}`);

    DebugManager.log(`Attack: ${this.attack}`);
    DebugManager.log(`Defense: ${this.defense}`);

    DebugManager.log(`Magic Attack: ${this.magicAttack}`);
    DebugManager.log(`Magic Defense: ${this.magicDefense}`);
  }

  // =====================================
  // Combat Stat Calculations
  // =====================================

  attackWithWeapon(weapon) {
    const weaponAttack = weapon ? weapon.attack || 0 : 0;

    return this.attack + this.strength + weaponAttack;
  }

  totalAttack() {
    return this.attackWithWeapon(this.weapon());
  }

  attackPercentWithWeapon(weapon) {
    const weaponAttackPercent = weapon ? (weapon.attackPercent ?? 100) : 100;

    return (this.attackPercent * weaponAttackPercent) / 100;
  }

  totalAttackPercent() {
    return this.attackPercentWithWeapon(this.weapon());
  }

  defenseWithArmor(armor) {
    const armorDefense = armor ? armor.defense || 0 : 0;

    return this.defense + this.vitality + armorDefense;
  }

  totalDefense() {
    return this.defenseWithArmor(this.armor());
  }

  // =====================================
  // Magic Attack Calculations
  // =====================================

  magicAttackWithWeapon(weapon) {
    const weaponMagicAttack = weapon ? weapon.magicAttack || 0 : 0;

    return this.magicAttack + this.magic + weaponMagicAttack;
  }

  totalMagicAttack() {
    return this.magicAttackWithWeapon(this.weapon());
  }

  criticalWithWeapon(weapon) {
    const weaponCritical = weapon ? weapon.criticalBonus || 0 : 0;

    return weaponCritical;
  }

  totalCritical() {
    return this.criticalWithWeapon(this.weapon());
  }
}
