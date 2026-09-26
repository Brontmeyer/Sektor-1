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
    const screen = MenuScreenLayout.metrics();
    const margin = screen.margin;
    const gap = screen.gap;
    const width = screen.width;
    const height = screen.height;
    const headerHeight = screen.headerHeight;

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

    this.listBounds = {
      x: margin,
      y: margin + headerHeight + gap,
      width,
      height: height - headerHeight - gap,
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
    context.strokeStyle =
      options.fallbackStroke || "rgba(150, 176, 220, 0.78)";
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
        playTimeSeconds: 0,
      };
    }

    const actors = Array.isArray(saveData.actors)
      ? saveData.actors.filter(Boolean)
      : saveData.actor
        ? [saveData.actor]
        : [];
    const actorById = new Map(
      actors
        .map((actor) => [Number(actor?.actorId), actor])
        .filter(([actorId, actor]) => Number.isInteger(actorId) && actor),
    );
    const partyActorIds = Array.isArray(saveData.party?.actorIds)
      ? saveData.party.actorIds
          .map((actorId) => Number(actorId))
          .filter((actorId, index, source) =>
            Number.isInteger(actorId) &&
            actorById.has(actorId) &&
            source.indexOf(actorId) === index,
          )
      : [];
    const displayParty = partyActorIds.length > 0
      ? partyActorIds.map((actorId) => actorById.get(actorId)).filter(Boolean)
      : actors;
    const leader = displayParty[0] || actors[0] || {};
    const metadata = saveData.metadata || {};
    const mapName =
      metadata.mapName ||
      (saveData.location?.mapId
        ? `Map ${saveData.location.mapId}`
        : "Unknown Location");
    const runes = Number(saveData.party?.gil);

    return {
      slotId,
      exists: true,
      actorName: metadata.actorName || leader.name || "Unknown",
      level: metadata.level ?? leader.level ?? "?",
      location: mapName,
      timestamp: metadata.timestamp || null,
      party: displayParty.slice(0, 4),
      runes: Number.isFinite(runes) ? runes : null,
      playTimeSeconds: Math.max(0, Number(metadata.playTimeSeconds) || 0),
    };
  }

  formatDate(timestamp) {
    if (!timestamp) {
      return "Unavailable";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "Unavailable";
    }

    return date.toLocaleDateString();
  }

  formatClock(timestamp) {
    if (!timestamp) {
      return "--:--";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "--:--";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  formatPlayTime(seconds) {
    if (typeof Game_System !== "undefined" && Game_System.formatPlayTime) {
      return Game_System.formatPlayTime(seconds);
    }

    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainingSeconds = total % 60;

    return [hours, minutes, remainingSeconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }

  screenTitle() {
    return this.mode === "load" ? "LOAD" : "SAVE";
  }

  drawHeader(context) {
    const bounds = this.headerBounds;
    const selectedSlot = String(this.currentSlotId()).padStart(2, "0");
    const modeWidth = Math.max(150, Math.floor(bounds.width * 0.16));
    const fileWidth = Math.max(150, Math.floor(bounds.width * 0.18));
    const modeX = bounds.x + bounds.width - modeWidth;
    const fileX = modeX - fileWidth;

    this.drawPanel(context, bounds);

    context.save();
    context.textBaseline = "middle";
    context.strokeStyle = "rgba(210, 222, 242, 0.34)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(fileX, bounds.y + 6);
    context.lineTo(fileX, bounds.y + bounds.height - 6);
    context.moveTo(modeX, bounds.y + 6);
    context.lineTo(modeX, bounds.y + bounds.height - 6);
    context.stroke();

    context.textAlign = "left";
    context.fillStyle = typeof UIThemePalette !== "undefined"
      ? UIThemePalette.primary()
      : "#ffffff";
    context.font = "600 20px sans-serif";
    context.fillText("Select a file.", bounds.x + 20, bounds.y + bounds.height / 2);

    context.textAlign = "center";
    context.fillStyle = typeof UIThemePalette !== "undefined"
      ? UIThemePalette.focus()
      : "#ffd75a";
    context.font = "600 19px sans-serif";
    context.fillText(
      `FILE ${selectedSlot}`,
      fileX + fileWidth / 2,
      bounds.y + bounds.height / 2,
    );

    context.fillStyle = typeof UIThemePalette !== "undefined"
      ? UIThemePalette.primary()
      : "#ffffff";
    context.font = "600 22px sans-serif";
    context.fillText(
      this.screenTitle(),
      modeX + modeWidth / 2,
      bounds.y + bounds.height / 2,
    );
    context.restore();
  }

  drawPortrait(context, actor, x, y, size) {
    if (
      typeof Window_ActorSummary !== "undefined" &&
      typeof Window_ActorSummary.drawPortraitPlaceholder === "function"
    ) {
      Window_ActorSummary.drawPortraitPlaceholder(context, actor, x, y, size);
      return;
    }

    context.fillStyle = "rgba(12, 23, 45, 0.94)";
    context.fillRect(x, y, size, size);
    context.strokeStyle = "rgba(137, 182, 235, 0.85)";
    context.strokeRect(x, y, size, size);
  }

  drawEmptySlot(context, summary, bounds, selected) {
    if (selected) {
      this.drawSelection(
        context,
        bounds.x + 7,
        bounds.y + 6,
        bounds.width - 14,
        bounds.height - 12,
      );
    }

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = selected ? "#ffd75a" : "#8897ac";
    context.font = selected ? "600 19px sans-serif" : "19px sans-serif";
    context.fillText(
      `${selected ? "▶ " : "  "}FILE ${String(summary.slotId).padStart(2, "0")}`,
      bounds.x + 18,
      bounds.y + 28,
    );

    context.textAlign = "center";
    context.fillStyle = "#ffd75a";
    context.font = "600 22px sans-serif";
    context.fillText("EMPTY", bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + 10);
    context.restore();
  }

  drawFilledSlot(context, summary, bounds, selected) {
    if (selected) {
      this.drawSelection(
        context,
        bounds.x + 7,
        bounds.y + 6,
        bounds.width - 14,
        bounds.height - 12,
      );
    }

    const innerX = bounds.x + 18;
    const innerY = bounds.y + 14;
    const innerHeight = bounds.height - 28;
    const portraitSize = Math.max(64, Math.min(84, Math.floor(innerHeight * 0.54)));
    const portraitGap = 8;
    const partyWidth = portraitSize * 4 + portraitGap * 3;
    const infoX = innerX + partyWidth + 36;
    const rightWidth = Math.max(224, Math.floor(bounds.width * 0.2));
    const rightX = bounds.x + bounds.width - rightWidth - 18;
    const dividerX = rightX - 14;
    const locationGap = 18;
    const centerWidth = Math.max(160, dividerX - locationGap - infoX);

    context.save();
    context.textBaseline = "middle";

    const slotLabelY = innerY + 12;
    context.textAlign = "left";
    context.fillStyle = selected ? "#ffd75a" : "#ffffff";
    context.font = selected ? "600 18px sans-serif" : "18px sans-serif";
    context.fillText(
      `${selected ? "▶ " : "  "}FILE ${String(summary.slotId).padStart(2, "0")}`,
      innerX,
      slotLabelY,
    );

    const portraitY = innerY + 30;
    for (let index = 0; index < 4; index++) {
      const actor = summary.party[index];
      const x = innerX + index * (portraitSize + portraitGap);

      if (actor) {
        this.drawPortrait(context, actor, x, portraitY, portraitSize);
      } else {
        context.fillStyle = "rgba(12, 23, 45, 0.48)";
        context.fillRect(x, portraitY, portraitSize, portraitSize);
        context.strokeStyle = "rgba(137, 182, 235, 0.28)";
        context.strokeRect(x, portraitY, portraitSize, portraitSize);
      }
    }

    context.textAlign = "left";
    context.fillStyle = "#ffffff";
    context.font = "600 20px sans-serif";
    context.fillText(summary.actorName, infoX, portraitY + 18);

    context.fillStyle = "#7ff0d5";
    context.font = "600 16px sans-serif";
    context.fillText(`LV ${summary.level}`, infoX, portraitY + 45);

    const locationY = portraitY + portraitSize + 18;
    context.fillStyle = "rgba(9, 18, 42, 0.54)";
    context.fillRect(infoX, locationY - 16, centerWidth, 32);
    context.strokeStyle = "rgba(150, 176, 220, 0.45)";
    context.strokeRect(infoX, locationY - 16, centerWidth, 32);
    context.fillStyle = "#ffffff";
    context.font = "16px sans-serif";
    context.fillText(summary.location, infoX + 12, locationY);

    context.strokeStyle = "rgba(210, 222, 242, 0.3)";
    context.beginPath();
    context.moveTo(dividerX, innerY + 4);
    context.lineTo(dividerX, bounds.y + bounds.height - 14);
    context.stroke();

    const valueX = bounds.x + bounds.width - 26;
    const rowYs = [
      portraitY + 8,
      portraitY + 34,
      portraitY + 60,
      portraitY + 86,
    ];
    context.font = "14px sans-serif";
    context.fillStyle = "#aebbd0";
    context.fillText("Saved", rightX, rowYs[0]);
    context.fillText("At", rightX, rowYs[1]);
    context.fillText("TIME", rightX, rowYs[2]);
    context.fillText("RUNES", rightX, rowYs[3]);

    context.textAlign = "right";
    context.fillStyle = "#ffffff";
    context.fillText(this.formatDate(summary.timestamp), valueX, rowYs[0]);
    context.fillText(this.formatClock(summary.timestamp), valueX, rowYs[1]);
    context.fillStyle = "#6fd8ff";
    context.fillText(this.formatPlayTime(summary.playTimeSeconds), valueX, rowYs[2]);
    context.fillStyle = "#ffffff";
    context.fillText(
      summary.runes === null
        ? "—"
        : typeof Game_Party !== "undefined" && typeof Game_Party.formatRunes === "function"
          ? Game_Party.formatRunes(summary.runes)
          : `${Math.max(0, summary.runes).toLocaleString()} R`,
      valueX,
      rowYs[3],
    );

    context.restore();
  }

  drawSlot(context, summary, bounds, selected) {
    this.drawPanel(context, bounds, {
      assetAlpha: selected ? 0.46 : 0.34,
      fallbackStroke: selected
        ? "rgba(255, 215, 90, 0.9)"
        : "rgba(150, 176, 220, 0.5)",
    });

    if (!summary.exists) {
      this.drawEmptySlot(context, summary, bounds, selected);
      return;
    }

    this.drawFilledSlot(context, summary, bounds, selected);
  }

  drawSlots(context) {
    const bounds = this.listBounds;
    const contentTop = bounds.y + 10;
    const contentBottom = bounds.y + bounds.height - 10;
    const availableHeight = Math.max(0, contentBottom - contentTop);
    const gap = 8;
    const slotHeight = Math.floor(
      (availableHeight - gap * (this.slots.length - 1)) / this.slots.length,
    );

    this.drawPanel(context, bounds);

    this.slots.forEach((slotId, index) => {
      this.drawSlot(
        context,
        this.slotSummary(slotId),
        {
          x: bounds.x + 10,
          y: contentTop + index * (slotHeight + gap),
          width: bounds.width - 20,
          height: slotHeight,
        },
        index === this.index,
      );
    });

  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    context.save();
    this.drawHeader(context);
    this.drawSlots(context);
    context.restore();
  }
}
