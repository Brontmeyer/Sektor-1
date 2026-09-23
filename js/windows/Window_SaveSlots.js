"use strict";

class Window_SaveSlots {
  constructor() {
    this.visible = false;
    this.mode = "save";
    this.index = 0;
    this.result = null;
    this.slots = [1, 2, 3];
    this.refreshLayout();
  }

  refreshLayout() {
    const margin = Math.max(12, Math.min(22, Math.floor(Graphics.width * 0.014)));
    const gap = 8;
    const width = Graphics.width - margin * 2;
    const height = Graphics.height - margin * 2;
    const headerHeight = 82;
    const descriptionHeight = 56;

    this.x = margin;
    this.y = margin;
    this.width = width;
    this.height = height;
    this.gap = gap;

    this.headerBounds = {
      x: margin,
      y: margin,
      width,
      height: headerHeight,
    };
    this.descriptionBounds = {
      x: margin,
      y: margin + headerHeight + gap,
      width,
      height: descriptionHeight,
    };
    const listY = this.descriptionBounds.y + descriptionHeight + gap;
    this.listBounds = {
      x: margin,
      y: listY,
      width,
      height: margin + height - listY,
    };
  }

  actionTriggered(action) {
    return typeof Input.isActionTriggered === "function"
      ? Input.isActionTriggered(action)
      : typeof Input.isTriggered === "function"
        ? Input.isTriggered(action)
        : false;
  }

  directionRepeated(action) {
    return typeof Input.isActionRepeated === "function"
      ? Input.isActionRepeated(action)
      : this.actionTriggered(action);
  }

  actionLabel(action, fallback) {
    return typeof Input.actionLabel === "function"
      ? Input.actionLabel(action)
      : fallback;
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (this.actionTriggered("cancel")) {
      this.hide();
      return;
    }

    if (this.directionRepeated("up")) {
      this.index = (this.index - 1 + this.slots.length) % this.slots.length;
    } else if (this.directionRepeated("down")) {
      this.index = (this.index + 1) % this.slots.length;
    }

    if (this.actionTriggered("confirm")) {
      this.result = this.currentSlotId();
      this.visible = false;
    }
  }

  show(mode = "save") {
    this.visible = true;
    this.mode = mode === "load" ? "load" : "save";
    this.index = 0;
    this.result = null;
    this.refreshLayout();
  }

  hide() {
    this.visible = false;
  }

  isOpen() {
    return this.visible;
  }

  currentSlotId() {
    return this.slots[this.index];
  }

  hasResult() {
    return this.result !== null;
  }

  takeResult() {
    const result = this.result;
    this.result = null;
    return result;
  }

  drawPanel(context, bounds, options = {}) {
    if (
      typeof Window_ActorSummary !== "undefined" &&
      typeof Window_ActorSummary.drawPanel === "function"
    ) {
      return Window_ActorSummary.drawPanel(context, bounds, options);
    }

    context.fillStyle = options.fallbackFill || "rgba(11, 16, 28, 0.96)";
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle = options.fallbackStroke || "rgba(150, 176, 220, 0.78)";
    context.lineWidth = 1.5;
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    return false;
  }

  drawSelection(context, x, y, width, height) {
    const drawn =
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawSelectionPanel === "function" &&
      UIAssetManager.drawSelectionPanel(context, x, y, width, height, {
        alpha: 0.22,
      });

    if (!drawn) {
      context.fillStyle = "rgba(255, 215, 90, 0.1)";
      context.fillRect(x, y, width, height);
    }
  }

  readSlot(slotId) {
    if (!SaveManager.exists(slotId)) {
      return null;
    }

    try {
      return SaveManager.read(slotId) || null;
    } catch (error) {
      console.warn(`Could not read save slot ${slotId} for presentation.`, error);
      return null;
    }
  }

  slotSummary(slotId) {
    const saveData = this.readSlot(slotId);

    if (!saveData) {
      return {
        slotId,
        exists: false,
        actorName: "",
        level: "",
        location: "",
        timestamp: null,
        party: [],
        runes: null,
      };
    }

    const actors = Array.isArray(saveData.actors)
      ? saveData.actors.filter(Boolean)
      : saveData.actor
        ? [saveData.actor]
        : [];
    const leader = actors[0] || {};
    const metadata = saveData.metadata || {};
    const mapName =
      metadata.mapName ||
      (saveData.location?.mapId ? `Map ${saveData.location.mapId}` : "Unknown Location");
    const runes = Number(saveData.party?.gil);

    return {
      slotId,
      exists: true,
      actorName: metadata.actorName || leader.name || "Unknown",
      level: metadata.level ?? leader.level ?? "?",
      location: mapName,
      timestamp: metadata.timestamp || null,
      party: actors.slice(0, 4),
      runes: Number.isFinite(runes) ? runes : null,
    };
  }

