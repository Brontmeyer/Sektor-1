"use strict";

/**
 * Shared combat foundation for actors and enemies.
 *
 * Game_Battler owns the state and behavior that every combatant has in
 * common: HP/MP, core battle stats, derived stats, and defeat-state checks.
 * Actor-specific equipment/magick/EXP stay in Game_Actor, while enemy-
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

  persistentStatusState() {
    const serialized = [];

    for (const runtimeStatus of this.statuses) {
      const definition = this.statusDefinition(runtimeStatus.key);

      if (
        !definition ||
        definition.duration?.type === "derived" ||
        definition.classification?.persistsAfterBattle !== true
      ) {
        continue;
      }

      const entry = { key: definition.key };

      if (Number.isInteger(runtimeStatus.turnsRemaining)) {
        entry.turnsRemaining = runtimeStatus.turnsRemaining;
      }

      serialized.push(entry);
    }

    return serialized;
  }

  restorePersistentStatusState(serializedStatuses = []) {
    this.statuses = [];

    if (!Array.isArray(serializedStatuses)) {
      this.updateDerivedStatuses();
      return [];
    }

    const restored = [];

    for (const savedStatus of serializedStatuses) {
      if (!savedStatus || typeof savedStatus !== "object") {
        continue;
      }

      const definition = this.statusDefinition(savedStatus.key);

      if (
        !definition ||
        definition.duration?.type === "derived" ||
        definition.classification?.persistsAfterBattle !== true
      ) {
        continue;
      }

      this.removeStatusConflicts(definition.key);

      if (this.hasStatus(definition.key)) {
        continue;
      }

      const runtimeStatus = { key: definition.key };

      if (
        definition.duration?.type === "turns" ||
        definition.duration?.type === "countdown"
      ) {
        const maximumTurns = Number(definition.duration.turns);
        const savedTurns = Number(savedStatus.turnsRemaining);

        runtimeStatus.turnsRemaining =
          Number.isInteger(savedTurns) && savedTurns > 0
            ? Math.min(savedTurns, maximumTurns)
            : maximumTurns;
      }

      this.statuses.push(runtimeStatus);
      restored.push(definition.key);
    }

    this.updateDerivedStatuses();
    return restored;
  }

  activeDefeatStatusDefinitions() {
    return this.activeStatusDefinitions().filter(
      (definition) => definition.effects?.countsAsDefeated === true,
    );
  }

  hasNonRevivableDefeatStatus() {
    return this.activeDefeatStatusDefinitions().some(
      (definition) => definition.effects?.canBeRevived !== true,
    );
  }

  canBeRevived() {
    if (!this.isDefeated()) {
      return false;
    }

    if (this.hasNonRevivableDefeatStatus()) {
      return false;
    }

    const defeatStatuses = this.activeDefeatStatusDefinitions();

    return (
      this.isDead() ||
      defeatStatuses.some(
        (definition) => definition.effects?.canBeRevived === true,
      )
    );
  }

  revive(hpPercent = 1) {
    const percent = Number(hpPercent);

    if (
      !this.canBeRevived() ||
      !Number.isFinite(percent) ||
      percent <= 0 ||
      percent > 1
    ) {
      return {
        success: false,
        hpBefore: this.hp,
        hpAfter: this.hp,
        hpRecovered: 0,
        removedStatuses: [],
      };
    }

    const hpBefore = this.hp;
    const removedStatuses = [];

    for (const definition of this.activeDefeatStatusDefinitions()) {
      if (definition.effects?.canBeRevived !== true) {
        continue;
      }

      if (this.removeStatus(definition.key, { force: true })) {
        removedStatuses.push(definition.key);
      }
    }

    const revivedHp = Math.max(1, Math.floor(this.maxHp * percent));
    this.setHp(revivedHp);

    return {
      success: !this.isDefeated(),
      hpBefore,
      hpAfter: this.hp,
      hpRecovered: Math.max(0, this.hp - hpBefore),
      removedStatuses,
    };
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

  hasStatusEffectFlag(effectKey) {
    return this.statusEffectValues(effectKey).some((value) => value === true);
  }

  isPlayerControlled() {
    return !this.statusEffectValues("playerControl").some(
      (value) => value === false,
    );
  }

  forcesPhysicalAttack() {
    return this.hasStatusEffectFlag("forcePhysicalAttack");
  }

  forcesRandomTarget() {
    return this.hasStatusEffectFlag("forceRandomTarget");
  }

  normalizedActionKey(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  allowedBattleActions() {
    const allowLists = this.statusEffectValues("allowedActions")
      .filter((value) => Array.isArray(value))
      .map((actions) =>
        actions
          .map((action) => this.normalizedActionKey(action))
          .filter((action) => action.length > 0),
      );

    if (allowLists.length === 0) {
      return null;
    }

    let allowed = new Set(allowLists[0]);

    for (const actions of allowLists.slice(1)) {
      const actionSet = new Set(actions);
      allowed = new Set([...allowed].filter((action) => actionSet.has(action)));
    }

    return [...allowed];
  }

  blockedActionTypes() {
    const blocked = new Set();

    for (const value of this.statusEffectValues("blockedActionTypes")) {
      if (!Array.isArray(value)) {
        continue;
      }

      for (const actionType of value) {
        const normalized = this.normalizedActionKey(actionType);

        if (normalized) {
          blocked.add(normalized);
        }
      }
    }

    return [...blocked];
  }

  canUseBattleAction(actionType) {
    if (!this.canAct()) {
      return false;
    }

    const action = this.normalizedActionKey(actionType);

    if (!action) {
      return false;
    }

    const allowedActions = this.allowedBattleActions();

    if (allowedActions && !allowedActions.includes(action)) {
      return false;
    }

    if (this.blockedActionTypes().includes(action)) {
      return false;
    }

    return true;
  }

  canUseMagickDefinition(magick) {
    if (!magick || typeof magick !== "object") {
      return false;
    }

    const magickType = this.normalizedActionKey(magick.type);

    if (!magickType) {
      return false;
    }

    return this.canUseBattleAction(magickType);
  }

  canUseSkillDefinition(skill) {
    if (!skill || typeof skill !== "object") {
      return false;
    }

    const skillType = this.normalizedActionKey(skill.type);

    if (skillType !== "skill") {
      return false;
    }

    return this.canUseBattleAction(skillType);
  }

  physicalDamageMultiplier() {
    return Math.max(0, this.statusEffectMultiplier("physicalDamageMultiplier"));
  }

  physicalAccuracyMultiplier() {
    return Math.max(
      0,
      this.statusEffectMultiplier("physicalAccuracyMultiplier"),
    );
  }

  turnSpeedMultiplier() {
    return Math.max(0, this.statusEffectMultiplier("turnSpeedMultiplier"));
  }

  haltsTurnProgression() {
    return this.hasStatusEffectFlag("haltsTurnProgression");
  }

  valorGainMultiplier() {
    return Math.max(0, this.statusEffectMultiplier("valorGainMultiplier"));
  }

  incomingDamageMultiplier(category) {
    if (category === "physical") {
      return Math.max(
        0,
        this.statusEffectMultiplier("physicalDamageTakenMultiplier"),
      );
    }

    if (category === "magical") {
      return Math.max(
        0,
        this.statusEffectMultiplier("magicalDamageTakenMultiplier"),
      );
    }

    return 1;
  }

  isElementalMagickElement(element) {
    if (typeof element !== "string" || element.length === 0) {
      return false;
    }

    return element !== "none" && element !== "restorative";
  }

  absorbsElementalMagick(element) {
    if (!this.isElementalMagickElement(element)) {
      return false;
    }

    return this.statusEffectValues("absorbElementalMagick").some(
      (value) => value === true,
    );
  }

  reflectsMagick() {
    return this.activeStatusDefinitions().some(
      (definition) => definition.effects?.reflectableMagick === true,
    );
  }

  maxMagickReflections() {
    let maxReflections = 0;

    for (const definition of this.activeStatusDefinitions()) {
      if (definition.effects?.reflectableMagick !== true) {
        continue;
      }

      const value = Number(definition.effects?.maxReflections);

      if (Number.isInteger(value) && value > maxReflections) {
        maxReflections = value;
      }
    }

    return maxReflections;
  }

  removeStatusesOnPhysicalDamage() {
    const removedStatuses = [];

    for (const definition of [...this.activeStatusDefinitions()]) {
      if (definition.effects?.removeOnPhysicalDamage !== true) {
        continue;
      }

      if (this.removeStatus(definition.key, { force: true })) {
        removedStatuses.push(definition.key);
      }
    }

    return removedStatuses;
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
      (!stateBeforeRewards && this.isDefeated());

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

  tickStatusDurations({ mode = "all" } = {}) {
    const expiredStatuses = [];

    for (let index = this.statuses.length - 1; index >= 0; index--) {
      const runtimeStatus = this.statuses[index];

      if (
        !Number.isInteger(runtimeStatus.turnsRemaining) ||
        runtimeStatus.turnsRemaining <= 0
      ) {
        continue;
      }

      const definition = this.statusDefinition(runtimeStatus.key);
      const haltsTurnProgression =
        definition?.effects?.haltsTurnProgression === true;

      if (mode === "turn" && haltsTurnProgression) {
        continue;
      }

      if (mode === "haltedRound" && !haltsTurnProgression) {
        continue;
      }

      runtimeStatus.turnsRemaining--;

      if (runtimeStatus.turnsRemaining !== 0) {
        continue;
      }

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
    if (this.isDefeated()) {
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
  // Shared Skill Legality
  // =====================================

  canUseSkill(skillId) {
    const skill = DatabaseManager.skill?.(skillId) || null;

    if (!skill) {
      return false;
    }

    if (typeof this.knowsSkill === "function" && !this.knowsSkill(skillId)) {
      return false;
    }

    return this.canUseSkillDefinition(skill) && this.canPaySkillCost(skill);
  }

  canPaySkillCost(_skill) {
    return true;
  }

  paySkillCost(skill) {
    return this.canPaySkillCost(skill);
  }

  skillPowerMultiplier(skill) {
    const multiplier = Number(skill?.powerMultiplier);
    return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  }

  // =====================================
  // Shared Magick Runtime
  // =====================================

  canUseMagick(magickId) {
    const magick = DatabaseManager.magick(magickId);

    if (!magick) {
      return false;
    }

    if (
      typeof this.knowsMagick === "function" &&
      !this.knowsMagick(magickId)
    ) {
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
      this.isSameBattleSide(target) &&
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
    // The battler owns Magick legality and MP payment. BattleManager owns the
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

  battleSideType() {
    if (typeof Game_Actor !== "undefined" && this instanceof Game_Actor) {
      return "actor";
    }

    if (typeof Game_Enemy !== "undefined" && this instanceof Game_Enemy) {
      return "enemy";
    }

    return null;
  }

  isSameBattleSide(target) {
    if (!target || typeof target.battleSideType !== "function") {
      return false;
    }

    const side = this.battleSideType();
    return side !== null && target.battleSideType() === side;
  }

  isOpposingBattleSide(target) {
    if (!target || typeof target.battleSideType !== "function") {
      return false;
    }

    const side = this.battleSideType();
    const targetSide = target.battleSideType();
    return side !== null && targetSide !== null && targetSide !== side;
  }

  isValidSkillTarget(skill, target) {
    if (!skill || !target) {
      return false;
    }

    const allowedTargets = Array.isArray(skill.target) ? skill.target : [];
    let targetGroupAllowed = allowedTargets.length === 0;

    if (allowedTargets.includes("self") && target === this) {
      targetGroupAllowed = true;
    }

    if (allowedTargets.includes("ally") && this.isSameBattleSide(target)) {
      targetGroupAllowed = true;
    }

    if (allowedTargets.includes("enemy") && this.isOpposingBattleSide(target)) {
      targetGroupAllowed = true;
    }

    if (!targetGroupAllowed) {
      return false;
    }

    return typeof target.isDefeated === "function"
      ? !target.isDefeated()
      : !(typeof target.isDead === "function" && target.isDead());
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

    if (allowedTargets.includes("ally") && this.isSameBattleSide(target)) {
      targetGroupAllowed = true;
    }

    if (allowedTargets.includes("enemy") && this.isOpposingBattleSide(target)) {
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
    return this.attackPercent;
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
  // Damage Hooks
  // =====================================

  onDamageReceived(_result) {
    // Actor-specific systems may react to resolved incoming damage here.
    return null;
  }

  // =====================================
  // HP Management
  // =====================================

  receiveDamage(amount, { category = "physical", element = null } = {}) {
    const requestedDamage = this._validAmount(amount);
    const damageMultiplier = this.incomingDamageMultiplier(category);
    const resolvedDamage = Math.max(
      0,
      Math.floor(requestedDamage * damageMultiplier),
    );
    const hpBefore = this.hp;
    const absorbed =
      category === "magical" &&
      resolvedDamage > 0 &&
      this.absorbsElementalMagick(element);

    if (absorbed) {
      this.setHp(this.hp + resolvedDamage);

      const healing = Math.max(0, this.hp - hpBefore);

      DebugManager.log(
        `${this.name} absorbed ${resolvedDamage} ${element || "elemental"} damage.`,
      );

      return {
        damage: 0,
        healing,
        absorbed: true,
        category,
        element,
        requestedDamage,
        resolvedDamage,
        damageMultiplier,
        removedStatuses: [],
      };
    }

    this.setHp(this.hp - resolvedDamage);

    const damage = Math.max(0, hpBefore - this.hp);
    const removedStatuses =
      category === "physical" && damage > 0
        ? this.removeStatusesOnPhysicalDamage()
        : [];

    DebugManager.log(`${this.name} lost ${damage} HP.`);

    const result = {
      damage,
      healing: 0,
      absorbed: false,
      category,
      element,
      requestedDamage,
      resolvedDamage,
      damageMultiplier,
      removedStatuses,
    };

    if (damage > 0) {
      this.onDamageReceived(result);
    }

    return result;
  }

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

  isDefeated() {
    return this.isDead() || this.activeDefeatStatusDefinitions().length > 0;
  }

  isAlive() {
    return !this.isDefeated();
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
