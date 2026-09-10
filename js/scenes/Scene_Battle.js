"use strict";

class Scene_Battle extends Scene_Base {
  constructor() {
    super();

    this.enemies = [new Game_Enemy(1), new Game_Enemy(1)];

    // CURRENTLY SELECTED ENEMY
    this.enemy = this.enemies[0];
    this.enemyBattleData = this.enemies.map(() => ({
      state: "idle",
      stateTimer: 0,

      animationFrame: 0,
      animationTimer: 0,

      visualX: 0,
    }));

    this.actorImage = null;
    this.enemyImage = null;

    this.actorVisualX = 0;
    this.actorVisualY = 0;

    this.enemyVisualX = 0;

    this.loadBattleSprites();
    this.commandWindow = new Window_BattleCommand();
    this.magicWindow = new Window_BattleMagic();
    this.itemWindow = new Window_BattleItem();

    this.battleMessages = [];
    this.victory = false;
    this.defeat = false;

    // BATTLER STATES
    this.actorState = "idle";
    this.enemyState = "idle";

    this.actorStateTimer = 0;
    this.enemyStateTimer = 0;

    // SPRITE ANIMATION TRACKING
    this.actorAnimationFrame = 0;
    this.actorAnimationTimer = 0;

    this.enemyAnimationFrame = 0;
    this.enemyAnimationTimer = 0;

    // BATTLE SYSTEM
    this.battleView = DatabaseManager.system.battleView || "side";

    // ENEMY TURN MANAGEMENT
    this.pendingEnemyTurn = false;
    this.enemyTurnIndex = 0;
    this.enemyTurnDelay = 0;
    this.battleInputLocked = false;

    // ENEMY TARGET SELECTION
    this.selectedEnemyIndex = 0;
    this.selectingEnemyTarget = false;
    this.enemyTargetAction = null;

    this.targetGroup = "enemy";
    this.targetScope = "single";

    // BATTLE ACTION PHASE SYSTEM
    this.actionPhase = "none";
    this.actionPhaseTimer = 0;
    this.pendingAttackDamage = false;
    this.pendingAttackTarget = null;

    // PENDING MAGIC ACTION
    this.pendingMagicSkill = null;
    this.pendingMagicTarget = null;

    // MAGIC EFFECT STATE
    this.magicEffectSkill = null;
    this.magicEffectTarget = null;
    this.battleEffect = null;

    // PENDING ITEM ACTION
    this.pendingItem = null;
  }

  start() {
    super.start();

    console.log(`Battle started against ${this.enemy.name}.`);
  }

  update(deltaTime) {
    this.updateBattlerStates(deltaTime);
    this.updateActionPhase(deltaTime);
    this.updateBattlerVisuals(deltaTime);
    this.updateBattleAnimations(deltaTime);
    this.updateBattleEffect(deltaTime);
    this.updatePendingEnemyTurn(deltaTime);
    this.updateBattleEffect(deltaTime);

    // -----------------------------
    // HANDLE VICTORY OR DEFEAT FIRST
    // -----------------------------

    if (this.victory || this.defeat) {
      if (
        Input.isTriggered("KeyE") ||
        Input.isTriggered("Enter") ||
        Input.isTriggered("Escape")
      ) {
        SceneManager.pop();
      }

      return;
    }

    // -----------------------------
    // HANDLE ENEMY TARGET SELECTION INPUT
    // -----------------------------

    if (this.selectingEnemyTarget) {
      if (Input.isTriggered("KeyR")) {
        this.targetScope = this.targetScope === "single" ? "all" : "single";
      }

      if (Input.isTriggered("KeyA") || Input.isTriggered("ArrowLeft")) {
        this.targetGroup = "ally";
      }

      if (Input.isTriggered("KeyD") || Input.isTriggered("ArrowRight")) {
        this.targetGroup = "enemy";
      }

      if (
        this.targetGroup === "enemy" &&
        this.targetScope === "single" &&
        (Input.isTriggered("KeyW") || Input.isTriggered("ArrowUp"))
      ) {
        this.moveEnemySelection(-1);
      }

      if (
        this.targetGroup === "enemy" &&
        this.targetScope === "single" &&
        (Input.isTriggered("KeyS") || Input.isTriggered("ArrowDown"))
      ) {
        this.moveEnemySelection(1);
      }

      if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
        const target = this.getSelectedTarget();

        if (target && !target.isDead()) {
          if (this.targetGroup === "enemy") {
            this.enemy = target;
          }

          this.selectingEnemyTarget = false;

          if (this.enemyTargetAction === "attack") {
            this.enemyTargetAction = null;
            this.performAttack();
          } else if (this.enemyTargetAction === "magic") {
            this.enemyTargetAction = null;

            const skill = this.pendingMagicSkill;

            if (skill) {
              this.pendingMagicTarget = target;
              this.battleInputLocked = true;

              this.setActorState("magic", 0.9);
              this.setActionPhase("magicCast", 0.4);
            }
          }
        }

        return;
      }

      if (Input.isTriggered("KeyQ") || Input.isTriggered("Escape")) {
        this.selectingEnemyTarget = false;
        this.enemyTargetAction = null;
        this.pendingMagicSkill = null;
        return;
      }

      return;
    }

    // -----------------------------
    // HANDLE ITEM WINDOW INPUT
    // -----------------------------

    if (this.itemWindow.isOpen()) {
      this.itemWindow.update();

      if (Input.isTriggered("Escape") || Input.isTriggered("KeyQ")) {
        this.itemWindow.hide();
        return;
      }

      if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
        this.executeItem();
      }

