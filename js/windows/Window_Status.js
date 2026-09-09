"use strict";

class Window_Status {
  constructor() {
    this.visible = false;

    this.width = 600;
    this.height = 450;

    this.padding = 30;

    this.x = (Graphics.width - this.width) / 2;
    this.y = (Graphics.height - this.height) / 2;
  }

  show() {
    this.visible = true;
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

    if (Input.isTriggered("Escape") || Input.isTriggered("KeyQ")) {
      this.hide();
    }
  }

  draw() {
    // =========================
    // STATUS WINDOW
    // =========================

    if (!this.visible) return;

    const context = Graphics.context;

    context.save();

    // Window background
    context.fillStyle = "#000000";
    context.fillRect(this.x, this.y, this.width, this.height);

    // Window border
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(this.x, this.y, this.width, this.height);

    // Text settings
    context.fillStyle = "#ffffff";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    const actor = $gameActor;
    const leftX = this.x + 40;
    const rightX = this.x + 330;

    // =========================
    // NAME
    // =========================

    context.font = "30px sans-serif";
    context.fillText(actor.name, leftX, this.y + 50);

    // =========================
    // LEVEL / EXP
    // =========================

    context.font = "20px sans-serif";
    context.fillText(`Level: ${actor.level}`, leftX, this.y + 85);

    const expNeeded = actor.expForNextLevel ? actor.expForNextLevel() : "?";

    context.fillText(`EXP: ${actor.exp} / ${expNeeded}`, rightX, this.y + 85);

    // =========================
    // HP / MP
    // =========================

    context.font = "22px sans-serif";
    context.fillText(`HP: ${actor.hp} / ${actor.maxHp}`, leftX, this.y + 125);
    context.fillText(`MP: ${actor.mp} / ${actor.maxMp}`, rightX, this.y + 125);

    // =========================
    // DIVIDER
    // =========================

    context.beginPath();
    context.moveTo(this.x + 30, this.y + 150);
    context.lineTo(this.x + this.width - 30, this.y + 150);
    context.stroke();

    // =========================
    // PRIMARY STATS
    // =========================

    context.font = "20px sans-serif";

    let leftY = this.y + 190;

    const statSpacing = 34;

    context.fillText(`Strength: ${actor.strength}`, leftX, leftY);
    leftY += statSpacing;

    context.fillText(`Vitality: ${actor.vitality}`, leftX, leftY);
    leftY += statSpacing;

    context.fillText(`Dexterity: ${actor.dexterity}`, leftX, leftY);
    leftY += statSpacing;

    context.fillText(`Agility: ${actor.agility}`, leftX, leftY);
    leftY += statSpacing;

    context.fillText(`Magic: ${actor.magic}`, leftX, leftY);
    leftY += statSpacing;

    context.fillText(`Spirit: ${actor.spirit}`, leftX, leftY);
    leftY += statSpacing;

    context.fillText(`Luck: ${actor.luck}`, leftX, leftY);

    // =========================
    // DERIVED STATS
    // =========================

    let rightY = this.y + 190;

    context.fillText(`Attack: ${actor.totalAttack()}`, rightX, rightY);
    rightY += statSpacing;

    context.fillText(`Defense: ${actor.totalDefense()}`, rightX, rightY);
    rightY += statSpacing;

    context.fillText(`Attack %: ${actor.totalAttackPercent()}`, rightX, rightY);
    rightY += statSpacing;

    context.fillText(
      `Defense %: ${actor.totalDefensePercent()}`,
      rightX,
      rightY,
    );
    rightY += statSpacing;

    context.fillText(
      `Magic Attack: ${actor.totalMagicAttack()}`,
      rightX,
      rightY,
    );
    rightY += statSpacing;

    context.fillText(
      `Magic Defense: ${actor.totalMagicDefense()}`,
      rightX,
      rightY,
    );
    rightY += statSpacing;

    context.fillText(
      `Magic Defense %: ${actor.totalMagicDefensePercent()}`,
      rightX,
      rightY,
    );

    context.restore();
  }
}
