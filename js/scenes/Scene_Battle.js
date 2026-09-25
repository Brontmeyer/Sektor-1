"use strict";

class Scene_Battle extends Scene_Base {
  constructor(encounter, onComplete = null) {
    super();

    if (!encounter || !Array.isArray(encounter.members)) {
      throw new Error("Scene_Battle requires a validated encounter.");
    }

    this.encounter = encounter;
    this.onComplete = typeof onComplete === "function" ? onComplete : null;
    this.outcome = null;
    this.result = null;
    this.battleExited = false;
    this.enemies = encounter.members.map(
      (member) => new Game_Enemy(member.enemyId),
    );

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
    this.battleSpriteLoadFailures = new Set();

    this.actorVisualX = 0;
    this.actorVisualY = 0;

    // =============================================================
    // Pass 10 - Independent Party Battler Data
    // =============================================================

    this.partyBattleData = new Map();
    this.partyImages = new Map();

    this.loadBattleSprites();
    this.commandWindow = new Window_BattleCommand(this);
    this.magickWindow = new Window_BattleMagick(this);
    this.skillsWindow = new Window_BattleSkills(this);
    this.itemWindow = new Window_BattleItem();
    this.resultsWindow = new Window_BattleResults(this);

    this.battleMessages = [];
    this.battlePopups = [];
    this.battleBanner = null;
    this.battleBannerQueue = [];

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
    this.activeTimeClaimDelay = 0;
    this.battleInputLocked = false;

    // ENEMY TARGET SELECTION
    this.selectedEnemyIndex = 0;
    this.selectedAllyIndex = 0;
    this.selectingEnemyTarget = false;
    this.enemyTargetAction = null;

    this.targetGroup = "enemy";
    this.targetScope = "single";
    this.targetManager = new BattleTargetManager(this);
    this.scanManager = new BattleScanManager(this);

    // BATTLE ACTION PHASE SYSTEM
    this.actionPhase = "none";
    this.actionPhaseTimer = 0;
    this.pendingAttackDamage = false;
    this.pendingAttackTarget = null;

    // PENDING SKILL ACTION
    this.pendingSkill = null;
    this.pendingSkillTarget = null;

    // PENDING MAGIC ACTION
    this.pendingMagick = null;
    this.pendingMagickTarget = null;

    // MAGIC EFFECT STATE
    this.magickEffect = null;
    this.magickEffectTarget = null;
    this.battleEffects = new BattleEffects(this);
    this.animationController = new BattleAnimationController(this);
    this.battleManager = new BattleManager(this);
    this.timeManager = new BattleTimeManager(this);
    this.formationManager = new BattleFormationManager(this);
    this.partyController = new BattlePartyController(this);
    this.hudLayout = new BattleHudLayout(this);
    this.renderer = new BattleRenderer(this);

    // PENDING ITEM ACTION
    this.pendingItem = null;
  }

  start() {
    super.start();

    this.initializePartyBattleData();
    this.timeManager.initialize();

    if (this.usesActiveTimeAuthority()) {
      this.partyController.clearActiveBattler();
      this.battleManager.setTurnState(BattleManager.TURN_START);
      this.battleInputLocked = true;
    } else {
      this.partyController.initializePartyTurnQueue();
    }

    const formation = this.getFormationType();
    if (formation === BattleFormationManager.BACK_ATTACK) {
      this.showBattleBanner("BACK ATTACK", 1.2);
    } else if (formation === BattleFormationManager.PINCER) {
      this.showBattleBanner("PINCER ATTACK", 1.2);
    }

    if (!this.usesActiveTimeAuthority()) {
      const canAct = this.battleManager.beginPartyTurn();

      if (!canAct) {
        this.battleManager.skipPartyTurn();
        return;
      }

      if (!this.battleManager.startForcedPartyAction()) {
        this.battleManager.setTurnState(BattleManager.TURN_COMMAND);
      }
    }

    DebugManager.log(`Battle started: ${this.encounter.name}.`);
  }

