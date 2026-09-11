"use strict";

class BattleAnimationController {
  constructor(scene) {
    this.scene = scene;
  }

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

        if (!actor.isDead()) {
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

          if (!enemy.isDead()) {
            battleData.state = "idle";
          }
        }
      }
    }

    // Unlock battle input when both battlers are idle and visually aligned.
    if (
      scene.battleInputLocked &&
      !scene.pendingEnemyTurn &&
      scene.actionPhase === "none" &&
      (!activeActorData || activeActorData.state === "idle") &&
      scene.enemies.every(
        (enemy, index) =>
          enemy.isDead() || scene.enemyBattleData[index].state === "idle",
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
    const actor = scene.partyController.currentBattler() || $gameActor;
    const battleData = scene.getPartyBattleData(actor);

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

  updateEnemyVisual(enemy, battleData, deltaTime) {
    const scene = this.scene;
    if (!enemy || !battleData) {
      return;
    }

    let targetX = 0;

    if (battleData.state === "attack") {
      targetX = -35;
    } else if (battleData.state === "hurt") {
      targetX = 18;
    }

    battleData.visualX = scene.moveToward(
      battleData.visualX,
      targetX,
      300 * deltaTime,
    );
  }

  updateBattleAnimations(deltaTime) {
    const scene = this.scene;
    scene.updateActorAnimation(deltaTime);
    scene.updateEnemyAnimation(deltaTime);
  }

  updateActorAnimation(deltaTime) {
    const scene = this.scene;

    for (const actor of $gameParty.battleMembers()) {
      const battleData = scene.getPartyBattleData(actor);

      if (!battleData) {
        continue;
      }

      const animation = scene.getBattlerAnimationData(battleData.state);

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

      const animation = scene.getBattlerAnimationData(battleData.state);

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

  getActiveActorData() {
    const actor = this.scene.partyController.currentBattler();

    if (!actor) {
      return null;
    }

    return this.scene.getPartyBattleData(actor);
  }

  getActorTargetOffset() {
    const scene = this.scene;

    // Attack movement is controlled by action phases.
    if (scene.actionPhase === "lunge") {
      return 45;
    }

    if (scene.actionPhase === "hit") {
      return 45;
    }

    if (scene.actionPhase === "return") {
      return 0;
    }

    const activeActor = scene.partyController.currentBattler();
    const activeActorData = activeActor
      ? scene.getPartyBattleData(activeActor)
      : null;

    // Hurt recoil takes priority over command positioning.
    if (activeActorData?.state === "hurt") {
      return -18;
    }

    // Active battler stands slightly forward while choosing a command.
    if (
      scene.battleManager.isTurnState(BattleManager.TURN_COMMAND) &&
      !scene.battleInputLocked &&
      scene.actionPhase === "none" &&
      (!activeActorData || activeActorData.state === "idle")
    ) {
      return 18;
    }

    return 0;
  }

  getActorTargetYOffset() {
    const scene = this.scene;
    if (scene.actionPhase === "magicCast") {
      return -12;
    }

    if (scene.actionPhase === "itemUse") {
      return -6;
    }

    if (scene.actionPhase === "itemEffect") {
      return -6;
    }
    return 0;
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

  getActorVisualScale(actor) {
    const scene = this.scene;
    const activeActor = scene.partyController.currentBattler();

    if (actor !== activeActor) {
      return 1;
    }

    if (scene.actionPhase === "magicCast") {
      const duration = 0.4;
      const progress = 1 - scene.actionPhaseTimer / duration;

      return 1 + 0.06 * progress;
    }

    if (scene.actionPhase === "magicEffect") {
      const duration = 0.25;
      const progress = 1 - scene.actionPhaseTimer / duration;

      return 1.06 - 0.06 * progress;
    }

    if (scene.actionPhase === "itemUse") {
      const duration = 0.35;
      const progress = 1 - scene.actionPhaseTimer / duration;

      return 1 + 0.03 * progress;
    }

    if (scene.actionPhase === "itemEffect") {
      const duration = 0.25;
      const progress = 1 - scene.actionPhaseTimer / duration;

      return 1.03 - 0.03 * progress;
    }

    return 1;
  }

  getActorVisualAlpha(actor) {
    const scene = this.scene;

    if (
      scene.actionPhase === "magicEffect" &&
      scene.magicEffectSkill &&
      scene.magicEffectTarget === actor
    ) {
      return 0.65;
    }

    return 1;
  }

  getEnemyVisualAlpha(enemy = this.scene.enemy) {
    const scene = this.scene;
    if (
      scene.actionPhase === "magicEffect" &&
      scene.magicEffectSkill &&
      scene.magicEffectTarget === enemy
    ) {
      return 0.45;
    }

    return 1;
  }

  getBattlerAnimationData(state) {
    const scene = this.scene;
    const animations = {
      idle: {
        frames: 4,
        frameDuration: 0.18,
        loop: true,
      },

      attack: {
        frames: 4,
        frameDuration: 0.1,
        loop: false,
      },

      magic: {
        frames: 4,
        frameDuration: 0.14,
        loop: false,
      },

      hurt: {
        frames: 2,
        frameDuration: 0.1,
        loop: false,
      },

      defeat: {
        frames: 4,
        frameDuration: 0.15,
        loop: false,
      },
    };

    return animations[state] || animations.idle;
  }

  getBattlerAnimationRow(state) {
    const scene = this.scene;
    const rows = {
      idle: 0,
      attack: 1,
      magic: 2,
      hurt: 3,
      defeat: 4,
    };

    return rows[state] ?? 0;
  }
}
