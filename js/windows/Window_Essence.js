"use strict";

class Window_Essence {
  constructor(party) {
    this.party = party;
    this.visible = false;
    this.mode = "slots";
    this.actorIndex = 0;
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
    return this.party?.members?.() || [];
  }

  actor() {
    return this.members()[this.actorIndex] || null;
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

  changeActor(offset) {
    const members = this.members();

    if (members.length === 0) {
      this.actorIndex = 0;
      return;
    }

    this.actorIndex = (this.actorIndex + offset + members.length) % members.length;
    this.slotIndex = 0;
    this.mode = "slots";
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
      if (Input.isTriggered("Escape") || Input.isTriggered("KeyQ")) {
        this.closeCatalog();
        return;
      }

      if (Input.isTriggered("ArrowUp") || Input.isTriggered("KeyW")) {
        this.moveCatalog(-1);
      }

      if (Input.isTriggered("ArrowDown") || Input.isTriggered("KeyS")) {
        this.moveCatalog(1);
      }

      if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
        this.applyCatalogSelection();
      }

      return;
    }

    if (Input.isTriggered("Escape") || Input.isTriggered("KeyQ")) {
      this.hide();
      return;
    }

    if (Input.isTriggered("ArrowLeft") || Input.isTriggered("KeyA")) {
      this.changeActor(-1);
    }

    if (Input.isTriggered("ArrowRight") || Input.isTriggered("KeyD")) {
      this.changeActor(1);
    }

    if (Input.isTriggered("ArrowUp") || Input.isTriggered("KeyW")) {
      this.moveSlot(-1);
    }

    if (Input.isTriggered("ArrowDown") || Input.isTriggered("KeyS")) {
      this.moveSlot(1);
    }

    if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
      this.openCatalog();
    }
  }

  show() {
    this.visible = true;
    this.mode = "slots";
    this.actorIndex = Math.min(this.actorIndex, Math.max(0, this.members().length - 1));
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
    const actor = this.actor();

    context.fillStyle = "#ffffff";
    context.font = "28px sans-serif";
    context.fillText("Essences", this.x + this.padding, this.y + 42);

    context.font = "20px sans-serif";
    context.textAlign = "right";
    context.fillText(
      actor ? `◀  ${actor.name}  ▶` : "No party members",
      this.x + this.width - this.padding,
      this.y + 42,
    );
    context.textAlign = "left";

    context.beginPath();
    context.moveTo(this.x + this.padding, this.y + 62);
    context.lineTo(this.x + this.width - this.padding, this.y + 62);
    context.stroke();
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

    const text =
      this.mode === "catalog"
        ? "W/S or ↑/↓: Choose   E/Enter: Equip   Q/Esc: Back"
        : "A/D or ←/→: Actor   W/S or ↑/↓: Slot   E/Enter: Change   Q/Esc: Close";

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
