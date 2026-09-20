"use strict";

class BattleRenderer {
  constructor(scene) {
    this.scene = scene;
  }

  // =================================
  // Battle Rendering
  // =================================

  draw() {
    const context = Graphics.context;

    context.save();

    // -----------------------------
    // Battle background
    // -----------------------------

    context.fillStyle = "#202020";

    context.fillRect(0, 0, Graphics.width, Graphics.height);

    this.drawBattleHeader(context);

    // -----------------------------
    // Battle presentation
    // -----------------------------

    if (this.scene.battleView === "front") {
      this.drawFrontView(context);
    } else {
      this.drawSideView(context);
    }
    this.drawBattleHud(context);
    this.drawBattleEffect(context);
    this.drawBattlePopups(context);

    this.drawBattleMessages(context);
    this.drawBattleHint(context);

    // -----------------------------
    // Battle windows
    // -----------------------------

    const selectionWindows = this.selectionWindows();
    const selectionWindowOpen = this.hasOpenSelectionWindow(selectionWindows);

    if (this.shouldDrawCommandWindow(selectionWindowOpen)) {
      this.scene.commandWindow.draw();
    }

    for (const window of selectionWindows) {
      window.draw();
    }

    context.restore();
  }

  selectionWindows() {
    return [
      this.scene.skillsWindow,
      this.scene.magickWindow,
      this.scene.itemWindow,
    ].filter(Boolean);
  }

  hasOpenSelectionWindow(windows = this.selectionWindows()) {
    return windows.some(
      (window) => typeof window.isOpen === "function" && window.isOpen(),
    );
  }

  currentTurnState() {
    const manager = this.scene.battleManager;

    if (!manager || typeof manager.currentTurnState !== "function") {
      return null;
    }

    return manager.currentTurnState();
  }

  activePartyBattler() {
    if (this.scene.outcome || this.currentTurnState() !== "command") {
      return null;
    }

    const controller = this.scene.partyController;

    return controller && typeof controller.currentBattler === "function"
      ? controller.currentBattler()
      : null;
  }

  shouldDrawCommandWindow(selectionWindowOpen = this.hasOpenSelectionWindow()) {
    if (
      this.scene.victory ||
      this.scene.defeat ||
      this.scene.outcome ||
      this.scene.battleInputLocked ||
      this.scene.selectingEnemyTarget ||
      selectionWindowOpen
    ) {
      return false;
    }

    const turnState = this.currentTurnState();

    return turnState === null || turnState === "command";
  }

  drawBattleHeader(context) {
    const encounterName = String(this.scene.encounter?.name || "").trim();
    const title = encounterName ? `Battle — ${encounterName}` : "Battle";

    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.font = "28px Arial";
    context.fillStyle = "#ffffff";
    const maxTitleWidth = Math.max(120, Graphics.width - 80);
    const displayTitle =
      context.measureText(title).width <= maxTitleWidth
        ? title
        : Window_TextLayout.ellipsize(context, title, maxTitleWidth);

    context.fillText(displayTitle, 40, 50);

    const battler = this.activePartyBattler();

    if (battler?.name) {
      context.font = "16px Arial";
      context.fillStyle = "#ffd75a";
      context.fillText(`Active: ${battler.name}`, 42, 78);
      context.fillStyle = "#ffffff";
    }
  }

