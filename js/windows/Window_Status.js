"use strict";

class Window_Status {
  constructor(source) {
    this.actorNavigation = new Window_ActorNavigator(source);
    this.visible = false;

    this.width = 600;
    this.height = 450;

    this.padding = 30;

    this.x = (Graphics.width - this.width) / 2;
    this.y = (Graphics.height - this.height) / 2;
  }

  get actor() {
    return this.actorNavigation.actor();
  }

  changeActor(offset) {
    return this.actorNavigation.changeActor(offset);
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (Input.isActionTriggered("cancel")) {
      this.hide();
      return;
    }

    this.actorNavigation.update();
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

    const actor = this.actor;

    if (!actor) {
      context.restore();
      return;
    }
    const leftX = this.x + 40;
    const rightX = this.x + 330;

    this.actorNavigation.drawHeader(
      context,
      "STATUS",
      this.x,
      this.y,
      this.width,
      this.padding,
    );

    // =========================
    // LEVEL / EXP
    // =========================

    context.font = "20px sans-serif";
    context.fillText(`Level: ${actor.level}`, leftX, this.y + 100);

    const expNeeded = actor.expForNextLevel ? actor.expForNextLevel() : "?";

    context.fillText(`EXP: ${actor.exp} / ${expNeeded}`, rightX, this.y + 100);

    // =========================
    // HP / MP
    // =========================

    context.font = "22px sans-serif";
    context.fillStyle = UIResourcePalette.text("hp");
    context.fillText("HP:", leftX, this.y + 135);
    context.fillStyle = UIResourcePalette.valueText();
    context.fillText(
      `${actor.hp} / ${actor.maxHp}`,
      leftX + context.measureText("HP: ").width,
      this.y + 135,
    );

    context.fillStyle = UIResourcePalette.text("mp");
    context.fillText("MP:", rightX, this.y + 135);
    context.fillStyle = UIResourcePalette.valueText();
    context.fillText(
      `${actor.mp} / ${actor.maxMp}`,
      rightX + context.measureText("MP: ").width,
      this.y + 135,
    );

    const valorDisplay =
      Math.round(Math.max(0, Number(actor.valor) || 0) * 10) / 10;
    const valorReady = actor.isValorReady?.() === true;
    const valorText = valorReady
      ? "READY"
      : `${valorDisplay} / ${actor.maxValor}`;
    context.font = "18px sans-serif";
    context.fillStyle = UIResourcePalette.text("valor", { ready: valorReady });
    context.fillText("Valor:", leftX, this.y + 170);
    context.fillStyle = UIResourcePalette.valueText();
    context.fillText(
      valorText,
      leftX + context.measureText("Valor: ").width,
      this.y + 170,
    );

    // =========================
    // DIVIDER
    // =========================

    context.beginPath();
    context.moveTo(this.x + 30, this.y + 190);
    context.lineTo(this.x + this.width - 30, this.y + 190);
    context.stroke();

    // =========================
    // PRIMARY STATS
    // =========================

    context.font = "20px sans-serif";

    let leftY = this.y + 225;

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

    let rightY = this.y + 225;

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
