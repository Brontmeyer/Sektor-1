"use strict";

class BattleAnimationController {
  constructor(scene) {
    this.scene = scene;
  }

  moveToward(current, target, amount) {
    const scene = this.scene;
    if (current < target) {
      return Math.min(current + amount, target);
    }

    if (current > target) {
      return Math.max(current - amount, target);
    }

    return target;
  }

  // =================================
  // Updates
  // =================================

  updateBattlerStates(deltaTime) {
    const scene = this.scene;

    const activeActor = scene.partyController.currentBattler();
    const activeActorData = activeActor
      ? scene.getPartyBattleData(activeActor)
      : null;

    // Update every party member's temporary battle state.
    for (const actor of $gameParty.battleMembers()) {
      const battleData = scene.getPartyBattleData(actor);

      if (!battleData || battleData.stateTimer <= 0) {
        continue;
      }

      battleData.stateTimer -= deltaTime;

      if (battleData.stateTimer <= 0) {
        battleData.stateTimer = 0;

        if (actor.isAlive()) {
          battleData.state = "idle";
        }
      }
    }

    for (let i = 0; i < scene.enemies.length; i++) {
      const enemy = scene.enemies[i];
      const battleData = scene.enemyBattleData[i];

      if (!enemy || !battleData) {
        continue;
      }

      if (battleData.stateTimer > 0) {
        battleData.stateTimer -= deltaTime;

        if (battleData.stateTimer <= 0) {
          battleData.stateTimer = 0;

          if (enemy.isAlive()) {
            battleData.state = "idle";
          }
        }
      }
    }

    // The old round scheduler unlocked input from animation state. Under ATB,
    // BattleManager owns command authority, so an idle battlefield must never
    // expose Confirm input when no actor actually owns a command turn.
    if (
      scene.usesActiveTimeAuthority?.() !== true &&
      scene.battleInputLocked &&
      !scene.pendingEnemyTurn &&
      scene.actionPhase === "none" &&
      (!activeActorData || activeActorData.state === "idle") &&
      scene.enemies.every(
        (enemy, index) =>
          !enemy.isAlive() || scene.enemyBattleData[index].state === "idle",
      ) &&
      (!activeActorData || Math.abs(activeActorData.visualX) < 0.5) &&
      scene.enemyBattleData.every((data) => Math.abs(data.visualX) < 0.5) &&
      !scene.victory &&
      !scene.defeat
    ) {
      if (activeActorData) {
        activeActorData.visualX = 0;
      }
      scene.battleInputLocked = false;
    }
  }

  updateBattlerVisuals(deltaTime) {
    const scene = this.scene;

    const actor = scene.partyController.currentBattler();
    const battleData = actor ? scene.getPartyBattleData(actor) : null;

    const actorTarget = scene.getActorTargetOffset();
    const actorTargetY = scene.getActorTargetYOffset();

    const speed = 300;

    if (battleData) {
      battleData.visualX = scene.moveToward(
        battleData.visualX,
        actorTarget,
        speed * deltaTime,
      );

      battleData.visualY = scene.moveToward(
        battleData.visualY,
        actorTargetY,
        80 * deltaTime,
      );
    }

    // Update enemy visual positions.
    for (let i = 0; i < scene.enemies.length; i++) {
      scene.updateEnemyVisual(
        scene.enemies[i],
        scene.enemyBattleData[i],
        deltaTime,
      );
    }
  }

  updateBattleAnimations(deltaTime) {
    const scene = this.scene;
    scene.updateActorAnimation(deltaTime);
    scene.updateEnemyAnimation(deltaTime);
  }

  updateEnemyVisual(enemy, battleData, deltaTime) {
    const scene = this.scene;
    if (!enemy || !battleData) {
      return;
    }

    let targetX = 0;
    const direction = scene.formationManager.enemyAdvanceDirection(enemy);

    if (battleData.state === "attack") {
      targetX = 35 * direction;
    } else if (battleData.state === "hurt") {
      targetX = -18 * direction;
    }

    battleData.visualX = scene.moveToward(
      battleData.visualX,
      targetX,
      300 * deltaTime,
    );
  }

