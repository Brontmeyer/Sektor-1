"use strict";

class Window_BattleCommand {
  static SIDE_ESCAPE = "Escape";
  static SIDE_DEFEND = "Defend";
  static SIDE_SURGE = "Surge";

  constructor(scene = null) {
    this.scene = scene;
    this.commands = ["Attack", "Magick", "Skills", "Item"];

    this.index = 0;
    this.visible = true;
    this.sideCommand = null;

    this.padding = 14;
    this.lineHeight = 36;

    this.sideWidth = 96;
    this.sideHeight = 44;
    this.sideGap = 0;

    this.width = 220;
    this.height = this.padding * 2 + this.commands.length * this.lineHeight;
    this.x = 160;
    this.y = Graphics.height - this.height - 20;

    this.refreshLayout();
  }

  refreshLayout() {
    const bounds = this.scene?.hudLayout?.commandBounds?.();

    if (!bounds) {
      return false;
    }

    this.x = bounds.x;
    this.y = bounds.y;
    this.width = bounds.width;
    this.height = bounds.height;
    this.lineHeight = bounds.height / this.commands.length;
    this.sideHeight = this.lineHeight;
    this.padding = 0;
    return true;
  }

  actor() {
    return this.scene?.partyController?.currentBattler?.() || null;
  }

  commandActionKey(command) {
    const actionKeys = {
      Attack: "attack",
      Skills: "skill",
      Magick: "magick",
      Item: "item",
      Defend: "defend",
      Surge: "skill",
    };

    return actionKeys[command] || "";
  }

  canOpenSurge() {
    const actor = this.actor();

    if (!actor || actor.isValorSurgeReady?.() !== true) {
      return false;
    }

    const arts = actor.selectedValorArts?.() || [];
    return arts.some((art) => actor.canUseValorArt?.(art.id) === true);
  }

  isCommandEnabled(command) {
    if (command === Window_BattleCommand.SIDE_ESCAPE) {
      return this.scene?.encounter?.canEscape === true;
    }

    if (command === Window_BattleCommand.SIDE_SURGE) {
      return this.canOpenSurge();
    }

    const actor = this.actor();
    const actionKey = this.commandActionKey(command);

    if (!actor || !actionKey) {
      return true;
    }

    if (
      typeof actor.isPlayerControlled === "function" &&
      !actor.isPlayerControlled()
    ) {
      return false;
    }

    if (typeof actor.canUseBattleAction !== "function") {
      return true;
    }

    if (!actor.canUseBattleAction(actionKey)) {
      return false;
    }

    if (command === "Skills") {
      const skills =
        typeof actor.knownSkills === "function" ? actor.knownSkills() : [];
      return skills.some((skill) => actor.canUseSkill?.(skill.id));
    }

    return true;
  }

  currentCommand() {
    return this.sideCommand || this.commands[this.index];
  }

  hasSideCommandOpen() {
    return this.sideCommand !== null;
  }

  openSide(command) {
    if (
      ![
        Window_BattleCommand.SIDE_ESCAPE,
        Window_BattleCommand.SIDE_DEFEND,
        Window_BattleCommand.SIDE_SURGE,
      ].includes(command)
    ) {
      return false;
    }

    if (command === Window_BattleCommand.SIDE_SURGE && !this.canOpenSurge()) {
      return false;
    }

    this.sideCommand = command;
    return true;
  }

  closeSide() {
    const hadSideCommand = this.hasSideCommandOpen();
    this.sideCommand = null;
    return hadSideCommand;
  }

  ensureEnabledSelection() {
    if (this.hasSideCommandOpen()) {
      return true;
    }

    if (this.isCommandEnabled(this.currentCommand())) {
      return true;
    }

    const firstEnabled = this.commands.findIndex((command) =>
      this.isCommandEnabled(command),
    );

    if (firstEnabled >= 0) {
      this.index = firstEnabled;
      return true;
    }

    return false;
  }

