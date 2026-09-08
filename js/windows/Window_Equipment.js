"use strict";

class Window_Equipment {
  constructor() {
    this.visible = false;

    this.index = 0;
    this.slots = ["Weapon", "Armor"];

    this.width = 600;
    this.height = 420;
    this.padding = 30;

    this.x = (Graphics.width - this.width) / 2;
    this.y = (Graphics.height - this.height) / 2;

    this.selectWindow = new Window_EquipSelect();
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

      if (type === "weapon") {
        if (result.id === 0) {
          const oldWeapon = $gameActor.weapon();

          $gameActor.weaponId = 0;

          if (oldWeapon) {
            console.log(`${$gameActor.name} unequipped ${oldWeapon.name}.`);
          }
        } else {
          $gameActor.equipWeapon(result.id);
        }
      } else if (type === "armor") {
        if (result.id === 0) {
          const oldArmor = $gameActor.armor();

          $gameActor.armorId = 0;

          if (oldArmor) {
            console.log(`${$gameActor.name} unequipped ${oldArmor.name}.`);
          }
        } else {
          $gameActor.equipArmor(result.id);
        }
      }

      this.selectWindow.hide();

      return;
    }

    if (Input.isTriggered("Escape")) {
      this.hide();

      return;
    }

    if (Input.isTriggered("ArrowUp") || Input.isTriggered("KeyW")) {
      this.index--;

      if (this.index < 0) {
        this.index = this.slots.length - 1;
      }
    }

    if (Input.isTriggered("ArrowDown") || Input.isTriggered("KeyS")) {
      this.index++;

      if (this.index >= this.slots.length) {
        this.index = 0;
      }
    }

    if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
      if (this.index === 0) {
        this.selectWindow.show("weapon");
      } else if (this.index === 1) {
        this.selectWindow.show("armor");
      }

      return;
    }
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;

    context.save();

    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    // =====================================
    // BACKGROUND
    // =====================================

    context.fillStyle = "rgba(0, 0, 0, 0.95)";
    context.fillRect(this.x, this.y, this.width, this.height);

    // =====================================
    // BORDER
    // =====================================

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(this.x, this.y, this.width, this.height);

    // =====================================
    // TITLE
    // =====================================

    context.fillStyle = "#ffffff";
    context.font = "28px sans-serif";
    context.fillText("Equipment", this.x + this.padding, this.y + 45);

    context.beginPath();
    context.moveTo(this.x + this.padding, this.y + 65);
    context.lineTo(this.x + this.width - this.padding, this.y + 65);

    context.stroke();

    // =====================================
    // CURRENT EQUIPMENT
    // =====================================

    const weapon = $gameActor.weapon();
    const armor = $gameActor.armor();

    const weaponName = weapon ? weapon.name : "None";
    const armorName = armor ? armor.name : "None";

    context.font = "22px sans-serif";

    // =====================================
    // WEAPON & ARMOR SELECTION
    // =====================================

    const weaponPrefix = this.index === 0 ? "▶ " : "  ";

    context.fillText(
      `${weaponPrefix}Weapon`,
      this.x + this.padding,
      this.y + 125,
    );
    context.fillText(weaponName, this.x + 200, this.y + 125);

    const armorPrefix = this.index === 1 ? "▶ " : "  ";

    context.fillText(
      `${armorPrefix}Armor`,
      this.x + this.padding,
      this.y + 175,
    );
    context.fillText(armorName, this.x + 200, this.y + 175);

    // =====================================
    // STATS
    // =====================================

    context.beginPath();
    context.moveTo(this.x + this.padding, this.y + 215);
    context.lineTo(this.x + this.width - this.padding, this.y + 215);

    context.stroke();
    context.font = "20px sans-serif";

    context.fillText(
      `Attack    ${$gameActor.totalAttack()}`,
      this.x + this.padding,
      this.y + 270,
    );

    context.fillText(
      `Defense   ${$gameActor.totalDefense()}`,
      this.x + this.padding,
      this.y + 315,
    );

    context.restore();

    this.selectWindow.draw();
  }
}