  update(deltaTime) {
    const battleDeltaTime = Scene_Battle.prototype.battleDeltaTime.call(
      this,
      deltaTime,
    );
    const messageDeltaTime = Scene_Battle.prototype.battleMessageDeltaTime.call(
      this,
      deltaTime,
    );

    Scene_Battle.prototype.updateActiveTimeClaimDelay.call(this, battleDeltaTime);
    const timeDeltaTime = Scene_Battle.prototype.battleTimeDeltaTime.call(
      this,
      battleDeltaTime,
    );
    this.updateBattleTime(timeDeltaTime);
    Scene_Battle.prototype.updateActiveTimeAuthority.call(this);
    this.updateBattlerStates(battleDeltaTime);
    this.updateActionPhase(battleDeltaTime);
    this.updateBattlerVisuals(battleDeltaTime);
    this.updateBattleAnimations(battleDeltaTime);
    this.updateBattleEffect(battleDeltaTime);
    this.updateBattlePopups(battleDeltaTime);
    this.updateBattleBanner?.(messageDeltaTime);
    this.updatePendingEnemyTurn(battleDeltaTime);

    // -----------------------------
    // HANDLE VICTORY OR DEFEAT FIRST
    // -----------------------------

    if (this.outcome) {
      if (this.outcome === BattleManager.OUTCOME_VICTORY) {
        this.prepareBattleResults();
        this.resultsWindow.update();
      }

      if (
        Input.isActionTriggered("confirm") ||
        Input.isActionTriggered("menu")
      ) {
        this.finishBattle();
      }

      return;
    }

    if (Input.isActionTriggered("help")) {
      this.scanManager.toggleHelp();
      return;
    }

    // Active ATB may temporarily interrupt an open command/selector with an
    // enemy action. Keep the player's current selection state intact, but do
    // not accept input until the interrupting action chain releases control.
    if (this.battleInputLocked) {
      return;
    }

    // -----------------------------
    // HANDLE ENEMY TARGET SELECTION INPUT
    // -----------------------------

    if (this.selectingEnemyTarget) {
      const definition = this.pendingSkill || this.pendingMagick;

      if (
        ["magick", "skill"].includes(this.enemyTargetAction) &&
        Input.isActionTriggered("scope")
      ) {
        if (definition) {
          this.targetManager.toggleScope(definition);
        }

        return;
      }

      const moveTarget = (dx, dy) => {
        if (this.targetScope === "all") {
          return this.targetManager.moveTargetBucket(dx, dy, definition);
        }

        return this.targetManager.moveDirectionalSelection(dx, dy, definition);
      };

      if (Input.isActionTriggered("left")) {
        moveTarget(-1, 0);
        return;
      }

      if (Input.isActionTriggered("right")) {
        moveTarget(1, 0);
        return;
      }

      if (Input.isActionTriggered("up")) {
        moveTarget(0, -1);
        return;
      }

      if (Input.isActionTriggered("down")) {
        moveTarget(0, 1);
        return;
      }

      if (Input.isActionTriggered("confirm")) {
        const target = this.targetManager.getSelectedTarget();

        if (target && this.targetManager.isSelectableTarget(target)) {
          if (this.targetGroup === "enemy") {
            this.enemy = target;
          }

          this.selectingEnemyTarget = false;

          if (this.enemyTargetAction === "attack") {
            this.enemyTargetAction = null;
            this.performAttack();
          } else if (this.enemyTargetAction === "skill") {
            this.enemyTargetAction = null;
            const skill = this.pendingSkill;
            if (skill) {
              this.pendingSkillTarget = target;
              this.battleInputLocked = true;
              this.setActorState("attack", 0.7);
              this.setActionPhase("skillUse", 0.25);
            }
          } else if (this.enemyTargetAction === "magick") {
            this.enemyTargetAction = null;

            const magick = this.pendingMagick;

            if (magick) {
              this.pendingMagickTarget = target;
              this.battleInputLocked = true;

              this.setActorState("magick", 0.9);
              this.setActionPhase("magickCast", 0.4);
            }
          }
        }

        return;
      }

      if (Input.isActionTriggered("cancel")) {
        this.cancelTargetSelection();
        return;
      }

      return;
    }

    // -----------------------------
    // HANDLE ITEM WINDOW INPUT
    // -----------------------------

    if (this.itemWindow.isOpen()) {
      this.itemWindow.update();

      if (Input.isActionTriggered("cancel")) {
        this.itemWindow.hide();
        return;
      }

      if (Input.isActionTriggered("confirm")) {
        this.executeItem();
      }

      return;
    }

    // -----------------------------
    // HANDLE SKILLS WINDOW INPUT
    // -----------------------------

    if (this.skillsWindow.isOpen()) {
      this.skillsWindow.update();
      if (Input.isActionTriggered("cancel")) {
        this.skillsWindow.hide();
        return;
      }

      if (Input.isActionTriggered("confirm")) {
        this.executeSkill();
      }
      return;
    }

    // -----------------------------
    // HANDLE MAGIC WINDOW INPUT
    // -----------------------------

    if (this.magickWindow.isOpen()) {
      this.magickWindow.update();

      if (Input.isActionTriggered("cancel")) {
        this.magickWindow.hide();
        return;
      }

      if (Input.isActionTriggered("confirm")) {
        this.executeMagick();
      }

      return;
    }

    // -----------------------------
    // HANDLE COMMAND WINDOW INPUT
    // -----------------------------

    this.commandWindow.update();

    if (Input.isActionTriggered("confirm")) {
      this.confirmCommandSelection();
      return;
    }

    if (Input.isActionTriggered("cancel")) {
      this.cancelCommandSelection();
    }
  }

