"use strict";

class Window_Essence {
  constructor(source) {
    this.actorNavigation = new Window_ActorNavigator(source);
    this.visible = false;
    this.mode = "slots";
    this.slotIndex = 0;
    this.catalogIndex = 0;

    this.width = 980;
    this.height = 600;
    this.padding = 24;
    this.lineHeight = 38;
    this.catalogViewport = new Window_ListViewport(8);

    this.x = (Graphics.width - this.width) / 2;
    this.y = (Graphics.height - this.height) / 2;
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
  }

  changeActor(offset) {
    if (!this.actorNavigation.changeActor(offset)) {
      return false;
    }

    this.onActorChanged();
    return true;
  }

  moveSlot(offset) {
    const actor = this.actor();
    const count = actor?.essenceSlotCount?.() || 0;

    if (count <= 0) {
      this.slotIndex = 0;
      return;
    }

    this.slotIndex = (this.slotIndex + offset + count) % count;
  }

  openCatalog() {
    const actor = this.actor();

    if (!actor) {
      return;
    }

    const currentId = actor.equippedEssenceAt(this.slotIndex)?.essenceId || 0;
    const entries = this.catalogEntries();
    const existingIndex = entries.findIndex((essence) => essence?.id === currentId);

    this.catalogIndex = existingIndex >= 0 ? existingIndex : 0;
    this.catalogViewport.reset(this.catalogIndex, entries.length);
    this.mode = "catalog";
  }

  closeCatalog() {
    this.mode = "slots";
  }