  moveSelection(direction) {
    if (this.commands.length === 0 || this.hasSideCommandOpen()) {
      return false;
    }

    const startIndex = this.index;

    for (let offset = 1; offset <= this.commands.length; offset++) {
      const index =
        (startIndex + direction * offset + this.commands.length) %
        this.commands.length;

      if (this.isCommandEnabled(this.commands[index])) {
        this.index = index;
        return true;
      }
    }

    return false;
  }

  update() {
    if (!this.visible) {
      return;
    }

    this.ensureEnabledSelection();

    if (this.hasSideCommandOpen()) {
      if (
        this.sideCommand === Window_BattleCommand.SIDE_SURGE &&
        !this.canOpenSurge()
      ) {
        this.closeSide();
        return;
      }

      const returnTowardCenter =
        (this.sideCommand === Window_BattleCommand.SIDE_ESCAPE &&
          Input.isActionTriggered("right")) ||
        (this.sideCommand === Window_BattleCommand.SIDE_DEFEND &&
          Input.isActionTriggered("left")) ||
        (this.sideCommand === Window_BattleCommand.SIDE_SURGE &&
          Input.isActionTriggered("down"));

      if (returnTowardCenter) {
        this.closeSide();
      }

      return;
    }

    if (Input.isActionTriggered("left")) {
      this.openSide(Window_BattleCommand.SIDE_ESCAPE);
      return;
    }

    if (Input.isActionTriggered("right")) {
      this.openSide(Window_BattleCommand.SIDE_DEFEND);
      return;
    }

    if (Input.isActionTriggered("up")) {
      if (this.index === 0 && this.canOpenSurge()) {
        this.openSide(Window_BattleCommand.SIDE_SURGE);
      } else {
        this.moveSelection(-1);
      }
      return;
    }

    if (Input.isActionTriggered("down")) {
      this.moveSelection(1);
    }
  }

  drawSurgeCommand(context) {
    // Valor readiness is already communicated by the HUD gauge. Keep the
    // SURGE chip out of the command silhouette until the player deliberately
    // presses Up from Attack, then reveal it as the focused side command.
    if (
      this.sideCommand !== Window_BattleCommand.SIDE_SURGE ||
      !this.canOpenSurge()
    ) {
      return;
    }

    const selected = true;
    const width = Math.max(104, this.sideWidth + 12);
    const height = this.sideHeight;
    const x = this.x;
    const y = this.y - height;

    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      UIAssetManager.drawPanel(
        context,
        "accentPanel",
        x,
        y,
        width,
        height,
        {
          fallbackFill: "rgba(7, 10, 15, 0.96)",
          fallbackStroke: "rgba(255, 215, 90, 0.92)",
          lineWidth: selected ? 2 : 1.5,
          assetAlpha: selected ? 0.58 : 0.42,
          sourceMargin: 14,
          destMargin: 8,
        },
      );
    } else {
      context.fillStyle = "rgba(7, 10, 15, 0.96)";
      context.fillRect(x, y, width, height);
      context.strokeStyle = "rgba(255, 215, 90, 0.92)";
      context.lineWidth = selected ? 2 : 1.5;
      context.strokeRect(x, y, width, height);
    }

