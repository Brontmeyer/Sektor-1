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

    this.refreshLayout();
  }

  refreshLayout() {
    this.layout = ConfigMenuLayout.calculate();
    this.x = this.layout.x;
    this.y = this.layout.y;
    this.width = this.layout.width;
    this.height = this.layout.height;
    this.contentBounds = this.layout.contentBounds;
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

  currentDescription() {
    if (this.message) {
      return this.message;
    }

    const entry = this.currentEntry();

    if (!entry) {
      return "Configure keyboard controls.";
    }

    if (this.capturing && entry.type === "binding") {
      const slot = this.slotIndex === 0 ? "Primary" : "Secondary";
      return `Press a key for ${entry.label} (${slot}). Backspace cancels; Delete clears this slot.`;
    }

    if (entry.type === "reset") {
      return "Restore every keyboard binding to the Sektor 1 defaults.";
    }

    return `Choose Primary or Secondary with Left/Right, then press Enter to rebind ${entry.label}.`;
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
        this.message = "";
        return true;
      }

      if (Input.isActionTriggered("right")) {
        this.slotIndex = 1;
        this.message = "";
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
        this.message = "";
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

  drawHeader(context) {
    ConfigMenuLayout.drawHeader(context, this.layout, {
      title: "CONTROLS",
      subtitle: "INPUT",
      description: this.currentDescription(),
    });
  }

  drawContent(context) {
    const bounds = this.contentBounds;
    const headingY = bounds.y + 30;
    const rowStartY = bounds.y + 70;
    const rowHeight = Math.max(
      38,
      Math.min(46, Math.floor((bounds.height - 88) / this.entries.length)),
    );
    const labelX = bounds.x + 30;
    const primaryX = bounds.x + bounds.width - 310;
    const secondaryX = bounds.x + bounds.width - 120;

    ConfigMenuLayout.drawPanel(context, bounds);

    context.save();
    context.textBaseline = "middle";
    context.font = "15px sans-serif";
    context.fillStyle = "#aebbd0";
    context.textAlign = "left";
    context.fillText("ACTION", labelX, headingY);
    context.textAlign = "center";
    context.fillText("PRIMARY", primaryX, headingY);
    context.fillText("SECONDARY", secondaryX, headingY);

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
          rowY - rowHeight / 2 + 4,
          bounds.width - 32,
          rowHeight - 8,
        );
      }

      context.textAlign = "left";
      context.font = selected ? "600 18px sans-serif" : "18px sans-serif";
      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.fillText(`${selected ? "▶ " : "  "}${entry.label}`, labelX, rowY);

      if (entry.type !== "binding") {
        continue;
      }

      const slots = ConfigManager.bindingSlots(entry.action);
      const drawSlot = (slot, x) => {
        const slotSelected = selected && this.slotIndex === slot;
        const capturing = slotSelected && this.capturing;

        context.textAlign = "center";
        context.font = slotSelected ? "600 17px sans-serif" : "17px sans-serif";
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

    context.restore();
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
