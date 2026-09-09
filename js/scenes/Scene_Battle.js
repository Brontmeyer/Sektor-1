"use strict";

class Scene_Battle extends Scene_Base {
  constructor() {
    super();

    this.enemy = new Game_Enemy(1);
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

    // Battler animation states
    this.actorState = "idle";
    this.enemyState = "idle";

    this.actorStateTimer = 0;
    this.enemyStateTimer = 0;

    this.battleView = DatabaseManager.system.battleView || "side";

    this.pendingEnemyTurn = false;
    this.enemyTurnDelay = 0;
    this.battleInputLocked = false;

    // Battle action phase system
    this.actionPhase = "none";
    this.actionPhaseTimer = 0;
    this.pendingAttackDamage = false;

    // Pending magic action
    this.pendingMagicSkill = null;
    this.pendingMagicTarget = null;

    // Magic effect state
    this.magicEffectSkill = null;
    this.magicEffectTarget = null;

    // Pending item action
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
    this.updatePendingEnemyTurn(deltaTime);

    // -----------------------------
    // Handle victory or defeat first
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
    // Handle item window input
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
    // Handle magic window input
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

    // Handle battle input lock
    if (this.battleInputLocked) {
      return;
    }

    // -----------------------------
    // Handle command window input
    // -----------------------------

    this.commandWindow.update();

    if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
      this.executeCommand();
    }

    if (Input.isTriggered("Escape") || Input.isTriggered("KeyQ")) {
      SceneManager.pop();
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

        if (this.enemy.isDead()) {
          this.setEnemyState("defeat");
          this.victory = true;

          this.addBattleMessage(`${this.enemy.name} is defeated! Victory!`);

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

    // Unlock battle input when both battlers are idle and visually aligned.
    if (
      this.battleInputLocked &&
      !this.pendingEnemyTurn &&
      this.actionPhase === "none" &&
      this.actorState === "idle" &&
      this.enemyState === "idle" &&
      Math.abs(this.actorVisualX) < 0.5 &&
      Math.abs(this.enemyVisualX) < 0.5 &&
      !this.victory &&
      !this.defeat
    ) {
      this.actorVisualX = 0;
      this.enemyVisualX = 0;

      this.battleInputLocked = false;
    }
  }

  updateBattlerVisuals(deltaTime) {
    const actorTarget = this.getActorTargetOffset();
    const actorTargetY = this.getActorTargetYOffset();

    const enemyTarget = this.getEnemyTargetOffset();

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
    this.enemyVisualX = this.moveToward(
      this.enemyVisualX,
      enemyTarget,
      speed * deltaTime,
    );
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

  queueEnemyTurn(delay = 0.5) {
    this.pendingEnemyTurn = true;
    this.enemyTurnDelay = delay;
    this.battleInputLocked = true;
  }

  addBattleMessage(message) {
    this.battleMessages.push(message);

    if (this.battleMessages.length > 2) {
      this.battleMessages.shift();
    }

    console.log(message);
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

  setActorState(state, duration = 0) {
    this.actorState = state;
    this.actorStateTimer = duration;
  }

  setEnemyState(state, duration = 0) {
    this.enemyState = state;
    this.enemyStateTimer = duration;
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

  getEnemyTargetOffset() {
    if (this.enemyState === "attack") {
      return -35;
    }

    if (this.enemyState === "hurt") {
      return 18;
    }

    return 0;
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

  performAttack() {
    if (this.enemy.isDead()) {
      return;
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

    const damage = Math.max(
      1,
      $gameActor.totalAttack() - this.enemy.totalDefense(),
    );

    this.enemy.loseHp(damage);

    if (this.enemy.isDead()) {
      this.setEnemyState("defeat");

      this.addBattleMessage(
        `${$gameActor.name} attacks! ${this.enemy.name} takes ${damage} damage!`,
      );

      return;
    }

    this.setEnemyState("hurt", 0.3);

    this.addBattleMessage(
      `${$gameActor.name} attacks! ${this.enemy.name} takes ${damage} damage!`,
    );
  }

  performMagicEffect() {
    const skill = this.pendingMagicSkill;
    const target = this.pendingMagicTarget;

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

    // Healing spell
    if (target === $gameActor) {
      const healing = $gameActor.hp - playerHpBefore;

      this.addBattleMessage(
        `${$gameActor.name} casts ${skill.name}! ` +
          `${$gameActor.name} recovers ${healing} HP!`,
      );
    }

    this.magicEffectSkill = skill;
    this.magicEffectTarget = target;

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

  performEnemyTurn() {
    if (this.enemy.isDead()) {
      return;
    }

    this.setEnemyState("attack", 0.4);

    const attack = this.enemy.totalAttack();
    const defense = $gameActor.totalDefense();

    const damage = Math.max(1, attack - defense);
    $gameActor.loseHp(damage);

    this.setActorState("hurt", 0.3);

    this.addBattleMessage(
      `${this.enemy.name} attacks! ` +
        `${$gameActor.name} takes ${damage} damage!`,
    );

    if ($gameActor.isDead()) {
      this.setActorState("defeat");

      this.defeat = true;

      this.addBattleMessage(`${$gameActor.name} has fallen! Defeat...`);
    }
  }

  executeCommand() {
    const command = this.commandWindow.currentCommand();

    switch (command) {
      case "Attack":
        this.performAttack();
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
        target = this.enemy;
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

    // Move drawing origin to the center
    // of the actor sprite.
    context.translate(x, y - height / 2);

    context.scale(scale, scale);

    if (
      this.actorImage &&
      this.actorImage.complete &&
      this.actorImage.naturalWidth > 0
    ) {
      context.drawImage(
        this.actorImage,
        -width / 2,
        -height / 2,
        width,
        height,
      );

      context.restore();
      return;
    }

    // Fallback rectangle
    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;

    context.strokeRect(-width / 2, -height / 2, width, height);

    context.restore();
  }

  drawEnemySprite(context, x, y) {
    const width = this.enemy.battleSpriteWidth;
    const height = this.enemy.battleSpriteHeight;

    const alpha = this.getEnemyVisualAlpha();

    context.save();
    context.globalAlpha = alpha;

    if (
      this.enemyImage &&
      this.enemyImage.complete &&
      this.enemyImage.naturalWidth > 0
    ) {
      context.drawImage(
        this.enemyImage,
        x - width / 2,
        y - height,
        width,
        height,
      );
      context.restore();
      return;
    }

    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;

    context.beginPath();
    context.arc(x, y - height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
    context.stroke();

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
      playerY + 100 + this.actorVisualY,
    );

    context.font = "16px Arial";
    context.fillStyle = "#ffffff";

    // -----------------------------
    // Enemy battlefield position
    // -----------------------------

    context.font = "30px Arial";
    context.fillText(this.enemy.name, enemyX, enemyY - 45);

    context.font = "20px Arial";
    context.fillText(
      `HP: ${this.enemy.hp} / ${this.enemy.maxHp}`,
      enemyX,
      enemyY - 15,
    );

    this.drawEnemySprite(context, enemyX + this.enemyVisualX, enemyY + 110);
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
