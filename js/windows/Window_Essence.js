"use strict";

class Window_Essence {
  constructor(source) {
    this.actorNavigation = new Window_ActorNavigator(source);
    this.visible = false;
    this.mode = "slots";
    this.slotIndex = 0;
    this.catalogIndex = 0;

    this.catalogColumns = 2;
    this.catalogVisibleRows = 7;
    this.catalogRowHeight = 40;
    this.catalogViewport = new Window_ListViewport(this.catalogVisibleRows);

    this.refreshLayout();
  }

  refreshLayout() {
    const margin = Math.max(12, Math.min(22, Math.floor(Graphics.width * 0.014)));
    const gap = 8;
    const totalWidth = Graphics.width - margin * 2;
    const totalHeight = Graphics.height - margin * 2;
    const headerHeight = Math.max(150, Math.min(174, Math.floor(totalHeight * 0.245)));
    const descriptionHeight = 56;
    const infoWidth = Math.max(250, Math.min(320, Math.floor(totalWidth * 0.25)));

    this.x = margin;
    this.y = margin;
    this.width = totalWidth;
    this.height = totalHeight;

    this.actorBounds = {
      x: this.x,
      y: this.y,
      width: this.width - infoWidth - gap,
      height: headerHeight,
    };
    this.infoBounds = {
      x: this.actorBounds.x + this.actorBounds.width + gap,
      y: this.y,
      width: infoWidth,
      height: headerHeight,
    };
    this.descriptionBounds = {
      x: this.x,
      y: this.y + headerHeight + gap,
      width: this.width,
      height: descriptionHeight,
    };

    const contentY = this.descriptionBounds.y + descriptionHeight + gap;
    const contentHeight = this.y + this.height - contentY;
    const leftWidth = Math.max(430, Math.floor((this.width - gap) * 0.46));

    this.listBounds = {
      x: this.x,
      y: contentY,
      width: leftWidth,
      height: contentHeight,
    };
    this.detailBounds = {
      x: this.x + leftWidth + gap,
      y: contentY,
      width: this.width - leftWidth - gap,
      height: contentHeight,
    };
  }

  members() {
    return this.actorNavigation.members();
  }

  actor() {
    return this.actorNavigation.actor();
  }

  catalogEssences() {
    return Array.isArray(DatabaseManager.essences)
      ? DatabaseManager.essences.filter((essence) => essence !== null)
      : [];
  }

  catalogEntries() {
    return [null, ...this.catalogEssences()];
  }

  currentSlotEssence() {
    return this.actor()?.equippedEssenceAt?.(this.slotIndex) || null;
  }

  currentCatalogEssence() {
    return this.catalogEntries()[this.catalogIndex] || null;
  }

  displayedEssence() {
    if (this.mode === "catalog") {
      const data = this.currentCatalogEssence();

      if (!data) {
        return null;
      }

      return this.actor()?.essenceProgress?.(data.id) || new Game_Essence(data.id);
    }

    return this.currentSlotEssence();
  }

  onActorChanged() {
    this.slotIndex = 0;
    this.mode = "slots";
    this.catalogIndex = 0;
    this.catalogViewport.reset(0, this.catalogRowCount());
  }

  changeActor(offset) {
    if (!this.actorNavigation.changeActor(offset)) {
      return false;
    }

    this.onActorChanged();
    return true;
  }

  directionRepeated(action) {
    return typeof Input.isActionRepeated === "function"
      ? Input.isActionRepeated(action)
      : Input.isActionTriggered(action);
  }

  moveSlot(offset) {
    const actor = this.actor();
    const count = actor?.essenceSlotCount?.() || 0;

    if (count <= 0) {
      this.slotIndex = 0;
      return false;
    }

    this.slotIndex = (this.slotIndex + offset + count) % count;
    return true;
  }

  catalogRowCount(totalEntries = this.catalogEntries().length) {
    return Math.ceil(Math.max(0, Number(totalEntries) || 0) / this.catalogColumns);
  }

