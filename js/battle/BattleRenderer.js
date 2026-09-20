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

    this.drawBattleBanner(context);
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

  hudActivePartyBattler() {
    if (this.scene.outcome || this.scene.pendingEnemyTurn) {
      return null;
    }

    const turnState = this.currentTurnState();

    if (turnState !== null && !["command", "action"].includes(turnState)) {
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

  drawBattleBanner(context) {
    const banner = this.scene.battleBanner;

    if (!banner?.text) {
      return;
    }

    context.save();
    context.font = "bold 18px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";

    const textWidth = context.measureText(banner.text).width;
    const bounds = this.scene.hudLayout.bannerBounds(textWidth);
    const maxTextWidth = bounds.width - bounds.paddingX * 2;
    const displayText =
      textWidth <= maxTextWidth
        ? banner.text
        : Window_TextLayout.ellipsize(context, banner.text, maxTextWidth);

    context.fillStyle = "rgba(8, 11, 17, 0.9)";
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle =
      banner.type === "state"
        ? "rgba(255, 215, 90, 0.85)"
        : "rgba(255, 255, 255, 0.72)";
    context.lineWidth = 2;
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.fillStyle = banner.type === "state" ? "#ffd75a" : "#ffffff";
    context.fillText(
      displayText,
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
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

    context.fillText(
      displayHint,
      Graphics.width - 30,
      this.scene.hudLayout.hintY(),
    );
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


  drawHudGauge(context, value, maximum, x, y, width, fillStyle) {
    const max = Number(maximum);
    const current = Number(value);
    const rate =
      Number.isFinite(max) && max > 0 && Number.isFinite(current)
        ? Math.max(0, Math.min(1, current / max))
        : 0;

    context.fillStyle = "#252b34";
    context.fillRect(x, y, width, 5);

    if (rate > 0) {
      context.fillStyle = fillStyle;
      context.fillRect(x, y, width * rate, 5);
    }
  }

  drawBattleHudActor(context, actor, index, activeActor) {
    const row = this.scene.hudLayout.partyRowBounds(index);
    const nameRow = this.scene.hudLayout.nameRowBounds(index);
    const statRow = this.scene.hudLayout.statRowBounds(index);
    const centerY = row.y + row.height / 2;
    const isActive = actor === activeActor;
    const isDefeated = actor?.isDefeated?.() === true;
    const namePadding = 12;
    const statPadding = 14;
    const statContentWidth = statRow.width - statPadding * 2;
    const hpWidth = statContentWidth * 0.34;
    const mpWidth = statContentWidth * 0.28;
    const valorWidth = statContentWidth - hpWidth - mpWidth;
    const hpX = statRow.x + statPadding;
    const mpX = hpX + hpWidth;
    const valorX = mpX + mpWidth;

    context.save();

    if (isActive) {
      context.fillStyle = "rgba(255, 215, 90, 0.1)";
      context.fillRect(nameRow.x, row.y + 1, nameRow.width, row.height - 2);
      context.fillRect(statRow.x, row.y + 1, statRow.width, row.height - 2);
      context.fillStyle = "#ffd75a";
      context.fillRect(nameRow.x, row.y + 4, 4, row.height - 8);
    }

    if (index > 0) {
      context.strokeStyle = "rgba(255, 255, 255, 0.1)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(nameRow.x + 6, row.y);
      context.lineTo(nameRow.x + nameRow.width - 6, row.y);
      context.moveTo(statRow.x + 6, row.y);
      context.lineTo(statRow.x + statRow.width - 6, row.y);
      context.stroke();
    }

    context.globalAlpha = isDefeated ? 0.5 : 1;
    context.textAlign = "left";
    context.textBaseline = "middle";

    context.font = "17px Arial";
    context.fillStyle = isActive ? "#ffd75a" : "#ffffff";
    context.fillText(actor.name, nameRow.x + namePadding, centerY - 7);

    let status =
      typeof actor.statusSummary === "function" ? actor.statusSummary(2) : "";

    if (isDefeated && !status) {
      status = "DEFEATED";
    }

    if (status) {
      context.font = "11px Arial";
      context.fillStyle = isDefeated ? "#ff8a8a" : "#aeb8c5";
      const maxStatusWidth = Math.max(40, nameRow.width - namePadding * 2);
      const displayStatus =
        context.measureText(status).width <= maxStatusWidth
          ? status
          : Window_TextLayout.ellipsize(context, status, maxStatusWidth);
      context.fillText(displayStatus, nameRow.x + namePadding, centerY + 10);
    }

    context.font = "14px Arial";
    context.fillStyle = "#ffffff";
    context.fillText(`HP ${actor.hp}/${actor.maxHp}`, hpX, centerY - 5);
    this.drawHudGauge(
      context,
      actor.hp,
      actor.maxHp,
      hpX,
      centerY + 8,
      Math.max(42, hpWidth - 18),
      "#63d471",
    );

    context.fillStyle = "#55df74";
    context.fillText(`MP ${actor.mp}/${actor.maxMp}`, mpX, centerY - 5);
    this.drawHudGauge(
      context,
      actor.mp,
      actor.maxMp,
      mpX,
      centerY + 8,
      Math.max(42, mpWidth - 18),
      "#4fa3ff",
    );

    const valorReady = actor.isValorReady?.() === true;
    const valorValue = Math.floor(Number(actor.valor) || 0);
    const valorMaximum = Math.max(0, Number(actor.maxValor) || 0);
    const valorLabel = valorReady
      ? "VALOR READY"
      : `VALOR ${valorValue}/${valorMaximum}`;

    context.fillStyle = valorReady ? "#ffd75a" : "#ffffff";
    context.fillText(valorLabel, valorX, centerY - 5);
    this.drawHudGauge(
      context,
      valorValue,
      valorMaximum,
      valorX,
      centerY + 8,
      Math.max(46, valorWidth - 12),
      valorReady ? "#ffd75a" : "#c86cff",
    );

    context.restore();
  }

  drawBattleHud(context) {
    const hud = this.scene.hudLayout.hudBounds();
    const names = this.scene.hudLayout.nameColumnBounds();
    const command = this.scene.hudLayout.commandBounds();
    const stats = this.scene.hudLayout.statsBounds();
    const members = $gameParty
      .battleMembers()
      .slice(0, BattleHudLayout.PARTY_SLOTS);
    const activeActor = this.hudActivePartyBattler();

    context.save();
    context.fillStyle = "rgba(7, 10, 15, 0.94)";
    context.fillRect(hud.x, hud.y, hud.width, hud.height);
    context.strokeStyle = "rgba(255, 255, 255, 0.72)";
    context.lineWidth = 2;
    context.strokeRect(hud.x, hud.y, hud.width, hud.height);

    // The middle command reserve intentionally stays empty while no actor is
    // choosing a command. Future Barrier / MBarrier-style presentation can
    // occupy this space without moving names or resource gauges.
    context.strokeStyle = "rgba(120, 205, 255, 0.18)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(names.x + names.width, hud.y);
    context.lineTo(names.x + names.width, hud.y + hud.height);
    context.moveTo(command.x + command.width, hud.y);
    context.lineTo(command.x + command.width, hud.y + hud.height);
    context.stroke();

    for (let index = 0; index < members.length; index++) {
      this.drawBattleHudActor(context, members[index], index, activeActor);
    }

    context.restore();
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