  battleDeltaTime(deltaTime) {
    if (typeof ConfigManager === "undefined") {
      return deltaTime;
    }

    return ConfigManager.battleDeltaTime(deltaTime);
  }

  battleMessageDeltaTime(deltaTime) {
    if (typeof ConfigManager === "undefined") {
      return deltaTime;
    }

    return ConfigManager.battleMessageDeltaTime(deltaTime);
  }

  atbWaitEnabled() {
    return (
      typeof ConfigManager !== "undefined" &&
      typeof ConfigManager.atbWaitEnabled === "function" &&
      ConfigManager.atbWaitEnabled()
    );
  }

  isChoosingActiveTimeCommand() {
    if (!Scene_Battle.prototype.atbWaitEnabled.call(this) || this.outcome) {
      return false;
    }

    const battler = this.timeManager?.activeBattler || null;

    if (!battler || this.enemies.includes(battler)) {
      return false;
    }

    if (this.actionPhase && this.actionPhase !== "none") {
      return false;
    }

    return this.battleInputLocked === false;
  }

  battleTimeDeltaTime(deltaTime) {
    return Scene_Battle.prototype.isChoosingActiveTimeCommand.call(this)
      ? 0
      : deltaTime;
  }

  updateActiveTimeClaimDelay(deltaTime) {
    const seconds = Math.max(0, Number(deltaTime) || 0);
    this.activeTimeClaimDelay = Math.max(
      0,
      (Number(this.activeTimeClaimDelay) || 0) - seconds,
    );
    return this.activeTimeClaimDelay;
  }

  scheduleActiveTimeClaimDelay(delay = 0.45) {
    const seconds = Math.max(0, Number(delay) || 0);
    this.activeTimeClaimDelay = Math.max(
      Number(this.activeTimeClaimDelay) || 0,
      seconds,
    );
    return this.activeTimeClaimDelay;
  }

