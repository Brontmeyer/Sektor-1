"use strict";

class Window_Choice {
  constructor() {
    this.visible = false;

    this.choices = [];
    this.index = 0;
    this.result = null;

    this.width = 360;
    this.lineHeight = 42;
    this.padding = 18;

    this.x = Graphics.width - this.width - 60;
    this.y = 0;
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (Input.isActionTriggered("up")) {
      this.index--;

      if (this.index < 0) {
        this.index = this.choices.length - 1;
      }
    }

    if (Input.isActionTriggered("down")) {
      this.index++;

      if (this.index >= this.choices.length) {
        this.index = 0;
      }
    }

    if (Input.isActionTriggered("confirm")) {
      this.result = this.index;
      this.visible = false;
    }
  }

  updatePosition() {
    const height = this.padding * 2 + this.choices.length * this.lineHeight;

    this.height = height;
    this.x = Graphics.width - this.width - 60;
    this.y = Graphics.height - 40 - 180 - this.height - 10;
  }

  show(choices) {
    this.visible = true;

    this.choices = choices || [];
    this.index = 0;
    this.result = null;

    this.updatePosition();
  }

  hide() {
    this.visible = false;

    this.choices = [];
    this.index = 0;
  }

  isOpen() {
    return this.visible;
  }

  hasResult() {
    return this.result !== null;
  }

  getResult() {
    return this.result;
  }

  clearResult() {
    this.result = null;
  }

  drawPanel(context, bounds) {
    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      return UIAssetManager.drawPanel(
        context,
        "menuPanel",
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        {
          fallbackFill: "rgba(11, 16, 28, 0.96)",
          fallbackStroke: "rgba(150, 176, 220, 0.78)",
          innerStroke: "rgba(232, 234, 255, 0.14)",
          lineWidth: 1.5,
          assetAlpha: 0.54,
          sourceMargin: 12,
          destMargin: 12,
        },
      );
    }

    context.fillStyle = "rgba(11, 16, 28, 0.96)";
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle = "rgba(150, 176, 220, 0.78)";
    context.lineWidth = 1.5;
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    return false;
  }

  drawSelection(context, x, y, width, height) {
    const drawn =
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawSelectionPanel === "function" &&
      UIAssetManager.drawSelectionPanel(context, x, y, width, height, {
        alpha: 0.2,
      });

    if (!drawn) {
      context.fillStyle = "rgba(255, 215, 90, 0.1)";
      context.fillRect(x, y, width, height);
    }
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    const bounds = {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    };

    context.save();
    this.drawPanel(context, bounds);
    context.font = "20px sans-serif";
    context.textAlign = "left";
    context.textBaseline = "middle";

    for (let i = 0; i < this.choices.length; i++) {
      const choiceY =
        this.y + this.padding + this.lineHeight * i + this.lineHeight / 2;
      const selected = i === this.index;

      if (selected) {
        this.drawSelection(
          context,
          this.x + 10,
          choiceY - this.lineHeight / 2 + 3,
          this.width - 20,
          this.lineHeight - 6,
        );
      }

      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.font = selected ? "600 20px sans-serif" : "20px sans-serif";
      context.fillText(
        `${selected ? "▶ " : "  "}${this.choices[i]}`,
        this.x + 20,
        choiceY,
      );
    }
    context.restore();
  }
}
