"use strict";

class BattleManager {
  static TURN_START = "turnStart";
  static TURN_COMMAND = "command";
  static TURN_ACTION = "action";
  static TURN_END = "turnEnd";

  static OUTCOME_VICTORY = "victory";
  static OUTCOME_DEFEAT = "defeat";
  static OUTCOME_ESCAPE = "escape";

  constructor(scene) {
    this.scene = scene;

    // =============================================================
    // Pass 9 - Awakening
    // Party Turn Queue
    // =============================================================

    this.partyTurnQueue = [];
    this.currentPartyTurn = 0;
    this.currentBattler = null;

    // =============================================================
    // Pass 9 - Awakening
    // Battle Turn State
    // =============================================================

    this.turnState = BattleManager.TURN_START;

    // Pass 19 - Turn Speed Runtime v1
    // Fractional progress is battle-local. A normal battler earns one turn slot
    // per side round, Haste earns two, and Slow carries half a slot between
    // rounds. The first schedule seeds sub-normal battlers so everyone receives
    // an opening turn before fractional carry begins.
    this.turnProgress = new Map();
    this.enemyTurnQueue = [];
    this.enemyAI = new BattleEnemyAI(this);

    // Pass 11 - Battle Resolution v1
    this.finalResult = null;
  }

  // =================================
  // Battle Resolution
  // =================================

  validOutcome(outcome) {
    return [
      BattleManager.OUTCOME_VICTORY,
      BattleManager.OUTCOME_DEFEAT,
      BattleManager.OUTCOME_ESCAPE,
    ].includes(outcome);
  }

  declareBattleOutcome(outcome) {
    const battle = this.scene;

    if (!this.validOutcome(outcome)) {
      console.error(`Invalid battle outcome: ${outcome}`);
      return false;
    }

    if (battle.outcome) {
      return battle.outcome === outcome;
    }

    battle.outcome = outcome;
    battle.victory = outcome === BattleManager.OUTCOME_VICTORY;
    battle.defeat = outcome === BattleManager.OUTCOME_DEFEAT;
    battle.pendingEnemyTurn = false;
    battle.enemyTurnDelay = 0;
    battle.battleInputLocked = false;

    if (outcome === BattleManager.OUTCOME_VICTORY) {
      battle.addBattleMessage("Victory!");
    } else if (outcome === BattleManager.OUTCOME_DEFEAT) {
      battle.addBattleMessage("Defeat...");
    }

    return true;
  }

  detectBattleOutcome() {
    const battle = this.scene;

    if (battle.enemies.every((enemy) => this.battlerIsDefeated(enemy))) {
      return BattleManager.OUTCOME_VICTORY;
    }

    if ($gameParty.livingBattleMembers().length === 0) {
      return BattleManager.OUTCOME_DEFEAT;
    }

    return null;
  }

  finishPartyActionSequence() {
    const battle = this.scene;

    battle.setActionPhase("none");

    const outcome = battle.outcome || this.detectBattleOutcome();

    if (outcome) {
      this.declareBattleOutcome(outcome);
      return;
    }

    this.endPartyTurn();

    if (battle.outcome) {
      return;
    }

    this.finishPartyAction();
  }

  createRewardBundle(defeatedEnemies, random = Math.random) {
    return {
      exp: this.calculateExperienceReward(defeatedEnemies),
      currency: this.calculateCurrencyReward(defeatedEnemies),
      drops: this.calculateItemDrops(defeatedEnemies, random),
      resonance: this.calculateEssenceResonance(defeatedEnemies),
    };
  }

  calculateExperienceReward(defeatedEnemies) {
    return defeatedEnemies.reduce((total, enemy) => {
      const reward = enemy.expReward;
      return total + (Number.isInteger(reward) && reward > 0 ? reward : 0);
    }, 0);
  }

  calculateCurrencyReward(defeatedEnemies) {
    return defeatedEnemies.reduce((total, enemy) => {
      if (typeof enemy.isBanished === "function" && enemy.isBanished()) {
        return total;
      }

      const reward = Number(enemy.gilReward);
      return total + (Number.isInteger(reward) && reward > 0 ? reward : 0);
    }, 0);
  }

  calculateItemDrops(defeatedEnemies, random = Math.random) {
    const totals = new Map();
    const roll = typeof random === "function" ? random : Math.random;

    for (const enemy of defeatedEnemies) {
      const dropTable = Array.isArray(enemy.dropTable) ? enemy.dropTable : [];

      for (const drop of dropTable) {
        const chance = Number(drop?.chance);
        const itemId = Number(drop?.itemId);
        const quantity = Number(drop?.quantity);

        if (
          !Number.isFinite(chance) ||
          chance < 0 ||
          chance > 1 ||
          !Number.isInteger(itemId) ||
          itemId <= 0 ||
          !Number.isInteger(quantity) ||
          quantity <= 0
        ) {
          continue;
        }

        if (roll() >= chance) {
          continue;
        }

        totals.set(itemId, (totals.get(itemId) || 0) + quantity);
      }
    }

    return [...totals.entries()].map(([itemId, quantity]) => ({
      itemId,
      name:
        typeof DatabaseManager !== "undefined" &&
        typeof DatabaseManager.itemName === "function"
          ? DatabaseManager.itemName(itemId)
          : `Item ${itemId}`,
      quantity,
    }));
  }

  calculateEssenceResonance(defeatedEnemies) {
    return defeatedEnemies.reduce((total, enemy) => {
      const reward = Number(enemy.resonanceReward);
      return total + (Number.isInteger(reward) && reward > 0 ? reward : 0);
    }, 0);
  }

  finalizeBattle(outcome = this.scene.outcome) {
    if (this.finalResult) {
      return this.finalResult;
    }

    if (!this.validOutcome(outcome)) {
      console.error(`Cannot finalize invalid battle outcome: ${outcome}`);
      return null;
    }

    // Once an outcome has been declared it is authoritative. A later caller
    // cannot change victory into escape, defeat into victory, and so on.
    if (this.scene.outcome && this.scene.outcome !== outcome) {
      outcome = this.scene.outcome;
    }

    this.declareBattleOutcome(outcome);

    const partyMembers = $gameParty.battleMembers();
    const partySnapshots = new Map(
      partyMembers.map((actor) => [
        actor,
        {
          hp: actor.hp,
          mp: actor.mp,
          wasDefeated: this.battlerIsDefeated(actor),
          levelBefore: actor.level,
        },
      ]),
    );

    const defeatedEnemies = this.scene.enemies.filter((enemy) =>
      this.battlerIsDefeated(enemy),
    );

    const rewards =
      outcome === BattleManager.OUTCOME_VICTORY
        ? this.createRewardBundle(
            defeatedEnemies,
            typeof this.rewardRandom === "function" ? this.rewardRandom : Math.random,
          )
        : { exp: 0, currency: 0, drops: [], resonance: 0 };

    if (outcome === BattleManager.OUTCOME_VICTORY) {
      if (rewards.currency > 0 && typeof $gameParty.gainGil === "function") {
        $gameParty.gainGil(rewards.currency);
      }

      for (const drop of rewards.drops) {
        $gameParty.gainItem(drop.itemId, drop.quantity);
      }
    }

    const partyResults = partyMembers.map((actor) => {
      const snapshot = partySnapshots.get(actor);
      let levelsGained = 0;
      let expGained = 0;
      let essenceRewards = [];

      if (outcome === BattleManager.OUTCOME_VICTORY && rewards.exp > 0) {
        levelsGained = actor.gainExp(rewards.exp);
        expGained = rewards.exp;
      }

      if (
        outcome === BattleManager.OUTCOME_VICTORY &&
        !snapshot.wasDefeated &&
        rewards.resonance > 0 &&
        typeof actor.gainEquippedEssenceResonance === "function"
      ) {
        essenceRewards = actor.gainEquippedEssenceResonance(rewards.resonance);
      }

      const postBattle = actor.restorePostBattleState(snapshot);

      return {
        actorId: actor.actorId,
        name: actor.name,
        expGained,
        levelsGained,
        levelBefore: snapshot.levelBefore,
        levelAfter: actor.level,
        essenceRewards,
        ...postBattle,
      };
    });

    this.finalResult = {
      outcome,
      encounter: {
        id: this.scene.encounter.id,
        name: this.scene.encounter.name,
      },
      rewards,
      defeatedEnemies: defeatedEnemies.map((enemy) => ({
        enemyId: enemy.enemyId,
        name: enemy.name,
        expReward: enemy.expReward,
        gilReward: enemy.gilReward,
        resonanceReward: enemy.resonanceReward,
        banished:
          typeof enemy.isBanished === "function" ? enemy.isBanished() : false,
      })),
      party: partyResults,
    };

    this.scene.result = this.finalResult;

    return this.finalResult;
  }

