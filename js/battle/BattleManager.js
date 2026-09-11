"use strict";

class BattleManager {
  // =============================================================
  // Turn States
  // =============================================================

  static TURN_START = "turnStart";
  static TURN_COMMAND = "command";
  static TURN_ACTION = "action";
  static TURN_END = "turnEnd";

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
  }

  party() {
    return this.scene.partyController;
  }

  setTurnState(state) {
    this.turnState = state;
  }

  isTurnState(state) {
    return this.turnState === state;
  }

  currentTurnState() {
    return this.turnState;
  }

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
        battle.setActionPhase("none");

        if (battle.defeat) {
          battle.battleInputLocked = false;
          return;
        }

        if (battle.enemies.every((enemy) => enemy.isDead())) {
          battle.victory = true;

          battle.addBattleMessage("Victory!");

          battle.battleInputLocked = false;
          return;
        }

        this.finishPartyAction();
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
        battle.setActionPhase("none");

        if (battle.defeat) {
          battle.battleInputLocked = false;
          return;
        }

        if (battle.enemies.every((enemy) => enemy.isDead())) {
          battle.victory = true;
          battle.battleInputLocked = false;

          battle.addBattleMessage("Victory!");

          return;
        }

        this.finishPartyAction();
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
        battle.setActionPhase("none");

        if (battle.enemies.every((enemy) => enemy.isDead())) {
          battle.victory = true;
          battle.battleInputLocked = false;
          battle.addBattleMessage("Victory!");
          return;
        }

        this.finishPartyAction();
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
    if (battle.victory || battle.defeat) {
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

  queueEnemyTurn(delay = 0.5) {
    const battle = this.scene;
    battle.pendingEnemyTurn = true;
    battle.enemyTurnDelay = delay;
    battle.battleInputLocked = true;
  }

  finishPartyAction() {
    const battle = this.scene;
    const party = this.party();

    if (party.hasNextBattler()) {
      party.nextBattler();

      this.setTurnState(BattleManager.TURN_COMMAND);

      battle.battleInputLocked = false;

      return;
    }

    this.setTurnState(BattleManager.TURN_END);

    battle.queueEnemyTurn(0.1);
  }

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

    let target = null;

    if (skill.effect === "damage") {
      if (Array.isArray(skill.target) && skill.target.includes("enemy")) {
        battle.pendingMagicSkill = skill;

        battle.targetGroup = "enemy";
        battle.targetScope = "single";

        battle.targetManager.selectFirstLivingEnemy();
        battle.enemyTargetAction = "magic";
        battle.selectingEnemyTarget = true;

        battle.magicWindow.hide();

        return;
      }
    }

    if (skill.effect === "heal") {
      if (
        Array.isArray(skill.target) &&
        (skill.target.includes("ally") || skill.target.includes("self"))
      ) {
        target = battler;
      }
    }

    if (!target) {
      console.warn(`No valid battle target for ${skill.name}.`);

      return;
    }

    battle.pendingMagicSkill = skill;
    battle.pendingMagicTarget = target;

    battle.battleInputLocked = true;

    battle.setActorState("magic", 0.9);
    battle.setActionPhase("magicCast", 0.4);

    battle.magicWindow.hide();

    if (battle.enemies.every((enemy) => enemy.isDead())) {
      battle.victory = true;
      battle.battleInputLocked = false;

      battle.addBattleMessage("Victory!");

      return;
    }

    // battle.queueEnemyTurn(1.1);
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

    const damage = Math.max(1, battler.totalAttack() - target.totalDefense());

    target.loseHp(damage);

    // -----------------------------
    // Ally target
    // -----------------------------

    if ($gameParty.battleMembers().includes(target)) {
      if (target.isDead()) {
        battle.setActorState("defeat", 0, target);

        battle.defeat = $gameParty.livingBattleMembers().length === 0;

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

    // MULTI-TARGET MAGIC EFFECT FOR ENEMIES
    if (battle.targetScope === "all" && skill?.effect === "damage") {
      const targets = battle.targetManager.getCurrentTargets();

      let paidCost = false;

      for (const battler of targets) {
        const hpBefore = battler.hp;

        const success = caster.useSkill(skill.id, battler, !paidCost);

        if (!success) {
          continue;
        }

        paidCost = true;

        const damage = hpBefore - battler.hp;

        // CHECK IF TARGET IS AN ALLY OR ENEMY
        if ($gameParty.battleMembers().includes(battler)) {
          battle.setActorState(
            battler.isDead() ? "defeat" : "hurt",
            battler.isDead() ? 0 : 0.4,
            battler,
          );

          if ($gameParty.livingBattleMembers().length === 0) {
            battle.defeat = true;
          }
        } else if (battler.isDead()) {
          battle.setEnemyState("defeat", 0, battler);
        } else {
          battle.setEnemyState("hurt", 0.4, battler);
        }

        battle.addBattleMessage(
          `${caster.name} casts ${skill.name}! ` +
            `${battler.name} takes ${damage} damage!`,
        );
      }

      if (skill.name === "Fire") {
        battle.startBattleEffect("fire", targets, 0.4);
      }

      battle.pendingMagicSkill = null;
      battle.pendingMagicTarget = null;

      return;
    }

    // SINGLE TARGET MAGIC EFFECT
    if (!skill || !target) {
      return;
    }

    const targetHpBefore = target.hp;

    const success = caster.useSkill(skill.id, target);

    if (!success) {
      battle.pendingMagicSkill = null;
      battle.pendingMagicTarget = null;

      battle.setActorState("idle");
      return;
    }

    // ENEMY TARGET
    if (battle.enemies.includes(target)) {
      if (skill.effect === "damage") {
        const damage = targetHpBefore - target.hp;

        battle.setEnemyState(
          target.isDead() ? "defeat" : "hurt",
          target.isDead() ? 0 : 0.4,
          target,
        );

        battle.addBattleMessage(
          `${caster.name} casts ${skill.name}! ` +
            `${target.name} takes ${damage} damage!`,
        );
      }

      if (skill.effect === "heal") {
        const healing = target.hp - targetHpBefore;

        battle.addBattleMessage(
          `${caster.name} casts ${skill.name}! ` +
            `${target.name} recovers ${healing} HP!`,
        );
      }
    }

    // ALLY TARGET
    if ($gameParty.battleMembers().includes(target)) {
      if (skill.effect === "damage") {
        const damage = targetHpBefore - target.hp;

        battle.setActorState(
          target.isDead() ? "defeat" : "hurt",
          target.isDead() ? 0 : 0.4,
          target,
        );

        if ($gameParty.livingBattleMembers().length === 0) {
          battle.defeat = true;
        }

        battle.addBattleMessage(
          `${caster.name} casts ${skill.name}! ` +
            `${target.name} takes ${damage} damage!`,
        );
      }
    }

    battle.magicEffectSkill = skill;
    battle.magicEffectTarget = target;

    if (skill.name === "Fire") {
      battle.startBattleEffect("fire", target, 0.4);
    }

    if (skill.name === "Cure") {
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
      return;
    }

    const healing = battler.hp - hpBefore;

    battle.addBattleMessage(
      `${battler.name} uses ${item.name}! ` +
        `${battler.name} recovers ${healing} HP!`,
    );

    // The pending item has now been used.
    battle.pendingItem = null;
  }

  performEnemyTurn(enemy = this.scene.enemies[this.scene.enemyTurnIndex]) {
    const battle = this.scene;
    if (!enemy || enemy.isDead()) {
      battle.enemyTurnIndex++;

      if (battle.enemyTurnIndex < battle.enemies.length) {
        battle.pendingEnemyTurn = true;
        battle.enemyTurnDelay = 0.2;
      } else {
        battle.enemyTurnIndex = 0;
        battle.pendingEnemyTurn = false;

        this.party().resetPartyTurnQueue();
        this.setTurnState(BattleManager.TURN_COMMAND);

        battle.battleInputLocked = false;
      }

      return;
    }

    battle.setEnemyState("attack", 0.4, enemy);

    const target = $gameParty.livingBattleMembers()[0];

    if (!target) {
      battle.defeat = true;
      battle.pendingEnemyTurn = false;
      battle.enemyTurnIndex = 0;
      return;
    }

    const attack = enemy.totalAttack();
    const defense = target.totalDefense();

    const damage = Math.max(1, attack - defense);
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
      battle.defeat = true;
      battle.pendingEnemyTurn = false;
      battle.enemyTurnIndex = 0;

      battle.addBattleMessage(`${target.name} has fallen! Defeat...`);
      return;
    }

    battle.enemyTurnIndex++;

    if (battle.enemyTurnIndex < battle.enemies.length) {
      battle.pendingEnemyTurn = true;
      battle.enemyTurnDelay = 0.6;
    } else {
      battle.enemyTurnIndex = 0;
      battle.pendingEnemyTurn = false;

      this.party().resetPartyTurnQueue();
      this.setTurnState(BattleManager.TURN_COMMAND);

      battle.battleInputLocked = false;
    }
  }
}
