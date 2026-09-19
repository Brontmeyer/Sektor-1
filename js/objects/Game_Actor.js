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

    this.magickIds = Array.isArray(actorData.initialMagickIds)
      ? [...actorData.initialMagickIds]
      : [];

    // Runtime Essence equipment state. Player-facing slot rules / UI remain
    // part of the future Essence Runtime milestone.
    this._equippedEssences = [];
  }

  // =====================================
  // Essence Equipment / Progression
  // =====================================

  equippedEssences() {
    return [...this._equippedEssences];
  }

  equippedEssence(essenceId) {
    const id = Number(essenceId);
    return this._equippedEssences.find((essence) => essence.essenceId === id) || null;
  }

  equipEssence(essenceId, resonance = 0) {
    const id = Number(essenceId);

    if (!Number.isInteger(id) || id <= 0 || !DatabaseManager.essence(id)) {
      return false;
    }

    if (this.equippedEssence(id)) {
      return false;
    }

    this._equippedEssences.push(new Game_Essence(id, resonance));
    return true;
  }

  unequipEssence(essenceId) {
    const id = Number(essenceId);
    const index = this._equippedEssences.findIndex(
      (essence) => essence.essenceId === id,
    );

    if (index < 0) {
      return false;
    }

    this._equippedEssences.splice(index, 1);
    return true;
  }

  equippedEssenceStates() {
    return this._equippedEssences.map((essence) => ({
      essenceId: essence.essenceId,
      resonance: essence.resonance,
    }));
  }

  restoreEquippedEssenceStates(states) {
    this._equippedEssences = [];

    if (!Array.isArray(states)) {
      return;
    }

    for (const state of states) {
      this.equipEssence(state?.essenceId, state?.resonance ?? 0);
    }
  }

  gainEquippedEssenceResonance(amount) {
    const results = [];

    for (const essence of this._equippedEssences) {
      const progression = essence.addResonance(amount);

      if (!progression) {
        continue;
      }

      results.push({
        essenceId: essence.essenceId,
        name: essence.name(),
        ...progression,
        awakenedMagickIds: progression.awakenedMagick.map((magick) => magick.id),
      });
    }

    return results;
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

  unequipWeapon() {
    const weapon = this.weapon();

    if (!weapon) {
      return false;
    }

    this.weaponId = 0;
    DebugManager.log(`${this.name} unequipped ${weapon.name}.`);
    return true;
  }

  unequipArmor() {
    const armor = this.armor();

    if (!armor) {
      return false;
    }

    this.armorId = 0;
    DebugManager.log(`${this.name} unequipped ${armor.name}.`);
    return true;
  }

  // =====================================
  // Magick Management
  // =====================================

  learnMagick(magickId) {
    if (!DatabaseManager.magick(magickId)) {
      console.warn(`Cannot learn magick ${magickId}: magick does not exist.`);
      return false;
    }

    if (this.knowsMagick(magickId)) {
      return false;
    }

    this.magickIds.push(magickId);

    DebugManager.log(
      `${this.name} learned ${DatabaseManager.magickName(magickId)}.`,
    );

    return true;
  }

  forgetMagick(magickId) {
    const index = this.magickIds.indexOf(magickId);

    if (index === -1) {
      return false;
    }

    this.magickIds.splice(index, 1);

    DebugManager.log(
      `${this.name} forgot ${DatabaseManager.magickName(magickId)}.`,
    );

    return true;
  }

  knowsMagick(magickId) {
    return this.magickIds.includes(magickId);
  }

  knownMagick() {
    return this.magickIds
      .map((magickId) => DatabaseManager.magick(magickId))
      .filter((magick) => magick !== null);
  }

  canUseMagick(magickId) {
    const magick = DatabaseManager.magick(magickId);

    if (!magick) {
      return false;
    }

    if (!this.knowsMagick(magickId)) {
      return false;
    }

    if (!this.canUseMagickDefinition(magick)) {
      return false;
    }

    const mpCost = magick.mpCost || 0;

    if (!this.canPayMpCost(mpCost)) {
      return false;
    }

    return true;
  }

  magickStatusChance(magick, target, baseChance) {
    const fallbackChance = Number(baseChance);
    let chance = Number.isFinite(fallbackChance) ? fallbackChance : 0;

    if (
      target instanceof Game_Actor &&
      Number.isFinite(Number(magick?.allyStatusChance))
    ) {
      chance = Number(magick.allyStatusChance);
    }

    return Math.max(0, Math.min(1, chance));
  }

  resolveMagickStatusEffects(magick, target, random = Math.random) {
    const statusPayload = magick?.status;

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
      const chance = this.magickStatusChance(magick, target, baseChance);
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

      if (magick.effect === "removeStatus") {
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
        magick.toggleStatus === true &&
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

  magickStatusResults() {
    return Array.isArray(this._lastMagickStatusResults)
      ? this._lastMagickStatusResults.map((result) => ({ ...result }))
      : [];
  }

  useMagick(
    magickId,
    target = this,
    payCost = true,
    scope = "single",
    random = Math.random,
    options = {},
  ) {
    const magick = DatabaseManager.magick(magickId);

    this._lastMagickStatusResults = [];

    if (!magick) {
      console.warn(`Cannot use magick ${magickId}: magick does not exist.`);

      return false;
    }

    if (payCost && !this.canUseMagick(magickId)) {
      console.warn(`${this.name} cannot use ${magick.name}.`);

      return false;
    }

    const reflected = options?.reflected === true;

    if (!reflected && !this.isValidMagickTarget(magick, target)) {
      console.warn(
        `${target?.name || "Target"} is not a valid target for ${magick.name}.`,
      );

      return false;
    }

    const payMagickCost = () => {
      if (!payCost) {
        return true;
      }

      return this.payMpCost(magick.mpCost || 0);
    };

    // BATTLE-LEVEL ESCAPE EFFECT
    // The actor owns magick legality and MP payment. BattleManager owns the
    // actual battle outcome so this branch intentionally performs no scene
    // transition itself.
    if (magick.effect === "escape") {
      if (!payMagickCost()) {
        return false;
      }

      DebugManager.log(`${this.name} used ${magick.name}.`);
      return true;
    }

    // BANISH EFFECT
    // Banish is enemy-owned state because later reward systems need to know
    // that this defeat came from banishment (for example, no currency reward)
    // without re-parsing the magick that caused it.
    if (magick.effect === "banish") {
      if (!target || typeof target.banish !== "function") {
        console.warn(`${magick.name} has no valid banish target.`);
        return false;
      }

      if (!payMagickCost()) {
        return false;
      }

      const banishment = target.banish();

      if (!banishment?.success) {
        return false;
      }

      this._lastMagickStatusResults = this.resolveMagickStatusEffects(
        magick,
        target,
        random,
      );

      DebugManager.log(`${this.name} used ${magick.name} on ${target.name}.`);
      return true;
    }

    // REVIVAL EFFECT
    if (magick.effect === "revive") {
      if (!target || typeof target.canBeRevived !== "function") {
        console.warn(`${magick.name} has no valid revival target.`);
        return false;
      }

      if (!target.canBeRevived()) {
        DebugManager.log(`${target.name} cannot be revived by ${magick.name}.`);
        return false;
      }

      const revivePercent = Number(magick.revivePercent);

      if (
        !Number.isFinite(revivePercent) ||
        revivePercent <= 0 ||
        revivePercent > 1
      ) {
        console.warn(`${magick.name} has an invalid revivePercent.`);
        return false;
      }

      if (!payMagickCost()) {
        return false;
      }

      const revival = target.revive(revivePercent);

      if (!revival?.success) {
        return false;
      }

      this._lastMagickStatusResults = this.resolveMagickStatusEffects(
        magick,
        target,
        random,
      );

      DebugManager.log(
        `${this.name} used ${magick.name} on ${target.name}; ` +
          `${target.name} revived with ${target.hp} HP.`,
      );

      return true;
    }

    // HEALING EFFECT
    if (magick.effect === "heal") {
      if (
        !reflected &&
        typeof target.isFullHp === "function" &&
        target.isFullHp()
      ) {
        DebugManager.log(`${target.name} is already at full HP.`);

        return false;
      }

      const healAmount = this.magickHealing(magick, scope, target);

      if (!payMagickCost()) {
        return false;
      }

      target.gainHp(healAmount);
      this._lastMagickStatusResults = this.resolveMagickStatusEffects(
        magick,
        target,
        random,
      );

      DebugManager.log(`${this.name} used ${magick.name} on ${target.name}.`);

      return true;
    }

    // DAMAGE EFFECT
    if (magick.effect === "damage") {
      if (!target || typeof target.loseHp !== "function") {
        console.warn(`${magick.name} has no valid damage target.`);

        return false;
      }

      const damage = this.magickDamage(magick, target, scope);

      if (!payMagickCost()) {
        return false;
      }

      const damageResult =
        typeof target.receiveDamage === "function"
          ? target.receiveDamage(damage, {
              category: "magical",
              element: magick.element,
            })
          : null;

      if (!damageResult) {
        target.loseHp(damage);
      }

      this._lastMagickStatusResults = this.resolveMagickStatusEffects(
        magick,
        target,
        random,
      );

      const resolvedDamage = damageResult?.damage ?? damage;
      const resolvedHealing = damageResult?.healing ?? 0;

      if (damageResult?.absorbed) {
        DebugManager.log(
          `${this.name} used ${magick.name} on ${target.name}; ` +
            `${target.name} absorbed it for ${resolvedHealing} HP.`,
        );
      } else {
        DebugManager.log(
          `${this.name} used ${magick.name} on ${target.name} for ${resolvedDamage} damage.`,
        );
      }

      return true;
    }

    // STATUS APPLICATION / REMOVAL EFFECTS
    if (magick.effect === "inflictStatus" || magick.effect === "removeStatus") {
      if (!payMagickCost()) {
        return false;
      }

      this._lastMagickStatusResults = this.resolveMagickStatusEffects(
        magick,
        target,
        random,
      );

      DebugManager.log(`${this.name} used ${magick.name} on ${target.name}.`);

      return true;
    }

    console.warn(
      `${magick.name} effect "${magick.effect}" is not implemented yet.`,
    );
    return false;
  }

  magickScopeMultiplier(magick, scope = "single") {
    if (!magick?.scopePower) {
      return 1;
    }

    const multiplier = Number(magick.scopePower[scope]);

    return Number.isFinite(multiplier) ? multiplier : 1;
  }

  magickHealing(magick, scope = "single", target = null) {
    if (!magick) {
      return 0;
    }

    const scopeMultiplier = this.magickScopeMultiplier(magick, scope);
    const healPercent = Number(magick.healPercent);

    // Percentage healing is resolved from the target's maximum HP. This keeps
    // effects such as Perfect Renewal data-driven instead of turning them into
    // magick-name checks.
    if (Number.isFinite(healPercent) && healPercent > 0 && target) {
      const maximumHp = Number(target.maxHp);

      if (Number.isFinite(maximumHp) && maximumHp > 0) {
        return Math.max(
          1,
          Math.floor(maximumHp * healPercent * scopeMultiplier),
        );
      }
    }

    const power = magick.power || 0;
    const level = this.level || 1;
    const magicAttack = this.totalMagicAttack();

    // FF7 restorative Magick formula:
    // (Spell Power × 22) + [(Level + Magic Attack) × 6]
    const rawHealing = power * 22 + (level + magicAttack) * 6;

    return Math.max(1, Math.floor(rawHealing * scopeMultiplier));
  }

  magickDamage(magick, target, scope = "single") {
    if (!magick || !target) {
      return 0;
    }

    const power = magick.power || 0;
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
        ? target.elementRate(magick.element)
        : 1;

    const scopeMultiplier = this.magickScopeMultiplier(magick, scope);
    const gravityPercent = Number(magick.gravityPercent);

    // Gravity-style damage uses the target's current HP instead of the normal
    // spell-power / Magic Defense formula. Elemental rate and normal incoming
    // magical-damage handling still apply afterward through the shared battle
    // damage path.
    if (Number.isFinite(gravityPercent) && gravityPercent > 0) {
      return Math.max(
        0,
        Math.floor(
          target.hp * gravityPercent * elementMultiplier * scopeMultiplier,
        ),
      );
    }

    return Math.max(
      0,
      Math.floor(rawDamage * elementMultiplier * scopeMultiplier),
    );
  }

  magickCanRemoveDefeatStatus(magick, target) {
    if (magick?.effect !== "removeStatus" || !target) {
      return false;
    }

    const statusPayload = magick.status;

    if (
      !statusPayload ||
      typeof statusPayload !== "object" ||
      Array.isArray(statusPayload)
    ) {
      return false;
    }

    return Object.keys(statusPayload).some((statusKey) => {
      if (
        typeof target.hasStatus !== "function" ||
        !target.hasStatus(statusKey)
      ) {
        return false;
      }

      const definition =
        typeof target.statusDefinition === "function"
          ? target.statusDefinition(statusKey)
          : null;

      return (
        definition?.effects?.countsAsDefeated === true &&
        definition?.classification?.removable !== false
      );
    });
  }

  isValidMagickTarget(magick, target) {
    if (!magick || !target) {
      return false;
    }

    const allowedTargets = Array.isArray(magick.target) ? magick.target : [];
    let targetGroupAllowed = allowedTargets.length === 0;

    if (allowedTargets.includes("self") && target === this) {
      targetGroupAllowed = true;
    }

    if (allowedTargets.includes("ally") && target instanceof Game_Actor) {
      targetGroupAllowed = true;
    }

    if (allowedTargets.includes("enemy") && target instanceof Game_Enemy) {
      targetGroupAllowed = true;
    }

    if (!targetGroupAllowed) {
      return false;
    }

    if (magick.effect === "revive") {
      return (
        typeof target.canBeRevived === "function" && target.canBeRevived()
      );
    }

    const defeated =
      typeof target.isDefeated === "function"
        ? target.isDefeated()
        : typeof target.isDead === "function" && target.isDead();

    if (defeated) {
      return this.magickCanRemoveDefeatStatus(magick, target);
    }

    return true;
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
