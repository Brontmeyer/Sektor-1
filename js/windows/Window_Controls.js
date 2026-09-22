"use strict";

class Window_Controls {
  constructor({ onBack = null } = {}) {
    this.onBack = onBack;
    this.index = 0;
    this.slotIndex = 0;
    this.capturing = false;
    this.message = "";

    this.entries = [
      ...ConfigManager.controlDefinitions().map((definition) => ({
        type: "binding",
        ...definition,
      })),
      {
        type: "reset",
        action: "reset",
        label: "Reset Controls to Defaults",
      },
    ];

    this.x = 120;
    this.y = 110;
    this.width = Graphics.width - 240;
    this.height = Graphics.height - 180;
    this.padding = 28;
    this.lineHeight = 38;
  }

  currentEntry() {
    return this.entries[this.index] || null;
  }

  currentBindingCode() {
    const entry = this.currentEntry();

    if (!entry || entry.type !== "binding") {
      return null;
    }

    return ConfigManager.bindingSlots(entry.action)[this.slotIndex] || null;
  }

  update() {
    if (this.capturing) {
      return this.updateCapture();
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

    const entry = this.currentEntry();

    if (entry?.type === "binding") {
      if (Input.isActionTriggered("left")) {
        this.slotIndex = 0;
        return true;
      }

      if (Input.isActionTriggered("right")) {
        this.slotIndex = 1;
        return true;
      }
    }

    if (Input.isActionTriggered("confirm")) {
      if (entry?.type === "reset") {
        ConfigManager.resetBindings();
        this.message = "Controls restored to defaults.";
        return true;
      }

      if (entry?.type === "binding") {
        this.capturing = true;
        this.message = "Press a key. Backspace cancels; Delete clears this slot.";
        return true;
      }
    }

    return false;
  }

  updateCapture() {
    const entry = this.currentEntry();

    if (!entry || entry.type !== "binding") {
      this.capturing = false;
      return false;
    }

    const code = Input.triggeredCodes()[0] || null;

    if (!code) {
      return false;
    }

    if (code === "Backspace") {
      this.capturing = false;
      this.message = "Binding unchanged.";
      return true;
    }

    if (code === "Delete") {
      const cleared = ConfigManager.clearBinding(entry.action, this.slotIndex);
      this.capturing = false;
      this.message = cleared
        ? "Binding cleared."
        : "That action must keep at least one binding.";
      return true;
    }

    if (!ConfigManager.isBindingCode(code)) {
      this.message = "That key cannot be bound.";
      return true;
    }

    ConfigManager.setBinding(entry.action, this.slotIndex, code);
    this.capturing = false;
    this.message = `${entry.label} set to ${ConfigManager.keyLabel(code)}.`;
    return true;
  }

  draw() {
    const context = Graphics.context;
    const contentX = this.x + this.padding;
    const primaryX = this.x + this.width - 300;
    const secondaryX = this.x + this.width - 120;

    context.save();
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
          assetAlpha: 0.58,
          sourceMargin: 12,
          destMargin: 13,
        },
      );
    } else {
      context.fillStyle = "rgba(15, 18, 22, 0.95)";
      context.fillRect(this.x, this.y, this.width, this.height);
      context.strokeStyle = "rgba(154, 183, 204, 0.66)";
      context.lineWidth = 1.5;
      context.strokeRect(this.x, this.y, this.width, this.height);
    }

    context.textBaseline = "middle";
    context.font = "16px Arial";
    context.fillStyle = "#8392a4";
    context.textAlign = "center";
    context.fillText("Primary", primaryX, this.y + 30);
    context.fillText("Secondary", secondaryX, this.y + 30);

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const selected = i === this.index;
      const rowY = this.y + 60 + i * this.lineHeight;

      if (selected) {
        const selectionX = this.x + 12;
        const selectionY = rowY - this.lineHeight / 2 + 4;
        const selectionWidth = this.width - 24;
        const selectionHeight = this.lineHeight - 8;
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
      context.font = "19px Arial";
      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.fillText(`${selected ? "▶ " : "  "}${entry.label}`, contentX, rowY);

      if (entry.type !== "binding") {
        continue;
      }

      const slots = ConfigManager.bindingSlots(entry.action);
      const drawSlot = (slot, x) => {
        const slotSelected = selected && this.slotIndex === slot;
        const capturing = slotSelected && this.capturing;
        context.textAlign = "center";
        context.fillStyle = capturing
          ? "#7fe7ff"
          : slotSelected
            ? "#ffd75a"
            : "#c8d3df";
        context.fillText(
          capturing ? "[ PRESS KEY ]" : ConfigManager.keyLabel(slots[slot]),
          x,
          rowY,
        );
      };

      drawSlot(0, primaryX);
      drawSlot(1, secondaryX);
    }

    const footerY = this.y + this.height - 44;
    context.textAlign = "left";
    context.font = "15px Arial";
    context.fillStyle = this.message ? "#d8e9f7" : "#8fa1b5";
    context.fillText(
      this.message ||
        `${Input.actionLabel("confirm")}: Rebind   ${Input.actionLabel("cancel")}: Back`,
      contentX,
      footerY,
    );

    context.restore();
  }
}
