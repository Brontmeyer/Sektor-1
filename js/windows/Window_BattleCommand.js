"use strict";

class Window_BattleCommand {
  static SIDE_ESCAPE = "Escape";
  static SIDE_DEFEND = "Defend";

  constructor(scene = null) {
    this.scene = scene;
    this.commands = ["Attack", "Skills", "Magick", "Item"];

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
    };

    return actionKeys[command] || "";
  }

  isCommandEnabled(command) {
    if (command === Window_BattleCommand.SIDE_ESCAPE) {
      return this.scene?.encounter?.canEscape === true;
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
      ].includes(command)
    ) {
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
      const returnTowardCenter =
        (this.sideCommand === Window_BattleCommand.SIDE_ESCAPE &&
          (Input.isActionTriggered("right"))) ||
        (this.sideCommand === Window_BattleCommand.SIDE_DEFEND &&
          (Input.isActionTriggered("left")));

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
      this.moveSelection(-1);
    }

    if (Input.isActionTriggered("down")) {
      this.moveSelection(1);
    }
  }

  drawSideCommand(context) {
    if (!this.hasSideCommandOpen()) {
      return;
    }

    const command = this.sideCommand;
    const isEscape = command === Window_BattleCommand.SIDE_ESCAPE;
    const x = isEscape
      ? this.x - this.sideWidth - this.sideGap
      : this.x + this.width + this.sideGap;
    const y = this.y;

    context.fillStyle = "rgba(0, 0, 0, 0.9)";
    context.fillRect(x, y, this.sideWidth, this.sideHeight);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(x, y, this.sideWidth, this.sideHeight);

    context.font = "20px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.globalAlpha = this.isCommandEnabled(command) ? 1.0 : 0.4;
    context.fillStyle = "#ffffff";
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

    context.fillStyle = "rgba(0, 0, 0, 0.85)";
    context.fillRect(this.x, this.y, this.width, this.height);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(this.x, this.y, this.width, this.height);

    context.font = "22px Arial";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";

    for (let i = 0; i < this.commands.length; i++) {
      const command = this.commands[i];
      const prefix =
        !this.hasSideCommandOpen() && i === this.index ? "▶ " : "   ";

      const drawY =
        this.y + this.padding + this.lineHeight / 2 + i * this.lineHeight;

      context.globalAlpha = this.isCommandEnabled(command) ? 1.0 : 0.4;
      context.fillText(`${prefix}${command}`, this.x + this.padding, drawY);
      context.globalAlpha = 1.0;
    }

    this.drawSideCommand(context);
    context.restore();
  }
}
