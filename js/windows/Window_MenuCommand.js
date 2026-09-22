"use strict";

class Window_MenuCommand {
  constructor(bounds = {}, accessPolicy = null) {
    this.visible = true;
    this.accessPolicy = accessPolicy || null;

    // Player-facing menu destinations intentionally remain singular.
    this.allCommands = [
      "Item",
      "Magick",
      "Skill",
      "Essence",
      "Equip",
      "Status",
      "Order",
      "Valor",
      "Option",
      "ROSTER",
      "Save",
      "Load",
      "Exit",
    ];

    this.commands = [];
    this.index = 0;
    this.padding = 18;
    this.refreshCommands();
    this.setBounds(bounds);
  }

  setAccessPolicy(accessPolicy) {
    this.accessPolicy = accessPolicy || null;
    this.refreshCommands();
  }

  commandState(command) {
    if (
      this.accessPolicy &&
      typeof this.accessPolicy.state === "function"
    ) {
      return this.accessPolicy.state(command);
    }

    return { visible: true, enabled: true, reason: "" };
  }

  refreshCommands() {
    const previous = this.commands[this.index] || null;
    this.commands = this.allCommands.filter(
      (command) => this.commandState(command).visible !== false,
    );

    if (this.commands.length === 0) {
      this.index = 0;
      return;
    }

    const previousIndex = previous ? this.commands.indexOf(previous) : -1;
    this.index = previousIndex >= 0
      ? previousIndex
      : Math.min(this.index, this.commands.length - 1);
  }

  setBounds(bounds = {}) {
    this.x = Number(bounds.x) || 60;
    this.y = Number(bounds.y) || 100;
    this.width = Math.max(190, Number(bounds.width) || 260);
    this.height = Math.max(320, Number(bounds.height) || 430);
    this.lineHeight = Math.max(
      24,
      Math.min(33, (this.height - this.padding * 2) / Math.max(1, this.commands.length)),
    );
  }

  update() {
    if (!this.visible || this.commands.length === 0) {
      return;
    }

    if (Input.isActionTriggered("up")) {
      this.index--;

      if (this.index < 0) {
        this.index = this.commands.length - 1;
      }
    }

    if (Input.isActionTriggered("down")) {
      this.index++;

      if (this.index >= this.commands.length) {
        this.index = 0;
      }
    }
  }

  currentCommand() {
    return this.commands[this.index] || null;
  }

  currentCommandState() {
    return this.commandState(this.currentCommand());
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";

    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      UIAssetManager.drawPanel(
        context,
        "menuPanel",
        this.x,
        this.y,
        this.width,
        this.height,
        {
          fallbackFill: "rgba(11, 18, 42, 0.95)",
          fallbackStroke: "rgba(143, 163, 236, 0.76)",
          innerStroke: "rgba(232, 235, 255, 0.15)",
          lineWidth: 1.5,
          assetAlpha: 0.48,
          sourceMargin: 12,
          destMargin: 12,
        },
      );
    } else {
      context.fillStyle = "rgba(11, 18, 42, 0.95)";
      context.fillRect(this.x, this.y, this.width, this.height);
      context.strokeStyle = "rgba(143, 163, 236, 0.76)";
      context.lineWidth = 1.5;
      context.strokeRect(this.x, this.y, this.width, this.height);
    }

    context.font = "19px sans-serif";
    const startY = this.y + this.padding + this.lineHeight / 2;

    for (let index = 0; index < this.commands.length; index++) {
      const command = this.commands[index];
      const state = this.commandState(command);
      const selected = index === this.index;
      const enabled = state.enabled !== false;
      const drawY = startY + index * this.lineHeight;

      if (selected) {
        const selectionX = this.x + 8;
        const selectionY = drawY - this.lineHeight / 2 + 2;
        const selectionWidth = this.width - 16;
        const selectionHeight = this.lineHeight - 4;
        const assetSelectionDrawn =
          typeof UIAssetManager !== "undefined" &&
          typeof UIAssetManager.drawSelectionPanel === "function" &&
          UIAssetManager.drawSelectionPanel(
            context,
            selectionX,
            selectionY,
            selectionWidth,
            selectionHeight,
            { alpha: enabled ? 0.22 : 0.1 },
          );

        if (!assetSelectionDrawn) {
          context.fillStyle = enabled
            ? "rgba(255, 215, 90, 0.1)"
            : "rgba(180, 190, 210, 0.06)";
          context.fillRect(
            selectionX,
            selectionY,
            selectionWidth,
            selectionHeight,
          );
        }
      }

      if (!enabled) {
        context.fillStyle = "rgba(180, 190, 210, 0.45)";
      } else {
        context.fillStyle = selected ? "#ffd75a" : "#f0f3f7";
      }

      context.fillText(
        `${selected ? "▶ " : "  "}${command}`,
        this.x + this.padding,
        drawY,
      );
    }

    context.restore();
  }
}