  cancelTargetSelection() {
    const action = this.enemyTargetAction;

    this.selectingEnemyTarget = false;
    this.enemyTargetAction = null;
    this.pendingSkill = null;
    this.pendingSkillTarget = null;
    this.pendingMagick = null;
    this.pendingMagickTarget = null;
    this.targetGroup = "enemy";
    this.targetScope = "single";

    if (action === "skill") {
      this.skillsWindow.show({ preserveIndex: true });
    } else if (action === "magick") {
      this.magickWindow.show({ preserveIndex: true });
    } else if (action === "item") {
      this.itemWindow.show({ preserveIndex: true });
    }

    return action;
  }

  confirmCommandSelection() {
    const command = this.commandWindow.currentCommand();
    const wasSideCommand = this.commandWindow.hasSideCommandOpen?.() === true;

    if (wasSideCommand) {
      this.commandWindow.closeSide();
    }

    if (command === "Escape") {
      const attempt = this.battleManager.attemptEscape();

      if (attempt?.success) {
        return this.finishBattle(BattleManager.OUTCOME_ESCAPE);
      }

      return false;
    }

    return this.executeCommand(command);
  }

  cancelCommandSelection() {
    return this.commandWindow.closeSide?.() || false;
  }

  prepareBattleResults() {
    if (this.outcome !== BattleManager.OUTCOME_VICTORY) {
      return this.result;
    }

    if (!this.result) {
      this.result = this.battleManager.finalizeBattle(this.outcome);
    }

    if (this.result && !this.resultsWindow.isOpen()) {
      this.resultsWindow.show(this.result);
    }

    return this.result;
  }

  finishBattle(outcome = this.outcome) {
    if (this.battleExited) {
      return this.result;
    }

    const result = this.battleManager.finalizeBattle(outcome);

    if (!result) {
      return null;
    }

    this.battleExited = true;

    try {
      if (this.onComplete) {
        this.onComplete(result);
      }
    } finally {
      SceneManager.pop();
    }

    return result;
  }

  currentBattler() {
    return this.battleManager.currentBattler();
  }

  usesActiveTimeAuthority() {
    return true;
  }

  updateBattleTime(deltaTime) {
    return this.timeManager.update(deltaTime);
  }

  updateActiveTimeAuthority() {
    if (
      this.outcome ||
      !Scene_Battle.prototype.usesActiveTimeAuthority.call(this) ||
      !this.battleManager?.updateActiveTimeAuthority
    ) {
      return null;
    }

    return this.battleManager.updateActiveTimeAuthority();
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

  updateBattlePopups(deltaTime) {
    for (const popup of this.battlePopups) {
      popup.age += deltaTime;
      popup.rise += 40 * deltaTime;
    }

    this.battlePopups = this.battlePopups.filter(
      (popup) => popup.age < popup.duration,
    );
  }

  updateBattleBanner(deltaTime) {
    if (!this.battleBanner) {
      this.battleBanner = this.battleBannerQueue.shift() || null;
      return;
    }

    const step = Math.max(0, Number(deltaTime) || 0);
    this.battleBanner.elapsed += step;
    this.battleBanner.timer -= step;

    if (this.battleBanner.timer <= 0) {
      this.battleBanner = this.battleBannerQueue.shift() || null;
    }
  }

  showBattleBanner(text, duration = 0.9, type = "action") {
    const value = String(text || "").trim();

    if (!value) {
      return false;
    }

    const resolvedDuration = Math.max(0.1, Number(duration) || 0.9);
    const entry = {
      text: value,
      type,
      timer: resolvedDuration,
      duration: resolvedDuration,
      elapsed: 0,
    };

    if (this.battleBanner) {
      this.battleBannerQueue.push(entry);

      if (this.battleBannerQueue.length > 4) {
        this.battleBannerQueue.shift();
      }
    } else {
      this.battleBanner = entry;
    }

    return true;
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

      const path = `js/sprites/actors/${actor.sideBattleSprite}`;
      const image = this.createBattleSpriteImage(path, `actor ${actor.name}`);

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

      const path = `js/sprites/enemies/${enemy.battleSprite}`;
      const image = this.createBattleSpriteImage(path, `enemy ${enemy.name}`);
      this.enemyImages.set(enemy.battleSprite, image);
    }
  }

