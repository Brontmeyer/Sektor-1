"use strict";

class Window_BattleCommand {
  constructor(scene = null) {
    this.scene = scene;
    this.commands = ["Attack", "Magic", "Item", "Defend"];

    this.index = 0;
    this.visible = true;

    this.width = 220;
    this.padding = 20;
    this.lineHeight = 40;

    this.height = this.padding * 2 + this.commands.length * this.lineHeight;

    this.x = 40;
    this.y = Graphics.height - this.height - 20;
  }

  actor() {
    return this.scene?.partyController?.currentBattler?.() || null;
  }

  commandActionKey(command) {
    const actionKeys = {
      Attack: "attack",
      Magic: "magic",
      Item: "item",
      Defend: "defend",
    };

    return actionKeys[command] || "";
  }

  isCommandEnabled(command) {
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

    return actor.canUseBattleAction(actionKey);
  }

  currentCommand() {
    return this.commands[this.index];
  }

  ensureEnabledSelection() {
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
    if (this.commands.length === 0) {
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

    if (Input.isTriggered("ArrowUp") || Input.isTriggered("KeyW")) {
      this.moveSelection(-1);
    }

    if (Input.isTriggered("ArrowDown") || Input.isTriggered("KeyS")) {
      this.moveSelection(1);
    }
  }

  draw() {
    if (!this.visible) {
      return;
    }

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
      const prefix = i === this.index ? "▶ " : "   ";

      const drawY =
        this.y + this.padding + this.lineHeight / 2 + i * this.lineHeight;

      context.globalAlpha = this.isCommandEnabled(command) ? 1.0 : 0.4;
      context.fillText(
        `${prefix}${command}`,
        this.x + this.padding,
        drawY,
      );
      context.globalAlpha = 1.0;
    }
    context.restore();
  }
}