  formatTimestamp(timestamp) {
    if (!timestamp) {
      return "Date unavailable";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleString();
  }

  screenTitle() {
    return this.mode === "load" ? "LOAD" : "SAVE";
  }

  screenDescription() {
    return this.mode === "load"
      ? "Choose a slot to load saved progress."
      : "Choose a slot to save current progress.";
  }

  drawHeader(context) {
    const bounds = this.headerBounds;
    this.drawPanel(context, bounds);

    context.save();
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.textAlign = "left";
    context.font = "600 24px sans-serif";
    context.fillText(this.screenTitle(), bounds.x + 22, bounds.y + 31);

    context.fillStyle = "#aebbd0";
    context.font = "14px sans-serif";
    context.fillText(
      this.mode === "load" ? "SAVED PROGRESS" : "SAVE PROGRESS",
      bounds.x + 22,
      bounds.y + 57,
    );

    context.textAlign = "right";
    context.fillStyle = "#7ff0d5";
    context.font = "600 15px sans-serif";
    context.fillText(
      `${this.slots.length} SLOTS`,
      bounds.x + bounds.width - 22,
      bounds.y + 42,
    );
    context.restore();
  }

  drawDescription(context) {
    const bounds = this.descriptionBounds;
    this.drawPanel(context, bounds, { assetAlpha: 0.46 });

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = "#ffffff";
    context.font = "16px sans-serif";
    context.fillText(
      this.screenDescription(),
      bounds.x + 18,
      bounds.y + bounds.height / 2,
    );
    context.restore();
  }

  partyText(summary) {
    if (!summary.exists || summary.party.length === 0) {
      return "";
    }

    return summary.party
      .map((actor) => `${actor?.name || "Unknown"} Lv ${actor?.level ?? "?"}`)
      .join("  •  ");
  }

  drawSlot(context, summary, bounds, selected) {
    this.drawPanel(context, bounds, {
      assetAlpha: selected ? 0.48 : 0.36,
      fallbackStroke: selected
        ? "rgba(255, 215, 90, 0.9)"
        : "rgba(150, 176, 220, 0.56)",
    });

    if (selected) {
      this.drawSelection(
        context,
        bounds.x + 8,
        bounds.y + 7,
        bounds.width - 16,
        bounds.height - 14,
      );
    }

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = selected ? "#ffd75a" : "#ffffff";
    context.font = selected ? "600 19px sans-serif" : "19px sans-serif";
    context.fillText(
      `${selected ? "▶ " : "  "}SLOT ${summary.slotId}`,
      bounds.x + 20,
      bounds.y + 28,
    );

    if (!summary.exists) {
      context.fillStyle = "#8897ac";
      context.font = "17px sans-serif";
      context.fillText("Empty Slot", bounds.x + 42, bounds.y + 67);

      if (this.mode === "save") {
        context.fillStyle = "#aebbd0";
        context.font = "14px sans-serif";
        context.fillText("New save data will be written here.", bounds.x + 42, bounds.y + 96);
      }

      context.restore();
      return;
    }

    const valueX = bounds.x + 170;
    const rightX = bounds.x + bounds.width - 24;

    context.fillStyle = "#aebbd0";
    context.font = "14px sans-serif";
    context.fillText("Leader", bounds.x + 42, bounds.y + 60);
    context.fillText("Location", bounds.x + 42, bounds.y + 87);
    context.fillText("Saved", bounds.x + 42, bounds.y + 114);

    context.fillStyle = "#ffffff";
    context.font = "16px sans-serif";
    context.fillText(
      `${summary.actorName}   LV ${summary.level}`,
      valueX,
      bounds.y + 60,
    );
    context.fillText(summary.location, valueX, bounds.y + 87);
    context.fillText(this.formatTimestamp(summary.timestamp), valueX, bounds.y + 114);

    context.textAlign = "right";
    context.fillStyle = "#aebbd0";
    context.font = "14px sans-serif";
    if (summary.runes !== null) {
      context.fillText(
        `RUNES ${Math.max(0, summary.runes).toLocaleString()}`,
        rightX,
        bounds.y + 28,
      );
    }

    context.textAlign = "left";
    const partyText = this.partyText(summary);

    if (partyText) {
      context.fillStyle = "#cbd8e7";
      context.font = "14px sans-serif";
      context.fillText(partyText, bounds.x + 42, bounds.y + bounds.height - 20);
    }

    context.restore();
  }

  drawSlots(context) {
    const bounds = this.listBounds;
    const footerHeight = 38;
    const contentTop = bounds.y + 12;
    const footerTop = bounds.y + bounds.height - footerHeight;
    const availableHeight = Math.max(0, footerTop - contentTop - 10);
    const gap = 10;
    const slotHeight = Math.floor(
      (availableHeight - gap * (this.slots.length - 1)) / this.slots.length,
    );

    this.drawPanel(context, bounds);

    this.slots.forEach((slotId, index) => {
      this.drawSlot(
        context,
        this.slotSummary(slotId),
        {
          x: bounds.x + 16,
          y: contentTop + index * (slotHeight + gap),
          width: bounds.width - 32,
          height: slotHeight,
        },
        index === this.index,
      );
    });

    context.save();
    context.strokeStyle = "rgba(210, 222, 242, 0.34)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(bounds.x + 20, footerTop);
    context.lineTo(bounds.x + bounds.width - 20, footerTop);
    context.stroke();

    context.fillStyle = "#aebbd0";
    context.font = "13px sans-serif";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(
      `${this.actionLabel("up", "W / ↑")}/${this.actionLabel("down", "S / ↓")}: Slot   ` +
        `${this.actionLabel("confirm", "E / Enter")}: ${this.mode === "load" ? "Load" : "Save"}   ` +
        `${this.actionLabel("cancel", "Q / Esc")}: Back`,
      bounds.x + 18,
      footerTop + footerHeight / 2,
    );
    context.restore();
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    context.save();
    context.fillStyle = "#0b0e13";
    context.fillRect(0, 0, Graphics.width, Graphics.height);
    this.drawHeader(context);
    this.drawDescription(context);
    this.drawSlots(context);
    context.restore();
  }
}