      return;
    }

    // -----------------------------
    // HANDLE MAGIC WINDOW INPUT
    // -----------------------------

    if (this.magicWindow.isOpen()) {
      this.magicWindow.update();

      if (Input.isTriggered("Escape") || Input.isTriggered("KeyQ")) {
        this.magicWindow.hide();
        return;
      }

      if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
        this.executeMagic();
      }

      return;
    }

    // HANDLE BATTLE INPUT LOCK
    if (this.battleInputLocked) {
      return;
    }

    // -----------------------------
    // HANDLE COMMAND WINDOW INPUT
    // -----------------------------

    this.commandWindow.update();

    if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
      this.executeCommand();
    }

    if (Input.isTriggered("Escape") || Input.isTriggered("KeyQ")) {
      SceneManager.pop();
    }
  }

  updateBattlerStates(deltaTime) {
    if (this.actorStateTimer > 0) {
      this.actorStateTimer -= deltaTime;

      if (this.actorStateTimer <= 0) {
        this.actorStateTimer = 0;

        if (!$gameActor.isDead()) {
          this.actorState = "idle";
        }
      }
    }

    if (this.enemyStateTimer > 0) {
      this.enemyStateTimer -= deltaTime;

      if (this.enemyStateTimer <= 0) {
        this.enemyStateTimer = 0;

        if (!this.enemy.isDead()) {
          this.enemyState = "idle";
        }
      }
    }

    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      const battleData = this.enemyBattleData[i];

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
      this.battleInputLocked &&
      !this.pendingEnemyTurn &&
      this.actionPhase === "none" &&
      this.actorState === "idle" &&
      this.enemies.every(
        (enemy, index) =>
          enemy.isDead() || this.enemyBattleData[index].state === "idle",
      ) &&
      Math.abs(this.actorVisualX) < 0.5 &&
      this.enemyBattleData.every((data) => Math.abs(data.visualX) < 0.5) &&
      !this.victory &&
      !this.defeat
    ) {
      this.actorVisualX = 0;
      this.enemyVisualX = 0;

      this.battleInputLocked = false;
    }
  }

  updateActionPhase(deltaTime) {
    if (this.actionPhase === "none") {
      return;
    }

    if (this.actionPhaseTimer > 0) {
      this.actionPhaseTimer -= deltaTime;
    }

    if (this.actionPhaseTimer > 0) {
      return;
    }

    this.actionPhaseTimer = 0;

    switch (this.actionPhase) {
      // =====================================
      // ATTACK SEQUENCE
      // =====================================

      case "lunge":
        this.performAttackHit();
        this.setActionPhase("hit", 0.15);
        break;

      case "hit":
        this.setActionPhase("return", 0.25);
        break;

      case "return":
        this.setActionPhase("wait", 0.25);
        break;

      case "wait":
        this.setActionPhase("none");

        if (this.enemies.every((enemy) => enemy.isDead())) {
          this.victory = true;

          this.addBattleMessage("Victory!");

          this.battleInputLocked = false;
          return;
        }

        this.queueEnemyTurn(0.1);
        break;

      // =====================================
      // MAGIC SEQUENCE
      // =====================================

      case "magicCast":
        this.performMagicEffect();
        this.setActionPhase("magicEffect", 0.25);
        break;

      case "magicEffect":
        this.magicEffectSkill = null;
        this.magicEffectTarget = null;

        this.setActionPhase("magicRecover", 0.25);
        break;

      case "magicRecover":
        this.setActionPhase("magicWait", 0.25);
        break;

      case "magicWait":
        this.setActionPhase("none");

        if (this.enemy.isDead()) {
          this.setEnemyState("defeat");
          this.victory = true;
          this.battleInputLocked = false;

          this.addBattleMessage(`${this.enemy.name} is defeated! Victory!`);

          return;
        }

        this.queueEnemyTurn(0.1);
        break;

      // =====================================
      // ITEM SEQUENCE
      // =====================================

      case "itemUse":
        this.performItemEffect();
        this.setActionPhase("itemEffect", 0.25);
        break;

      case "itemEffect":
        this.setActionPhase("itemRecover", 0.25);
        break;

      case "itemRecover":
        this.setActionPhase("itemWait", 0.25);
        break;

      case "itemWait":
        this.setActionPhase("none");

        if (this.enemy.isDead()) {
          this.setEnemyState("defeat");
          this.victory = true;
          this.battleInputLocked = false;
          return;
        }

        this.queueEnemyTurn(0.1);
        break;

      // =====================================
      // DEFAULT CASE
      // =====================================

      default:
        this.setActionPhase("none");
        break;
    }
  }

  updateBattlerVisuals(deltaTime) {
    const actorTarget = this.getActorTargetOffset();
    const actorTargetY = this.getActorTargetYOffset();

    const speed = 300;

    // Update actor visual position toward its target offset.
    this.actorVisualX = this.moveToward(
      this.actorVisualX,
      actorTarget,
      speed * deltaTime,
    );

    this.actorVisualY = this.moveToward(
      this.actorVisualY,
      actorTargetY,
      80 * deltaTime,
    );

    // Update enemy visual position toward its target offset.
    for (let i = 0; i < this.enemies.length; i++) {
      this.updateEnemyVisual(
        this.enemies[i],
        this.enemyBattleData[i],
        deltaTime,
      );
    }
  }

  updateEnemyVisual(enemy, battleData, deltaTime) {
    if (!enemy || !battleData) {
      return;
    }

    let targetX = 0;

    if (battleData.state === "attack") {
      targetX = -35;
    } else if (battleData.state === "hurt") {
      targetX = 18;
    }

    battleData.visualX = this.moveToward(
      battleData.visualX,
      targetX,
      300 * deltaTime,
    );
  }

  updateBattleAnimations(deltaTime) {
    this.updateActorAnimation(deltaTime);
    this.updateEnemyAnimation(deltaTime);
  }

  updateActorAnimation(deltaTime) {
    const animation = this.getBattlerAnimationData(this.actorState);

    this.actorAnimationTimer += deltaTime;

    while (this.actorAnimationTimer >= animation.frameDuration) {
      this.actorAnimationTimer -= animation.frameDuration;

      this.actorAnimationFrame++;

      if (this.actorAnimationFrame >= animation.frames) {
        if (animation.loop) {
          this.actorAnimationFrame = 0;
        } else {
          this.actorAnimationFrame = animation.frames - 1;
        }
      }
    }
  }

  updateEnemyAnimation(deltaTime) {
    for (let i = 0; i < this.enemies.length; i++) {
      const battleData = this.enemyBattleData[i];

      if (!battleData) {
        continue;
      }

      const animation = this.getBattlerAnimationData(battleData.state);

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

  updatePendingEnemyTurn(deltaTime) {
    if (!this.pendingEnemyTurn) {
      return;
    }

    this.enemyTurnDelay -= deltaTime;

    if (this.enemyTurnDelay > 0) {
      return;
    }

    this.pendingEnemyTurn = false;
    this.enemyTurnDelay = 0;

    this.performEnemyTurn();
  }

  updateBattleEffect(deltaTime) {
    if (!this.battleEffect) {
      return;
    }

    this.battleEffect.timer -= deltaTime;

    if (this.battleEffect.timer <= 0) {
      this.battleEffect = null;
    }
  }

  startBattleEffect(type, target, duration = 0.4) {
    this.battleEffect = {
      type: type,
      target: target,
      timer: duration,
      duration: duration,
    };
  }

  loadBattleSprites() {
    if ($gameActor.sideBattleSprite) {
      this.actorImage = new Image();

      this.actorImage.src = `js/sprites/actors/${$gameActor.sideBattleSprite}`;
    }

    if (this.enemy.battleSprite) {
      this.enemyImage = new Image();

      this.enemyImage.src = `js/sprites/enemies/${this.enemy.battleSprite}`;
    }
  }

  queueEnemyTurn(delay = 0.5) {
    this.pendingEnemyTurn = true;
    this.enemyTurnDelay = delay;
    this.battleInputLocked = true;
  }

  selectFirstLivingEnemy() {
    const index = this.enemies.findIndex((enemy) => !enemy.isDead());

    if (index >= 0) {
      this.selectedEnemyIndex = index;
      return this.enemies[index];
    }

    return null;
  }

  moveEnemySelection(direction) {
    if (this.enemies.length === 0) {
      return;
    }

    let index = this.selectedEnemyIndex;

    for (let i = 0; i < this.enemies.length; i++) {
      index += direction;

      if (index < 0) {
        index = this.enemies.length - 1;
      }

      if (index >= this.enemies.length) {
        index = 0;
      }

      if (!this.enemies[index].isDead()) {
        this.selectedEnemyIndex = index;
        return;
      }
    }
  }

  moveToward(current, target, amount) {
    if (current < target) {
      return Math.min(current + amount, target);
    }

    if (current > target) {
      return Math.max(current - amount, target);
    }

    return target;
  }

  addBattleMessage(message) {
    this.battleMessages.push(message);

    if (this.battleMessages.length > 2) {
      this.battleMessages.shift();
    }

    console.log(message);
  }

  setActorState(state, duration = 0) {
    if (this.actorState !== state) {
      this.actorAnimationFrame = 0;
      this.actorAnimationTimer = 0;
    }

    this.actorState = state;
    this.actorStateTimer = duration;
  }

  setEnemyState(state, duration = 0, enemy = this.enemy) {
    const battleData = this.getEnemyBattleData(enemy);

    if (battleData) {
      if (battleData.state !== state) {
        battleData.animationFrame = 0;
        battleData.animationTimer = 0;
      }

      battleData.state = state;
      battleData.stateTimer = duration;
    }

    // TEMPORARY BRIDGE:
    // Keep the old active-enemy system working
    // while we convert to true multi-enemy states.
    if (enemy === this.enemy) {
      if (this.enemyState !== state) {
        this.enemyAnimationFrame = 0;
        this.enemyAnimationTimer = 0;
      }

      this.enemyState = state;
      this.enemyStateTimer = duration;
    }
  }

  setActionPhase(phase, duration = 0) {
    this.actionPhase = phase;
    this.actionPhaseTimer = duration;
  }

  getActorTargetOffset() {
    // Attack movement is controlled by action phases.
    if (this.actionPhase === "lunge") {
      return 45;
    }

    if (this.actionPhase === "hit") {
      return 45;
    }

    if (this.actionPhase === "return") {
      return 0;
    }

    // Player recoil when hurt.
    if (this.actorState === "hurt") {
      return -18;
    }

    return 0;
  }

  getActorTargetYOffset() {
    if (this.actionPhase === "magicCast") {
      return -12;
    }

    if (this.actionPhase === "itemUse") {
      return -6;
    }

    if (this.actionPhase === "itemEffect") {
      return -6;
    }
    return 0;
  }

  getActorStateYOffset() {
    if (this.actorState === "hurt") {
      return 34;
    }

    if (this.actorState === "defeat") {
      return 52;
    }

    return 0;
  }

  getActorVisualScale() {
    // ACTOR GROWS  WHILE CASTING MAGIC
    if (this.actionPhase === "magicCast") {
      const duration = 0.4;

      const progress = 1 - this.actionPhaseTimer / duration;

      return 1 + 0.06 * progress;
    }

    // ACTOR SHRINKS WHILE MAGIC EFFECT IS ACTIVE
    if (this.actionPhase === "magicEffect") {
      const duration = 0.25;

      const progress = 1 - this.actionPhaseTimer / duration;

      return 1.06 - 0.06 * progress;
    }

    // ACTOR GROWS WHILE USING ITEM
    if (this.actionPhase === "itemUse") {
      const duration = 0.35;

      const progress = 1 - this.actionPhaseTimer / duration;

      return 1 + 0.03 * progress;
    }
    // ACTOR SHRINKS WHILE ITEM EFFECT IS ACTIVE
    if (this.actionPhase === "itemEffect") {
      const duration = 0.25;

      const progress = 1 - this.actionPhaseTimer / duration;

      return 1.03 - 0.03 * progress;
    }

    return 1;
  }

  getActorVisualAlpha() {
    if (
      this.actionPhase === "magicEffect" &&
      this.magicEffectSkill &&
      this.magicEffectTarget === $gameActor
    ) {
      return 0.65;
    }

    return 1;
  }

  getEnemyVisualAlpha() {
    if (
      this.actionPhase === "magicEffect" &&
      this.magicEffectSkill &&
      this.magicEffectTarget === this.enemy
    ) {
      return 0.45;
    }

    return 1;
  }

  getEnemyBattlePosition(index) {
    const positions = [
      {
        x: Graphics.width * 0.82,
        y: 400,
      },
      {
        x: Graphics.width * 0.68,
        y: 300,
      },
      {
        x: Graphics.width * 0.88,
        y: 250,
      },
    ];

    return positions[index] || positions[positions.length - 1];
  }

  getEnemyPosition(enemy) {
    const index = this.enemies.indexOf(enemy);

    if (index < 0) {
      return this.getEnemyBattlePosition(0);
    }

    return this.getEnemyBattlePosition(index);
  }

  getSelectedEnemy() {
    return this.enemies[this.selectedEnemyIndex] || null;
  }

  getSelectedTarget() {
    if (this.targetGroup === "ally") {
      return $gameActor;
    }

    return this.getSelectedEnemy();
  }

  getCurrentTargets() {
    if (this.targetScope === "all") {
      if (this.targetGroup === "ally") {
        return [$gameActor];
      }

      return this.enemies.filter((enemy) => enemy && !enemy.isDead());
    }

    const target = this.getSelectedTarget();

    return target ? [target] : [];
  }

  getEnemyBattleData(enemy) {
    const index = this.enemies.indexOf(enemy);

    if (index < 0) {
      return null;
    }

    return this.enemyBattleData[index];
  }

  getBattleAnimationFrameDuration() {
    return 0.12;
  }

  getBattlerAnimationData(state) {
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
    const rows = {
      idle: 0,
      attack: 1,
      magic: 2,
      hurt: 3,
      defeat: 4,
    };

    return rows[state] ?? 0;
  }

  performAttack() {
    const target = this.getSelectedTarget();

    if (!target) {
      return;
    }

    this.pendingAttackTarget = target;

    if (this.enemy.isDead()) {
      const nextEnemy = this.enemies.find((enemy) => !enemy.isDead());

      if (!nextEnemy) {
        return;
      }

      this.enemy = nextEnemy;
    }

    this.battleInputLocked = true;
    this.pendingAttackDamage = true;

    this.setActorState("attack", 0.4);
    this.setActionPhase("lunge", 0.2);
  }

  performAttackHit() {
    if (!this.pendingAttackDamage) {
      return;
    }

    this.pendingAttackDamage = false;

    const target = this.pendingAttackTarget;
    this.pendingAttackTarget = null;

    if (!target || target.isDead()) {
      return;
    }

    const damage = Math.max(
      1,
      $gameActor.totalAttack() - target.totalDefense(),
    );

    target.loseHp(damage);

    // -----------------------------
    // Ally target
    // -----------------------------

    if (target === $gameActor) {
      if (target.isDead()) {
        this.setActorState("defeat");
        this.defeat = true;

        this.addBattleMessage(
          `${$gameActor.name} attacks ${target.name}! ${target.name} takes ${damage} damage!`,
        );

        return;
      }

      this.setActorState("hurt", 0.3);

      this.addBattleMessage(
        `${$gameActor.name} attacks ${target.name}! ${target.name} takes ${damage} damage!`,
      );

      return;
    }

    // -----------------------------
    // Enemy target
    // -----------------------------

    if (target.isDead()) {
      this.setEnemyState("defeat", 0, target);

      this.addBattleMessage(
        `${$gameActor.name} attacks! ${target.name} takes ${damage} damage!`,
      );

      return;
    }

    this.setEnemyState("hurt", 0.3, target);

    this.addBattleMessage(
      `${$gameActor.name} attacks! ${target.name} takes ${damage} damage!`,
    );
  }

  performMagicEffect() {
    const skill = this.pendingMagicSkill;
    const target = this.pendingMagicTarget;

    // MULTI-TARGET MAGIC EFFECT FOR ENEMIES
    if (this.targetScope === "all" && skill?.effect === "damage") {
      const targets = this.getCurrentTargets();

      let paidCost = false;

      for (const enemy of targets) {
        const hpBefore = enemy.hp;

        const success = $gameActor.useSkill(skill.id, enemy, !paidCost);

        if (!success) {
          continue;
        }

        paidCost = true;

        const damage = hpBefore - enemy.hp;

        if (enemy.isDead()) {
          this.setEnemyState("defeat", 0, enemy);
        } else {
          this.setEnemyState("hurt", 0.4, enemy);
        }

        this.addBattleMessage(
          `${$gameActor.name} casts ${skill.name}! ` +
            `${enemy.name} takes ${damage} damage!`,
        );
      }

      if (skill.name === "Fire") {
        this.startBattleEffect("fire", targets, 0.4);
      }

      this.pendingMagicSkill = null;
      this.pendingMagicTarget = null;

      return;
    }

    // SINGLE TARGET MAGIC EFFECT
    if (!skill || !target) {
      return;
    }

    const enemyHpBefore = this.enemy.hp;
    const playerHpBefore = $gameActor.hp;

    const success = $gameActor.useSkill(skill.id, target);

    if (!success) {
      this.pendingMagicSkill = null;
      this.pendingMagicTarget = null;

      this.setActorState("idle");
      return;
    }

    // Offensive spell
    if (target === this.enemy) {
      const damage = enemyHpBefore - this.enemy.hp;

      if (this.enemy.isDead()) {
        this.setEnemyState("defeat");
      } else {
        this.setEnemyState("hurt", 0.4);
      }

      this.addBattleMessage(
        `${$gameActor.name} casts ${skill.name}! ` +
          `${this.enemy.name} takes ${damage} damage!`,
      );
    }

    // Ally target
    if (target === $gameActor) {
      if (skill.effect === "damage") {
        const damage = playerHpBefore - $gameActor.hp;

        this.setActorState("hurt", 0.4);

        this.addBattleMessage(
          `${$gameActor.name} casts ${skill.name}! ` +
            `${$gameActor.name} takes ${damage} damage!`,
        );
      }

      if (skill.effect === "heal") {
        const healing = $gameActor.hp - playerHpBefore;

        this.addBattleMessage(
          `${$gameActor.name} casts ${skill.name}! ` +
            `${$gameActor.name} recovers ${healing} HP!`,
        );
      }
    }

    this.magicEffectSkill = skill;
    this.magicEffectTarget = target;

    if (skill.name === "Fire") {
      this.startBattleEffect("fire", target, 0.4);
    }

    if (skill.name === "Cure") {
      this.startBattleEffect("cure", target, 0.5);
    }

    this.pendingMagicSkill = null;
    this.pendingMagicTarget = null;
  }

  performItemEffect() {
    const item = this.pendingItem;

    if (!item) {
      return;
    }

    const hpBefore = $gameActor.hp;

    const success = $gameParty.useItem(item.id);

    if (!success) {
      this.pendingItem = null;
      return;
    }

    const healing = $gameActor.hp - hpBefore;

    this.addBattleMessage(
      `${$gameActor.name} uses ${item.name}! ` +
        `${$gameActor.name} recovers ${healing} HP!`,
    );

    // The pending item has now been used.
    this.pendingItem = null;
  }

  performEnemyTurn(enemy = this.enemies[this.enemyTurnIndex]) {
    if (!enemy || enemy.isDead()) {
      this.enemyTurnIndex++;

      if (this.enemyTurnIndex < this.enemies.length) {
        this.pendingEnemyTurn = true;
        this.enemyTurnDelay = 0.2;
      } else {
        this.enemyTurnIndex = 0;
        this.pendingEnemyTurn = false;
      }

      return;
    }

    this.setEnemyState("attack", 0.4, enemy);

    const attack = enemy.totalAttack();
    const defense = $gameActor.totalDefense();

    const damage = Math.max(1, attack - defense);
    $gameActor.loseHp(damage);

    this.setActorState("hurt", 0.3);

    this.addBattleMessage(
      `${enemy.name} attacks! ` + `${$gameActor.name} takes ${damage} damage!`,
    );

    if ($gameActor.isDead()) {
      this.setActorState("defeat");

      this.defeat = true;

      this.addBattleMessage(`${$gameActor.name} has fallen! Defeat...`);
    }
    this.enemyTurnIndex++;

    if (this.enemyTurnIndex < this.enemies.length) {
      this.pendingEnemyTurn = true;
      this.enemyTurnDelay = 0.6;
    } else {
      this.enemyTurnIndex = 0;
      this.pendingEnemyTurn = false;
    }
  }

  executeCommand() {
    const command = this.commandWindow.currentCommand();

    switch (command) {
      case "Attack":
        this.targetGroup = "enemy";
        this.targetScope = "single";

        this.selectFirstLivingEnemy();
        this.enemyTargetAction = "attack";
        this.selectingEnemyTarget = true;
        break;

      case "Magic":
        this.magicWindow.show();
        break;

      case "Item":
        this.itemWindow.show();
        break;
    }
  }

  executeMagic() {
    // =====================================
    const skill = this.magicWindow.currentSkill();

    if (!skill) {
      return;
    }

    if (!$gameActor.canUseSkill(skill.id)) {
      return;
    }

    let target = null;

    if (skill.effect === "damage") {
      if (Array.isArray(skill.target) && skill.target.includes("enemy")) {
        this.pendingMagicSkill = skill;

        this.targetGroup = "enemy";
        this.targetScope = "single";

        this.selectFirstLivingEnemy();
        this.enemyTargetAction = "magic";
        this.selectingEnemyTarget = true;

        this.magicWindow.hide();

        return;
      }
    }

    if (skill.effect === "heal") {
      if (
        Array.isArray(skill.target) &&
        (skill.target.includes("ally") || skill.target.includes("self"))
      ) {
        target = $gameActor;
      }
    }

    if (!target) {
      console.warn(`No valid battle target for ${skill.name}.`);

      return;
    }

    this.pendingMagicSkill = skill;
    this.pendingMagicTarget = target;

    this.battleInputLocked = true;

    this.setActorState("magic", 0.9);
    this.setActionPhase("magicCast", 0.4);

    this.setActorState("magic", 0.9);

    this.magicWindow.hide();

    if (this.enemy.isDead()) {
      this.setEnemyState("defeat");
      this.victory = true;

      this.addBattleMessage(`${this.enemy.name} is defeated! Victory!`);

      return;
    }

    // this.queueEnemyTurn(1.1);
  }

  executeItem() {
    const item = this.itemWindow.currentItem();

    if (!item) {
      return;
    }

    // Store the item for the effect phase.
    this.pendingItem = item;

    // Close the item window now.
    this.itemWindow.hide();

    // Lock commands while the action plays.
    this.battleInputLocked = true;

    // Begin the item action.
    this.setActionPhase("itemUse", 0.35);
  }

  drawActorSprite(context, x, y) {
    const width = $gameActor.battleSpriteWidth;
    const height = $gameActor.battleSpriteHeight;
    const scale = this.getActorVisualScale();

    const alpha = this.getActorVisualAlpha();

    context.save();

    context.globalAlpha = alpha;

    context.translate(x, y - height / 2);

    context.scale(scale, scale);

    if (
      this.actorImage &&
      this.actorImage.complete &&
      this.actorImage.naturalWidth > 0
    ) {
      const animation = this.getBattlerAnimationData(this.actorState);

      const frameCount = $gameActor.battleSpriteFrames || 1;
      const rowCount = $gameActor.battleSpriteRows || 1;

      const sourceFrameWidth = this.actorImage.naturalWidth / frameCount;
      const sourceFrameHeight = this.actorImage.naturalHeight / rowCount;

      const frame = Math.min(this.actorAnimationFrame, frameCount - 1);

      const sourceX = frame * sourceFrameWidth;

      const requestedRow = this.getBattlerAnimationRow(this.actorState);

      const row = Math.min(requestedRow, rowCount - 1);

      const sourceY = row * sourceFrameHeight;

      context.drawImage(
        this.actorImage,

        sourceX,
        sourceY,
        sourceFrameWidth,
        sourceFrameHeight,

        -width / 2,
        -height / 2,
        width,
        height,
      );

      context.restore();
      return;
    }

    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;

    context.strokeRect(-width / 2, -height / 2, width, height);

    context.restore();
  }

  drawEnemySprite(context, x, y, battleData = null) {
    const width = this.enemy.battleSpriteWidth;
    const height = this.enemy.battleSpriteHeight;

    const alpha = this.getEnemyVisualAlpha();

    context.save();

    context.globalAlpha = alpha;

    context.translate(x, y - height / 2);

    if (
      this.enemyImage &&
      this.enemyImage.complete &&
      this.enemyImage.naturalWidth > 0
    ) {
      const frameCount = this.enemy.battleSpriteFrames || 1;
      const rowCount = this.enemy.battleSpriteRows || 1;

      const sourceFrameWidth = this.enemyImage.naturalWidth / frameCount;
      const sourceFrameHeight = this.enemyImage.naturalHeight / rowCount;

      const frame = Math.min(
        battleData ? battleData.animationFrame : this.enemyAnimationFrame,
        frameCount - 1,
      );

      const sourceX = frame * sourceFrameWidth;

      const requestedRow = this.getBattlerAnimationRow(this.enemyState);

      const row = Math.min(requestedRow, rowCount - 1);

      const sourceY = row * sourceFrameHeight;

      context.drawImage(
        this.enemyImage,

        sourceX,
        sourceY,
        sourceFrameWidth,
        sourceFrameHeight,

        -width / 2,
        -height / 2,
        width,
        height,
      );

      context.restore();
      return;
    }

    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;

    context.strokeRect(-width / 2, -height / 2, width, height);

    context.restore();
  }

  drawEnemies(context) {
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];

      const battleData = this.enemyBattleData[i];

      if (!enemy || !battleData) {
        continue;
      }

      const position = this.getEnemyBattlePosition(i);

      const previousEnemy = this.enemy;

      this.enemy = enemy;

      this.drawEnemySprite(
        context,
        position.x + battleData.visualX,
        position.y,
      );

      this.enemy = previousEnemy;
    }
  }

  drawEnemyTargetCursor(context) {
    if (!this.selectingEnemyTarget) {
      return;
    }

    context.save();

    context.font = "32px sans-serif";
    context.textAlign = "center";

    // -----------------------------
    // ALL TARGETS
    // -----------------------------

    if (this.targetScope === "all") {
      if (this.targetGroup === "ally") {
        const battlefieldBottom = Graphics.height - 190;

        const x = 230;
        const y = battlefieldBottom - 210;

        context.fillText("▼", x, y);
      } else {
        for (let i = 0; i < this.enemies.length; i++) {
          const enemy = this.enemies[i];

          if (!enemy || enemy.isDead()) {
            continue;
          }

          const position = this.getEnemyBattlePosition(i);

          context.fillText("▼", position.x, position.y - 110);
        }
      }

      context.restore();
      return;
    }

    // -----------------------------
    // SINGLE TARGET
    // -----------------------------

    let x;
    let y;

    if (this.targetGroup === "ally") {
      const battlefieldBottom = Graphics.height - 190;

      x = 230;
      y = battlefieldBottom - 210;
    } else {
      const position = this.getEnemyBattlePosition(this.selectedEnemyIndex);

      x = position.x;
      y = position.y - 110;
    }

    context.fillText("▼", x, y);

    context.restore();
  }

  drawFrontView(context) {
    context.textAlign = "center";
    context.textBaseline = "alphabetic";

    context.font = "34px Arial";
    context.fillStyle = "#ffffff";

    context.fillText(this.enemy.name, Graphics.width / 2, 180);

    context.font = "22px Arial";

    context.fillText(
      `HP: ${this.enemy.hp} / ${this.enemy.maxHp}`,
      Graphics.width / 2,
      220,
    );

    this.drawEnemySprite(context, Graphics.width / 2, 355);
  }

  drawSideView(context) {
    const battlefieldTop = 80;
    const battlefieldBottom = Graphics.height - 190;

    const playerX = 230;
    const playerY = battlefieldBottom - 150;

    const enemyX = Graphics.width - 230;
    const enemyY = battlefieldBottom - 190;

    // -----------------------------
    // Player battlefield position
    // -----------------------------

    context.textAlign = "center";
    context.textBaseline = "alphabetic";

    context.font = "24px Arial";
    context.fillStyle = "#ffffff";

    this.drawActorSprite(
      context,
      playerX + this.actorVisualX,
      playerY + 100 + this.actorVisualY + this.getActorStateYOffset(),
    );

    context.font = "16px Arial";
    context.fillStyle = "#ffffff";

    this.drawEnemies(context);
    this.drawEnemyTargetCursor(context);
  }

  drawBattleHud(context) {
    const hudHeight = 180;
    const hudY = Graphics.height - hudHeight - 10;

    context.fillStyle = "rgba(0, 0, 0, 0.9)";

    context.fillRect(20, hudY, Graphics.width - 40, hudHeight);

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;

    context.strokeRect(20, hudY, Graphics.width - 40, hudHeight);

    // Player status
    const statusX = Graphics.width - 320;

    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#ffffff";

    context.font = "22px Arial";

    context.fillText($gameActor.name, statusX, hudY + 45);

    context.font = "18px Arial";

    context.fillText(
      `HP: ${$gameActor.hp} / ${$gameActor.maxHp}`,
      statusX,
      hudY + 85,
    );

    context.fillText(
      `MP: ${$gameActor.mp} / ${$gameActor.maxMp}`,
      statusX,
      hudY + 120,
    );
  }

  drawBattleEffect(context) {
    if (!this.battleEffect) {
      return;
    }

    const effect = this.battleEffect;

    if (effect.type === "fire") {
      this.drawFireEffect(context, effect);

      return;
    }

    if (effect.type === "cure") {
      this.drawCureEffect(context, effect);
    }
  }

  drawFireEffect(context, effect) {
    if (Array.isArray(effect.target)) {
      for (const target of effect.target) {
        this.drawFireEffect(context, {
          ...effect,
          target: target,
        });
      }

      return;
    }

    if (effect.target !== $gameActor && !this.enemies.includes(effect.target)) {
      return;
    }

    const progress = 1 - effect.timer / effect.duration;

    let enemyX;
    let enemyY;

    if (effect.target === $gameActor) {
      const battlefieldBottom = Graphics.height - 190;
      const playerX = 230;
      const playerY = battlefieldBottom - 150;

      enemyX = playerX + this.actorVisualX;

      enemyY =
        playerY +
        100 +
        this.actorVisualY +
        this.getActorStateYOffset() -
        $gameActor.battleSpriteHeight * 0.5 -
        35;
    } else {
      const enemyPosition = this.getEnemyPosition(effect.target);

      enemyX = enemyPosition.x + this.enemyVisualX;

      enemyY = enemyPosition.y - effect.target.battleSpriteHeight * 0.5;
    }
    // Strongest in the middle of the effect
    const burst = Math.sin(progress * Math.PI);

    context.save();

    // ---------------------------------
    // OUTER FIRE GLOW
    // ---------------------------------

    const glowRadius = 30 + burst * 35;

    const glow = context.createRadialGradient(
      enemyX,
      enemyY,
      5,
      enemyX,
      enemyY,
      glowRadius,
    );

    glow.addColorStop(0, "rgba(255, 230, 80, 0.75)");
    glow.addColorStop(0.45, "rgba(255, 100, 20, 0.45)");
    glow.addColorStop(1, "rgba(255, 40, 0, 0)");

    context.fillStyle = glow;
    context.beginPath();
    context.arc(enemyX, enemyY, glowRadius, 0, Math.PI * 2);
    context.fill();

    // ---------------------------------
    // FLAME PARTICLES
    // ---------------------------------

    const flames = [
      { x: -28, y: 12, size: 15, speed: 42 },
      { x: -15, y: 4, size: 22, speed: 58 },
      { x: 0, y: 10, size: 25, speed: 72 },
      { x: 16, y: 2, size: 19, speed: 55 },
      { x: 30, y: 14, size: 14, speed: 45 },
      { x: -8, y: 18, size: 16, speed: 82 },
      { x: 10, y: 22, size: 13, speed: 68 },
    ];

    for (let i = 0; i < flames.length; i++) {
      const flame = flames[i];

      const wave = Math.sin(progress * 12 + i * 1.7) * 6;

      const x = enemyX + flame.x + wave * progress;
      const y = enemyY + flame.y - flame.speed * progress;

      const size = flame.size * (0.7 + burst * 0.5);

      const alpha = Math.max(0, 1 - progress);

      // Red/orange outer flame
      context.globalAlpha = alpha * 0.8;

      context.fillStyle = "rgba(255, 70, 10, 1)";
      context.beginPath();
      context.ellipse(x, y, size * 0.65, size, 0, 0, Math.PI * 2);
      context.fill();

      // Yellow inner flame
      context.globalAlpha = alpha;

      context.fillStyle = "rgba(255, 220, 70, 1)";
      context.beginPath();

      context.ellipse(
        x,
        y + size * 0.15,
        size * 0.3,
        size * 0.55,
        0,
        0,
        Math.PI * 2,
      );

      context.fill();
    }

    // ---------------------------------
    // IMPACT FLASH
    // ---------------------------------

    if (progress < 0.35) {
      const flashProgress = progress / 0.35;

      const flashRadius = 12 + flashProgress * 35;

      context.globalAlpha = 1 - flashProgress;

      context.fillStyle = "rgba(255, 245, 170, 1)";
      context.beginPath();
      context.arc(enemyX, enemyY, flashRadius, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  }

  drawCureEffect(context, effect) {
    if (effect.target !== $gameActor) {
      return;
    }

    const progress = 1 - effect.timer / effect.duration;

    const playerX = Graphics.width * 0.2 + this.actorVisualX;
    const playerY = 360 + this.actorVisualY + this.getActorStateYOffset();

    const rise = progress * 70;

    const fade = Math.max(0, 1 - progress);

    context.save();

    // ---------------------------------
    // SOFT HEALING GLOW
    // ---------------------------------

    const glowRadius = 25 + Math.sin(progress * Math.PI) * 30;

    const glow = context.createRadialGradient(
      playerX,
      playerY,
      5,
      playerX,
      playerY,
      glowRadius,
    );

    glow.addColorStop(0, "rgba(230, 255, 210, 0.8)");
    glow.addColorStop(0.5, "rgba(120, 255, 150, 0.35)");
    glow.addColorStop(1, "rgba(80, 220, 120, 0)");

    context.fillStyle = glow;
    context.beginPath();
    context.arc(playerX, playerY, glowRadius, 0, Math.PI * 2);
    context.fill();

    // ---------------------------------
    // RISING HEAL PARTICLES
    // ---------------------------------

    const particles = [
      { x: -28, y: 15, size: 5, speed: 0.8 },
      { x: -12, y: 0, size: 7, speed: 1.0 },
      { x: 4, y: 18, size: 6, speed: 0.9 },
      { x: 20, y: 5, size: 5, speed: 1.1 },
      { x: 32, y: 22, size: 4, speed: 0.75 },
      { x: -4, y: 30, size: 5, speed: 1.2 },
    ];

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];

      const wave = Math.sin(progress * 8 + i * 1.5) * 8;

      const x = playerX + particle.x + wave * progress;
      const y = playerY + particle.y - rise * particle.speed;

      context.globalAlpha = fade;

      context.fillStyle = "rgba(180, 255, 200, 1)";
      context.beginPath();
      context.arc(x, y, particle.size, 0, Math.PI * 2);
      context.fill();
    }

    // ---------------------------------
    // HEALING RING
    // ---------------------------------

    const ringRadius = 18 + progress * 35;

    context.globalAlpha = fade * 0.8;

    context.strokeStyle = "rgba(200, 255, 220, 1)";

    context.lineWidth = 3;

    context.beginPath();
    context.arc(playerX, playerY, ringRadius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  draw() {
    const context = Graphics.context;

    context.save();

    // -----------------------------
    // Battle background
    // -----------------------------

    context.fillStyle = "#202020";

    context.fillRect(0, 0, Graphics.width, Graphics.height);

    // -----------------------------
    // Battle title
    // -----------------------------

    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.font = "28px Arial";
    context.fillStyle = "#ffffff";

    context.fillText("Battle", 40, 50);

    // -----------------------------
    // Battle presentation
    // -----------------------------

    if (this.battleView === "front") {
      this.drawFrontView(context);
    } else {
      this.drawSideView(context);
    }
    this.drawBattleHud(context);
    this.drawBattleEffect(context);

    // -----------------------------
    // Battle messages
    // -----------------------------

    if (this.battleMessages.length > 0) {
      context.textAlign = "center";
      context.textBaseline = "alphabetic";
      context.font = "20px Arial";
      context.fillStyle = "#ffffff";

      const startY = Graphics.height - 250;

      for (let i = 0; i < this.battleMessages.length; i++) {
        context.fillText(
          this.battleMessages[i],
          Graphics.width / 2,
          startY + i * 28,
        );
      }
    }

    // -----------------------------
    // Test battle exit hint
    // -----------------------------

    context.textAlign = "right";
    context.textBaseline = "alphabetic";
    context.font = "16px Arial";
    context.fillStyle = "#ffffff";

    context.fillText(
      "Escape: Leave Test Battle",
      Graphics.width - 30,
      Graphics.height - 30,
    );

    // -----------------------------
    // Battle windows
    // -----------------------------

    if (
      !this.victory &&
      !this.defeat &&
      !this.battleInputLocked &&
      !this.magicWindow.isOpen() &&
      !this.itemWindow.isOpen()
    ) {
      this.commandWindow.draw();
    }

    this.magicWindow.draw();
    this.itemWindow.draw();

    context.restore();
  }

  terminate() {
    super.terminate();

    console.log("Battle ended.");
  }
}
