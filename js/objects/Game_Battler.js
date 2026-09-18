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

    this.statusRates = {
      ...(data.statusRates || {}),
    };

    this.statusFamilyRates = {
      ...(data.statusFamilyRates || {}),
    };

    this.statuses = [];
    this.defending = false;
  }

  // =====================================
  // Status Management
  // =====================================

  statusDefinitions() {
    return Array.isArray(DatabaseManager.statuses) ? DatabaseManager.statuses : [];
  }

  statusDefinition(statusKey) {
    if (!statusKey) {
      return null;
    }

    if (typeof DatabaseManager.statusByKey === "function") {
      return DatabaseManager.statusByKey(statusKey);
    }

    return (
      this.statusDefinitions().find((status) => status?.key === statusKey) || null
    );
  }

  statusRuntime(statusKey) {
    return this.statuses.find((status) => status.key === statusKey) || null;
  }

  hasStatus(statusKey) {
    return this.statusRuntime(statusKey) !== null;
  }

  activeStatusDefinitions() {
    return this.statuses
      .map((runtimeStatus) => this.statusDefinition(runtimeStatus.key))
      .filter((definition) => definition !== null);
  }

  statusEffectMultiplier(effectKey) {
    let multiplier = 1;

    for (const definition of this.activeStatusDefinitions()) {
      const value = Number(definition.effects?.[effectKey]);

      if (Number.isFinite(value)) {
        multiplier *= value;
      }
    }

    return multiplier;
  }

  statusEffectValues(effectKey) {
    return this.activeStatusDefinitions()
      .map((definition) => definition.effects?.[effectKey])
      .filter((value) => value !== undefined);
  }

  statusRate(statusKey) {
    const definition = this.statusDefinition(statusKey);

    if (!definition) {
      return 0;
    }

    const directRate = Number(this.statusRates[statusKey]);
    const family = definition.classification?.family;
    const familyRate = Number(this.statusFamilyRates[family]);

    const directMultiplier = Number.isFinite(directRate) ? directRate : 1;
    const familyMultiplier = Number.isFinite(familyRate) ? familyRate : 1;

    return Math.max(0, directMultiplier * familyMultiplier);
  }

  isStatusImmune(statusKey) {
    return this.statusRate(statusKey) <= 0;
  }

  tryAddStatus(statusKey, baseChance = 1, random = Math.random) {
    const definition = this.statusDefinition(statusKey);

    if (!definition) {
      return {
        applied: false,
        refreshed: false,
        reason: "unknownStatus",
        chance: 0,
      };
    }

    if (definition.duration?.type === "derived") {
      return {
        applied: false,
        refreshed: false,
        reason: "derivedStatus",
        chance: 0,
      };
    }

    const validBaseChance = Number(baseChance);
    const normalizedBaseChance = Number.isFinite(validBaseChance)
      ? Math.max(0, Math.min(1, validBaseChance))
      : 0;
    const finalChance = Math.max(
      0,
      Math.min(1, normalizedBaseChance * this.statusRate(statusKey)),
    );

    if (finalChance <= 0) {
      return {
        applied: false,
        refreshed: false,
        reason: "immune",
        chance: 0,
      };
    }

    const roll = typeof random === "function" ? random() : Math.random();

    if (roll >= finalChance) {
      return {
        applied: false,
        refreshed: false,
        reason: "resisted",
        chance: finalChance,
      };
    }

    const wasActive = this.hasStatus(statusKey);
    const applied = this.addStatus(statusKey);

    return {
      applied,
      refreshed: applied && wasActive,
      reason: applied ? (wasActive ? "refreshed" : "applied") : "unchanged",
      chance: finalChance,
    };
  }

  updateDerivedStatuses() {
    const derivedStatuses = this.statusDefinitions().filter(
      (status) => status?.duration?.type === "derived",
    );

    const activeDerivedStatuses = derivedStatuses.filter((status) => {
      const conditions = status.conditions;

      if (!conditions) {
        return false;
      }

      let matches = true;

      if (typeof conditions.hpPercentAbove === "number") {
        matches = matches && this.hpRate() > conditions.hpPercentAbove;
      }

      if (typeof conditions.hpPercentAtOrBelow === "number") {
        matches = matches && this.hpRate() <= conditions.hpPercentAtOrBelow;
      }

      return matches;
    });

    for (const status of activeDerivedStatuses) {
      this.addStatus(status.key);
    }

    for (const status of derivedStatuses) {
      const shouldBeActive = activeDerivedStatuses.some(
        (activeStatus) => activeStatus.key === status.key,
      );

      if (!shouldBeActive) {
        this.removeStatus(status.key, { force: true });
      }
    }

    return activeDerivedStatuses;
  }

  statusConflicts(statusKey) {
    const conflicts = {
      fury: ["sadness"],
      sadness: ["fury"],
    };

    return conflicts[statusKey] || [];
  }

  removeStatusConflicts(statusKey) {
    const removed = [];

    for (const conflictingKey of this.statusConflicts(statusKey)) {
      if (this.removeStatus(conflictingKey, { force: true })) {
        removed.push(conflictingKey);
      }
    }

    return removed;
  }

  refreshStatusDuration(runtimeStatus, definition) {
    if (!runtimeStatus || !definition) {
      return false;
    }

    if (
      definition.duration?.type !== "turns" &&
      definition.duration?.type !== "countdown"
    ) {
      return false;
    }

    runtimeStatus.turnsRemaining = definition.duration.turns;
    return true;
  }

  addStatus(statusKey) {
    const definition = this.statusDefinition(statusKey);

    if (!definition) {
      return false;
    }

    // Enforce interaction invariants even when loading or recovering from an
    // invalid runtime state that already contains conflicting statuses.
    this.removeStatusConflicts(statusKey);

    const existingStatus = this.statusRuntime(statusKey);

    if (existingStatus) {
      return this.refreshStatusDuration(existingStatus, definition);
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
    const definition = this.statusDefinition(statusKey);

    if (!definition) {
      return false;
    }

    if (definition.effects?.setsHpToZero === true) {
      this.setHp(0);
    }

    return true;
  }

  processStatusTrigger(trigger) {
    const processed = [];

    for (const runtimeStatus of [...this.statuses]) {
      const definition = this.statusDefinition(runtimeStatus.key);

      if (!definition) {
        continue;
      }

      if (definition.effects?.trigger !== trigger) {
        continue;
      }

      const result = this.applyTriggeredStatusEffects(definition);

      processed.push({
        key: definition.key,
        name: definition.name,
        ...result,
      });
    }

    return processed;
  }

  applyTriggeredStatusEffects(definition) {
    if (!definition?.effects) {
      return { damage: 0, healing: 0 };
    }

    let damage = 0;
    let healing = 0;

    if (typeof definition.effects.hpDamagePercent === "number") {
      damage = Math.max(
        0,
        Math.floor(this.maxHp * definition.effects.hpDamagePercent),
      );

      const minimumHp = definition.effects.canKill === true ? 0 : 1;
      const hpBefore = this.hp;

      this.setHp(Math.max(minimumHp, this.hp - damage));
      damage = Math.max(0, hpBefore - this.hp);
    }

    if (typeof definition.effects.hpHealPercent === "number") {
      healing = Math.max(
        0,
        Math.floor(this.maxHp * definition.effects.hpHealPercent),
      );

      const hpBefore = this.hp;

      this.setHp(this.hp + healing);
      healing = Math.max(0, this.hp - hpBefore);
    }

    return { damage, healing };
  }

  removeStatus(statusKey, { force = false } = {}) {
    const index = this.statuses.findIndex((status) => status.key === statusKey);

    if (index === -1) {
      return false;
    }

    const definition = this.statusDefinition(statusKey);
    const removable = definition?.classification?.removable !== false;

    if (!force && !removable) {
      return false;
    }

    this.statuses.splice(index, 1);
    return true;
  }

  clearTemporaryBattleStatuses() {
    const removedStatuses = [];

    this.statuses = this.statuses.filter((runtimeStatus) => {
      const definition = this.statusDefinition(runtimeStatus.key);

      const persistsAfterBattle =
        definition?.classification?.persistsAfterBattle === true;

      if (!persistsAfterBattle) {
        removedStatuses.push(runtimeStatus.key);
      }

      return persistsAfterBattle;
    });

    return removedStatuses;
  }

  restorePostBattleState(stateBeforeRewards = null) {
    const wasDefeated =
      stateBeforeRewards?.wasDefeated === true ||
      (!stateBeforeRewards && this.isDead());

    const hpBeforeRewards = Number(stateBeforeRewards?.hp);
    const mpBeforeRewards = Number(stateBeforeRewards?.mp);

    // Battle rewards must not accidentally become a healing system. Preserve
    // the HP/MP that existed when battle ended, except defeated party members
    // deliberately return to the map at 1 HP.
    if (wasDefeated) {
      this.setHp(1);
    } else if (Number.isFinite(hpBeforeRewards)) {
      this.setHp(hpBeforeRewards);
    }

    if (Number.isFinite(mpBeforeRewards)) {
      this.mp = Math.max(0, Math.min(mpBeforeRewards, this.maxMp));
    }

    this.stopDefending();

    const removedStatuses = this.clearTemporaryBattleStatuses();

    return {
      wasDefeated,
      hp: this.hp,
      mp: this.mp,
      removedStatuses,
      persistentStatuses: this.statuses.map((status) => status.key),
    };
  }

  tickStatusDurations() {
    const expiredStatuses = [];

    for (let index = this.statuses.length - 1; index >= 0; index--) {
      const runtimeStatus = this.statuses[index];

      if (
        !Number.isInteger(runtimeStatus.turnsRemaining) ||
        runtimeStatus.turnsRemaining <= 0
      ) {
        continue;
      }

      runtimeStatus.turnsRemaining--;

      if (runtimeStatus.turnsRemaining !== 0) {
        continue;
      }

      const definition = this.statusDefinition(runtimeStatus.key);

      if (
        definition?.duration?.type !== "turns" &&
        definition?.duration?.type !== "countdown"
      ) {
        continue;
      }

      const expiredKey = runtimeStatus.key;
      const durationType = definition.duration.type;

      this.statuses.splice(index, 1);
      expiredStatuses.push(expiredKey);

      if (durationType === "countdown") {
        this.resolveStatusExpiration(expiredKey);
      }
    }

    return expiredStatuses;
  }

  resolveStatusExpiration(statusKey) {
    const definition = this.statusDefinition(statusKey);

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

  canAct() {
    if (this.isDead()) {
      return false;
    }

    return !this.activeStatusDefinitions().some(
      (definition) => definition.effects?.canAct === false,
    );
  }

  statusDisplayEntries() {
    return this.statuses.map((runtimeStatus) => {
      const definition = this.statusDefinition(runtimeStatus.key);

      return {
        key: runtimeStatus.key,
        name: definition?.name || runtimeStatus.key,
        turnsRemaining: Number.isInteger(runtimeStatus.turnsRemaining)
          ? runtimeStatus.turnsRemaining
          : null,
        countdown: definition?.duration?.type === "countdown",
      };
    });
  }

  statusSummary(maxEntries = 2) {
    const entries = this.statusDisplayEntries();

    if (entries.length === 0) {
      return "";
    }

    const limit = Math.max(1, Math.floor(Number(maxEntries) || 1));
    const visible = entries.slice(0, limit).map((entry) => {
      if (entry.turnsRemaining === null) {
        return entry.name;
      }

      return `${entry.name} ${entry.turnsRemaining}`;
    });

    const hiddenCount = entries.length - visible.length;

    if (hiddenCount > 0) {
      visible.push(`+${hiddenCount}`);
    }

    return visible.join(", ");
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

    this.setHp(this.hp + value);

    DebugManager.log(`${this.name} recovered ${value} HP.`);

    return value;
  }

  setHp(value) {
    const validValue = Number.isFinite(value) ? value : 0;

    this.hp = Math.max(0, Math.min(validValue, this.maxHp));

    this.updateDerivedStatuses();

    return this.hp;
  }

  loseHp(amount) {
    const value = this._validAmount(amount);

    this.setHp(this.hp - value);

    DebugManager.log(`${this.name} lost ${value} HP.`);

    return value;
  }

  recoverAllHp() {
    this.setHp(this.maxHp);

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
