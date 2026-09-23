"use strict";

class Window_Equipment {
  constructor(source) {
    this.actorNavigation = new Window_ActorNavigator(source);
    this.visible = false;
    this.index = 0;
    this.slots = [
      { type: "weapon", label: "Weapon" },
      { type: "armor", label: "Armor" },
      { type: "accessory", label: "Accessories" },
    ];
    this.selectWindow = new Window_EquipSelect(this.actor);
    this.refreshLayout();
  }

  get actor() {
    return this.actorNavigation.actor();
  }

  refreshLayout() {
    const margin = Math.max(10, Math.min(18, Math.floor(Graphics.width * 0.012)));
    const gap = 8;
    const totalWidth = Graphics.width - margin * 2;
    const totalHeight = Graphics.height - margin * 2;
    const headerHeight = Math.max(150, Math.min(176, Math.floor(totalHeight * 0.25)));
    const summaryWidth = Math.max(360, Math.floor(totalWidth * 0.72));
    const descriptionHeight = 56;

    this.x = margin;
    this.y = margin;
    this.width = totalWidth;
    this.height = totalHeight;

    this.actorBounds = {
      x: this.x,
      y: this.y,
      width: summaryWidth - gap,
      height: headerHeight,
    };
    this.equippedBounds = {
      x: this.x + summaryWidth,
      y: this.y,
      width: this.width - summaryWidth,
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
    const statWidth = Math.max(480, Math.floor((this.width - gap) * 0.52));

    this.detailBounds = {
      x: this.x,
      y: contentY,
      width: statWidth,
      height: contentHeight,
    };
    this.listBounds = {
      x: this.x + statWidth + gap,
      y: contentY,
      width: this.width - statWidth - gap,
      height: contentHeight,
    };
    this.selectWindow.setBounds(this.listBounds);
  }

  onActorChanged() {
    this.index = 0;
    this.selectWindow.actor = this.actor;
    this.selectWindow.hide();
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

  slotEquipment(type) {
    if (type === "weapon") {
      return this.actor?.weapon?.() || null;
    }

    if (type === "armor") {
      return this.actor?.armor?.() || null;
    }

    if (type === "accessory") {
      return this.actor?.accessory?.() || null;
    }

    return null;
  }

  currentSlot() {
    return this.slots[this.index] || null;
  }

  displayedEquipment() {
    if (this.selectWindow.isOpen()) {
      return this.selectWindow.selectedEquipment();
    }

    return this.slotEquipment(this.currentSlot()?.type);
  }

  descriptionText() {
    if (this.selectWindow.isOpen()) {
      return this.selectWindow.selectedDescription();
    }

    return this.displayedEquipment()?.description || "No equipment selected.";
  }

  essenceGrowthLabel() {
    if (this.selectWindow.isOpen()) {
      return this.selectWindow.essenceGrowthLabel();
    }

    const equipment = this.displayedEquipment();
    const growth = String(equipment?.essenceGrowth || "Normal").trim();
    return growth || "Normal";
  }

  applySelection(type, equipmentId) {
    if (!this.actor) {
      return false;
    }

    if (type === "weapon") {
      return equipmentId === 0
        ? this.actor.unequipWeapon()
        : this.actor.equipWeapon(equipmentId);
    }

    if (type === "armor") {
      return equipmentId === 0
        ? this.actor.unequipArmor()
        : this.actor.equipArmor(equipmentId);
    }

    if (type === "accessory") {
      return equipmentId === 0
        ? this.actor.unequipAccessory()
        : this.actor.equipAccessory(equipmentId);
    }

    return false;
  }

  currentStats() {
    const actor = this.actor;

    if (!actor) {
      return [];
    }

    return [
      { name: "Attack", value: actor.totalAttack() },
      { name: "Attack %", value: actor.totalAttackPercent() },
      { name: "Defense", value: actor.totalDefense() },
      {
        name: "Defense %",
        value: actor.totalDefensePercent?.() ?? actor.defensePercent ?? 0,
      },
      { name: "Magic Attack", value: actor.totalMagicAttack() },
      { name: "Magic Defense", value: actor.totalMagicDefense() },
      {
        name: "Magic Defense %",
        value: actor.totalMagicDefensePercent?.() ?? actor.magicDefensePercent ?? 0,
      },
      { name: "Critical", value: actor.totalCritical() },
    ];
  }

  previewStats() {
    if (this.selectWindow.isOpen()) {
      return this.selectWindow.previewStats();
    }

    return this.currentStats().map((stat) => ({
      name: stat.name,
      current: stat.value,
      preview: stat.value,
    }));
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (this.selectWindow.isOpen()) {
      this.selectWindow.update();
      return;
    }

    if (this.selectWindow.hasResult()) {
      const type = this.selectWindow.type;
      const result = this.selectWindow.takeResult();

      if (result) {
        this.applySelection(type, result.id);
      }

      this.selectWindow.hide();
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
      this.index = (this.index - 1 + this.slots.length) % this.slots.length;
    } else if (this.directionRepeated("down")) {
      this.index = (this.index + 1) % this.slots.length;
    }

    if (Input.isActionTriggered("confirm")) {
      const slot = this.currentSlot();

      if (slot) {
        this.selectWindow.actor = this.actor;
        this.selectWindow.show(slot.type);
      }
    }
  }

  show() {
    this.visible = true;
    this.index = 0;
    this.refreshLayout();
    this.selectWindow.actor = this.actor;
  }

  hide() {
    this.visible = false;
    this.selectWindow.hide();
  }

  isOpen() {
    return this.visible;
  }

  drawPanel(context, bounds, options = {}) {
    return Window_ActorSummary.drawPanel(context, bounds, options);
  }

  drawActorPanel(context) {
    Window_ActorSummary.draw(context, this.actor, this.actorBounds);
  }

  drawEquippedSummary(context) {
    const bounds = this.equippedBounds;
    this.drawPanel(context, bounds);

    context.save();
    context.textBaseline = "alphabetic";
    context.fillStyle = "#ffffff";
    context.font = "600 22px sans-serif";
    context.textAlign = "center";
    context.fillText("EQUIP", bounds.x + bounds.width / 2, bounds.y + 30);

    context.font = "14px sans-serif";
    this.slots.forEach((slot, index) => {
      const y = bounds.y + 62 + index * 30;
      context.textAlign = "left";
      context.fillStyle = "#aebbd0";
      context.fillText(slot.label, bounds.x + 18, y);
      context.textAlign = "right";
      context.fillStyle = "#ffffff";
      context.fillText(
        this.slotEquipment(slot.type)?.name || "None",
        bounds.x + bounds.width - 18,
        y,
      );
    });
    context.restore();
  }

  drawDescription(context) {
    const bounds = this.descriptionBounds;
    this.drawPanel(context, bounds, { assetAlpha: 0.46 });
    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.font = "16px sans-serif";

    if (typeof Window_TextLayout !== "undefined" && Window_TextLayout.drawWrappedText) {
      Window_TextLayout.drawWrappedText(
        context,
        this.descriptionText(),
        bounds.x + 18,
        bounds.y + 21,
        bounds.width - 36,
        18,
        2,
      );
    } else {
      context.fillText(this.descriptionText(), bounds.x + 18, bounds.y + bounds.height / 2);
    }
    context.restore();
  }

  statAndFooterLayout(bounds, rowCount) {
    const footerHeight = 38;
    const footerTop = bounds.y + bounds.height - footerHeight;
    const dividerY = bounds.y + 188;
    const statStartY = dividerY + 24;
    const usableHeight = Math.max(0, footerTop - statStartY - 8);
    const rowSpacing = Math.max(20, Math.min(25, Math.floor(usableHeight / Math.max(1, rowCount))));

    return {
      dividerY,
      statStartY,
      rowSpacing,
      footerTop,
      footerY: footerTop + footerHeight / 2,
    };
  }

  drawSlotAndStats(context) {
    const bounds = this.detailBounds;
    const slot = this.currentSlot();
    const selecting = this.selectWindow.isOpen();
    const rows = this.previewStats();
    this.drawPanel(context, bounds);

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.font = "600 19px sans-serif";
    context.fillStyle = "#ffffff";
    context.fillText("EQUIPMENT", bounds.x + 20, bounds.y + 28);

    const slotStartY = bounds.y + 60;
    this.slots.forEach((entry, index) => {
      const y = slotStartY + index * 32;
      const selected = index === this.index && !selecting;
      context.fillStyle = selected ? "#ffd75a" : "#aebbd0";
      context.font = selected ? "600 17px sans-serif" : "17px sans-serif";
      context.fillText(`${selected ? "▶ " : "  "}${entry.label}`, bounds.x + 24, y);
      context.fillStyle = "#ffffff";
      context.font = "17px sans-serif";
      context.fillText(
        this.slotEquipment(entry.type)?.name || "None",
        bounds.x + 170,
        y,
      );
    });

    const growthY = bounds.y + 166;
    context.fillStyle = "#aebbd0";
    context.font = "17px sans-serif";
    context.fillText("Essence Growth", bounds.x + 24, growthY);
    context.fillStyle = "#ffffff";
    context.fillText(this.essenceGrowthLabel(), bounds.x + 190, growthY);

    const layout = this.statAndFooterLayout(bounds, rows.length);
    context.strokeStyle = "rgba(210, 222, 242, 0.38)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(bounds.x + 20, layout.dividerY);
    context.lineTo(bounds.x + bounds.width - 20, layout.dividerY);
    context.stroke();

    let y = layout.statStartY;
    const labelX = bounds.x + 42;
    const currentX = bounds.x + Math.floor(bounds.width * 0.58);
    const arrowX = bounds.x + Math.floor(bounds.width * 0.72);
    const previewX = bounds.x + Math.floor(bounds.width * 0.82);

    rows.forEach((stat) => {
      const current = Number(stat.current) || 0;
      const preview = Number(stat.preview) || 0;
      const changed = selecting && preview !== current;

      context.font = "16px sans-serif";
      context.textAlign = "left";
      context.fillStyle = "#aebbd0";
      context.fillText(stat.name, labelX, y);
      context.textAlign = "right";
      context.fillStyle = "#ffffff";
      context.fillText(String(current), currentX, y);

      if (selecting) {
        context.textAlign = "center";
        context.fillStyle = changed ? "#55e0c2" : "#aebbd0";
        context.fillText("→", arrowX, y);
        context.textAlign = "right";
        context.fillStyle =
          preview > current ? "#7dff8a" : preview < current ? "#ff6b6b" : "#ffffff";
        context.fillText(String(preview), previewX, y);
      }

      y += layout.rowSpacing;
    });

    context.strokeStyle = "rgba(210, 222, 242, 0.28)";
    context.beginPath();
    context.moveTo(bounds.x + 20, layout.footerTop);
    context.lineTo(bounds.x + bounds.width - 20, layout.footerTop);
    context.stroke();

    context.fillStyle = "#aebbd0";
    context.font = "13px sans-serif";
    context.textAlign = "left";
    const help = selecting
      ? "Preview updates while browsing equipment."
      : `${Input.actionLabel("left")}/${Input.actionLabel("right")}: Actor   ` +
        `${Input.actionLabel("up")}/${Input.actionLabel("down")}: Slot   ` +
        `${Input.actionLabel("confirm")}: Change   ${Input.actionLabel("cancel")}: Back`;
    context.fillText(help, bounds.x + 18, layout.footerY);
    context.restore();
  }

  drawListPlaceholder(context) {
    const bounds = this.listBounds;
    this.drawPanel(context, bounds);
    context.save();
    context.fillStyle = "#ffffff";
    context.font = "600 20px sans-serif";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText((this.currentSlot()?.label || "Equipment").toUpperCase(), bounds.x + 18, bounds.y + 28);
    context.fillStyle = "#aebbd0";
    context.font = "16px sans-serif";
    context.fillText(
      `Press ${Input.actionLabel("confirm")} to choose equipment.`,
      bounds.x + 24,
      bounds.y + 72,
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

    this.drawActorPanel(context);
    this.drawEquippedSummary(context);
    this.drawDescription(context);
    this.drawSlotAndStats(context);

    if (this.selectWindow.isOpen()) {
      this.selectWindow.draw();
    } else {
      this.drawListPlaceholder(context);
    }

    context.restore();
  }
}
