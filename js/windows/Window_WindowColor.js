"use strict";

class Window_WindowColor {
  constructor({ onBack = null } = {}) {
    this.onBack = onBack;
    this.index = 0;
    this.channelIndex = 0;
    this.editing = false;
    this.message = "";
    this.step = 1;

    this.entries = [
      { type: "color", key: "topLeft", label: "Top Left" },
      { type: "color", key: "topRight", label: "Top Right" },
      { type: "color", key: "bottomLeft", label: "Bottom Left" },
      { type: "color", key: "bottomRight", label: "Bottom Right" },
      { type: "reset", key: "reset", label: "Reset Window Colors" },
    ];

    this.refreshLayout();
  }

  refreshLayout() {
    this.layout = ConfigMenuLayout.calculate();
    this.x = this.layout.x;
    this.y = this.layout.y;
    this.width = this.layout.width;
    this.height = this.layout.height;
    this.contentBounds = this.layout.contentBounds;
    this.contentSplit = ConfigMenuLayout.split(this.contentBounds, 0.5, 8);
  }

  currentEntry() {
    return this.entries[this.index] || null;
  }

  currentChannel() {
    return ConfigManager.colorChannelKeys()[this.channelIndex] || "r";
  }

  currentDescription() {
    if (this.message) {
      return this.message;
    }

    const entry = this.currentEntry();

    if (!entry) {
      return "Customize the shared Sektor 1 window colors.";
    }

    if (entry.type === "reset") {
      return "Restore all four shared window-corner colors to their defaults.";
    }

    if (this.editing) {
      return `Editing ${entry.label}: Up/Down selects R, G, or B; Left/Right adjusts the value; Enter or Back finishes.`;
    }

    return `Customize the ${entry.label.toLowerCase()} corner used by shared window panels. Press Enter to edit.`;
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
        this.message = "";
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

    if (typeof Input.isActionRepeated === "function" ? Input.isActionRepeated("left") : Input.isActionTriggered("left")) {
      ConfigManager.adjustWindowColorChannel(
        entry.key,
        this.currentChannel(),
        -this.step,
      );
      return true;
    }

    if (typeof Input.isActionRepeated === "function" ? Input.isActionRepeated("right") : Input.isActionTriggered("right")) {
      ConfigManager.adjustWindowColorChannel(
        entry.key,
        this.currentChannel(),
        this.step,
      );
      return true;
    }

    return false;
  }

  drawHeader(context) {
    ConfigMenuLayout.drawHeader(context, this.layout, {
      title: "WINDOW COLOR",
      subtitle: "APPEARANCE",
      description: this.currentDescription(),
    });
  }

  drawEntries(context, bounds) {
    const headingY = bounds.y + 30;
    const listX = bounds.x + 24;
    const listRight = bounds.x + bounds.width - 24;
    const rowStartY = bounds.y + 78;
    const rowHeight = 52;

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("WINDOW COLORS", listX, headingY);

    context.strokeStyle = "rgba(210, 222, 242, 0.24)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(bounds.x + 18, bounds.y + 50);
    context.lineTo(bounds.x + bounds.width - 18, bounds.y + 50);
    context.stroke();

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const selected = i === this.index;
      const rowY = rowStartY + i * rowHeight;

      if (selected) {
        ConfigMenuLayout.drawSelection(
          context,
          bounds.x + 16,
          rowY - rowHeight / 2 + 5,
          bounds.width - 32,
          rowHeight - 10,
        );
      }

      context.textAlign = "left";
      context.font = selected ? "600 18px sans-serif" : "18px sans-serif";
      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.fillText(`${selected ? "▶ " : "  "}${entry.label}`, listX, rowY);

      if (entry.type !== "color") {
        continue;
      }

      const color = ConfigManager.windowColor(entry.key);
      const rgb = ConfigManager.hexToRgb(color);
      const swatchX = listRight - 156;

      context.fillStyle = color;
      context.fillRect(swatchX, rowY - 12, 26, 24);
      context.strokeStyle = "rgba(255, 255, 255, 0.55)";
      context.lineWidth = 1;
      context.strokeRect(swatchX, rowY - 12, 26, 24);

      context.textAlign = "right";
      context.font = "14px sans-serif";
      context.fillStyle = selected ? "#ffd75a" : "#c8d3df";
      context.fillText(
        `${color.toUpperCase()}  ${rgb.r}, ${rgb.g}, ${rgb.b}`,
        listRight,
        rowY,
      );
    }