  createBattleSpriteImage(path, battlerLabel) {
    const image = new Image();

    image.loadFailed = false;
    image.onerror = () => {
      image.loadFailed = true;
      this.battleSpriteLoadFailures.add(path);
      console.warn(`Failed to load battle sprite for ${battlerLabel}: ${path}`);
    };
    image.onload = () => {
      image.loadFailed = false;
      this.battleSpriteLoadFailures.delete(path);
    };
    image.src = path;

    return image;
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
        backAttackTurned: false,
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

  addBattlePopup(target, text, type = "damage") {
    if (!target) {
      return;
    }

    const activeForTarget = this.battlePopups.filter(
      (popup) => popup.target === target && popup.age < popup.duration,
    ).length;

    this.battlePopups.push({
      target,
      text: String(text),
      type,
      age: 0,
      duration: 0.9,
      rise: 0,
      stackIndex: activeForTarget,
    });
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

  getAllyTargetPosition(actor) {
    if (
      this.formationManager &&
      typeof this.formationManager.targetPositionForActor === "function"
    ) {
      return this.formationManager.targetPositionForActor(actor);
    }

    return this.getAllyPosition(actor);
  }

  getEnemyBattlePosition(index) {
    return this.formationManager.enemyPosition(index);
  }

  getFormationType() {
    return this.formationManager.formation();
  }

  getActorFormationScale(actor) {
    return this.formationManager.partyScale(actor);
  }

  getActorRenderScale(actor) {
    return this.getActorFormationScale(actor) * this.getActorVisualScale(actor);
  }

  getEnemyFormationScale(enemy) {
    if (this.battleView === "front") {
      return 1;
    }

    return this.formationManager.enemyScale(enemy);
  }

  getActorSpriteHeight(actor) {
    return (
      (Number(actor?.battleSpriteHeight) || 0) *
      this.getActorFormationScale(actor)
    );
  }

  getEnemySpriteHeight(enemy) {
    return (
      (Number(enemy?.battleSpriteHeight) || 0) *
      this.getEnemyFormationScale(enemy)
    );
  }

  getActorFacing(actor) {
    return this.formationManager.actorFacing(actor);
  }

  getEnemyFacing(enemy) {
    if (this.battleView === "front") {
      return 1;
    }

    return this.formationManager.enemyFacing(enemy);
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

  hasActorTurnedInBackAttack(actor) {
    return this.getPartyBattleData(actor)?.backAttackTurned === true;
  }

  turnActorTowardEnemies(actor) {
    if (!actor || this.getFormationType() !== BattleFormationManager.BACK_ATTACK) {
      return false;
    }

    const battleData = this.getPartyBattleData(actor);

    if (!battleData || battleData.backAttackTurned) {
      return false;
    }

    battleData.backAttackTurned = true;
    return true;
  }

  turnAllActorsTowardEnemies() {
    if (this.getFormationType() !== BattleFormationManager.BACK_ATTACK) {
      return false;
    }

    let changed = false;

    for (const actor of $gameParty.battleMembers()) {
      changed = this.turnActorTowardEnemies(actor) || changed;
    }

    return changed;
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

  performSkillEffect() {
    return this.battleManager.performSkillEffect();
  }

  performMagickEffect() {
    return this.battleManager.performMagickEffect();
  }

  performItemEffect() {
    return this.battleManager.performItemEffect();
  }

  performEnemyTurn(enemy) {
    return this.battleManager.performEnemyTurn(enemy);
  }

  executeCommand(command = null) {
    return this.battleManager.executeCommand(command);
  }

  executeSkill() {
    return this.battleManager.executeSkill();
  }

  executeMagick() {
    return this.battleManager.executeMagick();
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
    this.resultsWindow.draw();
  }

  terminate() {
    super.terminate();

    DebugManager.log("Battle ended.");
  }
}
