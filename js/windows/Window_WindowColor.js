"use strict";

class Window_WindowColor {
  constructor({ onBack = null } = {}) {
    this.onBack = onBack;
    this.index = 0;
    this.channelIndex = 0;
    this.editing = false;
    this.message = "";
    this.step = 8;

    this.entries = [
      { type: "color", key: "topLeft", label: "Top Left" },
      { type: "color", key: "topRight", label: "Top Right" },
      { type: "color", key: "bottomLeft", label: "Bottom Left" },
      { type: "color", key: "bottomRight", label: "Bottom Right" },
      { type: "reset", key: "reset", label: "Reset Window Colors" },
    ];

    this.x = 90;
    this.y = 118;
    this.width = Graphics.width - 180;
    this.height = Graphics.height - 170;
    this.padding = 28;
    this.rowHeight = 58;
  }

  currentEntry() {
    return this.entries[this.index] || null;
  }

  currentChannel() {
    return ConfigManager.colorChannelKeys()[this.channelIndex] || "r";
  }

  update() {
    if (this.editing) {
      return this.updateEditing();
    }

    if (Input.isActionTriggered("cancel")) {
      this.onBack?.();
      return true;
    }

    if (Input.isActionTriggered("up")) {
      this.index = (this.index - 1 + this.entries.length) % this.entries.length;
      this.message = "";
      return true;
    }

    if (Input.isActionTriggered("down")) {
      this.index = (this.index + 1) % this.entries.length;
      this.message = "";
      return true;
    }

    if (Input.isActionTriggered("confirm")) {
      const entry = this.currentEntry();

      if (entry?.type === "reset") {
        ConfigManager.resetWindowColors();
        this.message = "Window colors restored to defaults.";
        return true;
      }

      if (entry?.type === "color") {
        this.editing = true;
        this.channelIndex = 0;
        this.message = "Editing color. Choose R/G/B, then adjust with Left/Right.";
        return true;
      }
    }

    return false;
  }

  updateEditing() {
    const entry = this.currentEntry();

    if (!entry || entry.type !== "color") {
      this.editing = false;
      return false;
    }

    if (Input.isActionTriggered("cancel") || Input.isActionTriggered("confirm")) {
      this.editing = false;
      this.message = "Color saved.";
      return true;
    }

    if (Input.isActionTriggered("up")) {
      this.channelIndex =
        (this.channelIndex - 1 + ConfigManager.colorChannelKeys().length) %
        ConfigManager.colorChannelKeys().length;
      return true;
    }

    if (Input.isActionTriggered("down")) {
      this.channelIndex =
        (this.channelIndex + 1) % ConfigManager.colorChannelKeys().length;
      return true;
    }

    if (Input.isActionTriggered("left")) {
      ConfigManager.adjustWindowColorChannel(
        entry.key,
        this.currentChannel(),
        -this.step,
      );
      return true;
    }

    if (Input.isActionTriggered("right")) {
      ConfigManager.adjustWindowColorChannel(
        entry.key,
        this.currentChannel(),
        this.step,
      );
      return true;
    }

    return false;
  }

  draw() {
    const context = Graphics.context;
    const listX = this.x + this.padding;
    const listWidth = Math.min(520, Math.floor(this.width * 0.48));
    const previewX = this.x + listWidth + 70;
    const previewWidth = this.x + this.width - this.padding - previewX;

    context.save();
    this.drawOuterPanel(context);
    this.drawEntries(context, listX, listWidth);
    this.drawPreview(context, previewX, previewWidth);
    this.drawFooter(context);
    context.restore();
  }