    const entry = this.currentEntry();
    if (this.editing && entry?.type === "color") {
      this.drawChannelEditor(context, bounds, entry);
    }

    context.restore();
  }

  drawChannelEditor(context, bounds, entry) {
    const rgb = ConfigManager.hexToRgb(ConfigManager.windowColor(entry.key));
    const channels = [
      ["r", "R", rgb.r],
      ["g", "G", rgb.g],
      ["b", "B", rgb.b],
    ];
    const listX = bounds.x + 28;
    const listRight = bounds.x + bounds.width - 28;
    const baseY = bounds.y + 386;

    context.font = "16px sans-serif";
    context.textAlign = "left";

    for (let i = 0; i < channels.length; i++) {
      const [key, label, value] = channels[i];
      const selected = i === this.channelIndex;
      const y = baseY + i * 38;
      const barX = listX + 54;
      const barWidth = Math.max(140, bounds.width - 190);

      context.fillStyle = selected ? "#ffd75a" : "#c7d1dc";
      context.fillText(`${selected ? "▶ " : "  "}${label}`, listX, y);

      context.fillStyle = "rgba(5, 8, 12, 0.72)";
      context.fillRect(barX, y - 7, barWidth, 14);
      context.fillStyle = key === "r" ? "#d96868" : key === "g" ? "#66c982" : "#67a9e8";
      context.fillRect(barX, y - 7, barWidth * (value / 255), 14);

      context.textAlign = "right";
      context.fillStyle = selected ? "#ffd75a" : "#eef3f8";
      context.fillText(String(value), listRight, y);
      context.textAlign = "left";
    }
  }

  drawPreview(context, bounds) {
    const headingY = bounds.y + 30;
    const panel = {
      x: bounds.x + 18,
      y: bounds.y + 64,
      width: bounds.width - 36,
      height: Math.min(300, bounds.height - 92),
    };

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("LIVE PREVIEW", bounds.x + 24, headingY);

    context.strokeStyle = "rgba(210, 222, 242, 0.24)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(bounds.x + 18, bounds.y + 50);
    context.lineTo(bounds.x + bounds.width - 18, bounds.y + 50);
    context.stroke();

    ConfigMenuLayout.drawPanel(context, panel, { assetAlpha: 0.44 });

    context.fillStyle = "#ffffff";
    context.font = "600 24px sans-serif";
    context.fillText("SAMPLE WINDOW", panel.x + 24, panel.y + 46);

    context.font = "16px sans-serif";
    context.fillStyle = "#d7e0ea";
    context.fillText(
      "The four corners blend through the shared window skin.",
      panel.x + 24,
      panel.y + 92,
    );
    context.fillStyle = "#aeb8c5";
    context.fillText(
      "HP / MP / Valor colors stay independent.",
      panel.x + 24,
      panel.y + 124,
    );

    const colors = ConfigManager.getWindowColors();
    const corners = [
      ["TL", colors.topLeft, panel.x + 28, panel.y + panel.height - 48],
      ["TR", colors.topRight, panel.x + panel.width - 92, panel.y + panel.height - 48],
      ["BL", colors.bottomLeft, panel.x + 28, panel.y + panel.height - 20],
      ["BR", colors.bottomRight, panel.x + panel.width - 92, panel.y + panel.height - 20],
    ];

    context.font = "13px sans-serif";
    for (const [label, color, x, y] of corners) {
      context.fillStyle = color;
      context.fillRect(x, y - 7, 18, 14);
      context.fillStyle = "#eef3f8";
      context.fillText(label, x + 24, y);
    }

    context.restore();
  }

  drawContent(context) {
    const bounds = this.contentBounds;
    const split = this.contentSplit;

    ConfigMenuLayout.drawPanel(context, bounds);

    context.save();
    context.strokeStyle = "rgba(210, 222, 242, 0.3)";
    context.lineWidth = 1;
    context.beginPath();
    const dividerX = split.left.x + split.left.width + 4;
    context.moveTo(dividerX, bounds.y + 18);
    context.lineTo(dividerX, bounds.y + bounds.height - 18);
    context.stroke();
    context.restore();

    this.drawEntries(context, split.left);
    this.drawPreview(context, split.right);
  }

  hintText() {
    return this.currentDescription();
  }

  draw() {
    this.refreshLayout();
    const context = Graphics.context;
    context.save();
    this.drawHeader(context);
    this.drawContent(context);
    context.restore();
  }
}