  // =================================
  // Turn Speed Scheduling
  // =================================

  battlerTurnSpeedMultiplier(battler) {
    if (!battler || typeof battler.turnSpeedMultiplier !== "function") {
      return 1;
    }

    const multiplier = Number(battler.turnSpeedMultiplier());

    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      return 1;
    }

    return multiplier;
  }

  battlerHaltsTurnProgression(battler) {
    return Boolean(
      battler &&
        typeof battler.haltsTurnProgression === "function" &&
        battler.haltsTurnProgression(),
    );
  }

  initialTurnProgress(multiplier) {
    return multiplier < 1 ? 1 - multiplier : 0;
  }

  turnSlotsForRound(battler) {
    if (
      !battler ||
      this.battlerIsDefeated(battler) ||
      this.battlerHaltsTurnProgression(battler)
    ) {
      return 0;
    }

    const multiplier = this.battlerTurnSpeedMultiplier(battler);
    let progress = this.turnProgress.has(battler)
      ? this.turnProgress.get(battler)
      : this.initialTurnProgress(multiplier);

    progress += multiplier;

    // Small epsilon prevents floating-point residue from turning an exact
    // accumulated whole turn into a missed slot.
    const slots = Math.max(0, Math.floor(progress + 1e-9));
    this.turnProgress.set(battler, Math.max(0, progress - slots));

    return slots;
  }

  buildTurnQueue(battlers) {
    const candidates = Array.isArray(battlers)
      ? battlers.filter((battler) => battler && !this.battlerIsDefeated(battler))
      : [];
    const slotCounts = candidates.map((battler) => {
      const haltedAtRoundStart = this.battlerHaltsTurnProgression(battler);

      return {
        battler,
        haltedAtRoundStart,
        slots: haltedAtRoundStart ? 0 : this.turnSlotsForRound(battler),
      };
    });
    const maxSlots = slotCounts.reduce(
      (maximum, entry) => Math.max(maximum, entry.slots),
      0,
    );
    const queue = [];

    // Interleave additional turns so a Hasted battler receives its normal
    // formation-order turn before its bonus turn rather than acting twice in
    // a row ahead of the rest of its side.
    for (let slotIndex = 0; slotIndex < maxSlots; slotIndex++) {
      for (const entry of slotCounts) {
        if (entry.slots > slotIndex) {
          queue.push(entry.battler);
        }
      }
    }

    // A halted battler receives no personal turn slots, so its ordinary
    // turn-start effects and battler-relative status timers remain frozen.
    // The halting status itself advances once per side round so Stop can
    // expire without granting the battler a turn in that same round.
    for (const entry of slotCounts) {
      if (
        entry.haltedAtRoundStart &&
        typeof entry.battler.tickStatusDurations === "function"
      ) {
        entry.battler.tickStatusDurations({ mode: "haltedRound" });
      }
    }

    return queue;
  }

  prepareEnemyTurnQueue() {
    this.enemyTurnQueue = this.buildTurnQueue(this.scene.enemies);
    this.scene.enemyTurnIndex = 0;
    return this.enemyTurnQueue;
  }

  currentEnemyTurnBattler() {
    return this.enemyTurnQueue[this.scene.enemyTurnIndex] || null;
  }

  // =================================
  // Party Methods
  // =================================

  party() {
    return this.scene.partyController;
  }

  battlerIsDefeated(battler) {
    if (!battler) {
      return false;
    }

    if (typeof battler.isDefeated === "function") {
      return battler.isDefeated();
    }

    return typeof battler.isDead === "function" && battler.isDead();
  }

  presentDefeatTransition(battler, wasDefeated = false) {
    if (!battler) {
      return false;
    }

    const battle = this.scene;
    const isDefeated = this.battlerIsDefeated(battler);

    if (isDefeated === wasDefeated) {
      return false;
    }

    if ($gameParty.battleMembers().includes(battler)) {
      battle.setActorState(isDefeated ? "defeat" : "idle", 0, battler);
    } else if (battle.enemies.includes(battler)) {
      battle.setEnemyState(isDefeated ? "defeat" : "idle", 0, battler);
    }

    const outcome = this.detectBattleOutcome();

    if (outcome) {
      this.declareBattleOutcome(outcome);
    }

    return true;
  }

  processTurnStartStatuses(battler) {
    const battle = this.scene;

    if (!battler || typeof battler.processStatusTrigger !== "function") {
      return [];
    }

    const results = battler.processStatusTrigger(BattleManager.TURN_START);

    for (const result of results) {
      if (result.damage > 0) {
        battle.addBattlePopup(battler, `-${result.damage}`, "damage");
        battle.addBattleMessage(
          `${battler.name} suffers ${result.damage} damage from ${result.name}!`,
        );
      }

      if (result.healing > 0) {
        battle.addBattlePopup(battler, `+${result.healing}`, "heal");
        battle.addBattleMessage(
          `${battler.name} recovers ${result.healing} HP from ${result.name}!`,
        );
      }
    }

    if (this.battlerIsDefeated(battler)) {
      if ($gameParty.battleMembers().includes(battler)) {
        battle.setActorState("defeat", 0, battler);
      } else if (battle.enemies.includes(battler)) {
        battle.setEnemyState("defeat", 0, battler);
      }
    }

    const outcome = this.detectBattleOutcome();

    if (outcome) {
      this.declareBattleOutcome(outcome);
    }

    return results;
  }

  battlerCanAct(battler) {
    if (!battler || this.battlerIsDefeated(battler)) {
      return false;
    }

    if (typeof battler.canAct === "function") {
      return battler.canAct();
    }

    return true;
  }

  battlerCanUseAction(battler, actionType) {
    if (!this.battlerCanAct(battler)) {
      return false;
    }

    if (typeof battler.canUseBattleAction === "function") {
      return battler.canUseBattleAction(actionType);
    }

    return true;
  }

  rejectRestrictedAction(battler, actionName) {
    if (!battler || !actionName) {
      return false;
    }

    this.scene.addBattleMessage(
      `${battler.name} cannot use ${actionName} right now!`,
    );

    return false;
  }

  // =================================
  // Combat Resolution
  // =================================

  physicalHitChance(battler) {
    if (!battler || typeof battler.totalAttackPercent !== "function") {
      return 0;
    }

    const baseAccuracy = Number(battler.totalAttackPercent());
    const accuracyMultiplier =
      typeof battler.physicalAccuracyMultiplier === "function"
        ? battler.physicalAccuracyMultiplier()
        : 1;
    const accuracy = Number.isFinite(baseAccuracy) ? baseAccuracy : 0;

    return Math.max(0, Math.min(100, accuracy * accuracyMultiplier));
  }

  calculatePhysicalDamage(
    attacker,
    target,
    { critical = false, powerMultiplier = 1 } = {},
  ) {
    if (!attacker || !target) {
      return 0;
    }

    const attack =
      typeof attacker.totalAttack === "function" ? attacker.totalAttack() : 0;
    const defense =
      typeof target.totalDefense === "function" ? target.totalDefense() : 0;

    let damage = Math.max(1, attack - defense);
    const power = Number(powerMultiplier);
    damage = Math.max(
      1,
      Math.floor(damage * (Number.isFinite(power) && power > 0 ? power : 1)),
    );

    if (critical) {
      damage = Math.max(1, Math.floor(damage * 2));
    }

    const outgoingMultiplier =
      typeof attacker.physicalDamageMultiplier === "function"
        ? attacker.physicalDamageMultiplier()
        : 1;

    damage = Math.max(1, Math.floor(damage * outgoingMultiplier));

    if (typeof target.isDefending === "function" && target.isDefending()) {
      damage = Math.max(1, Math.floor(damage * 0.5));
    }

    return damage;
  }

  applyPhysicalDamage(attacker, target, options = {}) {
    const requestedDamage = this.calculatePhysicalDamage(
      attacker,
      target,
      options,
    );

    if (typeof target?.receiveDamage === "function") {
      return target.receiveDamage(requestedDamage, { category: "physical" });
    }

    const hpBefore = target?.hp ?? 0;

    target?.loseHp?.(requestedDamage);

    return {
      damage: Math.max(0, hpBefore - (target?.hp ?? hpBefore)),
      healing: 0,
      absorbed: false,
      category: "physical",
      element: null,
      requestedDamage,
      resolvedDamage: requestedDamage,
      damageMultiplier: 1,
      removedStatuses: [],
    };
  }

  battlerSide(battler) {
    if (!battler) {
      return null;
    }

    if ($gameParty.battleMembers().includes(battler)) {
      return "ally";
    }

    if (this.scene.enemies.includes(battler)) {
      return "enemy";
    }

    return null;
  }

  livingBattlersForSide(side) {
    if (side === "ally") {
      return $gameParty.livingBattleMembers();
    }

    if (side === "enemy") {
      return this.scene.enemies.filter((enemy) => enemy && enemy.isAlive());
    }

    return [];
  }

  reflectedMagickCandidates(magick, side) {
    if (magick?.effect !== "revive") {
      return this.livingBattlersForSide(side);
    }

    const battlers =
      side === "ally"
        ? $gameParty.battleMembers()
        : side === "enemy"
          ? this.scene.enemies
          : [];

    return battlers.filter(
      (battler) =>
        battler &&
        typeof battler.canBeRevived === "function" &&
        battler.canBeRevived(),
    );
  }

  opposingBattleSide(side) {
    if (side === "ally") {
      return "enemy";
    }

    if (side === "enemy") {
      return "ally";
    }

    return null;
  }

  randomBattleTarget(candidates, random = Math.random) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }

    const roll = typeof random === "function" ? Number(random()) : Math.random();
    const normalizedRoll = Number.isFinite(roll)
      ? Math.max(0, Math.min(0.999999999, roll))
      : 0;
    const index = Math.floor(normalizedRoll * candidates.length);

    return candidates[index] || candidates[0] || null;
  }

  battlerForcesRandomTarget(battler) {
    return (
      battler &&
      typeof battler.forcesRandomTarget === "function" &&
      battler.forcesRandomTarget()
    );
  }

  battlerForcesPhysicalAttack(battler) {
    return (
      battler &&
      typeof battler.forcesPhysicalAttack === "function" &&
      battler.forcesPhysicalAttack()
    );
  }

  allLivingBattlers() {
    return [
      ...$gameParty.livingBattleMembers(),
      ...this.livingBattlersForSide("enemy"),
    ];
  }

  physicalAttackCandidates(battler) {
    if (!battler) {
      return [];
    }

    if (this.battlerForcesRandomTarget(battler)) {
      return this.allLivingBattlers();
    }

    const side = this.battlerSide(battler);
    return this.livingBattlersForSide(this.opposingBattleSide(side));
  }

  randomMagickTargetCandidates(magick) {
    const battle = this.scene;

    if (!magick || !battle.targetManager) {
      return [];
    }

    const candidates = [];

    for (const group of battle.targetManager.allowedTargetGroups(magick)) {
      const groupCandidates = battle.targetManager.selectableBattlers(
        group,
        magick,
      );

      for (const battler of groupCandidates) {
        if (!candidates.includes(battler)) {
          candidates.push(battler);
        }
      }
    }

    return candidates;
  }

  selectForcedTarget(target) {
    if (!target || !this.scene.targetManager) {
      return null;
    }

    return this.scene.targetManager.selectBattler(target);
  }

  startForcedPartyAction(random = Math.random) {
    const battle = this.scene;
    const battler = this.party().currentBattler();

    if (!battler || !this.battlerForcesPhysicalAttack(battler)) {
      return false;
    }

    const candidates = this.physicalAttackCandidates(battler);
    const target = this.battlerForcesRandomTarget(battler)
      ? this.randomBattleTarget(candidates, random)
      : candidates[0] || null;

    if (!target || !this.selectForcedTarget(target)) {
      return false;
    }

    battle.selectingEnemyTarget = false;
    battle.enemyTargetAction = null;
    battle.addBattleMessage(`${battler.name} attacks uncontrollably!`);

    this.setTurnState(BattleManager.TURN_ACTION);
    this.performAttack();

    return true;
  }

  resolveMagickReflection(magick, target, random = Math.random) {
    const reflections = [];
    let resolvedTarget = target;
    let reflectionLimit = null;

    if (!magick || magick.reflectable !== true || !resolvedTarget) {
      return {
        target: resolvedTarget,
        reflected: false,
        reflections,
      };
    }

    while (
      resolvedTarget &&
      typeof resolvedTarget.reflectsMagick === "function" &&
      resolvedTarget.reflectsMagick()
    ) {
      if (reflectionLimit === null) {
        reflectionLimit =
          typeof resolvedTarget.maxMagickReflections === "function"
            ? resolvedTarget.maxMagickReflections()
            : 0;
      }

      if (
        !Number.isInteger(reflectionLimit) ||
        reflections.length >= reflectionLimit
      ) {
        break;
      }

      const currentSide = this.battlerSide(resolvedTarget);
      const reflectedSide = this.opposingBattleSide(currentSide);
      const candidates = this.reflectedMagickCandidates(magick, reflectedSide);
      const reflectedTarget = this.randomBattleTarget(candidates, random);

      if (!reflectedTarget) {
        break;
      }

      reflections.push({
        from: resolvedTarget,
        to: reflectedTarget,
      });

      resolvedTarget = reflectedTarget;
    }

    return {
      target: resolvedTarget,
      reflected: reflections.length > 0,
      reflections,
    };
  }

  presentMagickReflection(magick, reflection) {
    const battle = this.scene;

    if (!reflection?.reflected || !Array.isArray(reflection.reflections)) {
      return [];
    }

    for (const step of reflection.reflections) {
      battle.addBattlePopup(step.from, "REFLECT", "status");
      battle.addBattleMessage(
        `${step.from.name}'s Reflect redirects ${magick.name} to ${step.to.name}!`,
      );
    }

    return reflection.reflections;
  }

  magickHitCount(magick) {
    const hits = Number(magick?.hits);

    return Number.isInteger(hits) && hits > 0 ? hits : 1;
  }

  magickUsesRandomTargetPerHit(magick) {
    return (
      magick?.randomTargetPerHit === true &&
      this.magickHitCount(magick) > 1
    );
  }

  resolveRandomMultiHitMagick(caster, magick, random = Math.random) {
    if (!caster || !magick || !this.magickUsesRandomTargetPerHit(magick)) {
      return [];
    }

    const resolutions = [];
    let paidCost = false;
    const hitCount = this.magickHitCount(magick);

    for (let hitIndex = 0; hitIndex < hitCount; hitIndex++) {
      // Rebuild candidates every hit so a target defeated by an earlier strike
      // is not selected again while another legal target remains.
      const candidates = this.randomMagickTargetCandidates(magick);
      const target = this.randomBattleTarget(candidates, random);

      if (!target) {
        break;
      }

      const resolution = this.resolveMagickEffectOnTarget(
        caster,
        magick,
        target,
        !paidCost,
        "single",
        random,
      );

      if (!resolution.success) {
        if (!paidCost) {
          break;
        }

        continue;
      }

      paidCost = true;
      resolutions.push({
        hit: hitIndex + 1,
        ...resolution,
      });
    }

    return resolutions;
  }

  performEscapeMagick(caster, magick) {
    const battle = this.scene;

    if (!caster || !magick || magick.effect !== "escape") {
      return false;
    }

    const success = caster.useMagick(
      magick.id,
      caster,
      true,
      "all",
    );

    if (!success) {
      return false;
    }

    battle.addBattleMessage(
      `${caster.name} casts ${magick.name}! The party escapes!`,
    );
    this.declareBattleOutcome(BattleManager.OUTCOME_ESCAPE);

    return true;
  }

  resolveMagickEffectOnTarget(
    caster,
    magick,
    requestedTarget,
    payCost = true,
    scope = "single",
    random = Math.random,
  ) {
    if (!caster || !magick || !requestedTarget) {
      return {
        success: false,
        requestedTarget,
        target: requestedTarget,
        reflected: false,
        reflections: [],
      };
    }

    const reflection = this.resolveMagickReflection(
      magick,
      requestedTarget,
      random,
    );
    const target = reflection.target;

    if (!target) {
      return {
        success: false,
        requestedTarget,
        target: null,
        ...reflection,
      };
    }

    const hpBefore = target.hp;
    const defeatedBefore = this.battlerIsDefeated(target);
    const success = caster.useMagick(
      magick.id,
      target,
      payCost,
      scope,
      random,
      { reflected: reflection.reflected },
    );

    if (!success) {
      return {
        success: false,
        requestedTarget,
        target,
        hpBefore,
        ...reflection,
      };
    }

    this.presentMagickReflection(magick, reflection);

    const statusResults = caster.magickStatusResults?.() || [];
    this.presentMagickStatusResults(caster, magick, target, statusResults);

    let damageResult = null;
    let healing = 0;

    if (magick.effect === "damage") {
      damageResult = this.presentMagickDamage(caster, magick, target, hpBefore);
    }

    if (magick.effect === "heal") {
      healing = Math.max(0, target.hp - hpBefore);

      this.scene.addBattlePopup(target, `+${healing}`, "heal");
      this.scene.addBattleMessage(
        `${caster.name} casts ${magick.name}! ` +
          `${target.name} recovers ${healing} HP!`,
      );
    }

    if (magick.effect === "revive") {
      healing = Math.max(0, target.hp - hpBefore);

      this.scene.addBattlePopup(target, `+${target.hp}`, "heal");
      this.scene.addBattleMessage(
        `${caster.name} casts ${magick.name}! ` +
          `${target.name} returns with ${target.hp} HP!`,
      );
    }

    if (magick.effect === "banish") {
      this.scene.addBattlePopup(target, "BANISHED", "status");
      this.scene.addBattleMessage(
        `${caster.name} casts ${magick.name}! ${target.name} is banished!`,
      );
    }

    this.presentDefeatTransition(target, defeatedBefore);

    return {
      success: true,
      requestedTarget,
      target,
      hpBefore,
      healing,
      defeatedBefore,
      defeatedAfter: this.battlerIsDefeated(target),
      damageResult,
      statusResults,
      ...reflection,
    };
  }

  presentMagickStatusResults(caster, magick, target, results = []) {
    const battle = this.scene;

    if (!Array.isArray(results) || results.length === 0) {
      return [];
    }

    const applied = [];
    const refreshed = [];
    const removed = [];
    let blocked = false;

    for (const result of results) {
      const name = result.name || result.key || "Status";

      if (result.applied) {
        if (result.refreshed) {
          refreshed.push(name);
          battle.addBattlePopup(target, `${name} ↻`, "status");
        } else {
          applied.push(name);
          battle.addBattlePopup(target, name, "status");
        }
        continue;
      }

      if (result.removed) {
        removed.push(name);
        battle.addBattlePopup(target, `-${name}`, "status");
        continue;
      }

      if (result.reason === "immune" || result.reason === "resisted") {
        blocked = true;
      }

      if (result.reason === "unknownStatus") {
        console.warn(
          `${magick.name} references unknown status "${result.key}".`,
        );
      }
    }

    if (magick.effect === "inflictStatus" || magick.effect === "removeStatus") {
      let message = `${caster.name} casts ${magick.name}!`;

      if (applied.length > 0) {
        message += ` ${target.name} gains ${applied.join(", ")}!`;
      } else if (refreshed.length > 0) {
        message += ` ${refreshed.join(", ")} refreshed on ${target.name}!`;
      } else if (removed.length > 0) {
        message += ` ${removed.join(", ")} removed from ${target.name}!`;
      } else {
        message += ` No effect on ${target.name}.`;
      }

      battle.addBattleMessage(message);

      if (blocked) {
        battle.addBattlePopup(target, "RESIST", "resist");
      }
    }

    return results;
  }

  presentMagickDamage(caster, magick, target, hpBefore) {
    const battle = this.scene;
    const damage = Math.max(0, hpBefore - target.hp);
    const healing = Math.max(0, target.hp - hpBefore);
    const elementRate =
      typeof target.elementRate === "function"
        ? target.elementRate(magick.element)
        : 1;
    const absorbed =
      elementRate > 0 &&
      typeof target.absorbsElementalMagick === "function" &&
      target.absorbsElementalMagick(magick.element);

    if (elementRate === 0) {
      battle.addBattlePopup(target, "IMMUNE", "immune");
      battle.addBattleMessage(
        `${caster.name} casts ${magick.name}! ${target.name} is immune!`,
      );

      return { damage: 0, healing: 0, absorbed: false, elementRate };
    }

    if (absorbed) {
      battle.addBattlePopup(target, "ABSORB", "heal");

      if (healing > 0) {
        battle.addBattlePopup(target, `+${healing}`, "heal");
      }

      const recoveryText =
        healing > 0 ? ` and recovers ${healing} HP!` : "!";

      battle.addBattleMessage(
        `${caster.name} casts ${magick.name}! ` +
          `${target.name} absorbs the magick${recoveryText}`,
      );

      return { damage: 0, healing, absorbed: true, elementRate };
    }

    battle.addBattlePopup(target, `-${damage}`, "damage");

    if (elementRate > 1) {
      battle.addBattlePopup(target, "WEAK", "weak");
    } else if (elementRate < 1) {
      battle.addBattlePopup(target, "RESIST", "resist");
    }

    if ($gameParty.battleMembers().includes(target)) {
      if (!this.battlerIsDefeated(target) && damage > 0) {
        battle.setActorState("hurt", 0.4, target);
      }
    } else if (battle.enemies.includes(target)) {
      if (!this.battlerIsDefeated(target) && damage > 0) {
        battle.setEnemyState("hurt", 0.4, target);
      }
    }

    battle.addBattleMessage(
      `${caster.name} casts ${magick.name}! ${target.name} takes ${damage} damage!`,
    );

    return { damage, healing: 0, absorbed: false, elementRate };
  }

  beginPartyTurn() {
    const party = this.party();
    const battler = party.activeBattler;

    if (!battler) {
      return false;
    }

    if (this.battlerHaltsTurnProgression(battler)) {
      this.scene.addBattleMessage(`${battler.name} is stopped!`);
      return false;
    }

    this.processTurnStartStatuses(battler);

    if (this.scene.outcome || !this.battlerCanAct(battler)) {
      if (!this.scene.outcome && !this.battlerIsDefeated(battler)) {
        this.scene.addBattleMessage(`${battler.name} cannot act!`);
      }

      return false;
    }

    return true;
  }

  endPartyTurn() {
    const party = this.party();
    const battler = party.activeBattler;

    if (!battler) {
      return false;
    }

    if (!this.battlerHaltsTurnProgression(battler)) {
      battler.tickStatusDurations({ mode: "turn" });
    }

    const outcome = this.detectBattleOutcome();

    if (outcome) {
      this.declareBattleOutcome(outcome);
    }

    return true;
  }

  skipPartyTurn() {
    if (this.scene.outcome) {
      return false;
    }

    this.endPartyTurn();

    if (this.scene.outcome) {
      return false;
    }

    this.finishPartyAction();
    return true;
  }

  finishPartyAction() {
    const battle = this.scene;
    const party = this.party();

    if (party.hasNextBattler()) {
      party.nextBattler();

      const canAct = this.beginPartyTurn();

      if (!canAct) {
        return this.skipPartyTurn();
      }

      if (this.startForcedPartyAction()) {
        return;
      }

      this.setTurnState(BattleManager.TURN_COMMAND);

      battle.battleInputLocked = false;

      return;
    }

    this.setTurnState(BattleManager.TURN_END);

    battle.queueEnemyTurn(0.1);
  }

  isTurnState(state) {
    return this.turnState === state;
  }

  currentTurnState() {
    return this.turnState;
  }

  queueEnemyTurn(delay = 0.5) {
    const battle = this.scene;

    this.prepareEnemyTurnQueue();
    battle.battleInputLocked = true;

    if (this.enemyTurnQueue.length === 0) {
      battle.pendingEnemyTurn = false;
      battle.enemyTurnDelay = 0;
      this.startNextPartyRound(true);
      return;
    }

    battle.pendingEnemyTurn = true;
    battle.enemyTurnDelay = delay;
  }

  // =================================
  // Updates
  // =================================

  updateActionPhase(deltaTime) {
    const battle = this.scene;
    if (battle.actionPhase === "none") {
      return;
    }

    if (battle.actionPhaseTimer > 0) {
      battle.actionPhaseTimer -= deltaTime;
    }

    if (battle.actionPhaseTimer > 0) {
      return;
    }

    battle.actionPhaseTimer = 0;

    switch (battle.actionPhase) {
      // =====================================
      // ATTACK SEQUENCE
      // =====================================

      case "lunge":
        battle.performAttackHit();
        battle.setActionPhase("hit", 0.15);
        break;

      case "hit":
        battle.setActionPhase("return", 0.25);
        break;

      case "return":
        battle.setActionPhase("wait", 0.25);
        break;

      case "wait":
        this.finishPartyActionSequence();
        break;

      // =====================================
      // MAGIC SEQUENCE
      // =====================================

      case "skillUse":
        battle.performSkillEffect();
        battle.setActionPhase("skillEffect", 0.2);
        break;

      case "skillEffect":
        battle.setActionPhase("skillRecover", 0.2);
        break;

      case "skillRecover":
        battle.setActionPhase("skillWait", 0.2);
        break;

      case "skillWait":
        this.finishPartyActionSequence();
        break;

      case "magickCast":
        battle.performMagickEffect();
        battle.setActionPhase("magickEffect", 0.25);
        break;

      case "magickEffect":
        battle.magickEffect = null;
        battle.magickEffectTarget = null;

        battle.setActionPhase("magickRecover", 0.25);
        break;

      case "magickRecover":
        battle.setActionPhase("magickWait", 0.25);
        break;

      case "magickWait":
        this.finishPartyActionSequence();
        break;

      // =====================================
      // ITEM SEQUENCE
      // =====================================

      case "itemUse":
        battle.performItemEffect();
        battle.setActionPhase("itemEffect", 0.25);
        break;

      case "itemEffect":
        battle.setActionPhase("itemRecover", 0.25);
        break;

      case "itemRecover":
        battle.setActionPhase("itemWait", 0.25);
        break;

      case "itemWait":
        this.finishPartyActionSequence();
        break;

      // =====================================
      // DEFAULT CASE
      // =====================================

      default:
        battle.setActionPhase("none");
        break;
    }
  }

  updatePendingEnemyTurn(deltaTime) {
    const battle = this.scene;
    if (battle.outcome) {
      battle.pendingEnemyTurn = false;
      return;
    }

    if (!battle.pendingEnemyTurn) {
      return;
    }

    battle.enemyTurnDelay -= deltaTime;

    if (battle.enemyTurnDelay > 0) {
      return;
    }

    battle.pendingEnemyTurn = false;
    battle.enemyTurnDelay = 0;

    battle.performEnemyTurn();
  }

  // =================================
  // Setters and Getters
  // =================================

  setTurnState(state) {
    this.turnState = state;
  }

  // =================================
  // Execution Methods
  // =================================

  executeCommand() {
    const battle = this.scene;
    const battler = this.party().currentBattler();
    const command = battle.commandWindow.currentCommand();

    DebugManager.log(`${battler.name} selected "${command}".`);

    if (
      typeof battler.isPlayerControlled === "function" &&
      !battler.isPlayerControlled()
    ) {
      this.rejectRestrictedAction(battler, command);
      return;
    }

    const actionKey = battle.commandWindow.commandActionKey
      ? battle.commandWindow.commandActionKey(command)
      : String(command || "").toLowerCase();

    if (!this.battlerCanUseAction(battler, actionKey)) {
      this.rejectRestrictedAction(battler, command);
      return;
    }

    switch (command) {
      case "Attack": {
        battle.targetScope = "single";

        if (this.battlerForcesRandomTarget(battler)) {
          const target = this.randomBattleTarget(
            this.physicalAttackCandidates(battler),
          );

          if (!target || !this.selectForcedTarget(target)) {
            battle.addBattleMessage(`${battler.name} has no valid target.`);
            return;
          }

          battle.addBattleMessage(
            `${battler.name} is confused and lashes out at ${target.name}!`,
          );
          battle.enemyTargetAction = null;
          battle.selectingEnemyTarget = false;
          this.performAttack();
          break;
        }

        battle.targetGroup = "enemy";
        battle.targetManager.selectFirstLivingEnemy();
        battle.enemyTargetAction = "attack";
        battle.selectingEnemyTarget = true;
        break;
      }

      case "Skills":
        battle.skillsWindow.show();
        break;

      case "Magick":
        battle.magickWindow.show();
        break;

      case "Item":
        battle.itemWindow.show();
        break;

      case "Defend":
        this.performDefend();
        break;
    }
  }

  executeSkill() {
    const battle = this.scene;
    const battler = this.party().currentBattler();
    const skill = battle.skillsWindow.currentSkill();

    if (!skill || !battler?.canUseSkill?.(skill.id)) {
      return;
    }

    const targetGroups = battle.targetManager.allowedTargetGroups(skill);
    const scopes = battle.targetManager.allowedScopes(skill);

    if (targetGroups.length === 0) {
      console.warn(`Skill ${skill.name} has no valid target groups.`);
      return;
    }

    battle.pendingSkill = skill;
    battle.targetScope = scopes.includes("single")
      ? "single"
      : scopes[0] || "single";

    // Start on the first allowed group that actually contains a legal target.
    // Enemy-first matches Attack and Magick while still allowing ally/self
    // techniques through the same data-driven target contract.
    const preferredGroups = ["enemy", "ally"].filter((group) =>
      targetGroups.includes(group),
    );
    let selectedTarget = null;

    for (const group of preferredGroups) {
      battle.targetGroup = group;
      selectedTarget =
        group === "enemy"
          ? battle.targetManager.selectFirstSelectableEnemy(skill)
          : battle.targetManager.selectFirstSelectableAlly(skill);

      if (selectedTarget) {
        break;
      }
    }

    if (!selectedTarget) {
      battle.addBattleMessage(`${skill.name} has no valid targets.`);
      battle.pendingSkill = null;
      return;
    }

    // Confuse preserves the selected Skill but takes target selection away
    // from the player, matching the existing Attack and Magick contract.
    if (this.battlerForcesRandomTarget(battler)) {
      if (battle.targetScope === "single") {
        const candidates = targetGroups.flatMap((group) =>
          battle.targetManager.selectableBattlers(group, skill),
        );
        const target = this.randomBattleTarget(candidates);

        if (!target || !this.selectForcedTarget(target)) {
          battle.addBattleMessage(`${skill.name} has no valid targets.`);
          battle.pendingSkill = null;
          return;
        }

        battle.pendingSkillTarget = target;
        battle.addBattleMessage(
          `${battler.name} is confused and targets ${target.name} with ${skill.name}!`,
        );
      } else {
        const legalGroups = targetGroups.filter(
          (group) =>
            battle.targetManager.selectableBattlers(group, skill).length > 0,
        );
        const targetGroup = this.randomBattleTarget(legalGroups);

        if (!targetGroup) {
          battle.addBattleMessage(`${skill.name} has no valid targets.`);
          battle.pendingSkill = null;
          return;
        }

        battle.targetGroup = targetGroup;
        battle.pendingSkillTarget = null;
        battle.addBattleMessage(
          `${battler.name} is confused and targets all ${targetGroup} battlers with ${skill.name}!`,
        );
      }

      battle.selectingEnemyTarget = false;
      battle.enemyTargetAction = null;
      battle.battleInputLocked = true;
      battle.setActorState("attack", 0.7);
      battle.setActionPhase("skillUse", 0.25);
      battle.skillsWindow.hide();
      return;
    }

    battle.enemyTargetAction = "skill";
    battle.selectingEnemyTarget = true;
    battle.skillsWindow.hide();
  }

  executeMagick() {
    const battle = this.scene;
    const battler = this.party().currentBattler();
    const magick = battle.magickWindow.currentMagick();

    if (!magick) {
      return;
    }

    if (!this.battlerCanUseAction(battler, "magick")) {
      this.rejectRestrictedAction(battler, "Magick");
      return;
    }

    if (!battler.canUseMagick(magick.id)) {
      return;
    }

    const targetGroups = battle.targetManager.allowedTargetGroups(magick);
    const scopes = battle.targetManager.allowedScopes(magick);

    if (targetGroups.length === 0) {
      console.warn(`Magick ${magick.name} has no valid target groups.`);
      return;
    }

    // Store the selected magick before entering target selection.
    battle.pendingMagick = magick;

    // Start on the first valid scope defined by the magick.
    battle.targetScope = scopes.includes("single")
      ? "single"
      : scopes[0] || "single";

    // Cast-level effects and per-hit random-target magick own their targeting
    // at resolution time. They should not ask the player to select a target
    // that will immediately be ignored.
    if (magick.effect === "escape" || this.magickUsesRandomTargetPerHit(magick)) {
      if (
        this.magickUsesRandomTargetPerHit(magick) &&
        this.randomMagickTargetCandidates(magick).length === 0
      ) {
        battle.addBattleMessage(`${magick.name} has no valid targets.`);
        battle.pendingMagick = null;
        return;
      }

      battle.pendingMagickTarget = null;
      battle.enemyTargetAction = null;
      battle.selectingEnemyTarget = false;
      battle.battleInputLocked = true;
      battle.setActorState("magick", 0.9);
      battle.setActionPhase("magickCast", 0.4);
      battle.magickWindow.hide();
      return;
    }

    // Start on the first allowed group that actually contains a legal target.
    // Enemy-first preserves the established offensive targeting preference,
    // while revive/cleanse magick can select defeated allies through the same
    // target-validity contract used by execution.
    const preferredGroups = ["enemy", "ally"].filter((group) =>
      targetGroups.includes(group),
    );
    let selectedTarget = null;

    for (const group of preferredGroups) {
      battle.targetGroup = group;
      selectedTarget =
        group === "enemy"
          ? battle.targetManager.selectFirstSelectableEnemy(magick)
          : battle.targetManager.selectFirstSelectableAlly(magick);

      if (selectedTarget) {
        break;
      }
    }

    if (!selectedTarget) {
      battle.addBattleMessage(`${magick.name} has no valid targets.`);
      battle.pendingMagick = null;
      return;
    }

    // Confuse preserves the chosen action/magick but takes target selection away
    // from the player. Single-target magick choose randomly from every target
    // that is legal for the selected magick. All-target-only magick choose a
    // random legal target group and then resolve against that whole side.
    if (this.battlerForcesRandomTarget(battler)) {
      if (battle.targetScope === "single") {
        const target = this.randomBattleTarget(
          this.randomMagickTargetCandidates(magick),
        );

        if (!target || !this.selectForcedTarget(target)) {
          battle.addBattleMessage(`${magick.name} has no valid targets.`);
          battle.pendingMagick = null;
          return;
        }

        battle.pendingMagickTarget = target;
        battle.addBattleMessage(
          `${battler.name} is confused and targets ${target.name} with ${magick.name}!`,
        );
      } else {
        const legalGroups = targetGroups.filter(
          (group) =>
            battle.targetManager.selectableBattlers(group, magick).length > 0,
        );
        const targetGroup = this.randomBattleTarget(legalGroups);

        if (!targetGroup) {
          battle.addBattleMessage(`${magick.name} has no valid targets.`);
          battle.pendingMagick = null;
          return;
        }

        battle.targetGroup = targetGroup;
        battle.pendingMagickTarget = null;
        battle.addBattleMessage(
          `${battler.name} is confused and targets all ${targetGroup} battlers with ${magick.name}!`,
        );
      }

      battle.enemyTargetAction = null;
      battle.selectingEnemyTarget = false;
      battle.battleInputLocked = true;
      battle.setActorState("magick", 0.9);
      battle.setActionPhase("magickCast", 0.4);
      battle.magickWindow.hide();
      return;
    }

    battle.enemyTargetAction = "magick";
    battle.selectingEnemyTarget = true;

    battle.magickWindow.hide();
  }

  executeItem() {
    const battle = this.scene;
    const battler = this.party().currentBattler();
    const item = battle.itemWindow.currentItem();

    if (!this.battlerCanUseAction(battler, "item")) {
      this.rejectRestrictedAction(battler, "Item");
      return;
    }

    if (!item) {
      return;
    }

    // Store the item for the effect phase.
    battle.pendingItem = item;

    // Close the item window now.
    battle.itemWindow.hide();

    // Lock commands while the action plays.
    battle.battleInputLocked = true;

    // Begin the item action.
    battle.setActionPhase("itemUse", 0.35);
  }

  // =================================
  // Perform Methods
  // =================================

  performAttack() {
    const battle = this.scene;
    const battler = this.party().currentBattler();
    const target = battle.targetManager.getSelectedTarget();

    if (!this.battlerCanUseAction(battler, "attack")) {
      this.rejectRestrictedAction(battler, "Attack");
      return;
    }

    if (!target) {
      return;
    }

    battle.pendingAttackTarget = target;

    if (this.battlerIsDefeated(battle.enemy)) {
      const nextEnemy = battle.enemies.find(
        (enemy) => !this.battlerIsDefeated(enemy),
      );

      if (!nextEnemy) {
        return;
      }

      battle.enemy = nextEnemy;
    }

    battle.battleInputLocked = true;
    battle.pendingAttackDamage = true;

    battle.setActorState("attack", 0.4);
    battle.setActionPhase("lunge", 0.2);
  }

  performAttackHit() {
    const battle = this.scene;
    const battler = this.party().currentBattler();

    if (!battle.pendingAttackDamage) {
      return;
    }

    if (!battler) {
      return;
    }

    battle.pendingAttackDamage = false;

    const target = battle.pendingAttackTarget;
    battle.pendingAttackTarget = null;

    if (!target || this.battlerIsDefeated(target)) {
      return;
    }

    const hitChance = this.physicalHitChance(battler);
    const hitRoll = Math.random() * 100;

    if (hitRoll >= hitChance) {
      battle.addBattlePopup(target, "MISS", "miss");

      battle.addBattleMessage(
        `${battler.name} attacks! ${battler.name} misses ${target.name}!`,
      );

      return;
    }

    const criticalChancePercent = Math.max(
      0,
      (battler.luck + battler.level - target.level) / 4 +
        battler.totalCritical(),
    );
    const criticalChance = criticalChancePercent / 100;
    const isCritical = Math.random() < criticalChance;
    const damageResult = this.applyPhysicalDamage(battler, target, {
      critical: isCritical,
    });
    const damage = damageResult.damage;

    if (damage > 0) {
      battle.addBattlePopup(target, `-${damage}`, "damage");

      if (isCritical) {
        battle.addBattlePopup(target, "CRITICAL", "critical");
      }
    } else {
      battle.addBattlePopup(target, "BLOCK", "immune");
    }

    const damageMessage =
      damage > 0
        ? `${target.name} takes ${damage} damage!`
        : `${target.name} blocks the attack!`;

    // -----------------------------
    // Ally target
    // -----------------------------

    if ($gameParty.battleMembers().includes(target)) {
      if (this.battlerIsDefeated(target)) {
        battle.setActorState("defeat", 0, target);

        if ($gameParty.livingBattleMembers().length === 0) {
          this.declareBattleOutcome(BattleManager.OUTCOME_DEFEAT);
        }

        battle.addBattleMessage(
          `${battler.name} attacks ${target.name}! ${damageMessage}`,
        );

        return;
      }

      if (damage > 0) {
        battle.setActorState("hurt", 0.3, target);
      }

      battle.addBattleMessage(
        `${battler.name} attacks ${target.name}! ${damageMessage}`,
      );

      return;
    }

    // -----------------------------
    // Enemy target
    // -----------------------------

    if (this.battlerIsDefeated(target)) {
      battle.setEnemyState("defeat", 0, target);

      battle.addBattleMessage(`${battler.name} attacks! ${damageMessage}`);

      return;
    }

    if (damage > 0) {
      battle.setEnemyState("hurt", 0.3, target);
    }

    battle.addBattleMessage(`${battler.name} attacks! ${damageMessage}`);
  }

  appliedSkillStatusNames(statusResults) {
    return statusResults
      .filter((result) => result?.applied === true)
      .map((result) => result.name || result.key)
      .filter(Boolean);
  }

  showSkillStatusPopups(target, statusNames) {
    const battle = this.scene;

    for (const statusName of statusNames) {
      battle.addBattlePopup(target, String(statusName).toUpperCase(), "status");
    }
  }

  performSkillDamageTarget(caster, skill, target, random = Math.random) {
    const battle = this.scene;
    const hitChance = this.physicalHitChance(caster);
    const roll = typeof random === "function" ? Number(random()) : Math.random();

    if (roll * 100 >= hitChance) {
      battle.addBattlePopup(target, "MISS", "miss");
      battle.addBattleMessage(
        `${caster.name} uses ${skill.name}! ${caster.name} misses ${target.name}!`,
      );
      return false;
    }

    const result = this.applyPhysicalDamage(caster, target, {
      powerMultiplier: caster.skillPowerMultiplier?.(skill) ?? 1,
    });
    const damage = result.damage;
    const statusResults =
      typeof caster.resolveSkillStatusEffects === "function"
        ? caster.resolveSkillStatusEffects(skill, target, random)
        : [];
    const statusNames = this.appliedSkillStatusNames(statusResults);

    battle.addBattlePopup(
      target,
      damage > 0 ? `-${damage}` : "BLOCK",
      damage > 0 ? "damage" : "immune",
    );
    this.showSkillStatusPopups(target, statusNames);

    const statusMessage =
      statusNames.length > 0 ? ` ${statusNames.join(", ")} takes hold!` : "";
    battle.addBattleMessage(
      `${caster.name} uses ${skill.name}! ${target.name} ${
        damage > 0 ? `takes ${damage} damage!` : "blocks the technique!"
      }${statusMessage}`,
    );

    if (this.battlerIsDefeated(target)) {
      if ($gameParty.battleMembers().includes(target)) {
        battle.setActorState("defeat", 0, target);
      } else {
        battle.setEnemyState("defeat", 0, target);
      }
    } else if (damage > 0) {
      if ($gameParty.battleMembers().includes(target)) {
        battle.setActorState("hurt", 0.3, target);
      } else {
        battle.setEnemyState("hurt", 0.3, target);
      }
    }

    return true;
  }

  performSkillHealTarget(caster, skill, target) {
    const battle = this.scene;
    const hpBefore = target.hp;
    const requestedHealing = caster.skillHealing?.(skill, target) ?? 0;

    if (requestedHealing <= 0 || typeof target.gainHp !== "function") {
      return false;
    }

    target.gainHp(requestedHealing);
    const healing = Math.max(0, target.hp - hpBefore);

    if (healing > 0) {
      battle.addBattlePopup(target, `+${healing}`, "heal");
      battle.addBattleMessage(
        `${caster.name} uses ${skill.name}! ${target.name} recovers ${healing} HP!`,
      );
      return true;
    }

    return false;
  }

  performSkillStatusTarget(caster, skill, target, random = Math.random) {
    const battle = this.scene;
    const statusResults =
      typeof caster.resolveSkillStatusEffects === "function"
        ? caster.resolveSkillStatusEffects(skill, target, random)
        : [];
    const statusNames = this.appliedSkillStatusNames(statusResults);

    this.showSkillStatusPopups(target, statusNames);

    if (statusNames.length > 0) {
      battle.addBattleMessage(
        `${caster.name} uses ${skill.name}! ${target.name} is afflicted by ${statusNames.join(", ")}!`,
      );
    } else {
      battle.addBattleMessage(
        `${caster.name} uses ${skill.name}! ${target.name} resists the technique!`,
      );
    }

    if (this.battlerIsDefeated(target)) {
      if ($gameParty.battleMembers().includes(target)) {
        battle.setActorState("defeat", 0, target);
      } else {
        battle.setEnemyState("defeat", 0, target);
      }
    }

    return statusNames.length > 0;
  }

  performSkillTarget(caster, skill, target, random = Math.random) {
    if (skill.effect === "damage") {
      return this.performSkillDamageTarget(caster, skill, target, random);
    }

    if (skill.effect === "heal") {
      return this.performSkillHealTarget(caster, skill, target);
    }

    if (skill.effect === "inflictStatus") {
      return this.performSkillStatusTarget(caster, skill, target, random);
    }

    console.warn(`Skill ${skill.name} effect "${skill.effect}" is not implemented.`);
    return false;
  }

  performSkillEffect() {
    const battle = this.scene;
    const caster = this.party().currentBattler();
    const skill = battle.pendingSkill;

    if (!caster || !skill || !caster.canUseSkill?.(skill.id)) {
      battle.pendingSkill = null;
      battle.pendingSkillTarget = null;
      return false;
    }

    const targets =
      battle.targetScope === "all"
        ? battle.targetManager.getCurrentTargets()
        : [battle.pendingSkillTarget].filter(Boolean);
    const validTargets = targets.filter((target) =>
      caster.isValidSkillTarget?.(skill, target),
    );

    if (validTargets.length === 0 || !caster.paySkillCost?.(skill)) {
      battle.pendingSkill = null;
      battle.pendingSkillTarget = null;
      return false;
    }

    let affected = false;

    for (const target of validTargets) {
      affected = this.performSkillTarget(caster, skill, target) || affected;
    }

    battle.pendingSkill = null;
    battle.pendingSkillTarget = null;
    const outcome = this.detectBattleOutcome();
    if (outcome) this.declareBattleOutcome(outcome);
    return affected;
  }

  performMagickEffect() {
    const battle = this.scene;
    const magick = battle.pendingMagick;
    const requestedTarget = battle.pendingMagickTarget;
    const caster = this.party().currentBattler();

    if (!caster || !magick) {
      return;
    }

    // =====================================
    // CAST-LEVEL ESCAPE EFFECT
    // =====================================

    if (magick.effect === "escape") {
      const success = this.performEscapeMagick(caster, magick);

      if (success) {
        battle.magickEffect = magick;
        battle.magickEffectTarget = caster;
      }

      battle.pendingMagick = null;
      battle.pendingMagickTarget = null;
      return;
    }

    // =====================================
    // RANDOM PER-HIT MAGIC EFFECT
    // =====================================

    if (this.magickUsesRandomTargetPerHit(magick)) {
      const resolutions = this.resolveRandomMultiHitMagick(caster, magick);
      const lastResolution = resolutions[resolutions.length - 1] || null;

      if (lastResolution) {
        battle.magickEffect = magick;
        battle.magickEffectTarget = lastResolution.target;
      }

      battle.pendingMagick = null;
      battle.pendingMagickTarget = null;
      return;
    }

    // =====================================
    // MULTI-TARGET MAGIC EFFECT
    // =====================================

    if (battle.targetScope === "all") {
      const targets = battle.targetManager.getCurrentTargets();

      if (!targets || targets.length === 0) {
        return;
      }

      let paidCost = false;
      const affectedTargets = [];

      for (const target of targets) {
        if (!target) {
          continue;
        }

        // Reflection is resolved independently for every original target.
        // MP is still paid only once for the cast.
        const resolution = this.resolveMagickEffectOnTarget(
          caster,
          magick,
          target,
          !paidCost,
          battle.targetScope,
        );

        if (!resolution.success) {
          continue;
        }

        paidCost = true;
        affectedTargets.push(resolution.target);
      }

      // -----------------------------
      // VISUAL EFFECTS
      // -----------------------------

      if (affectedTargets.length > 0) {
        const visualTargets = [...new Set(affectedTargets)];

        if (magick.element === "fire") {
          battle.startBattleEffect("fire", visualTargets, 0.4);
        }

        if (magick.effect === "heal") {
          battle.startBattleEffect("cure", visualTargets, 0.5);
        }
      }

      battle.pendingMagick = null;
      battle.pendingMagickTarget = null;

      return;
    }

    // =====================================
    // SINGLE TARGET MAGIC EFFECT
    // =====================================

    if (!requestedTarget) {
      return;
    }

    const resolution = this.resolveMagickEffectOnTarget(
      caster,
      magick,
      requestedTarget,
      true,
      battle.targetScope,
    );

    if (!resolution.success) {
      battle.pendingMagick = null;
      battle.pendingMagickTarget = null;

      battle.setActorState("idle");
      return;
    }

    const target = resolution.target;

    battle.magickEffect = magick;
    battle.magickEffectTarget = target;

    if (magick.element === "fire") {
      battle.startBattleEffect("fire", target, 0.4);
    }

    if (magick.effect === "heal") {
      battle.startBattleEffect("cure", target, 0.5);
    }

    battle.pendingMagick = null;
    battle.pendingMagickTarget = null;
  }

  performItemEffect() {
    const battle = this.scene;
    const item = battle.pendingItem;
    const battler = this.party().currentBattler();

    if (!battler) {
      return;
    }

    if (!item) {
      return;
    }

    const hpBefore = battler.hp;

    const success = $gameParty.useItem(item.id, battler);

    if (!success) {
      battle.pendingItem = null;
      return false;
    }

    const healing = battler.hp - hpBefore;

    battle.addBattleMessage(
      `${battler.name} uses ${item.name}! ` +
        `${battler.name} recovers ${healing} HP!`,
    );

    // The pending item has now been used.
    battle.pendingItem = null;
    return true;
  }

  performDefend() {
    const battle = this.scene;
    const battler = this.party().currentBattler();

    if (!this.battlerCanUseAction(battler, "defend")) {
      this.rejectRestrictedAction(battler, "Defend");
      return;
    }

    battler.startDefending();

    battle.addBattleMessage(`${battler.name} defends!`);

    this.endPartyTurn();

    if (battle.outcome) {
      return;
    }

    this.finishPartyAction();
  }

  startNextPartyRound(unlockInputAtRoundStart = false) {
    const battle = this.scene;

    battle.enemyTurnIndex = 0;
    battle.pendingEnemyTurn = false;
    battle.enemyTurnDelay = 0;
    this.enemyTurnQueue = [];

    this.party().resetPartyTurnQueue();

    if (!this.party().currentBattler()) {
      this.setTurnState(BattleManager.TURN_END);
      this.queueEnemyTurn(0.1);
      return;
    }

    const canAct = this.beginPartyTurn();

    if (!canAct) {
      this.skipPartyTurn();
      return;
    }

    if (this.startForcedPartyAction()) {
      return;
    }

    this.setTurnState(BattleManager.TURN_COMMAND);

    if (unlockInputAtRoundStart) {
      battle.battleInputLocked = false;
    }
  }

  advanceEnemyTurn(unlockInputAtRoundStart = false, remainingEnemyDelay = 0.6) {
    const battle = this.scene;

    battle.enemyTurnIndex++;

    if (battle.enemyTurnIndex < this.enemyTurnQueue.length) {
      battle.pendingEnemyTurn = true;
      battle.enemyTurnDelay = remainingEnemyDelay;
      return;
    }

    this.startNextPartyRound(unlockInputAtRoundStart);
  }

  completeEnemyTurn(enemy, unlockInputAtRoundStart = false) {
    if (
      enemy &&
      !this.battlerHaltsTurnProgression(enemy) &&
      typeof enemy.tickStatusDurations === "function"
    ) {
      enemy.tickStatusDurations({ mode: "turn" });
    }

    const outcome = this.detectBattleOutcome();

    if (outcome) {
      this.declareBattleOutcome(outcome);
      return;
    }

    this.advanceEnemyTurn(unlockInputAtRoundStart);
  }

  performEnemyPhysicalAction(enemy, target, random = Math.random) {
    const battle = this.scene;

    if (!enemy || !target) {
      return false;
    }

    battle.setEnemyState("attack", 0.4, enemy);

    const hitChance = this.physicalHitChance(enemy);
    const roll = typeof random === "function" ? Number(random()) : Math.random();
    const normalizedRoll = Number.isFinite(roll)
      ? Math.max(0, Math.min(0.999999999, roll))
      : 0;
    const hitRoll = normalizedRoll * 100;

    if (hitRoll >= hitChance) {
      battle.addBattlePopup(target, "MISS", "miss");
      battle.addBattleMessage(
        `${enemy.name} attacks! ${enemy.name} misses ${target.name}!`,
      );
      this.completeEnemyTurn(enemy, false);
      return true;
    }

    const damageResult = this.applyPhysicalDamage(enemy, target);
    const damage = damageResult.damage;

    if (damage > 0) {
      battle.addBattlePopup(target, `-${damage}`, "damage");
    } else {
      battle.addBattlePopup(target, "BLOCK", "immune");
    }

    if ($gameParty.battleMembers().includes(target)) {
      if (this.battlerIsDefeated(target)) {
        battle.setActorState("defeat", 0, target);
      } else if (damage > 0) {
        battle.setActorState("hurt", 0.3, target);
      }
    } else if (battle.enemies.includes(target)) {
      if (this.battlerIsDefeated(target)) {
        battle.setEnemyState("defeat", 0, target);
      } else if (damage > 0) {
        battle.setEnemyState("hurt", 0.3, target);
      }
    }

    const damageMessage =
      damage > 0
        ? `${target.name} takes ${damage} damage!`
        : `${target.name} blocks the attack!`;

    battle.addBattleMessage(`${enemy.name} attacks! ${damageMessage}`);

    const outcome = this.detectBattleOutcome();

    if (outcome) {
      battle.enemyTurnIndex = 0;
      this.declareBattleOutcome(outcome);
      return true;
    }

    this.completeEnemyTurn(enemy, false);
    return true;
  }

  performEnemySkillAction(enemy, action, random = Math.random) {
    const battle = this.scene;
    const skill = DatabaseManager.skill?.(action?.skillId) || null;

    if (!enemy || !skill || !enemy.canUseSkill?.(skill.id)) {
      return false;
    }

    const scope = action.scope || "single";
    const allowedScopes = Array.isArray(skill.scope) ? skill.scope : ["single"];

    if (!allowedScopes.includes(scope)) {
      battle.addBattleMessage(`${enemy.name} cannot use ${skill.name}!`);
      this.completeEnemyTurn(enemy, false);
      return false;
    }

    const targets =
      scope === "all"
        ? this.enemyAI.targetCandidates(enemy, action)
        : [this.enemyAI.selectTarget(enemy, action, random)].filter(Boolean);
    const validTargets = targets.filter((target) =>
      enemy.isValidSkillTarget?.(skill, target),
    );

    if (validTargets.length === 0 || !enemy.paySkillCost?.(skill)) {
      battle.addBattleMessage(`${enemy.name} cannot use ${skill.name}!`);
      this.completeEnemyTurn(enemy, false);
      return false;
    }

    battle.setEnemyState("attack", 0.4, enemy);

    for (const target of validTargets) {
      this.performSkillTarget(enemy, skill, target, random);
    }

    const outcome = this.detectBattleOutcome();

    if (outcome) {
      battle.enemyTurnIndex = 0;
      this.declareBattleOutcome(outcome);
      return true;
    }

    this.completeEnemyTurn(enemy, false);
    return true;
  }

  performEnemyMagickAction(enemy, action, random = Math.random) {
    const battle = this.scene;
    const magick = DatabaseManager.magick(action?.magickId);

    if (!enemy || !magick) {
      return false;
    }

    const scope = action.scope || "single";
    battle.setEnemyState("attack", 0.4, enemy);

    let resolutions = [];

    if (this.magickUsesRandomTargetPerHit(magick)) {
      let paidCost = false;
      const hitCount = this.magickHitCount(magick);

      for (let hitIndex = 0; hitIndex < hitCount; hitIndex++) {
        const target = this.enemyAI.selectTarget(enemy, action, random);

        if (!target) {
          break;
        }

        const resolution = this.resolveMagickEffectOnTarget(
          enemy,
          magick,
          target,
          !paidCost,
          "single",
          random,
        );

        if (!resolution.success) {
          if (!paidCost) {
            break;
          }
          continue;
        }

        paidCost = true;
        resolutions.push(resolution);
      }
    } else if (scope === "all") {
      let paidCost = false;
      const targets = this.enemyAI.targetCandidates(enemy, action);

      for (const target of targets) {
        const resolution = this.resolveMagickEffectOnTarget(
          enemy,
          magick,
          target,
          !paidCost,
          "all",
          random,
        );

        if (!resolution.success) {
          continue;
        }

        paidCost = true;
        resolutions.push(resolution);
      }
    } else {
      const target = this.enemyAI.selectTarget(enemy, action, random);

      if (target) {
        const resolution = this.resolveMagickEffectOnTarget(
          enemy,
          magick,
          target,
          true,
          "single",
          random,
        );

        if (resolution.success) {
          resolutions.push(resolution);
        }
      }
    }

    const visualTargets = [
      ...new Set(resolutions.map((resolution) => resolution.target).filter(Boolean)),
    ];

    if (visualTargets.length > 0) {
      if (magick.element === "fire") {
        battle.startBattleEffect(
          "fire",
          visualTargets.length === 1 ? visualTargets[0] : visualTargets,
          0.4,
        );
      }

      if (magick.effect === "heal") {
        battle.startBattleEffect(
          "cure",
          visualTargets.length === 1 ? visualTargets[0] : visualTargets,
          0.5,
        );
      }
    }

    if (battle.outcome) {
      battle.enemyTurnIndex = 0;
      return true;
    }

    if (resolutions.length === 0) {
      battle.addBattleMessage(`${enemy.name} cannot use ${magick.name}!`);
    }

    this.completeEnemyTurn(enemy, false);
    return resolutions.length > 0;
  }

  performEnemyTurn(
    enemy = this.currentEnemyTurnBattler(),
    random = Math.random,
  ) {
    const battle = this.scene;

    if (!enemy || this.battlerIsDefeated(enemy)) {
      this.advanceEnemyTurn(true, 0.2);
      return;
    }

    if (this.battlerHaltsTurnProgression(enemy)) {
      battle.addBattleMessage(`${enemy.name} is stopped!`);
      this.completeEnemyTurn(enemy, true);
      return;
    }

    this.processTurnStartStatuses(enemy);

    if (battle.outcome) {
      return;
    }

    if (this.battlerIsDefeated(enemy)) {
      this.advanceEnemyTurn(true);
      return;
    }

    if (!this.battlerCanAct(enemy)) {
      battle.addBattleMessage(`${enemy.name} cannot act!`);
      this.completeEnemyTurn(enemy, true);
      return;
    }

    if (this.battlerForcesPhysicalAttack(enemy)) {
      const candidates = this.physicalAttackCandidates(enemy);
      const target = this.battlerForcesRandomTarget(enemy)
        ? this.randomBattleTarget(candidates, random)
        : candidates[0] || null;

      if (!target) {
        this.completeEnemyTurn(enemy, true);
        return;
      }

      this.performEnemyPhysicalAction(enemy, target, random);
      return;
    }

    const action = this.enemyAI.selectAction(enemy, random);

    if (!action) {
      battle.addBattleMessage(`${enemy.name} has no usable action!`);
      this.completeEnemyTurn(enemy, true);
      return;
    }

    if (action.type === "magick") {
      this.performEnemyMagickAction(enemy, action, random);
      return;
    }

    if (action.type === "skill") {
      this.performEnemySkillAction(enemy, action, random);
      return;
    }

    const target = this.enemyAI.selectTarget(enemy, action, random);

    if (!target) {
      battle.addBattleMessage(`${enemy.name} has no valid target!`);
      this.completeEnemyTurn(enemy, true);
      return;
    }

    this.performEnemyPhysicalAction(enemy, target, random);
  }

}
