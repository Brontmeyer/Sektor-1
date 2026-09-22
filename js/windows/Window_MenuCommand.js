"use strict";

class Window_MenuCommand {
  constructor(bounds = {}) {
    this.visible = true;

    // Pass 57 naming contract: menu destinations use singular labels and the
    // main screen carries the heading, so this list needs no extra title.
    this.commands = [
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
      "Exit",
    ];

    this.index = 0;
    this.padding = 18;
    this.setBounds(bounds);
  }

  setBounds(bounds = {}) {
    this.x = Number(bounds.x) || 60;
    this.y = Number(bounds.y) || 100;
    this.width = Math.max(190, Number(bounds.width) || 260);
    this.height = Math.max(320, Number(bounds.height) || 430);
    this.lineHeight = Math.max(
      25,
      Math.min(34, (this.height - this.padding * 2) / this.commands.length),
    );
  }

  update() {
    if (!this.visible) {
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
    return this.commands[this.index];
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
          fallbackFill: "rgba(15, 18, 28, 0.95)",
          fallbackStroke: "rgba(139, 174, 225, 0.72)",
          lineWidth: 1.5,
          assetAlpha: 0.56,
          sourceMargin: 12,
          destMargin: 12,
        },
      );
    } else {
      context.fillStyle = "rgba(15, 18, 28, 0.95)";
      context.fillRect(this.x, this.y, this.width, this.height);
      context.strokeStyle = "rgba(139, 174, 225, 0.72)";
      context.lineWidth = 1.5;
      context.strokeRect(this.x, this.y, this.width, this.height);
    }

    context.font = "19px sans-serif";
    const startY = this.y + this.padding + this.lineHeight / 2;

    for (let index = 0; index < this.commands.length; index++) {
      const selected = index === this.index;
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
            { alpha: 0.22 },
          );

        if (!assetSelectionDrawn) {
          context.fillStyle = "rgba(255, 215, 90, 0.1)";
          context.fillRect(
            selectionX,
            selectionY,
            selectionWidth,
            selectionHeight,
          );
        }
      }

      context.fillStyle = selected ? "#ffd75a" : "#f0f3f7";
      context.fillText(
        `${selected ? "▶ " : "  "}${this.commands[index]}`,
        this.x + this.padding,
        drawY,
      );
    }

    context.restore();
  }
}