  drawBattleMessages(context) {
    const messages = Array.isArray(this.scene.battleMessages)
      ? this.scene.battleMessages.slice(-2)
      : [];

    if (messages.length === 0) {
      return;
    }

    const maxWidth = Math.max(120, Math.min(920, Graphics.width - 120));
    const lineHeight = 22;
    const paddingX = 18;
    const paddingY = 12;
    const lines = [];

    context.save();
    context.font = "18px Arial";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    for (const message of messages) {
      const wrapped = Window_TextLayout.wrapLines(
        context,
        message,
        maxWidth - paddingX * 2,
      );
      const visible = wrapped.slice(0, 2);

      if (wrapped.length > visible.length && visible.length > 0) {
        const last = visible.length - 1;
        visible[last] = Window_TextLayout.ellipsize(
          context,
          visible[last],
          maxWidth - paddingX * 2,
        );
      }

      lines.push(...visible);
    }

    const panelHeight = paddingY * 2 + Math.max(1, lines.length) * lineHeight;
    const hudTop = Graphics.height - 200;
    const panelX = (Graphics.width - maxWidth) / 2;
    const panelY = Math.max(92, hudTop - panelHeight - 10);

    context.fillStyle = "rgba(0, 0, 0, 0.78)";
    context.fillRect(panelX, panelY, maxWidth, panelHeight);
    context.strokeStyle = "rgba(255, 255, 255, 0.65)";
    context.lineWidth = 1;
    context.strokeRect(panelX, panelY, maxWidth, panelHeight);
    context.fillStyle = "#ffffff";

    for (let index = 0; index < lines.length; index++) {
      context.fillText(
        lines[index],
        panelX + paddingX,
        panelY + paddingY + 17 + index * lineHeight,
      );
    }

    context.restore();
  }

  canToggleTargetScope() {
    if (
      !this.scene.selectingEnemyTarget ||
      !["skill", "magick"].includes(this.scene.enemyTargetAction)
    ) {
      return false;
    }

    const definition = this.scene.pendingSkill || this.scene.pendingMagick;
    const manager = this.scene.targetManager;

    if (!definition || !manager || typeof manager.allowedScopes !== "function") {
      return false;
    }

    return manager.allowedScopes(definition).length > 1;
  }

  battleHint() {
    if (this.scene.outcome) {
      return "E / Enter / Esc: Continue";
    }

    if (this.scene.selectingEnemyTarget) {
      const group = this.scene.targetGroup === "ally" ? "Allies" : "Enemies";
      const scope =
        this.scene.targetScope === "all" ? `All ${group}` : `Single ${group}`;
      const scopeHint = this.canToggleTargetScope() ? "   R: Scope" : "";

      return `${scope}   WASD / Arrows: Target   E / Enter: Confirm   Q / Esc: Back${scopeHint}`;
    }

    if (this.hasOpenSelectionWindow()) {
      return "W / S or ↑ / ↓: Choose   E / Enter: Select   Q / Esc: Back";
    }

    if (this.scene.battleInputLocked || this.scene.pendingEnemyTurn) {
      return "Resolving battle...";
    }

    const turnState = this.currentTurnState();

    if (turnState !== null && turnState !== "command") {
      return "Resolving battle...";
    }

    const commandWindow = this.scene.commandWindow;

    if (commandWindow?.hasSideCommandOpen?.()) {
      const command = commandWindow.currentCommand();
      const enabled = commandWindow.isCommandEnabled?.(command) !== false;
      const availability = enabled ? "" : " (Unavailable)";

      return `${command}${availability}   E / Enter: Confirm   Q / Esc: Back`;
    }

    return "W / S or ↑ / ↓: Command   ←: Escape   →: Defend   E / Enter: Select";
  }

  drawBattleHint(context) {
    const hint = this.battleHint();

    if (!hint) {
      return;
    }

    context.save();
    context.textAlign = "right";
    context.textBaseline = "alphabetic";
    context.font = "15px Arial";
    context.fillStyle = "#dddddd";
    const maxWidth = Math.max(120, Graphics.width - 80);
    const displayHint =
      context.measureText(hint).width <= maxWidth
        ? hint
        : Window_TextLayout.ellipsize(context, hint, maxWidth);

    context.fillText(displayHint, Graphics.width - 30, Graphics.height - 30);
    context.restore();
  }