  selectedCatalogRow() {
    return Math.floor(this.catalogIndex / this.catalogColumns);
  }

  ensureCatalogSelectionVisible() {
    this.catalogViewport.ensureVisible(
      this.selectedCatalogRow(),
      this.catalogRowCount(),
    );
  }

  openCatalog() {
    const actor = this.actor();

    if (!actor) {
      return false;
    }

    const currentId = actor.equippedEssenceAt(this.slotIndex)?.essenceId || 0;
    const entries = this.catalogEntries();
    const existingIndex = entries.findIndex((essence) => essence?.id === currentId);

    this.catalogIndex = existingIndex >= 0 ? existingIndex : 0;
    this.catalogViewport.reset(
      this.selectedCatalogRow(),
      this.catalogRowCount(entries.length),
    );
    this.mode = "catalog";
    return true;
  }

  closeCatalog() {
    this.mode = "slots";
  }

  moveCatalogHorizontal(direction) {
    const entries = this.catalogEntries();
    const total = entries.length;

    if (total <= 0) {
      return false;
    }

    const row = Math.floor(this.catalogIndex / this.catalogColumns);
    const column = this.catalogIndex % this.catalogColumns;
    const nextColumn = column + (direction < 0 ? -1 : 1);

    if (nextColumn < 0 || nextColumn >= this.catalogColumns) {
      return false;
    }

    const nextIndex = row * this.catalogColumns + nextColumn;

    if (nextIndex < 0 || nextIndex >= total) {
      return false;
    }

    this.catalogIndex = nextIndex;
    this.ensureCatalogSelectionVisible();
    return true;
  }

  moveCatalogVertical(direction) {
    const entries = this.catalogEntries();
    const total = entries.length;
    const rows = this.catalogRowCount(total);

    if (total <= 0 || rows <= 0) {
      return false;
    }

    const row = Math.floor(this.catalogIndex / this.catalogColumns);
    const column = this.catalogIndex % this.catalogColumns;
    const nextRow = row + (direction < 0 ? -1 : 1);

    if (nextRow < 0 || nextRow >= rows) {
      return false;
    }

    this.catalogIndex = Math.min(
      nextRow * this.catalogColumns + column,
      total - 1,
    );
    this.ensureCatalogSelectionVisible();
    return true;
  }

  catalogEntryEnabled(essence) {
    if (!essence) {
      return true;
    }

    return this.actor()?.canEquipEssenceInSlot?.(this.slotIndex, essence.id) === true;
  }

  applyCatalogSelection() {
    const actor = this.actor();

    if (!actor) {
      return false;
    }

    const essence = this.currentCatalogEssence();

    if (!essence) {
      actor.unequipEssenceSlot(this.slotIndex);
      this.closeCatalog();
      return true;
    }

    if (!this.catalogEntryEnabled(essence)) {
      DebugManager.log(`${essence.name} is already equipped in another slot.`);
      return false;
    }

    if (!actor.equipEssenceInSlot(this.slotIndex, essence.id)) {
      return false;
    }

    this.closeCatalog();
    return true;
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (this.mode === "catalog") {
      if (Input.isActionTriggered("cancel")) {
        this.closeCatalog();
        return;
      }

      if (this.directionRepeated("up")) {
        this.moveCatalogVertical(-1);
      } else if (this.directionRepeated("down")) {
        this.moveCatalogVertical(1);
      } else if (this.directionRepeated("left")) {
        this.moveCatalogHorizontal(-1);
      } else if (this.directionRepeated("right")) {
        this.moveCatalogHorizontal(1);
      }

      if (Input.isActionTriggered("confirm")) {
        this.applyCatalogSelection();
      }

      return;
    }

    if (Input.isActionTriggered("cancel")) {
      this.hide();
      return;
    }

    if (this.actorNavigation.update()) {
      this.onActorChanged();
      return;
    }

    if (this.directionRepeated("up")) {
      this.moveSlot(-1);
    } else if (this.directionRepeated("down")) {
      this.moveSlot(1);
    }

    if (Input.isActionTriggered("confirm")) {
      this.openCatalog();
    }
  }

