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

  createRewardBundle(defeatedEnemies) {
    return {
      exp: this.calculateExperienceReward(defeatedEnemies),
      currency: this.calculateCurrencyReward(defeatedEnemies),
      drops: this.calculateItemDrops(defeatedEnemies),
      resonance: this.calculateEssenceResonance(defeatedEnemies),
    };
  }

  calculateExperienceReward(defeatedEnemies) {
    return defeatedEnemies.reduce((total, enemy) => {
      const reward = enemy.expReward;
      return total + (Number.isInteger(reward) && reward > 0 ? reward : 0);
    }, 0);
  }

  // Extension points for later reward passes. These intentionally return
  // empty rewards until their owning systems exist.
  calculateCurrencyReward(_defeatedEnemies) {
    return 0;
  }

  calculateItemDrops(_defeatedEnemies) {
    return [];
  }

  calculateEssenceResonance(_defeatedEnemies) {
    return 0;
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
        ? this.createRewardBundle(defeatedEnemies)
        : { exp: 0, currency: 0, drops: [], resonance: 0 };

    const partyResults = partyMembers.map((actor) => {
      const snapshot = partySnapshots.get(actor);
      let levelsGained = 0;
      let expGained = 0;

      if (outcome === BattleManager.OUTCOME_VICTORY && rewards.exp > 0) {
        levelsGained = actor.gainExp(rewards.exp);
        expGained = rewards.exp;
      }

      const postBattle = actor.restorePostBattleState(snapshot);

      return {
        actorId: actor.actorId,
        name: actor.name,
        expGained,
        levelsGained,
        levelBefore: snapshot.levelBefore,
        levelAfter: actor.level,
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
      })),
      party: partyResults,
    };

    this.scene.result = this.finalResult;

    return this.finalResult;
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

  calculatePhysicalDamage(attacker, target, { critical = false } = {}) {
    if (!attacker || !target) {
      return 0;
    }

    const attack =
      typeof attacker.totalAttack === "function" ? attacker.totalAttack() : 0;
    const defense =
      typeof target.totalDefense === "function" ? target.totalDefense() : 0;

    let damage = Math.max(1, attack - defense);

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

  reflectedSkillCandidates(skill, side) {
    if (skill?.effect !== "revive") {
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

  randomSkillTargetCandidates(skill) {
    const battle = this.scene;

    if (!skill || !battle.targetManager) {
      return [];
    }

    const candidates = [];

    for (const group of battle.targetManager.allowedTargetGroups(skill)) {
      const groupCandidates = battle.targetManager.selectableBattlers(
        group,
        skill,
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

  resolveSkillReflection(skill, target, random = Math.random) {
    const reflections = [];
    let resolvedTarget = target;
    let reflectionLimit = null;

    if (!skill || skill.reflectable !== true || !resolvedTarget) {
      return {
        target: resolvedTarget,
        reflected: false,
        reflections,
      };
    }

    while (
      resolvedTarget &&
      typeof resolvedTarget.reflectsSkills === "function" &&
      resolvedTarget.reflectsSkills()
    ) {
      if (reflectionLimit === null) {
        reflectionLimit =
          typeof resolvedTarget.maxSkillReflections === "function"
            ? resolvedTarget.maxSkillReflections()
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
      const candidates = this.reflectedSkillCandidates(skill, reflectedSide);
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

  presentSkillReflection(skill, reflection) {
    const battle = this.scene;

    if (!reflection?.reflected || !Array.isArray(reflection.reflections)) {
      return [];
    }

    for (const step of reflection.reflections) {
      battle.addBattlePopup(step.from, "REFLECT", "status");
      battle.addBattleMessage(
        `${step.from.name}'s Reflect redirects ${skill.name} to ${step.to.name}!`,
      );
    }

    return reflection.reflections;
  }

  resolveMagicEffectOnTarget(
    caster,
    skill,
    requestedTarget,
    payCost = true,
    scope = "single",
    random = Math.random,
  ) {
    if (!caster || !skill || !requestedTarget) {
      return {
        success: false,
        requestedTarget,
        target: requestedTarget,
        reflected: false,
        reflections: [],
      };
    }

    const reflection = this.resolveSkillReflection(
      skill,
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
    const success = caster.useSkill(
      skill.id,
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

    this.presentSkillReflection(skill, reflection);

    const statusResults = caster.skillStatusResults?.() || [];
    this.presentSkillStatusResults(caster, skill, target, statusResults);

    let damageResult = null;
    let healing = 0;

    if (skill.effect === "damage") {
      damageResult = this.presentMagicDamage(caster, skill, target, hpBefore);
    }

    if (skill.effect === "heal") {
      healing = Math.max(0, target.hp - hpBefore);

      this.scene.addBattlePopup(target, `+${healing}`, "heal");
      this.scene.addBattleMessage(
        `${caster.name} casts ${skill.name}! ` +
          `${target.name} recovers ${healing} HP!`,
      );
    }

    if (skill.effect === "revive") {
      healing = Math.max(0, target.hp - hpBefore);

      this.scene.addBattlePopup(target, `+${target.hp}`, "heal");
      this.scene.addBattleMessage(
        `${caster.name} casts ${skill.name}! ` +
          `${target.name} returns with ${target.hp} HP!`,
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

  presentSkillStatusResults(caster, skill, target, results = []) {
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
          `${skill.name} references unknown status "${result.key}".`,
        );
      }
    }

    if (skill.effect === "inflictStatus" || skill.effect === "removeStatus") {
      let message = `${caster.name} casts ${skill.name}!`;

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

  presentMagicDamage(caster, skill, target, hpBefore) {
    const battle = this.scene;
    const damage = Math.max(0, hpBefore - target.hp);
    const healing = Math.max(0, target.hp - hpBefore);
    const elementRate =
      typeof target.elementRate === "function"
        ? target.elementRate(skill.element)
        : 1;
    const absorbed =
      elementRate > 0 &&
      typeof target.absorbsElementalMagic === "function" &&
      target.absorbsElementalMagic(skill.element);

    if (elementRate === 0) {
      battle.addBattlePopup(target, "IMMUNE", "immune");
      battle.addBattleMessage(
        `${caster.name} casts ${skill.name}! ${target.name} is immune!`,
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
        `${caster.name} casts ${skill.name}! ` +
          `${target.name} absorbs the magic${recoveryText}`,
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
      `${caster.name} casts ${skill.name}! ${target.name} takes ${damage} damage!`,
    );

    return { damage, healing: 0, absorbed: false, elementRate };
  }

  beginPartyTurn() {
    const party = this.party();
    const battler = party.activeBattler;

    if (!battler) {
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

    battler.tickStatusDurations();

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
    battle.pendingEnemyTurn = true;
    battle.enemyTurnDelay = delay;
    battle.battleInputLocked = true;
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

      case "magicCast":
        battle.performMagicEffect();
        battle.setActionPhase("magicEffect", 0.25);
        break;

      case "magicEffect":
        battle.magicEffectSkill = null;
        battle.magicEffectTarget = null;

        battle.setActionPhase("magicRecover", 0.25);
        break;

      case "magicRecover":
        battle.setActionPhase("magicWait", 0.25);
        break;

      case "magicWait":
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

      case "Magic":
        battle.magicWindow.show();
        break;

      case "Item":
        battle.itemWindow.show();
        break;

      case "Defend":
        this.performDefend();
        break;
    }
  }

  executeMagic() {
    const battle = this.scene;
    const battler = this.party().currentBattler();
    const skill = battle.magicWindow.currentSkill();

    if (!skill) {
      return;
    }

    if (!this.battlerCanUseAction(battler, "magic")) {
      this.rejectRestrictedAction(battler, "Magic");
      return;
    }

    if (!battler.canUseSkill(skill.id)) {
      return;
    }

    const targetGroups = battle.targetManager.allowedTargetGroups(skill);
    const scopes = battle.targetManager.allowedScopes(skill);

    if (targetGroups.length === 0) {
      console.warn(`Skill ${skill.name} has no valid target groups.`);
      return;
    }

    // Store the selected skill before entering target selection.
    battle.pendingMagicSkill = skill;

    // Start on the first allowed group that actually contains a legal target.
    // Enemy-first preserves the established offensive targeting preference,
    // while revive/cleanse skills can select defeated allies through the same
    // target-validity contract used by execution.
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
      battle.pendingMagicSkill = null;
      return;
    }

    // Start on the first valid scope defined by the skill.
    battle.targetScope = scopes.includes("single")
      ? "single"
      : scopes[0] || "single";

    // Confuse preserves the chosen action/skill but takes target selection away
    // from the player. Single-target skills choose randomly from every target
    // that is legal for the selected skill. All-target-only skills choose a
    // random legal target group and then resolve against that whole side.
    if (this.battlerForcesRandomTarget(battler)) {
      if (battle.targetScope === "single") {
        const target = this.randomBattleTarget(
          this.randomSkillTargetCandidates(skill),
        );

        if (!target || !this.selectForcedTarget(target)) {
          battle.addBattleMessage(`${skill.name} has no valid targets.`);
          battle.pendingMagicSkill = null;
          return;
        }

        battle.pendingMagicTarget = target;
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
          battle.pendingMagicSkill = null;
          return;
        }

        battle.targetGroup = targetGroup;
        battle.pendingMagicTarget = null;
        battle.addBattleMessage(
          `${battler.name} is confused and targets all ${targetGroup} battlers with ${skill.name}!`,
        );
      }

      battle.enemyTargetAction = null;
      battle.selectingEnemyTarget = false;
      battle.battleInputLocked = true;
      battle.setActorState("magic", 0.9);
      battle.setActionPhase("magicCast", 0.4);
      battle.magicWindow.hide();
      return;
    }

    battle.enemyTargetAction = "magic";
    battle.selectingEnemyTarget = true;

    battle.magicWindow.hide();
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

  performMagicEffect() {
    const battle = this.scene;
    const skill = battle.pendingMagicSkill;
    const requestedTarget = battle.pendingMagicTarget;
    const caster = this.party().currentBattler();

    if (!caster || !skill) {
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
        const resolution = this.resolveMagicEffectOnTarget(
          caster,
          skill,
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

        if (skill.element === "fire") {
          battle.startBattleEffect("fire", visualTargets, 0.4);
        }

        if (skill.effect === "heal") {
          battle.startBattleEffect("cure", visualTargets, 0.5);
        }
      }

      battle.pendingMagicSkill = null;
      battle.pendingMagicTarget = null;

      return;
    }

    // =====================================
    // SINGLE TARGET MAGIC EFFECT
    // =====================================

    if (!requestedTarget) {
      return;
    }

    const resolution = this.resolveMagicEffectOnTarget(
      caster,
      skill,
      requestedTarget,
      true,
      battle.targetScope,
    );

    if (!resolution.success) {
      battle.pendingMagicSkill = null;
      battle.pendingMagicTarget = null;

      battle.setActorState("idle");
      return;
    }

    const target = resolution.target;

    battle.magicEffectSkill = skill;
    battle.magicEffectTarget = target;

    if (skill.element === "fire") {
      battle.startBattleEffect("fire", target, 0.4);
    }

    if (skill.effect === "heal") {
      battle.startBattleEffect("cure", target, 0.5);
    }

    battle.pendingMagicSkill = null;
    battle.pendingMagicTarget = null;
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

  advanceEnemyTurn(unlockInputAtRoundStart = false, remainingEnemyDelay = 0.6) {
    const battle = this.scene;

    battle.enemyTurnIndex++;

    if (battle.enemyTurnIndex < battle.enemies.length) {
      battle.pendingEnemyTurn = true;
      battle.enemyTurnDelay = remainingEnemyDelay;
      return;
    }

    battle.enemyTurnIndex = 0;
    battle.pendingEnemyTurn = false;

    this.party().resetPartyTurnQueue();

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

  completeEnemyTurn(enemy, unlockInputAtRoundStart = false) {
    if (enemy && typeof enemy.tickStatusDurations === "function") {
      enemy.tickStatusDurations();
    }

    const outcome = this.detectBattleOutcome();

    if (outcome) {
      this.declareBattleOutcome(outcome);
      return;
    }

    this.advanceEnemyTurn(unlockInputAtRoundStart);
  }

  performEnemyTurn(enemy = this.scene.enemies[this.scene.enemyTurnIndex]) {
    const battle = this.scene;

    if (!enemy || this.battlerIsDefeated(enemy)) {
      this.advanceEnemyTurn(true, 0.2);
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

    battle.setEnemyState("attack", 0.4, enemy);

    const target = this.battlerForcesRandomTarget(enemy)
      ? this.randomBattleTarget(this.physicalAttackCandidates(enemy))
      : $gameParty.livingBattleMembers()[0];

    if (!target) {
      battle.enemyTurnIndex = 0;

      const outcome = this.detectBattleOutcome();
      if (outcome) {
        this.declareBattleOutcome(outcome);
      }

      return;
    }

    const hitChance = this.physicalHitChance(enemy);
    const hitRoll = Math.random() * 100;

    if (hitRoll >= hitChance) {
      battle.addBattlePopup(target, "MISS", "miss");
      battle.addBattleMessage(
        `${enemy.name} attacks! ${enemy.name} misses ${target.name}!`,
      );
      this.completeEnemyTurn(enemy, false);
      return;
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
      return;
    }

    this.completeEnemyTurn(enemy, false);
  }
}