    context.font = "600 17px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#ffd75a";
    context.fillText(
      selected ? "▶ SURGE" : "SURGE",
      x + width / 2,
      y + height / 2,
    );
  }

  drawSideCommand(context) {
    if (
      !this.hasSideCommandOpen() ||
      this.sideCommand === Window_BattleCommand.SIDE_SURGE
    ) {
      return;
    }

    const command = this.sideCommand;
    const isEscape = command === Window_BattleCommand.SIDE_ESCAPE;
    const x = isEscape
      ? this.x - this.sideWidth - this.sideGap
      : this.x + this.width + this.sideGap;
    const y = this.y;

    const enabled = this.isCommandEnabled(command);

    const sideStroke = enabled
      ? "rgba(255, 215, 90, 0.8)"
      : "rgba(151, 196, 229, 0.35)";

    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      UIAssetManager.drawPanel(
        context,
        "accentPanel",
        x,
        y,
        this.sideWidth,
        this.sideHeight,
        {
          fallbackFill: "rgba(7, 10, 15, 0.92)",
          fallbackStroke: sideStroke,
          lineWidth: 1.5,
          assetAlpha: enabled ? 0.4 : 0.2,
          sourceMargin: 14,
          destMargin: 8,
        },
      );
    } else {
      context.fillStyle = "rgba(7, 10, 15, 0.92)";
      context.fillRect(x, y, this.sideWidth, this.sideHeight);
      context.strokeStyle = sideStroke;
      context.lineWidth = 1.5;
      context.strokeRect(x, y, this.sideWidth, this.sideHeight);
    }

    context.font = "17px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.globalAlpha = enabled ? 1.0 : 0.4;
    context.fillStyle = enabled ? "#ffd75a" : "#d5dbe3";
    context.fillText(command, x + this.sideWidth / 2, y + this.sideHeight / 2);
    context.globalAlpha = 1.0;
  }

  draw() {
    if (!this.visible) {
      return;
    }

    this.refreshLayout();
    this.ensureEnabledSelection();

    const context = Graphics.context;

    context.save();

    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      UIAssetManager.drawPanel(
        context,
        "battlePanel",
        this.x,
        this.y,
        this.width,
        this.height,
        {
          fallbackFill: "rgba(7, 10, 15, 0.93)",
          fallbackStroke: "rgba(151, 196, 229, 0.58)",
          lineWidth: 1.5,
          assetAlpha: 0.48,
          sourceMargin: 12,
          destMargin: 10,
        },
      );
    } else {
      context.fillStyle = "rgba(7, 10, 15, 0.93)";
      context.fillRect(this.x, this.y, this.width, this.height);
      context.strokeStyle = "rgba(151, 196, 229, 0.58)";
      context.lineWidth = 1.5;
      context.strokeRect(this.x, this.y, this.width, this.height);
    }

    context.font = "19px Arial";
    context.textAlign = "left";
    context.textBaseline = "middle";

    for (let i = 0; i < this.commands.length; i++) {
      const command = this.commands[i];
      const selected = !this.hasSideCommandOpen() && i === this.index;
      const enabled = this.isCommandEnabled(command);
      const drawY = this.y + this.lineHeight / 2 + i * this.lineHeight;

      if (selected) {
        const selectionX = this.x + 5;
        const selectionY = this.y + i * this.lineHeight + 3;
        const selectionWidth = this.width - 10;
        const selectionHeight = this.lineHeight - 6;
        const assetSelectionDrawn =
          typeof UIAssetManager !== "undefined" &&
          typeof UIAssetManager.drawSelectionPanel === "function" &&
          UIAssetManager.drawSelectionPanel(
            context,
            selectionX,
            selectionY,
            selectionWidth,
            selectionHeight,
            { alpha: 0.2 },
          );

        if (!assetSelectionDrawn) {
          context.fillStyle = "rgba(255, 215, 90, 0.09)";
          context.fillRect(
            selectionX,
            selectionY,
            selectionWidth,
            selectionHeight,
          );
        }
        context.fillStyle = "#ffd75a";
        context.fillRect(
          this.x + 3,
          this.y + i * this.lineHeight + 5,
          3,
          Math.max(8, this.lineHeight - 10),
        );
      }

      context.globalAlpha = enabled ? 1.0 : 0.38;
      context.fillStyle = selected ? "#ffd75a" : "#f0f3f7";
      context.fillText(
        `${selected ? "▶ " : "   "}${command}`,
        this.x + 14,
        drawY,
      );
      context.globalAlpha = 1.0;
    }

    this.drawSurgeCommand(context);
    this.drawSideCommand(context);
    context.restore();
  }
}