  show() {
    this.visible = true;
    this.mode = "slots";
    this.slotIndex = 0;
    this.refreshLayout();
  }

  hide() {
    this.visible = false;
    this.mode = "slots";
  }

  isOpen() {
    return this.visible;
  }

  drawPanel(context, bounds, options = {}) {
    return Window_ActorSummary.drawPanel(context, bounds, options);
  }

  drawActorPanel(context) {
    Window_ActorSummary.draw(context, this.actor(), this.actorBounds);
  }

  titleCase(value, fallback = "--") {
    const text = String(value || "").trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : fallback;
  }

  resonanceDisplay(essence) {
    if (!essence) {
      return "--";
    }

    if (essence.isMasteryReady()) {
      return `${essence.resonance} / ${essence.masteryThreshold()}`;
    }

    const milestone = essence.nextProgressionMilestone();
    return milestone
      ? `${essence.resonance} / ${milestone.resonanceRequired}`
      : String(essence.resonance);
  }

  drawEssenceInfoPanel(context) {
    const bounds = this.infoBounds;
    const essence = this.displayedEssence();
    const data = essence?.data?.() || null;
    this.drawPanel(context, bounds);

    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#ffffff";
    context.font = "600 22px sans-serif";
    context.fillText("ESSENCE", bounds.x + bounds.width / 2, bounds.y + 34);

    const labels = ["Type", "Element", "Level", "Resonance"];
    const values = [
      this.titleCase(data?.type),
      this.titleCase(data?.element),
      essence ? String(essence.level()) : "--",
      this.resonanceDisplay(essence),
    ];

    context.font = "14px sans-serif";

    labels.forEach((label, index) => {
      const rowY = bounds.y + 66 + index * 24;
      context.textAlign = "left";
      context.fillStyle = "#aebbd0";
      context.fillText(label, bounds.x + 18, rowY);
      context.textAlign = "right";
      context.fillStyle = "#ffffff";
      context.fillText(values[index], bounds.x + bounds.width - 18, rowY);
    });

    if (essence?.isMasteryReady?.()) {
      context.textAlign = "center";
      context.fillStyle = "#7dff8a";
      context.font = "600 13px sans-serif";
      context.fillText(
        "MASTERY READY",
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height - 13,
      );
    }
  }