  moveCatalog(offset) {
    const entries = this.catalogEntries();

    if (entries.length === 0) {
      this.catalogIndex = 0;
      return;
    }

    this.catalogIndex =
      (this.catalogIndex + offset + entries.length) % entries.length;
    this.catalogViewport.ensureVisible(this.catalogIndex, entries.length);
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

      if (Input.isActionTriggered("up")) {
        this.moveCatalog(-1);
      }

      if (Input.isActionTriggered("down")) {
        this.moveCatalog(1);
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

    if (Input.isActionTriggered("up")) {
      this.moveSlot(-1);
    }

    if (Input.isActionTriggered("down")) {
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
  }

  hide() {
    this.visible = false;
    this.mode = "slots";
  }

  isOpen() {
    return this.visible;
  }

  drawPanel(context) {
    context.fillStyle = "rgba(0, 0, 0, 0.95)";
    context.fillRect(this.x, this.y, this.width, this.height);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(this.x, this.y, this.width, this.height);
  }

  drawHeader(context) {
    this.actorNavigation.drawHeader(
      context,
      "ESSENCE",
      this.x,
      this.y,
      this.width,
      this.padding,
    );
  }

  drawSlots(context) {
    const actor = this.actor();

    context.fillStyle = "#ffd75a";
    context.font = "20px sans-serif";
    context.fillText("EQUIPPED SLOTS", this.x + this.padding, this.y + 100);

    if (!actor) {
      return;
    }

    context.fillStyle = "#ffffff";
    context.font = "20px sans-serif";

    for (let slot = 0; slot < actor.essenceSlotCount(); slot++) {
      const essence = actor.equippedEssenceAt(slot);
      const selected = slot === this.slotIndex;
      const prefix = selected ? "▶ " : "   ";
      const name = essence?.name() || "Empty";

      context.fillText(
        `${prefix}Slot ${slot + 1}: ${name}`,
        this.x + this.padding,
        this.y + 145 + slot * 48,
      );
    }
  }

  drawCatalog(context) {
    const entries = this.catalogEntries();

    context.fillStyle = "#ffd75a";
    context.font = "20px sans-serif";
    context.fillText(
      `CHOOSE FOR SLOT ${this.slotIndex + 1}`,
      this.x + this.padding,
      this.y + 100,
    );

    const range = this.catalogViewport.visibleRange(this.catalogIndex, entries.length);
    let drawY = this.y + 140;

    context.font = "19px sans-serif";

    for (let index = range.start; index < range.end; index++) {
      const essence = entries[index];
      const selected = index === this.catalogIndex;
      const enabled = this.catalogEntryEnabled(essence);
      const prefix = selected ? "▶ " : "   ";
      const name = essence ? essence.name : "Unequip / Empty";

      context.globalAlpha = enabled ? 1 : 0.4;
      context.fillStyle = "#ffffff";
      context.fillText(`${prefix}${name}`, this.x + this.padding, drawY);
      context.globalAlpha = 1;
      drawY += this.lineHeight;
    }

    context.font = "16px sans-serif";
    context.textAlign = "right";

    if (this.catalogViewport.hasPrevious()) {
      context.fillText("▲", this.x + 330, this.y + 140);
    }

    if (this.catalogViewport.hasNext(entries.length)) {
      context.fillText("▼", this.x + 330, this.y + 140 + 7 * this.lineHeight);
    }

    context.textAlign = "left";
  }

  drawDetails(context) {
    const essence = this.displayedEssence();
    const detailX = this.x + 385;
    const detailWidth = this.width - 385 - this.padding;

    context.beginPath();
    context.moveTo(detailX - 22, this.y + 85);
    context.lineTo(detailX - 22, this.y + this.height - 65);
    context.strokeStyle = "#666666";
    context.stroke();

    context.fillStyle = "#ffd75a";
    context.font = "20px sans-serif";
    context.fillText("ESSENCE DETAILS", detailX, this.y + 100);

    if (!essence) {
      context.fillStyle = "#cccccc";
      context.font = "20px sans-serif";
      context.fillText("No Essence selected.", detailX, this.y + 145);
      return;
    }

    const data = essence.data();
    const milestone = essence.nextProgressionMilestone();

    context.fillStyle = "#ffffff";
    context.font = "26px sans-serif";
    context.fillText(essence.name(), detailX, this.y + 145);

    context.fillStyle = "#cccccc";
    context.font = "17px sans-serif";
    this.drawWrappedText(
      context,
      data?.description || "",
      detailX,
      this.y + 178,
      detailWidth,
      24,
    );

    context.fillStyle = "#ffffff";
    context.font = "18px sans-serif";
    context.fillText(
      `Type: ${data?.type || "unknown"}    Element: ${data?.element || "none"}`,
      detailX,
      this.y + 245,
    );
    context.fillText(`Level: ${essence.level()}`, detailX, this.y + 278);

    if (essence.isMasteryReady()) {
      context.fillStyle = "#7dff8a";
      context.fillText(
        `Resonance: ${essence.resonance} / ${essence.masteryThreshold()}  •  MASTERY READY`,
        detailX,
        this.y + 311,
      );
    } else if (milestone) {
      context.fillStyle = "#ffffff";
      context.fillText(
        `Resonance: ${essence.resonance} / ${milestone.resonanceRequired}`,
        detailX,
        this.y + 311,
      );
      context.fillStyle = "#cccccc";
      context.fillText(
        `${essence.resonanceToNextMilestone()} to ${milestone.label}`,
        detailX,
        this.y + 340,
      );
    }

    context.fillStyle = "#ffd75a";
    context.fillText("MAGICK AWAKENING", detailX, this.y + 382);

    const abilities = Array.isArray(data?.abilities) ? data.abilities : [];
    let abilityY = this.y + 414;

    for (const ability of abilities.slice(0, 5)) {
      const magick = DatabaseManager.magick(ability.magickId);
      const unlocked = ability.unlockLevel <= essence.level();
      const marker = unlocked ? "✓" : "•";

      context.fillStyle = unlocked ? "#7dff8a" : "#999999";
      context.fillText(
        `${marker} Lv ${ability.unlockLevel}: ${magick?.name || `Magick ${ability.magickId}`}`,
        detailX,
        abilityY,
      );
      abilityY += 29;
    }
  }

  drawWrappedText(context, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(/\s+/).filter(Boolean);
    let line = "";
    let drawY = y;

    for (const word of words) {
      const next = line ? `${line} ${word}` : word;

      if (line && context.measureText(next).width > maxWidth) {
        context.fillText(line, x, drawY);
        line = word;
        drawY += lineHeight;
      } else {
        line = next;
      }
    }

    if (line) {
      context.fillText(line, x, drawY);
    }
  }

  drawControls(context) {
    context.fillStyle = "#cccccc";
    context.font = "16px sans-serif";

    const vertical = `${Input.actionLabel("up")} / ${Input.actionLabel("down")}`;
    const horizontal = `${Input.actionLabel("left")} / ${Input.actionLabel("right")}`;
    const confirm = Input.actionLabel("confirm");
    const cancel = Input.actionLabel("cancel");
    const text =
      this.mode === "catalog"
        ? `${vertical}: Choose   ${confirm}: Equip   ${cancel}: Back`
        : `${horizontal}: Actor   ${vertical}: Slot   ${confirm}: Change   ${cancel}: Close`;

    context.fillText(text, this.x + this.padding, this.y + this.height - 24);
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    context.save();
    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    this.drawPanel(context);
    this.drawHeader(context);

    if (this.mode === "catalog") {
      this.drawCatalog(context);
    } else {
      this.drawSlots(context);
    }

    this.drawDetails(context);
    this.drawControls(context);

    context.restore();
  }
}
