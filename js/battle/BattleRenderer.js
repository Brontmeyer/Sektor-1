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
    this.drawTacticalHelp(context);

    if (this.shouldDrawBattleHint()) {
      this.drawBattleHint(context);
    }

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

  battleBannerAlpha(banner = this.scene.battleBanner) {
    if (!banner) {
      return 0;
    }

    if (banner.elapsed === undefined || banner.duration === undefined) {
      return 1;
    }

    const duration = Math.max(0.1, Number(banner.duration) || 0.9);
    const elapsed = Math.max(0, Number(banner.elapsed) || 0);
    const remaining = Math.max(0, Number(banner.timer) || 0);
    const fadeIn = Math.min(1, elapsed / Math.min(0.12, duration * 0.25));
    const fadeOut = Math.min(1, remaining / Math.min(0.2, duration * 0.3));

    return Math.max(0, Math.min(1, fadeIn, fadeOut));
  }

  drawBattleBanner(context) {
    const banner = this.scene.battleBanner;

    if (!banner?.text) {
      return;
    }

    const alpha = this.battleBannerAlpha(banner);

    if (alpha <= 0) {
      return;
    }

    context.save();
    context.globalAlpha = alpha;
    context.font = "bold 17px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";

    const textWidth = context.measureText(banner.text).width;
    const bounds = this.scene.hudLayout.bannerBounds(textWidth);
    const maxTextWidth = bounds.width - bounds.paddingX * 2;
    const displayText =
      textWidth <= maxTextWidth
        ? banner.text
        : Window_TextLayout.ellipsize(context, banner.text, maxTextWidth);

    const bannerStroke =
      banner.type === "state"
        ? "rgba(255, 215, 90, 0.8)"
        : "rgba(151, 196, 229, 0.72)";

    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      UIAssetManager.drawPanel(
        context,
        "accentPanel",
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        {
          fallbackFill: "rgba(8, 11, 17, 0.74)",
          fallbackStroke: bannerStroke,
          lineWidth: 1.5,
          assetAlpha: 0.28,
          sourceMargin: 14,
          destMargin: 10,
        },
      );
    } else {
      context.fillStyle = "rgba(8, 11, 17, 0.74)";
      context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      context.strokeStyle = bannerStroke;
      context.lineWidth = 1.5;
      context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    context.fillStyle = banner.type === "state" ? "#ffd75a" : "#ffffff";
    context.fillText(
      displayText,
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    context.restore();
  }

  tacticalHelpControlHint() {
    const help = Input.actionLabel("help");
    return this.scene.scanManager?.isHelpVisible?.()
      ? `${help}: Hide Help`
      : `${help}: Help`;
  }

  tacticalAffinityText(values, unknown = "??") {
    if (values === null) {
      return unknown;
    }

    if (!Array.isArray(values) || values.length === 0) {
      return "None";
    }

    return values.join(", ");
  }

  drawTacticalHelp(context) {
    const manager = this.scene.scanManager;

    if (!manager?.isHelpVisible?.() || this.scene.outcome) {
      return;
    }

    const bounds = this.scene.hudLayout.tacticalHelpBounds();
    const target = manager.currentEnemyTarget();
    const profile = target ? manager.tacticalProfile(target) : null;
    const paddingX = 14;
    const left = bounds.x + paddingX;
    const right = bounds.x + bounds.width - paddingX;
    const lineOneY = bounds.y + 18;
    const lineTwoY = bounds.y + 38;
    const maxWidth = bounds.width - paddingX * 2;

    context.save();
    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      UIAssetManager.drawPanel(
        context,
        "menuPanel",
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        {
          fallbackFill: "rgba(7, 10, 15, 0.76)",
          fallbackStroke: "rgba(151, 196, 229, 0.48)",
          lineWidth: 1,
          assetAlpha: 0.28,
          sourceMargin: 12,
          destMargin: 8,
        },
      );
    } else {
      context.fillStyle = "rgba(7, 10, 15, 0.76)";
      context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      context.strokeStyle = "rgba(151, 196, 229, 0.48)";
      context.lineWidth = 1;
      context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    context.textBaseline = "middle";

    context.font = "12px Arial";
    context.textAlign = "right";
    context.fillStyle = "#9eacbc";
    context.fillText(`${Input.actionLabel("help")}: Hide`, right, lineOneY);

    context.textAlign = "left";

    if (!profile) {
      context.font = "bold 13px Arial";
      context.fillStyle = "#ffd75a";
      context.fillText("TACTICAL", left, lineOneY);
      context.font = "12px Arial";
      context.fillStyle = "#d6dde6";
      const message = "Target an enemy to inspect tactical information.";
      const displayMessage =
        context.measureText(message).width <= maxWidth
          ? message
          : Window_TextLayout.ellipsize(context, message, maxWidth);
      context.fillText(displayMessage, left, lineTwoY);
      context.restore();
      return;
    }

    const hpText = profile.scanned
      ? `${Math.floor(profile.hp)}/${Math.floor(profile.maxHp)}`
      : "??/??";
    const mpText = profile.scanned
      ? `${Math.floor(profile.mp)}/${Math.floor(profile.maxMp)}`
      : "??/??";
    const weakText = this.tacticalAffinityText(profile.weak);
    const resistText = this.tacticalAffinityText(profile.resist);
    const immuneText = this.tacticalAffinityText(profile.immune);
    const resourceDetail = `${profile.name}   HP ${hpText}   MP ${mpText}`;
    const affinityDetail = `Weak ${weakText}   Resist ${resistText}   Immune ${immuneText}`;
    const hintWidth = context.measureText(`${Input.actionLabel("help")}: Hide`).width;
    const lineOneMaxWidth = Math.max(120, maxWidth - hintWidth - 20);
    const displayResource =
      context.measureText(resourceDetail).width <= lineOneMaxWidth
        ? resourceDetail
        : Window_TextLayout.ellipsize(context, resourceDetail, lineOneMaxWidth);
    const displayAffinity =
      context.measureText(affinityDetail).width <= maxWidth
        ? affinityDetail
        : Window_TextLayout.ellipsize(context, affinityDetail, maxWidth);

    context.font = "bold 13px Arial";
    context.fillStyle = profile.scanned ? "#ffffff" : "#c0c8d3";
    context.fillText(displayResource, left, lineOneY);

    context.font = "12px Arial";
    context.fillStyle = profile.scanned ? "#d6dde6" : "#9ea8b5";
    context.fillText(displayAffinity, left, lineTwoY);
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

    if (
      !definition ||
      !manager ||
      typeof manager.effectiveAllowedScopes !== "function"
    ) {
      return false;
    }

    return manager.effectiveAllowedScopes(definition).length > 1;
  }

  shouldDrawBattleHint() {
    if (this.scene.outcome || this.scene.selectingEnemyTarget) {
      return true;
    }

    if (this.hasOpenSelectionWindow()) {
      return true;
    }

    const commandWindow = this.scene.commandWindow;

    return commandWindow?.hasSideCommandOpen?.() === true;
  }

  battleHint() {
    const up = Input.actionLabel("up");
    const down = Input.actionLabel("down");
    const left = Input.actionLabel("left");
    const right = Input.actionLabel("right");
    const confirm = Input.actionLabel("confirm");
    const cancel = Input.actionLabel("cancel");
    const menu = Input.actionLabel("menu");
    const scopeControl = Input.actionLabel("scope");

    if (this.scene.outcome) {
      return `${confirm} / ${menu}: Continue`;
    }

    if (this.scene.selectingEnemyTarget) {
      const group = this.scene.targetGroup === "ally" ? "Allies" : "Enemies";
      let scope =
        this.scene.targetScope === "all" ? `All ${group}` : `Single ${group}`;

      if (
        this.scene.targetScope === "all" &&
        this.scene.targetGroup === "enemy" &&
        this.scene.getFormationType?.() === "pincer"
      ) {
        const flank = this.scene.targetManager.selectedEnemyFlank?.();
        if (flank) {
          scope += ` (${flank[0].toUpperCase()}${flank.slice(1)})`;
        }
      }

      const scopeHint = this.canToggleTargetScope()
        ? `   ${scopeControl}: Scope`
        : "";
      const moveHint =
        this.scene.targetScope === "all"
          ? `${left} / ${right}: Group`
          : `${up} ${down} ${left} ${right}: Target`;

      return `${scope}   ${moveHint}   ${confirm}: Confirm   ${cancel}: Back${scopeHint}   ${this.tacticalHelpControlHint()}`;
    }

    if (this.hasOpenSelectionWindow()) {
      return `${up} / ${down}: Choose   ${confirm}: Select   ${cancel}: Back   ${this.tacticalHelpControlHint()}`;
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

      return `${command}${availability}   ${confirm}: Confirm   ${cancel}: Back   ${this.tacticalHelpControlHint()}`;
    }

    return `${up} / ${down}: Command   ${left}: Escape   ${right}: Defend   ${confirm}: Select   ${this.tacticalHelpControlHint()}`;
  }

  drawBattleHint(context) {
    const hint = this.battleHint();

    if (!hint) {
      return;
    }

    context.save();
    context.textAlign = "right";
    context.textBaseline = "alphabetic";
    context.font = "13px Arial";
    const maxWidth = Math.max(120, Graphics.width - 80);
    const displayHint =
      context.measureText(hint).width <= maxWidth
        ? hint
        : Window_TextLayout.ellipsize(context, hint, maxWidth);
    const textWidth = context.measureText(displayHint).width;
    const x = Graphics.width - 28;
    const y = this.scene.hudLayout.hintY();

    context.fillStyle = "rgba(4, 7, 11, 0.48)";
    context.fillRect(x - textWidth - 10, y - 16, textWidth + 18, 21);
    context.fillStyle = "#d5dbe3";
    context.fillText(displayHint, x, y);
    context.restore();
  }

  drawAssetBattleShadow(context, x, y, scale = 1, alpha = 0.55) {
    if (
      typeof UIAssetManager === "undefined" ||
      typeof UIAssetManager.drawBattleShadow !== "function"
    ) {
      return false;
    }

    return UIAssetManager.drawBattleShadow(context, x, y, {
      scale: Math.max(0.45, Number(scale) || 1),
      alpha,
    });
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
    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawGauge === "function"
    ) {
      UIAssetManager.drawGauge(
        context,
        value,
        maximum,
        x,
        y - 1,
        width,
        7,
        fillStyle,
      );
      return;
    }

    const max = Number(maximum);
    const current = Number(value);
    const rate =
      Number.isFinite(max) && max > 0 && Number.isFinite(current)
        ? Math.max(0, Math.min(1, current / max))
        : 0;

    context.fillStyle = "#252c35";
    context.fillRect(x, y, width, 4);

    if (rate > 0) {
      context.fillStyle = fillStyle;
      context.fillRect(x, y, width * rate, 4);
    }
  }

  drawBattleHudActor(context, actor, index, activeActor) {
    const row = this.scene.hudLayout.partyRowBounds(index);
    const nameRow = this.scene.hudLayout.nameRowBounds(index);
    const statRow = this.scene.hudLayout.statRowBounds(index);
    const centerY = row.y + row.height / 2;
    const isActive = actor === activeActor;
    const isDefeated = actor?.isDefeated?.() === true;
    const namePadding = 10;
    const statPadding = 12;
    const statContentWidth = statRow.width - statPadding * 2;
    const hpWidth = statContentWidth * 0.34;
    const mpWidth = statContentWidth * 0.28;
    const valorWidth = statContentWidth - hpWidth - mpWidth;
    const hpX = statRow.x + statPadding;
    const mpX = hpX + hpWidth;
    const valorX = mpX + mpWidth;

    context.save();

    if (isActive) {
      context.fillStyle = "rgba(255, 215, 90, 0.075)";
      context.fillRect(nameRow.x, row.y + 1, nameRow.width, row.height - 2);
      context.fillRect(statRow.x, row.y + 1, statRow.width, row.height - 2);
      context.fillStyle = "#ffd75a";
      context.fillRect(nameRow.x, row.y + 4, 4, row.height - 8);
    }

    if (index > 0) {
      context.strokeStyle = "rgba(151, 196, 229, 0.11)";
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

    let status =
      typeof actor.statusSummary === "function" ? actor.statusSummary(2) : "";

    if (isDefeated && !status) {
      status = "DEFEATED";
    }

    // A one-line actor name sits on the same vertical centerline as its
    // corresponding battle-command row. Actors with visible status text keep
    // the compact two-line name/status stack centered around that line.
    const nameY = status ? centerY - 7 : centerY;

    context.font = "16px Arial";
    context.fillStyle = isActive ? "#ffd75a" : "#ffffff";
    context.fillText(actor.name, nameRow.x + namePadding, nameY);

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
    context.fillStyle = UIResourcePalette.text("hp");
    context.fillText("HP", hpX, centerY - 5);
    context.fillStyle = UIResourcePalette.valueText();
    context.fillText(
      `${actor.hp}/${actor.maxHp}`,
      hpX + context.measureText("HP ").width,
      centerY - 5,
    );
    this.drawHudGauge(
      context,
      actor.hp,
      actor.maxHp,
      hpX,
      centerY + 8,
      Math.max(42, hpWidth - 18),
      UIResourcePalette.fill("hp"),
    );

    context.fillStyle = UIResourcePalette.text("mp");
    context.fillText("MP", mpX, centerY - 5);
    context.fillStyle = UIResourcePalette.valueText();
    context.fillText(
      `${actor.mp}/${actor.maxMp}`,
      mpX + context.measureText("MP ").width,
      centerY - 5,
    );
    this.drawHudGauge(
      context,
      actor.mp,
      actor.maxMp,
      mpX,
      centerY + 8,
      Math.max(42, mpWidth - 18),
      UIResourcePalette.fill("mp"),
    );

    const valorReady = actor.isValorReady?.() === true;
    const rawValor = Math.max(0, Number(actor.valor) || 0);
    const valorValue = Math.round(rawValor * 10) / 10;
    const valorMaximum = Math.max(0, Number(actor.maxValor) || 0);
    const valorValueText = valorReady
      ? "READY"
      : `${valorValue}/${valorMaximum}`;

    context.fillStyle = UIResourcePalette.text("valor", {
      ready: valorReady,
    });
    context.fillText("VALOR", valorX, centerY - 5);
    context.fillStyle = UIResourcePalette.valueText();
    context.fillText(
      valorValueText,
      valorX + context.measureText("VALOR ").width,
      centerY - 5,
    );
    this.drawHudGauge(
      context,
      rawValor,
      valorMaximum,
      valorX,
      centerY + 8,
      Math.max(46, valorWidth - 12),
      UIResourcePalette.fill("valor", { ready: valorReady }),
    );

    context.restore();
  }

  drawBattleHud(context) {
    const hud = this.scene.hudLayout.hudBounds();
    const names = this.scene.hudLayout.nameColumnBounds();
    const command = this.scene.hudLayout.commandBounds();
    const stats = this.scene.hudLayout.statsBounds();
    const members = (
      $gameParty.battleFormationMembers?.() ||
      $gameParty.battleMembers()
    ).slice(0, BattleHudLayout.PARTY_SLOTS);
    const activeActor = this.hudActivePartyBattler();

    context.save();
    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      UIAssetManager.drawPanel(
        context,
        "battlePanel",
        hud.x,
        hud.y,
        hud.width,
        hud.height,
        {
          fallbackFill: "rgba(7, 10, 15, 0.91)",
          fallbackStroke: "rgba(151, 196, 229, 0.56)",
          lineWidth: 1.5,
          assetAlpha: 0.42,
          sourceMargin: 12,
          destMargin: 11,
        },
      );
    } else {
      context.fillStyle = "rgba(7, 10, 15, 0.91)";
      context.fillRect(hud.x, hud.y, hud.width, hud.height);
      context.strokeStyle = "rgba(151, 196, 229, 0.56)";
      context.lineWidth = 1.5;
      context.strokeRect(hud.x, hud.y, hud.width, hud.height);
    }

    // The middle command reserve intentionally stays empty while no actor is
    // choosing a command. Future Barrier / MBarrier-style presentation can
    // occupy this space without moving names or resource gauges.
    context.strokeStyle = "rgba(151, 196, 229, 0.14)";
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
      const drawX = position.x + battleData.visualX;
      const scale = this.scene.getEnemyFormationScale(enemy);

      this.drawAssetBattleShadow(
        context,
        drawX,
        position.y + 7,
        scale,
        this.scene.getEnemyVisualAlpha(enemy) * 0.5,
      );
      this.drawEnemySprite(context, drawX, position.y, enemy, battleData);
    }
  }

  drawEnemyTargetCursor(context) {
    if (!this.scene.selectingEnemyTarget) {
      return;
    }

    context.save();

    context.font = "30px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#ffd75a";
    context.strokeStyle = "rgba(7, 10, 15, 0.9)";
    context.lineWidth = 3;

    const drawCursor = (x, y) => {
      if (typeof context.strokeText === "function") {
        context.strokeText("▼", x, y);
      }
      context.fillText("▼", x, y);
    };

    // -----------------------------
    // ALL TARGETS
    // -----------------------------

    if (this.scene.targetScope === "all") {
      const targets = this.scene.targetManager.getCurrentTargets();

      for (const target of targets) {
        if ($gameParty.battleMembers().includes(target)) {
          const position = this.scene.getAllyPosition(target);
          const height = this.scene.getActorSpriteHeight(target);
          drawCursor(position.x, position.y - height - 18);
          continue;
        }

        const enemyIndex = this.scene.enemies.indexOf(target);

        if (enemyIndex < 0) {
          continue;
        }

        const position = this.scene.getEnemyBattlePosition(enemyIndex);
        const height = this.scene.getEnemySpriteHeight(target);
        drawCursor(position.x, position.y - height - 18);
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
      const ally =
        this.scene.getBattlePartyMembers()[this.scene.selectedAllyIndex];
      const position = this.scene.getAllyPosition(ally);
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

    drawCursor(x, y);

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

    partyMembers.forEach((actor) => {
      const position = this.scene.getAllyPosition(actor);
      const battleData = this.scene.getPartyBattleData(actor);

      const visualX = battleData?.visualX || 0;
      const visualY = battleData?.visualY || 0;
      const drawX = position.x + visualX;

      this.drawAssetBattleShadow(
        context,
        drawX,
        position.y + 7,
        this.scene.getActorRenderScale(actor),
        this.scene.getActorVisualAlpha(actor) * 0.5,
      );
      this.drawActorSprite(
        context,
        drawX,
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