  drawDescription(context) {
    const bounds = this.descriptionBounds;
    const essence = this.displayedEssence();
    const description = essence?.data?.()?.description || "No Essence selected.";
    this.drawPanel(context, bounds, { assetAlpha: 0.46 });

    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.font = "16px sans-serif";

    if (
      typeof Window_TextLayout !== "undefined" &&
      Window_TextLayout.drawWrappedText
    ) {
      Window_TextLayout.drawWrappedText(
        context,
        description,
        bounds.x + 18,
        bounds.y + 21,
        bounds.width - 36,
        18,
        2,
      );
    } else {
      context.fillText(description, bounds.x + 18, bounds.y + bounds.height / 2);
    }
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

  drawSlots(context) {
    const bounds = this.listBounds;
    const actor = this.actor();
    this.drawPanel(context, bounds);

    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#ffffff";
    context.font = "600 20px sans-serif";
    context.fillText("EQUIPPED ESSENCE", bounds.x + 20, bounds.y + 34);

    if (!actor) {
      context.font = "17px sans-serif";
      context.fillText("No active actor.", bounds.x + 20, bounds.y + 72);
      return;
    }

    const slotCount = actor.essenceSlotCount?.() || 0;
    const rowHeight = 58;
    const firstY = bounds.y + 62;

    for (let slot = 0; slot < slotCount; slot++) {
      const essence = actor.equippedEssenceAt(slot);
      const selected = slot === this.slotIndex;
      const rowY = firstY + slot * rowHeight;

      if (selected) {
        this.drawSelection(
          context,
          bounds.x + 12,
          rowY - 24,
          bounds.width - 24,
          44,
        );
      }

      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.font = "18px sans-serif";
      context.fillText(
        `${selected ? "▶ " : "  "}Slot ${slot + 1}`,
        bounds.x + 22,
        rowY,
      );
      context.fillStyle = essence ? "#ffffff" : "#9aa8b8";
      context.fillText(
        essence?.name?.() || "Empty",
        bounds.x + 128,
        rowY,
      );
    }

    this.drawControls(context, bounds);
  }

  drawCatalogScrollIndicators(context, totalRows) {
    const bounds = this.listBounds;
    const arrowX = bounds.x + bounds.width - 18;

    context.save();
    context.fillStyle = "#ffffff";
    context.font = "17px sans-serif";
    context.textAlign = "center";

    if (this.catalogViewport.hasPrevious()) {
      context.fillText("▲", arrowX, bounds.y + 58);
    }

    if (this.catalogViewport.hasNext(totalRows)) {
      context.fillText("▼", arrowX, bounds.y + bounds.height - 44);
    }

    context.restore();
  }

  drawCatalog(context) {
    const bounds = this.listBounds;
    const entries = this.catalogEntries();
    const totalRows = this.catalogRowCount(entries.length);
    const range = this.catalogViewport.visibleRange(
      this.selectedCatalogRow(),
      totalRows,
    );
    this.drawPanel(context, bounds);

    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#ffffff";
    context.font = "600 19px sans-serif";
    context.fillText(
      `CHOOSE FOR SLOT ${this.slotIndex + 1}`,
      bounds.x + 20,
      bounds.y + 34,
    );

    const horizontalPadding = 20;
    const columnGap = 14;
    const contentWidth = bounds.width - horizontalPadding * 2 - 26;
    const columnWidth =
      (contentWidth - columnGap * (this.catalogColumns - 1)) /
      this.catalogColumns;
    const firstY = bounds.y + 72;

    context.font = "16px sans-serif";
    context.textBaseline = "middle";

    for (let row = range.start; row < range.end; row++) {
      const visibleRow = row - range.start;
      const drawY = firstY + visibleRow * this.catalogRowHeight;

      for (let column = 0; column < this.catalogColumns; column++) {
        const index = row * this.catalogColumns + column;

        if (index >= entries.length) {
          continue;
        }

        const essence = entries[index];
        const selected = index === this.catalogIndex;
        const enabled = this.catalogEntryEnabled(essence);
        const columnX =
          bounds.x + horizontalPadding + column * (columnWidth + columnGap);

        if (selected) {
          this.drawSelection(
            context,
            columnX - 6,
            drawY - this.catalogRowHeight / 2 + 4,
            columnWidth,
            this.catalogRowHeight - 8,
          );
        }

        context.globalAlpha = enabled ? 1 : 0.42;
        context.fillStyle = selected ? "#ffd75a" : "#ffffff";
        context.fillText(
          `${selected ? "▶ " : "  "}${essence?.name || "Unequip / Empty"}`,
          columnX,
          drawY,
        );
        context.globalAlpha = 1;
      }
    }

    this.drawCatalogScrollIndicators(context, totalRows);
    this.drawControls(context, bounds);
  }

  drawResonanceGauge(context, essence, x, y, width) {
    if (!essence) {
      return;
    }

    const milestone = essence.nextProgressionMilestone();
    const maximum = milestone?.resonanceRequired || essence.masteryThreshold();
    const current = Math.min(essence.resonance, maximum);
    const color = essence.isMasteryReady() ? "#7dff8a" : "#ffd75a";

    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawGauge === "function"
    ) {
      UIAssetManager.drawGauge(context, current, maximum, x, y, width, 8, color);
      return;
    }

    const rate = maximum > 0 ? Math.max(0, Math.min(1, current / maximum)) : 0;
    context.fillStyle = "rgba(11, 15, 23, 0.92)";
    context.fillRect(x, y, width, 8);
    context.fillStyle = color;
    context.fillRect(x + 1, y + 1, Math.max(0, (width - 2) * rate), 6);
  }