  drawOuterPanel(context) {
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
          fallbackFill: "rgba(13, 16, 21, 0.95)",
          fallbackStroke: "rgba(165, 187, 211, 0.7)",
          innerStroke: "rgba(235, 241, 250, 0.15)",
          lineWidth: 1.5,
          assetAlpha: 0.54,
          sourceMargin: 12,
          destMargin: 13,
        },
      );
      return;
    }

    context.fillStyle = "rgba(13, 16, 21, 0.95)";
    context.fillRect(this.x, this.y, this.width, this.height);
    context.strokeStyle = "rgba(165, 187, 211, 0.7)";
    context.lineWidth = 1.5;
    context.strokeRect(this.x, this.y, this.width, this.height);
  }

  drawEntries(context, listX, listWidth) {
    context.textBaseline = "middle";

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const selected = i === this.index;
      const rowY = this.y + 58 + i * this.rowHeight;

      if (selected) {
        const selectionX = listX - 12;
        const selectionY = rowY - this.rowHeight / 2 + 6;
        const selectionWidth = listWidth;
        const selectionHeight = this.rowHeight - 12;
        const assetSelectionDrawn =
          typeof UIAssetManager !== "undefined" &&
          typeof UIAssetManager.drawSelectionPanel === "function" &&
          UIAssetManager.drawSelectionPanel(
            context,
            selectionX,
            selectionY,
            selectionWidth,
            selectionHeight,
            { alpha: 0.18 },
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
      }

      context.textAlign = "left";
      context.font = "20px Arial";
      context.fillStyle = selected ? "#ffd75a" : "#f2f4f7";
      context.fillText(`${selected ? "▶ " : "  "}${entry.label}`, listX, rowY);

      if (entry.type !== "color") {
        continue;
      }

      const color = ConfigManager.windowColor(entry.key);
      const rgb = ConfigManager.hexToRgb(color);
      const swatchX = listX + listWidth - 152;
      const swatchY = rowY - 13;

      context.fillStyle = color;
      context.fillRect(swatchX, swatchY, 28, 26);
      context.strokeStyle = "rgba(255, 255, 255, 0.55)";
      context.lineWidth = 1;
      context.strokeRect(swatchX, swatchY, 28, 26);

      context.textAlign = "right";
      context.font = "16px Arial";
      context.fillStyle = selected ? "#ffd75a" : "#c8d3df";
      context.fillText(
        `${color.toUpperCase()}   ${rgb.r}, ${rgb.g}, ${rgb.b}`,
        listX + listWidth,
        rowY,
      );
    }

    const entry = this.currentEntry();

    if (this.editing && entry?.type === "color") {
      this.drawChannelEditor(context, listX, listWidth, entry);
    }
  }

  drawChannelEditor(context, listX, listWidth, entry) {
    const rgb = ConfigManager.hexToRgb(ConfigManager.windowColor(entry.key));
    const channels = [
      ["r", "R", rgb.r],
      ["g", "G", rgb.g],
      ["b", "B", rgb.b],
    ];
    const baseY = this.y + 360;

    context.font = "17px Arial";
    context.textAlign = "left";

    for (let i = 0; i < channels.length; i++) {
      const [key, label, value] = channels[i];
      const selected = i === this.channelIndex;
      const y = baseY + i * 34;
      const barX = listX + 54;
      const barWidth = Math.max(140, listWidth - 155);

      context.fillStyle = selected ? "#ffd75a" : "#c7d1dc";
      context.fillText(`${selected ? "▶ " : "  "}${label}`, listX, y);

      context.fillStyle = "rgba(5, 8, 12, 0.72)";
      context.fillRect(barX, y - 7, barWidth, 14);
      context.fillStyle = key === "r" ? "#d96868" : key === "g" ? "#66c982" : "#67a9e8";
      context.fillRect(barX, y - 7, barWidth * (value / 255), 14);

      context.textAlign = "right";
      context.fillStyle = selected ? "#ffd75a" : "#eef3f8";
      context.fillText(String(value), listX + listWidth, y);
      context.textAlign = "left";
    }
  }

  drawPreview(context, previewX, previewWidth) {
    const previewY = this.y + 48;
    const previewHeight = Math.min(265, this.height - 150);

    context.textAlign = "left";
    context.textBaseline = "middle";
    context.font = "17px Arial";
    context.fillStyle = "#aeb8c5";
    context.fillText("LIVE PREVIEW", previewX, previewY - 19);

    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      UIAssetManager.drawPanel(
        context,
        "menuPanel",
        previewX,
        previewY,
        previewWidth,
        previewHeight,
        {
          fallbackFill: "rgba(12, 18, 35, 0.96)",
          fallbackStroke: "rgba(160, 181, 221, 0.78)",
          innerStroke: "rgba(235, 241, 250, 0.17)",
          assetAlpha: 0.52,
        },
      );
    } else {
      context.fillStyle = "rgba(12, 18, 35, 0.96)";
      context.fillRect(previewX, previewY, previewWidth, previewHeight);
    }

    context.textAlign = "left";
    context.font = "26px Arial";
    context.fillStyle = "#f4f7fb";
    context.fillText("SAMPLE WINDOW", previewX + 28, previewY + 48);

    context.font = "17px Arial";
    context.fillStyle = "#d7e0ea";
    context.fillText(
      "The four corners blend through the shared window skin.",
      previewX + 28,
      previewY + 94,
    );
    context.fillStyle = "#aeb8c5";
    context.fillText(
      "HP / MP / Valor colors stay independent.",
      previewX + 28,
      previewY + 126,
    );

    const colors = ConfigManager.getWindowColors();
    const corners = [
      ["TL", colors.topLeft, previewX + 30, previewY + previewHeight - 45],
      ["TR", colors.topRight, previewX + previewWidth - 85, previewY + previewHeight - 45],
      ["BL", colors.bottomLeft, previewX + 30, previewY + previewHeight - 18],
      ["BR", colors.bottomRight, previewX + previewWidth - 85, previewY + previewHeight - 18],
    ];

    context.font = "13px Arial";
    for (const [label, color, x, y] of corners) {
      context.fillStyle = color;
      context.fillRect(x, y - 7, 18, 14);
      context.fillStyle = "#eef3f8";
      context.fillText(label, x + 24, y);
    }
  }

  drawFooter(context) {
    const footerY = this.y + this.height - 34;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.font = "15px Arial";
    context.fillStyle = this.message ? "#d8e9f7" : "#8fa1b5";
    context.fillText(this.message || this.hintText(), this.x + this.padding, footerY);
  }

  hintText() {
    if (this.editing) {
      return (
        `${Input.actionLabel("up")} / ${Input.actionLabel("down")}: RGB channel   ` +
        `${Input.actionLabel("left")} / ${Input.actionLabel("right")}: Adjust   ` +
        `${Input.actionLabel("confirm")} / ${Input.actionLabel("cancel")}: Done`
      );
    }

    return (
      `${Input.actionLabel("up")} / ${Input.actionLabel("down")}: Choose   ` +
      `${Input.actionLabel("confirm")}: Edit / Reset   ` +
      `${Input.actionLabel("cancel")}: Back`
    );
  }
}