  drawActorSprite(context, x, y, actor) {
    if (!actor) {
      return;
    }

    const width = actor.battleSpriteWidth;
    const height = actor.battleSpriteHeight;

    const scale = this.scene.getActorRenderScale(actor);
    const facing = this.scene.getActorFacing(actor);
    const alpha = this.scene.getActorVisualAlpha(actor);

    const battleData = this.scene.getPartyBattleData(actor);
    const image = this.scene.getPartyBattleImage(actor);

    context.save();

    context.globalAlpha = alpha;

    context.translate(x, y);
    context.scale(facing * scale, scale);

    if (image && image.complete && image.naturalWidth > 0) {
      const state = battleData?.state || "idle";
      const animation = this.scene.getBattlerAnimationData(state);

      const frameCount = actor.battleSpriteFrames || 1;
      const rowCount = actor.battleSpriteRows || 1;

      const sourceFrameWidth = image.naturalWidth / frameCount;
      const sourceFrameHeight = image.naturalHeight / rowCount;

      const frame = Math.min(battleData?.animationFrame || 0, frameCount - 1);

      const sourceX = frame * sourceFrameWidth;

      const requestedRow = this.scene.getBattlerAnimationRow(state);

      const row = Math.min(requestedRow, rowCount - 1);

      const sourceY = row * sourceFrameHeight;

      context.drawImage(
        image,

        sourceX,
        sourceY,
        sourceFrameWidth,
        sourceFrameHeight,

        -width / 2,
        -height,
        width,
        height,
      );

      context.restore();
      return;
    }

    if (facing < 0) {
      context.scale(-1, 1);
    }

    this.drawMissingSpriteFallback(context, width, height, actor.name);

    context.restore();
  }

  drawEnemySprite(context, x, y, enemy, battleData) {
    if (!enemy || !battleData) {
      return;
    }

    const width = enemy.battleSpriteWidth;
    const height = enemy.battleSpriteHeight;
    const scale = this.scene.getEnemyFormationScale(enemy);
    const facing = this.scene.getEnemyFacing(enemy);
    const alpha = this.scene.getEnemyVisualAlpha(enemy);
    const image = enemy.battleSprite
      ? this.scene.enemyImages.get(enemy.battleSprite)
      : null;

    context.save();
    context.globalAlpha = alpha;
    context.translate(x, y);
    context.scale(facing * scale, scale);

    if (image && image.complete && image.naturalWidth > 0) {
      const frameCount = enemy.battleSpriteFrames || 1;
      const rowCount = enemy.battleSpriteRows || 1;

      const sourceFrameWidth = image.naturalWidth / frameCount;
      const sourceFrameHeight = image.naturalHeight / rowCount;

      const frame = Math.min(battleData.animationFrame, frameCount - 1);
      const sourceX = frame * sourceFrameWidth;

      const requestedRow = this.scene.getBattlerAnimationRow(battleData.state);
      const row = Math.min(requestedRow, rowCount - 1);
      const sourceY = row * sourceFrameHeight;

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceFrameWidth,
        sourceFrameHeight,
        -width / 2,
        -height,
        width,
        height,
      );

      context.restore();
      this.drawStatusIndicator(context, enemy, x, y + 18);
      return;
    }

    if (facing < 0) {
      context.scale(-1, 1);
    }

