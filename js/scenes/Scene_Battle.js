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
    this.enemyImages = new Map();

    this.actorVisualX = 0;
    this.actorVisualY = 0;

    // =============================================================
    // Pass 10 - Independent Party Battler Data
    // =============================================================

    this.partyBattleData = new Map();
    this.partyImages = new Map();

    this.loadBattleSprites();
    this.commandWindow = new Window_BattleCommand();
    this.magicWindow = new Window_BattleMagic(this);
    this.itemWindow = new Window_BattleItem();

    this.battleMessages = [];
    this.victory = false;
    this.defeat = false;

    // BATTLER STATES
    this.actorState = "idle";
    this.actorStateTimer = 0;

    // SPRITE ANIMATION TRACKING
    this.actorAnimationFrame = 0;
    this.actorAnimationTimer = 0;

    // BATTLE SYSTEM
    this.battleView = DatabaseManager.system.battleView || "side";

    // ENEMY TURN MANAGEMENT
    this.pendingEnemyTurn = false;
    this.enemyTurnIndex = 0;
    this.enemyTurnDelay = 0;
    this.battleInputLocked = false;

    // ENEMY TARGET SELECTION
    this.selectedEnemyIndex = 0;
    this.selectedAllyIndex = 0;
    this.selectingEnemyTarget = false;
    this.enemyTargetAction = null;

    this.targetGroup = "enemy";
    this.targetScope = "single";
    this.targetManager = new BattleTargetManager(this);

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
    this.battleEffects = new BattleEffects(this);
    this.animationController = new BattleAnimationController(this);
    this.battleManager = new BattleManager(this);
    this.partyController = new BattlePartyController(this);
    this.renderer = new BattleRenderer(this);

    // PENDING ITEM ACTION
    this.pendingItem = null;
  }

  start() {
    super.start();

    // =============================================================
    // Pass 9 - Awakening
    // Initialize the party turn queue.
    // =============================================================

    this.partyController.initializePartyTurnQueue();
    this.initializePartyBattleData();

    this.battleManager.setTurnState(BattleManager.TURN_COMMAND);

    DebugManager.log(`Battle started against ${this.enemy.name}.`);
  }

  update(deltaTime) {
    this.updateBattlerStates(deltaTime);
    this.updateActionPhase(deltaTime);
    this.updateBattlerVisuals(deltaTime);
    this.updateBattleAnimations(deltaTime);
    this.updateBattleEffect(deltaTime);
    this.updatePendingEnemyTurn(deltaTime);

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
      if (this.enemyTargetAction === "magic" && Input.isTriggered("KeyR")) {
        this.targetScope = this.targetScope === "single" ? "all" : "single";
      }

      if (Input.isTriggered("KeyA") || Input.isTriggered("ArrowLeft")) {
        this.targetGroup = "ally";
        this.targetManager.selectFirstLivingAlly();
      }

      if (Input.isTriggered("KeyD") || Input.isTriggered("ArrowRight")) {
        this.targetGroup = "enemy";
        this.targetManager.selectFirstLivingEnemy();
      }

      if (
        this.targetGroup === "enemy" &&
        this.targetScope === "single" &&
        (Input.isTriggered("KeyW") || Input.isTriggered("ArrowUp"))
      ) {
        this.targetManager.moveEnemySelection(-1);
      }

      if (
        this.targetGroup === "enemy" &&
        this.targetScope === "single" &&
        (Input.isTriggered("KeyS") || Input.isTriggered("ArrowDown"))
      ) {
        this.targetManager.moveEnemySelection(1);
      }

      if (
        this.targetGroup === "ally" &&
        this.targetScope === "single" &&
        (Input.isTriggered("KeyW") || Input.isTriggered("ArrowUp"))
      ) {
        this.targetManager.moveAllySelection(-1);
      }

      if (
        this.targetGroup === "ally" &&
        this.targetScope === "single" &&
        (Input.isTriggered("KeyS") || Input.isTriggered("ArrowDown"))
      ) {
        this.targetManager.moveAllySelection(1);
      }

      if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
        const target = this.targetManager.getSelectedTarget();

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
        this.targetGroup = "enemy";
        this.targetScope = "single";
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

  currentBattler() {
    return this.battleManager.currentBattler();
  }

  updateBattlerStates(deltaTime) {
    return this.animationController.updateBattlerStates(deltaTime);
  }

  updateActionPhase(deltaTime) {
    return this.battleManager.updateActionPhase(deltaTime);
  }

  updateBattlerVisuals(deltaTime) {
    return this.animationController.updateBattlerVisuals(deltaTime);
  }

  updateEnemyVisual(enemy, battleData, deltaTime) {
    return this.animationController.updateEnemyVisual(
      enemy,
      battleData,
      deltaTime,
    );
  }

  updateBattleAnimations(deltaTime) {
    return this.animationController.updateBattleAnimations(deltaTime);
  }

  updateActorAnimation(deltaTime) {
    return this.animationController.updateActorAnimation(deltaTime);
  }

  updateEnemyAnimation(deltaTime) {
    return this.animationController.updateEnemyAnimation(deltaTime);
  }

  updatePendingEnemyTurn(deltaTime) {
    return this.battleManager.updatePendingEnemyTurn(deltaTime);
  }

  updateBattleEffect(deltaTime) {
    this.battleEffects.update(deltaTime);
  }

  startBattleEffect(type, target, duration = 0.4) {
    this.battleEffects.start(type, target, duration);
  }

  loadBattleSprites() {
    // =====================================
    // PARTY SPRITES
    // =====================================

    this.partyImages.clear();

    for (const actor of $gameParty.battleMembers()) {
      if (!actor.sideBattleSprite) {
        continue;
      }

      const image = new Image();
      image.src = `js/sprites/actors/${actor.sideBattleSprite}`;

      this.partyImages.set(actor, image);
    }

    // =====================================
    // ENEMY SPRITES
    // =====================================

    this.enemyImages.clear();

    for (const enemy of this.enemies) {
      if (!enemy?.battleSprite || this.enemyImages.has(enemy.battleSprite)) {
        continue;
      }

      const image = new Image();
      image.src = `js/sprites/enemies/${enemy.battleSprite}`;
      this.enemyImages.set(enemy.battleSprite, image);
    }
  }

  initializePartyBattleData() {
    this.partyBattleData.clear();

    for (const actor of $gameParty.battleMembers()) {
      this.partyBattleData.set(actor, {
        state: "idle",
        stateTimer: 0,

        animationFrame: 0,
        animationTimer: 0,

        visualX: 0,
        visualY: 0,
      });
    }
  }

  queueEnemyTurn(delay = 0.5) {
    return this.battleManager.queueEnemyTurn(delay);
  }

  moveToward(current, target, amount) {
    return this.animationController.moveToward(current, target, amount);
  }

  addBattleMessage(message) {
    this.battleMessages.push(message);

    if (this.battleMessages.length > 2) {
      this.battleMessages.shift();
    }

    DebugManager.log(message);
  }

  setActorState(state, duration = 0, actor = null) {
    return this.animationController.setActorState(
      state,
      duration,
      actor || this.partyController.currentBattler(),
    );
  }

  setEnemyState(state, duration = 0, enemy = this.enemy) {
    return this.animationController.setEnemyState(state, duration, enemy);
  }

  setActionPhase(phase, duration = 0) {
    this.actionPhase = phase;
    this.actionPhaseTimer = duration;
  }

  getActorTargetOffset() {
    return this.animationController.getActorTargetOffset();
  }

  getActorTargetYOffset() {
    return this.animationController.getActorTargetYOffset();
  }

  getActorStateYOffset(actor) {
    return this.animationController.getActorStateYOffset(actor);
  }

  getActorVisualScale(actor) {
    return this.animationController.getActorVisualScale(actor);
  }

  getActorVisualAlpha(actor) {
    return this.animationController.getActorVisualAlpha(actor);
  }

  getEnemyVisualAlpha(enemy = this.enemy) {
    return this.animationController.getEnemyVisualAlpha(enemy);
  }

  getBattlePartyMembers() {
    return $gameParty.battleMembers();
  }

  getAllyBattlePosition(index) {
    return this.partyController.battlePosition(index);
  }

  getAllyPosition(actor) {
    return this.partyController.positionForBattler(actor);
  }

  getEnemyBattlePosition(index) {
    const positions = [
      {
        x: Graphics.width * 0.9,
        y: 400,
      },
      {
        x: Graphics.width * 0.8,
        y: 290,
      },
      {
        x: Graphics.width * 0.92,
        y: 220,
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

  getEnemyBattleData(enemy) {
    const index = this.enemies.indexOf(enemy);

    if (index < 0) {
      return null;
    }

    return this.enemyBattleData[index];
  }

  getBattlerAnimationData(state) {
    return this.animationController.getBattlerAnimationData(state);
  }

  getBattlerAnimationRow(state) {
    return this.animationController.getBattlerAnimationRow(state);
  }

  getPartyBattleData(actor) {
    return this.partyBattleData.get(actor) || null;
  }

  getPartyBattleImage(actor) {
    return this.partyImages.get(actor) || null;
  }

  performAttack() {
    return this.battleManager.performAttack();
  }

  performAttackHit() {
    return this.battleManager.performAttackHit();
  }

  performMagicEffect() {
    return this.battleManager.performMagicEffect();
  }

  performItemEffect() {
    return this.battleManager.performItemEffect();
  }

  performEnemyTurn(enemy = this.enemies[this.enemyTurnIndex]) {
    return this.battleManager.performEnemyTurn(enemy);
  }

  executeCommand() {
    return this.battleManager.executeCommand();
  }

  executeMagic() {
    return this.battleManager.executeMagic();
  }

  executeItem() {
    return this.battleManager.executeItem();
  }

  drawActorSprite(context, x, y) {
    this.renderer.drawActorSprite(context, x, y);
  }

  drawEnemySprite(context, x, y, battleData = null) {
    this.renderer.drawEnemySprite(context, x, y, battleData);
  }

  drawEnemies(context) {
    this.renderer.drawEnemies(context);
  }

  drawEnemyTargetCursor(context) {
    this.renderer.drawEnemyTargetCursor(context);
  }

  drawFrontView(context) {
    this.renderer.drawFrontView(context);
  }

  drawSideView(context) {
    this.renderer.drawSideView(context);
  }

  drawBattleHud(context) {
    this.renderer.drawBattleHud(context);
  }

  drawBattleEffect(context) {
    this.renderer.drawBattleEffect(context);
  }

  draw() {
    this.renderer.draw();
  }

  terminate() {
    super.terminate();

    DebugManager.log("Battle ended.");
  }
}