  updateActorAnimation(deltaTime) {
    const scene = this.scene;

    for (const actor of $gameParty.battleMembers()) {
      const battleData = scene.getPartyBattleData(actor);

      if (!battleData) {
        continue;
      }

      const animation = scene.getBattlerAnimationData(actor, battleData.state);

      battleData.animationTimer += deltaTime;

      while (battleData.animationTimer >= animation.frameDuration) {
        battleData.animationTimer -= animation.frameDuration;

        battleData.animationFrame++;

        if (battleData.animationFrame >= animation.frames) {
          if (animation.loop) {
            battleData.animationFrame = 0;
          } else {
            battleData.animationFrame = animation.frames - 1;
          }
        }
      }
    }
  }

  updateEnemyAnimation(deltaTime) {
    const scene = this.scene;
    for (let i = 0; i < scene.enemies.length; i++) {
      const battleData = scene.enemyBattleData[i];

      if (!battleData) {
        continue;
      }

      const animation = scene.getBattlerAnimationData(
        scene.enemies[i],
        battleData.state,
      );

      battleData.animationTimer += deltaTime;

      while (battleData.animationTimer >= animation.frameDuration) {
        battleData.animationTimer -= animation.frameDuration;

        battleData.animationFrame++;

        if (battleData.animationFrame >= animation.frames) {
          if (animation.loop) {
            battleData.animationFrame = 0;
          } else {
            battleData.animationFrame = animation.frames - 1;
          }
        }
      }
    }
  }

  // =================================
  // State Management
  // =================================

  setActorState(
    state,
    duration = 0,
    actor = this.scene.partyController.currentBattler(),
  ) {
    const scene = this.scene;

    if (!actor) {
      return;
    }

    const battleData = scene.getPartyBattleData(actor);

    if (battleData) {
      if (battleData.state !== state) {
        battleData.animationFrame = 0;
        battleData.animationTimer = 0;
      }

      battleData.state = state;
      battleData.stateTimer = duration;
    }
  }

  setEnemyState(state, duration = 0, enemy = this.scene.enemy) {
    const scene = this.scene;
    const battleData = scene.getEnemyBattleData(enemy);

    if (battleData) {
      if (battleData.state !== state) {
        battleData.animationFrame = 0;
        battleData.animationTimer = 0;
      }

      battleData.state = state;
      battleData.stateTimer = duration;
    }
  }

  // =================================
  // Battle Manager
  // =================================

  getActiveActorData() {
    const actor = this.scene.partyController.currentBattler();

    if (!actor) {
      return null;
    }

    return this.scene.getPartyBattleData(actor);
  }

  getActorStateYOffset(actor) {
    const scene = this.scene;
    const battleData = scene.getPartyBattleData(actor);
    const state = battleData?.state || "idle";

    if (state === "hurt") {
      return 34;
    }

    if (state === "defeat") {
      return 52;
    }

    return 0;
  }

  getActorTargetOffset() {
    const scene = this.scene;

    // Attack movement is controlled by action phases.
    const activeActor = scene.partyController.currentBattler();
    const direction = activeActor
      ? scene.formationManager.actorAdvanceDirection(activeActor)
      : 1;
    const activeActorData = activeActor
      ? scene.getPartyBattleData(activeActor)
      : null;

    if (scene.actionPhase === "lunge") {
      return 45 * direction;
    }

    if (scene.actionPhase === "hit") {
      return 45 * direction;
    }

    if (scene.actionPhase === "return") {
      return 0;
    }

    // Magick, Skill, and Item actions do not perform a physical lunge. Hold
    // the actor exactly where they were when the action was committed so the
    // command-selection stance does not snap backward at the start of the
    // animation. Forced actions that started at home remain at home too.
    const plantedActionPhases = new Set([
      "skillUse",
      "skillEffect",
      "skillRecover",
      "skillWait",
      "magickCast",
      "magickEffect",
      "magickRecover",
      "magickWait",
      "itemUse",
      "itemEffect",
      "itemRecover",
      "itemWait",
    ]);

    if (plantedActionPhases.has(scene.actionPhase)) {
      const anchor = Number(scene.partyActionAnchorX);
      return Number.isFinite(anchor)
        ? anchor
        : Number(activeActorData?.visualX) || 0;
    }

    // Hurt recoil takes priority over command positioning.
    if (activeActorData?.state === "hurt") {
      return -18 * direction;
    }

    // Active battler stands slightly forward while choosing a command.
    if (
      scene.battleManager.isTurnState(BattleManager.TURN_COMMAND) &&
      !scene.battleInputLocked &&
      scene.actionPhase === "none" &&
      (!activeActorData || activeActorData.state === "idle")
    ) {
      return 18 * direction;
    }

    return 0;
  }

