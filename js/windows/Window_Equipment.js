"use strict";

class Window_Equipment {
  constructor(actor) {
    this.actor = actor;
    this.visible = false;

    this.index = 0;
    this.slots = [
      { type: "weapon", label: "Weapon" },
      { type: "armor", label: "Armor" },
      { type: "accessory", label: "Accessory" },
    ];

    this.width = 660;
    this.height = 500;
    this.padding = 30;

    this.x = (Graphics.width - this.width) / 2;
    this.y = (Graphics.height - this.height) / 2;

    this.selectWindow = new Window_EquipSelect(actor);
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

    if (Input.isTriggered("Escape") || Input.isTriggered("KeyQ")) {
      this.hide();
      return;
    }

    if (Input.isTriggered("ArrowUp") || Input.isTriggered("KeyW")) {
      this.index = (this.index - 1 + this.slots.length) % this.slots.length;
    }

    if (Input.isTriggered("ArrowDown") || Input.isTriggered("KeyS")) {
      this.index = (this.index + 1) % this.slots.length;
    }

    if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
      const slot = this.slots[this.index];

      if (slot) {
        this.selectWindow.show(slot.type);
      }
    }
  }

  show() {
    this.visible = true;
    this.index = 0;
  }

  hide() {
    this.visible = false;
  }

  isOpen() {
    return this.visible;
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;

    context.save();
    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    context.fillStyle = "rgba(0, 0, 0, 0.95)";
    context.fillRect(this.x, this.y, this.width, this.height);

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(this.x, this.y, this.width, this.height);

    context.fillStyle = "#ffffff";
    context.font = "28px sans-serif";
    context.fillText("Equipment", this.x + this.padding, this.y + 45);

    context.beginPath();
    context.moveTo(this.x + this.padding, this.y + 65);
    context.lineTo(this.x + this.width - this.padding, this.y + 65);
    context.stroke();

    context.font = "22px sans-serif";

    for (let index = 0; index < this.slots.length; index++) {
      const slot = this.slots[index];
      const equipment = this.slotEquipment(slot.type);
      const prefix = this.index === index ? "▶ " : "  ";
      const drawY = this.y + 125 + index * 50;

      context.fillText(
        `${prefix}${slot.label}`,
        this.x + this.padding,
        drawY,
      );
      context.fillText(
        equipment?.name || "None",
        this.x + 220,
        drawY,
      );
    }

    context.beginPath();
    context.moveTo(this.x + this.padding, this.y + 275);
    context.lineTo(this.x + this.width - this.padding, this.y + 275);
    context.stroke();

    context.font = "20px sans-serif";
    const leftX = this.x + this.padding;
    const rightX = this.x + 340;

    context.fillText(
      `Attack          ${this.actor?.totalAttack() ?? 0}`,
      leftX,
      this.y + 325,
    );
    context.fillText(
      `Defense         ${this.actor?.totalDefense() ?? 0}`,
      leftX,
      this.y + 365,
    );
    context.fillText(
      `Critical        ${this.actor?.totalCritical() ?? 0}`,
      leftX,
      this.y + 405,
    );

    context.fillText(
      `Magic Attack    ${this.actor?.totalMagicAttack() ?? 0}`,
      rightX,
      this.y + 325,
    );
    context.fillText(
      `Magic Defense   ${this.actor?.totalMagicDefense() ?? 0}`,
      rightX,
      this.y + 365,
    );

    context.font = "16px sans-serif";
    context.fillText(
      "Enter: Change    Q/Esc: Back",
      leftX,
      this.y + this.height - 28,
    );

    context.restore();
    this.selectWindow.draw();
  }
}
