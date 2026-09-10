"use strict";

class BattleAnimationController {
  constructor(scene) {
    this.scene = scene;
  }

  updateBattlerStates(deltaTime) {
    const scene = this.scene;
    if (scene.actorStateTimer > 0) {
      scene.actorStateTimer -= deltaTime;

      if (scene.actorStateTimer <= 0) {
        scene.actorStateTimer = 0;

        if (!$gameActor.isDead()) {
          scene.actorState = "idle";
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
      scene.actorState === "idle" &&
      scene.enemies.every(
        (enemy, index) =>
          enemy.isDead() || scene.enemyBattleData[index].state === "idle",
      ) &&
      Math.abs(scene.actorVisualX) < 0.5 &&
      scene.enemyBattleData.every((data) => Math.abs(data.visualX) < 0.5) &&
      !scene.victory &&
      !scene.defeat
    ) {
      scene.actorVisualX = 0;
      scene.battleInputLocked = false;
    }
  }

  updateBattlerVisuals(deltaTime) {
    const scene = this.scene;
    const actorTarget = scene.getActorTargetOffset();
    const actorTargetY = scene.getActorTargetYOffset();

    const speed = 300;

    // Update actor visual position toward its target offset.
    scene.actorVisualX = scene.moveToward(
      scene.actorVisualX,
      actorTarget,
      speed * deltaTime,
    );

    scene.actorVisualY = scene.moveToward(
      scene.actorVisualY,
      actorTargetY,
      80 * deltaTime,
    );

    // Update enemy visual position toward its target offset.
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
    const animation = scene.getBattlerAnimationData(scene.actorState);

    scene.actorAnimationTimer += deltaTime;

    while (scene.actorAnimationTimer >= animation.frameDuration) {
      scene.actorAnimationTimer -= animation.frameDuration;

      scene.actorAnimationFrame++;

      if (scene.actorAnimationFrame >= animation.frames) {
        if (animation.loop) {
          scene.actorAnimationFrame = 0;
        } else {
          scene.actorAnimationFrame = animation.frames - 1;
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

  setActorState(state, duration = 0) {
    const scene = this.scene;
    if (scene.actorState !== state) {
      scene.actorAnimationFrame = 0;
      scene.actorAnimationTimer = 0;
    }

    scene.actorState = state;
    scene.actorStateTimer = duration;
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

    // Player recoil when hurt.
    if (scene.actorState === "hurt") {
      return -18;
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

  getActorStateYOffset() {
    const scene = this.scene;
    if (scene.actorState === "hurt") {
      return 34;
    }

    if (scene.actorState === "defeat") {
      return 52;
    }

    return 0;
  }

  getActorVisualScale() {
    const scene = this.scene;
    // ACTOR GROWS  WHILE CASTING MAGIC
    if (scene.actionPhase === "magicCast") {
      const duration = 0.4;

      const progress = 1 - scene.actionPhaseTimer / duration;

      return 1 + 0.06 * progress;
    }

    // ACTOR SHRINKS WHILE MAGIC EFFECT IS ACTIVE
    if (scene.actionPhase === "magicEffect") {
      const duration = 0.25;

      const progress = 1 - scene.actionPhaseTimer / duration;

      return 1.06 - 0.06 * progress;
    }

    // ACTOR GROWS WHILE USING ITEM
    if (scene.actionPhase === "itemUse") {
      const duration = 0.35;

      const progress = 1 - scene.actionPhaseTimer / duration;

      return 1 + 0.03 * progress;
    }
    // ACTOR SHRINKS WHILE ITEM EFFECT IS ACTIVE
    if (scene.actionPhase === "itemEffect") {
      const duration = 0.25;

      const progress = 1 - scene.actionPhaseTimer / duration;

      return 1.03 - 0.03 * progress;
    }

    return 1;
  }

  getActorVisualAlpha() {
    const scene = this.scene;
    if (
      scene.actionPhase === "magicEffect" &&
      scene.magicEffectSkill &&
      scene.magicEffectTarget === $gameActor
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