  getActorTargetYOffset() {
    // Action personality belongs in the sprite animation itself. Magick,
    // Skills, and Items all stay grounded instead of moving the whole battler
    // vertically as a presentation shortcut.
    return 0;
  }

  getActorVisualAlpha(actor) {
    const scene = this.scene;

    if (
      scene.actionPhase === "magickEffect" &&
      scene.magickEffect &&
      scene.magickEffectTarget === actor
    ) {
      return 0.65;
    }

    return 1;
  }

  getActorVisualScale(actor) {
    // Whole-battler scaling made casting and item use read as hopping/pulsing.
    // Dedicated sprite-sheet motions now own those action poses instead.
    return 1;
  }

  getBattlerAnimationData(battlerOrState, maybeState = null) {
    const hasBattler =
      battlerOrState && typeof battlerOrState === "object" && maybeState !== null;
    const battler = hasBattler ? battlerOrState : null;
    const state = hasBattler ? maybeState : battlerOrState;

    if (battler && typeof battler.battleAnimation === "function") {
      return battler.battleAnimation(state || "idle");
    }

    const fallback =
      typeof Game_Battler !== "undefined" &&
      typeof Game_Battler.defaultBattleAnimations === "function"
        ? Game_Battler.defaultBattleAnimations()
        : {
            idle: { row: 0, frames: 4, frameDuration: 0.18, loop: true },
            attack: { row: 1, frames: 4, frameDuration: 0.1, loop: false },
            magick: { row: 2, frames: 4, frameDuration: 0.14, loop: false },
            hurt: { row: 3, frames: 2, frameDuration: 0.1, loop: false },
            defeat: { row: 4, frames: 4, frameDuration: 0.15, loop: false },
          };
    const definition = fallback[state] || fallback.idle;

    if (definition?.fallback && fallback[definition.fallback]) {
      return {
        ...fallback[definition.fallback],
        row: Number(fallback[definition.fallback].row) || 0,
        offsetX: 0,
        offsetY: 0,
      };
    }

    return {
      row: Number(definition?.row) || 0,
      frames: Math.max(1, Number(definition?.frames) || 1),
      frameDuration: Math.max(0.01, Number(definition?.frameDuration) || 0.18),
      loop: definition?.loop !== false,
      offsetX: Number(definition?.offsetX) || 0,
      offsetY: Number(definition?.offsetY) || 0,
    };
  }

  getBattlerAnimationRow(battlerOrState, maybeState = null) {
    return this.getBattlerAnimationData(battlerOrState, maybeState).row || 0;
  }

  getBattlerAnimationOffset(battlerOrState, maybeState = null) {
    const animation = this.getBattlerAnimationData(battlerOrState, maybeState);

    return {
      x: Number(animation.offsetX) || 0,
      y: Number(animation.offsetY) || 0,
    };
  }

  getEnemyVisualAlpha(enemy = this.scene.enemy) {
    const scene = this.scene;
    if (
      scene.actionPhase === "magickEffect" &&
      scene.magickEffect &&
      scene.magickEffectTarget === enemy
    ) {
      return 0.45;
    }

    return 1;
  }
}
