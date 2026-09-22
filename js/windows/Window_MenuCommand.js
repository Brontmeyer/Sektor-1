"use strict";

class Window_MenuCommand {
  constructor() {
    this.visible = true;

    this.commands = [
      "Items",
      "Magick",
      "Skills",
      "Essence",
      "Status",
      "Equipment",
      "Save",
      "Load",
      "Options",
      "Exit",
    ];

    this.index = 0;

    this.width = 300;
    
    this.padding = 24;
    this.lineHeight = 45;
    this.height = 90 + this.commands.length * this.lineHeight;

    this.x = 60;
    this.y = 100;
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
    context.textBaseline = "alphabetic";

    // Background / soft frame

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
          fallbackFill: "rgba(15, 18, 22, 0.95)",
          fallbackStroke: "rgba(154, 183, 204, 0.66)",
          lineWidth: 1.5,
          assetAlpha: 0.6,
          sourceMargin: 12,
          destMargin: 12,
        },
      );
    } else {
      context.fillStyle = "rgba(15, 18, 22, 0.95)";
      context.fillRect(this.x, this.y, this.width, this.height);
      context.strokeStyle = "rgba(154, 183, 204, 0.66)";
      context.lineWidth = 1.5;
      context.strokeRect(this.x, this.y, this.width, this.height);
    }

    // Title

    context.fillStyle = "#ffffff";
    context.font = "26px sans-serif";
    context.fillText("Menu", this.x + this.padding, this.y + 42);

    // Divider

    context.beginPath();
    context.moveTo(this.x + this.padding, this.y + 60);
    context.lineTo(this.x + this.width - this.padding, this.y + 60);
    context.stroke();

    // Commands

    context.font = "22px sans-serif";

    let drawY = this.y + 105;

    for (let i = 0; i < this.commands.length; i++) {
      const selected = i === this.index;
      const prefix = selected ? "▶ " : "  ";

      if (selected) {
        const selectionX = this.x + 12;
        const selectionY = drawY - 27;
        const selectionWidth = this.width - 24;
        const selectionHeight = 35;
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
          context.fillStyle = "rgba(255, 215, 90, 0.08)";
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
        `${prefix}${this.commands[i]}`,
        this.x + this.padding,
        drawY,
      );

      drawY += this.lineHeight;
    }

    context.restore();
  }
}
