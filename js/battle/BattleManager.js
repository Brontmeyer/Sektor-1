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

    if (battle.enemies.every((enemy) => enemy.isDead())) {
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
          wasDefeated: actor.isDead(),
          levelBefore: actor.level,
        },
      ]),
    );

    const defeatedEnemies = this.scene.enemies.filter((enemy) =>
      enemy.isDead(),
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

    if (battler.isDead()) {
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
    if (!battler || battler.isDead()) {
      return false;
    }

    if (typeof battler.canAct === "function") {
      return battler.canAct();
    }

    return true;
  }

  beginPartyTurn() {
    const party = this.party();
    const battler = party.activeBattler;

    if (!battler) {
      return false;
    }

    this.processTurnStartStatuses(battler);

    if (this.scene.outcome || !this.battlerCanAct(battler)) {
      if (!this.scene.outcome && !battler.isDead()) {
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

    switch (command) {
      case "Attack":
        battle.targetGroup = "enemy";
        battle.targetScope = "single";

        battle.targetManager.selectFirstLivingEnemy();
        battle.enemyTargetAction = "attack";
        battle.selectingEnemyTarget = true;
        break;

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

    // Start on the first allowed target group.
    // Prefer enemies when both groups are available so offensive-style
    // targeting still feels natural without depending on skill.effect.
    if (targetGroups.includes("enemy")) {
      battle.targetGroup = "enemy";
      battle.targetManager.selectFirstLivingEnemy();
    } else if (targetGroups.includes("ally")) {
      battle.targetGroup = "ally";
      battle.targetManager.selectFirstLivingAlly();
    } else {
      console.warn(`Skill ${skill.name} has no supported battle target group.`);
      battle.pendingMagicSkill = null;
      return;
    }

    // Start on the first valid scope defined by the skill.
    battle.targetScope = scopes.includes("single")
      ? "single"
      : scopes[0] || "single";

    battle.enemyTargetAction = "magic";
    battle.selectingEnemyTarget = true;

    battle.magicWindow.hide();
  }

  executeItem() {
    const battle = this.scene;
    const item = battle.itemWindow.currentItem();

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
    const target = battle.targetManager.getSelectedTarget();

    if (!target) {
      return;
    }

    battle.pendingAttackTarget = target;

    if (battle.enemy.isDead()) {
      const nextEnemy = battle.enemies.find((enemy) => !enemy.isDead());

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

    if (!target || target.isDead()) {
      return;
    }

    let damage = Math.max(1, battler.totalAttack() - target.totalDefense());

    const hitChance = Math.max(0, Math.min(100, battler.totalAttackPercent()));

    const hitRoll = Math.random() * 100;

    if (hitRoll >= hitChance) {
      battle.addBattlePopup(target, "MISS", "miss");

      battle.addBattleMessage(
        `${battler.name} attacks! ${battler.name} misses ${target.name}!`,
      );

      return;
    }

    const criticalMultiplier = 2;

    const criticalChancePercent = Math.max(
      0,
      (battler.luck + battler.level - target.level) / 4 +
        battler.totalCritical(),
    );

    const criticalChance = criticalChancePercent / 100;
    const isCritical = Math.random() < criticalChance;

    if (isCritical) {
      damage = Math.max(1, Math.floor(damage * criticalMultiplier));
    }

    if (target.isDefending()) {
      damage = Math.max(1, Math.floor(damage * 0.5));
    }

    target.loseHp(damage);

    battle.addBattlePopup(target, `-${damage}`, "damage");

    if (isCritical) {
      battle.addBattlePopup(target, "CRITICAL", "critical");
    }

    // -----------------------------
    // Ally target
    // -----------------------------

    if ($gameParty.battleMembers().includes(target)) {
      if (target.isDead()) {
        battle.setActorState("defeat", 0, target);

        if ($gameParty.livingBattleMembers().length === 0) {
          this.declareBattleOutcome(BattleManager.OUTCOME_DEFEAT);
        }

        battle.addBattleMessage(
          `${battler.name} attacks ${target.name}! ${target.name} takes ${damage} damage!`,
        );

        return;
      }

      battle.setActorState("hurt", 0.3, target);

      battle.addBattleMessage(
        `${battler.name} attacks ${target.name}! ${target.name} takes ${damage} damage!`,
      );

      return;
    }

    // -----------------------------
    // Enemy target
    // -----------------------------

    if (target.isDead()) {
      battle.setEnemyState("defeat", 0, target);

      battle.addBattleMessage(
        `${battler.name} attacks! ${target.name} takes ${damage} damage!`,
      );

      return;
    }

    battle.setEnemyState("hurt", 0.3, target);

    battle.addBattleMessage(
      `${battler.name} attacks! ${target.name} takes ${damage} damage!`,
    );
  }

  performMagicEffect() {
    const battle = this.scene;
    const skill = battle.pendingMagicSkill;
    const target = battle.pendingMagicTarget;

    const caster = this.party().currentBattler();

    if (!caster) {
      return;
    }

    // =====================================
    // MULTI-TARGET MAGIC EFFECT
    // =====================================

    if (battle.targetScope === "all") {
      if (!skill) {
        return;
      }

      const targets = battle.targetManager.getCurrentTargets();

      if (!targets || targets.length === 0) {
        return;
      }

      let paidCost = false;
      const affectedTargets = [];

      for (const battler of targets) {
        if (!battler) {
          continue;
        }

        const hpBefore = battler.hp;

        // Pay the MP cost only once, even though the spell
        // is being applied to multiple targets.
        const success = caster.useSkill(
          skill.id,
          battler,
          !paidCost,
          battle.targetScope,
        );

        if (!success) {
          continue;
        }

        paidCost = true;
        affectedTargets.push(battler);

        // -----------------------------
        // DAMAGE
        // -----------------------------

        if (skill.effect === "damage") {
          const damage = Math.max(0, hpBefore - battler.hp);

          const elementRate =
            typeof battler.elementRate === "function"
              ? battler.elementRate(skill.element)
              : 1;

          if (elementRate === 0) {
            battle.addBattlePopup(battler, "IMMUNE", "immune");
          } else {
            battle.addBattlePopup(battler, `-${damage}`, "damage");

            if (elementRate > 1) {
              battle.addBattlePopup(battler, "WEAK", "weak");
            } else if (elementRate < 1) {
              battle.addBattlePopup(battler, "RESIST", "resist");
            }
          }

          if ($gameParty.battleMembers().includes(battler)) {
            battle.setActorState(
              battler.isDead() ? "defeat" : "hurt",
              battler.isDead() ? 0 : 0.4,
              battler,
            );

            if ($gameParty.livingBattleMembers().length === 0) {
              this.declareBattleOutcome(BattleManager.OUTCOME_DEFEAT);
            }
          } else if (battle.enemies.includes(battler)) {
            battle.setEnemyState(
              battler.isDead() ? "defeat" : "hurt",
              battler.isDead() ? 0 : 0.4,
              battler,
            );
          }

          if (elementRate === 0) {
            battle.addBattleMessage(
              `${caster.name} casts ${skill.name}! ` +
                `${battler.name} is immune!`,
            );
          } else {
            battle.addBattleMessage(
              `${caster.name} casts ${skill.name}! ` +
                `${battler.name} takes ${damage} damage!`,
            );
          }
        }

        // -----------------------------
        // HEALING
        // -----------------------------

        if (skill.effect === "heal") {
          const healing = Math.max(0, battler.hp - hpBefore);

          battle.addBattlePopup(battler, `+${healing}`, "heal");

          battle.addBattleMessage(
            `${caster.name} casts ${skill.name}! ` +
              `${battler.name} recovers ${healing} HP!`,
          );
        }
      }

      // -----------------------------
      // VISUAL EFFECTS
      // -----------------------------

      if (affectedTargets.length > 0) {
        if (skill.element === "fire") {
          battle.startBattleEffect("fire", affectedTargets, 0.4);
        }

        if (skill.effect === "heal") {
          battle.startBattleEffect("cure", affectedTargets, 0.5);
        }
      }

      battle.pendingMagicSkill = null;
      battle.pendingMagicTarget = null;

      return;
    }

    // =====================================
    // SINGLE TARGET MAGIC EFFECT
    // =====================================

    if (!skill || !target) {
      return;
    }

    const targetHpBefore = target.hp;

    const success = caster.useSkill(skill.id, target, true, battle.targetScope);

    if (!success) {
      battle.pendingMagicSkill = null;
      battle.pendingMagicTarget = null;

      battle.setActorState("idle");
      return;
    }

    // =====================================
    // ENEMY TARGET
    // =====================================

    if (battle.enemies.includes(target)) {
      if (skill.effect === "damage") {
        const damage = Math.max(0, targetHpBefore - target.hp);

        const elementRate =
          typeof target.elementRate === "function"
            ? target.elementRate(skill.element)
            : 1;

        if (elementRate === 0) {
          battle.addBattlePopup(target, "IMMUNE", "immune");
        } else {
          battle.addBattlePopup(target, `-${damage}`, "damage");

          if (elementRate > 1) {
            battle.addBattlePopup(target, "WEAK", "weak");
          } else if (elementRate < 1) {
            battle.addBattlePopup(target, "RESIST", "resist");
          }
        }

        if (target.isDead()) {
          battle.setEnemyState("defeat", 0, target);
        } else if (elementRate !== 0) {
          battle.setEnemyState("hurt", 0.4, target);
        }

        if (elementRate === 0) {
          battle.addBattleMessage(
            `${caster.name} casts ${skill.name}! ${target.name} is immune!`,
          );
        } else {
          battle.addBattleMessage(
            `${caster.name} casts ${skill.name}! ${target.name} takes ${damage} damage!`,
          );
        }
      }
    }

    // =====================================
    // ALLY TARGET
    // =====================================

    if ($gameParty.battleMembers().includes(target)) {
      if (skill.effect === "damage") {
        const damage = targetHpBefore - target.hp;

        battle.addBattlePopup(target, `-${damage}`, "damage");

        battle.setActorState(
          target.isDead() ? "defeat" : "hurt",
          target.isDead() ? 0 : 0.4,
          target,
        );

        if ($gameParty.livingBattleMembers().length === 0) {
          this.declareBattleOutcome(BattleManager.OUTCOME_DEFEAT);
        }

        battle.addBattleMessage(
          `${caster.name} casts ${skill.name}! ` +
            `${target.name} takes ${damage} damage!`,
        );
      }

      if (skill.effect === "heal") {
        const healing = Math.max(0, target.hp - targetHpBefore);

        battle.addBattlePopup(target, `+${healing}`, "heal");

        battle.addBattleMessage(
          `${caster.name} casts ${skill.name}! ` +
            `${target.name} recovers ${healing} HP!`,
        );
      }
    }

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

    if (!battler || battler.isDead()) {
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

    if (!enemy || enemy.isDead()) {
      this.advanceEnemyTurn(true, 0.2);
      return;
    }

    this.processTurnStartStatuses(enemy);

    if (battle.outcome) {
      return;
    }

    if (enemy.isDead()) {
      this.advanceEnemyTurn(true);
      return;
    }

    if (!this.battlerCanAct(enemy)) {
      battle.addBattleMessage(`${enemy.name} cannot act!`);
      this.completeEnemyTurn(enemy, true);
      return;
    }

    battle.setEnemyState("attack", 0.4, enemy);

    const target = $gameParty.livingBattleMembers()[0];

    if (!target) {
      battle.enemyTurnIndex = 0;
      this.declareBattleOutcome(BattleManager.OUTCOME_DEFEAT);
      return;
    }

    const attack = enemy.totalAttack();
    const defense = target.totalDefense();

    let damage = Math.max(1, attack - defense);

    if (target.isDefending()) {
      damage = Math.max(1, Math.floor(damage * 0.5));
    }

    target.loseHp(damage);

    if ($gameParty.battleMembers().includes(target)) {
      battle.setActorState(
        target.isDead() ? "defeat" : "hurt",
        target.isDead() ? 0 : 0.3,
        target,
      );
    }

    battle.addBattleMessage(
      `${enemy.name} attacks! ` + `${target.name} takes ${damage} damage!`,
    );

    if ($gameParty.livingBattleMembers().length === 0) {
      battle.enemyTurnIndex = 0;
      battle.addBattleMessage(`${target.name} has fallen!`);
      this.declareBattleOutcome(BattleManager.OUTCOME_DEFEAT);
      return;
    }

    this.completeEnemyTurn(enemy, false);
  }
}