    this.drawMissingSpriteFallback(context, width, height, enemy.name);
    context.restore();
    this.drawStatusIndicator(context, enemy, x, y + 18);
  }

  drawMissingSpriteFallback(context, width, height, name) {
    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;
    context.strokeRect(-width / 2, -height, width, height);

    context.fillStyle = "#ffffff";
    context.font = "14px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      name || "Missing Sprite",
      0,
      -height / 2,
      Math.max(0, width - 10),
    );
  }

  drawStatusIndicator(context, battler, x, y, maxEntries = 2) {
    if (!battler || typeof battler.statusSummary !== "function") {
      return;
    }

    if (
      (typeof battler.isDefeated === "function" && battler.isDefeated()) ||
      (typeof battler.isDefeated !== "function" &&
        typeof battler.isDead === "function" &&
        battler.isDead())
    ) {
      return;
    }

    const summary = battler.statusSummary(maxEntries);

    if (!summary) {
      return;
    }

    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "13px Arial";
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#000000";
    context.lineWidth = 3;
    context.strokeText(summary, x, y);
    context.fillText(summary, x, y);
    context.restore();
  }

  drawBattlePopups(context) {
    for (const popup of this.scene.battlePopups) {
      const target = popup.target;

      if (!target) {
        continue;
      }

      let position = null;
      let offsetY = 0;

      if ($gameParty.battleMembers().includes(target)) {
        position = this.scene.getAllyPosition(target);
        offsetY = -this.scene.getActorSpriteHeight(target) * 0.7;
      } else if (this.scene.enemies.includes(target)) {
        position = this.scene.getEnemyPosition(target);
        offsetY = -this.scene.getEnemySpriteHeight(target) * 0.7;
      }

      if (!position) {
        continue;
      }

      const progress = popup.age / popup.duration;
      const alpha = Math.max(0, 1 - progress);

      const x = position.x;
      const stackOffset = (popup.stackIndex || 0) * 30;

      const y = position.y + offsetY - popup.rise - stackOffset;

      context.save();

      context.globalAlpha = alpha;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "bold 28px Arial";

      if (popup.type === "heal") {
        context.fillStyle = "#66ff88";
      } else if (popup.type === "damage") {
        context.fillStyle = "#ff5555";
      } else if (popup.type === "weak") {
        context.fillStyle = "#ffcc55";
      } else if (popup.type === "resist") {
        context.fillStyle = "#66ccff";
      } else if (popup.type === "immune") {
        context.fillStyle = "#cccccc";
      } else if (popup.type === "critical") {
        context.fillStyle = "#ffff66";
      } else {
        context.fillStyle = "#ffffff";
      }

      context.strokeStyle = "#000000";
      context.lineWidth = 4;

      context.strokeText(popup.text, x, y);
      context.fillText(popup.text, x, y);

      context.restore();
    }
  }

  drawValorState(context, actor, x, y, font = "14px Arial") {
    if (!actor || !Number.isFinite(actor.maxValor) || actor.maxValor <= 0) {
      return;
    }

    const ready =
      typeof actor.isValorReady === "function" && actor.isValorReady();
    const value = Math.floor(Number(actor.valor) || 0);
    const label = ready
      ? "VALOR: READY"
      : `VALOR: ${value} / ${actor.maxValor}`;

    context.font = font;
    context.fillStyle = ready ? "#ffd75a" : "#ffffff";
    context.fillText(label, x, y);
    context.fillStyle = "#ffffff";
  }

  drawBattleHud(context) {
    const hudHeight = 190;
    const hudY = Graphics.height - hudHeight - 10;

    context.fillStyle = "rgba(0, 0, 0, 0.9)";

    context.fillRect(20, hudY, Graphics.width - 40, hudHeight);

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;

    context.strokeRect(20, hudY, Graphics.width - 40, hudHeight);

    // Party status. With one member this preserves the current layout; with
    // two or three members it automatically spreads the status blocks out.
    const members = $gameParty.battleMembers();

    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#ffffff";

    if (members.length <= 1) {
      const actor = members[0];

      if (!actor) {
        return;
      }
      const statusX = Graphics.width - 320;

      context.font = "22px Arial";
      context.fillText(actor.name, statusX, hudY + 40);

      context.font = "18px Arial";
      context.fillText(`HP: ${actor.hp} / ${actor.maxHp}`, statusX, hudY + 78);
      context.fillText(`MP: ${actor.mp} / ${actor.maxMp}`, statusX, hudY + 110);
      this.drawValorState(context, actor, statusX, hudY + 140, "16px Arial");

      const summary =
        typeof actor.statusSummary === "function" ? actor.statusSummary(3) : "";

      if (summary) {
        context.font = "14px Arial";
        context.fillText(summary, statusX, hudY + 168);
      }

      return;
    }

    const statusStartX = Math.max(300, Graphics.width - 690);
    const statusWidth = (Graphics.width - statusStartX - 40) / members.length;

    members.forEach((actor, index) => {
      const statusX = statusStartX + index * statusWidth;

      context.font = "20px Arial";
      context.fillText(actor.name, statusX, hudY + 38);

      context.font = "16px Arial";
      context.fillText(`HP: ${actor.hp} / ${actor.maxHp}`, statusX, hudY + 74);
      context.fillText(`MP: ${actor.mp} / ${actor.maxMp}`, statusX, hudY + 106);
      this.drawValorState(context, actor, statusX, hudY + 134, "13px Arial");

      const summary =
        typeof actor.statusSummary === "function" ? actor.statusSummary(2) : "";

      if (summary) {
        context.font = "13px Arial";
        context.fillText(summary, statusX, hudY + 163);
      }
    });
  }

  drawBattleEffect(context) {
    this.scene.battleEffects.draw(context);
  }

  drawEnemies(context) {
    for (let i = 0; i < this.scene.enemies.length; i++) {
      const enemy = this.scene.enemies[i];
      const battleData = this.scene.enemyBattleData[i];

      if (!enemy || !battleData) {
        continue;
      }

      const position = this.scene.getEnemyBattlePosition(i);

      this.drawEnemySprite(
        context,
        position.x + battleData.visualX,
        position.y,
        enemy,
        battleData,
      );
    }
  }

  drawEnemyTargetCursor(context) {
    if (!this.scene.selectingEnemyTarget) {
      return;
    }

    context.save();

    context.font = "32px sans-serif";
    context.textAlign = "center";

    // -----------------------------
    // ALL TARGETS
    // -----------------------------

    if (this.scene.targetScope === "all") {
      if (this.scene.targetGroup === "ally") {
        const allies = this.scene.targetManager.selectableBattlers("ally");

        for (const ally of allies) {
          const position = this.scene.getAllyPosition(ally);
          const height = this.scene.getActorSpriteHeight(ally);
          context.fillText("▼", position.x, position.y - height - 18);
        }
      } else {
        const selectableEnemies = new Set(
          this.scene.targetManager.selectableBattlers("enemy"),
        );

        for (let i = 0; i < this.scene.enemies.length; i++) {
          const enemy = this.scene.enemies[i];

          if (!selectableEnemies.has(enemy)) {
            continue;
          }

          const position = this.scene.getEnemyBattlePosition(i);
          const height = this.scene.getEnemySpriteHeight(enemy);

          context.fillText("▼", position.x, position.y - height - 18);
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

    if (this.scene.targetGroup === "ally") {
      const position = this.scene.getAllyBattlePosition(
        this.scene.selectedAllyIndex,
      );

      const ally =
        this.scene.getBattlePartyMembers()[this.scene.selectedAllyIndex];
      x = position.x;
      y = position.y - this.scene.getActorSpriteHeight(ally) - 18;
    } else {
      const position = this.scene.getEnemyBattlePosition(
        this.scene.selectedEnemyIndex,
      );

      const enemy = this.scene.enemies[this.scene.selectedEnemyIndex];
      x = position.x;
      y = position.y - this.scene.getEnemySpriteHeight(enemy) - 18;
    }

    context.fillText("▼", x, y);

    context.restore();
  }

  drawFrontView(context) {
    context.textAlign = "center";
    context.textBaseline = "alphabetic";

    context.font = "34px Arial";
    context.fillStyle = "#ffffff";

    context.fillText(this.scene.enemy.name, Graphics.width / 2, 180);

    context.font = "22px Arial";

    context.fillText(
      `HP: ${this.scene.enemy.hp} / ${this.scene.enemy.maxHp}`,
      Graphics.width / 2,
      220,
    );

    this.drawEnemySprite(
      context,
      Graphics.width / 2,
      355,
      this.scene.enemy,
      this.scene.getEnemyBattleData(this.scene.enemy),
    );
  }

  drawSideView(context) {
    const partyMembers = this.scene.getBattlePartyMembers();

    // -----------------------------
    // Party battlefield positions
    // -----------------------------

    context.textAlign = "center";
    context.textBaseline = "alphabetic";

    context.font = "24px Arial";
    context.fillStyle = "#ffffff";

    partyMembers.forEach((actor, index) => {
      const position = this.scene.getAllyBattlePosition(index);
      const battleData = this.scene.getPartyBattleData(actor);

      const visualX = battleData?.visualX || 0;
      const visualY = battleData?.visualY || 0;

      this.drawActorSprite(
        context,
        position.x + visualX,
        position.y + visualY + this.scene.getActorStateYOffset(actor),
        actor,
      );
    });

    context.font = "16px Arial";
    context.fillStyle = "#ffffff";

    this.drawEnemies(context);
    this.drawEnemyTargetCursor(context);
  }
}