  drawDetails(context) {
    const bounds = this.detailBounds;
    const essence = this.displayedEssence();
    this.drawPanel(context, bounds);

    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#ffffff";
    context.font = "600 20px sans-serif";
    context.fillText("PROGRESSION", bounds.x + 20, bounds.y + 34);

    if (!essence) {
      context.fillStyle = "#aebbd0";
      context.font = "17px sans-serif";
      context.fillText("No Essence selected.", bounds.x + 20, bounds.y + 72);
      return;
    }

    const data = essence.data();
    const milestone = essence.nextProgressionMilestone();
    const contentX = bounds.x + 20;
    const contentWidth = bounds.width - 40;

    context.font = "17px sans-serif";
    context.fillStyle = "#ffffff";
    context.fillText(`Level ${essence.level()}`, contentX, bounds.y + 70);

    context.textAlign = "right";
    context.fillText(
      essence.isMasteryReady()
        ? `${essence.resonance} / ${essence.masteryThreshold()}`
        : `${essence.resonance} / ${milestone?.resonanceRequired ?? essence.masteryThreshold()}`,
      bounds.x + bounds.width - 20,
      bounds.y + 70,
    );
    context.textAlign = "left";
    this.drawResonanceGauge(context, essence, contentX, bounds.y + 80, contentWidth);

    context.fillStyle = essence.isMasteryReady() ? "#7dff8a" : "#aebbd0";
    context.font = "15px sans-serif";
    context.fillText(
      essence.isMasteryReady()
        ? "MASTERY READY"
        : `${essence.resonanceToNextMilestone()} to ${milestone?.label || "Mastery Ready"}`,
      contentX,
      bounds.y + 111,
    );

    context.fillStyle = "#ffffff";
    context.font = "600 18px sans-serif";
    context.fillText("MAGICK AWAKENING", contentX, bounds.y + 151);

    const abilities = Array.isArray(data?.abilities) ? data.abilities : [];
    let abilityY = bounds.y + 184;

    if (abilities.length === 0) {
      context.fillStyle = "#aebbd0";
      context.font = "16px sans-serif";
      context.fillText("No Magick awakening data.", contentX, abilityY);
    } else {
      context.font = "16px sans-serif";

      for (const ability of abilities.slice(0, 6)) {
        const magick = DatabaseManager.magick(ability.magickId);
        const unlocked = ability.unlockLevel <= essence.level();
        context.fillStyle = unlocked ? "#7dff8a" : "#9aa8b8";
        context.fillText(
          `${unlocked ? "✓" : "•"} Lv ${ability.unlockLevel}  ${magick?.name || `Magick ${ability.magickId}`}`,
          contentX,
          abilityY,
        );
        abilityY += 28;
      }
    }
  }

  drawControls(context, bounds) {
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#c3ccda";
    context.font = "13px sans-serif";

    const vertical = `${Input.actionLabel("up")} / ${Input.actionLabel("down")}`;
    const horizontal = `${Input.actionLabel("left")} / ${Input.actionLabel("right")}`;
    const confirm = Input.actionLabel("confirm");
    const cancel = Input.actionLabel("cancel");
    const text =
      this.mode === "catalog"
        ? `${vertical} / ${horizontal}: Choose   ${confirm}: Equip   ${cancel}: Back`
        : `${horizontal}: Actor   ${vertical}: Slot   ${confirm}: Change   ${cancel}: Close`;

    context.fillText(text, bounds.x + 18, bounds.y + bounds.height - 16);
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    context.save();
    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    this.drawActorPanel(context);
    this.drawEssenceInfoPanel(context);
    this.drawDescription(context);

    if (this.mode === "catalog") {
      this.drawCatalog(context);
    } else {
      this.drawSlots(context);
    }

    this.drawDetails(context);
    context.restore();
  }
}
