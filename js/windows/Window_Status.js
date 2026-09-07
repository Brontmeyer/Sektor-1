"use strict";

class Window_Status {
  constructor() {
    this.visible = false;

    this.width = 600;
    this.height = 420;

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

    if (Input.isTriggered("Escape")) {
      this.hide();
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
    context.fillText("Status", this.x + this.padding, this.y + 45);

    // Divider

    context.beginPath();
    context.moveTo(this.x + this.padding, this.y + 65);
    context.lineTo(this.x + this.width - this.padding, this.y + 65);
    context.stroke();

    // =====================================
    // CHARACTER
    // =====================================

    context.font = "24px sans-serif";
    context.fillText($gameActor.name, this.x + this.padding, this.y + 115);

    // =====================================
    // HP
    // =====================================

    const hp = $gameActor.hp;
    const maxHp = $gameActor.maxHp;

    context.font = "20px sans-serif";
    context.fillText(
      `HP    ${hp} / ${maxHp}`,
      this.x + this.padding,
      this.y + 165,
    );

    // =====================================
    // HP BAR
    // =====================================

    const hpRatio = Math.max(0, Math.min(1, hp / maxHp));

    const barX = this.x + this.padding;
    const barY = this.y + 185;
    const barWidth = 350;
    const barHeight = 20;

    context.fillStyle = "#333333";
    context.fillRect(barX, barY, barWidth, barHeight);

    context.fillStyle = "#ffffff";
    context.fillRect(barX, barY, barWidth * hpRatio, barHeight);

    // =====================================
    // LEVEL
    // =====================================

    context.fillStyle = "#ffffff";
    context.font = "20px sans-serif";

    context.fillText(
      `Level    ${$gameActor.level}`,
      this.x + this.padding,
      this.y + 260,
    );

    // =====================================
    // EXP BAR
    // =====================================

    const currentExp = $gameActor.exp;
    const requiredExp = $gameActor.expForNextLevel();

    context.fillText(
      `EXP      ${currentExp} / ${requiredExp}`,
      this.x + this.padding,
      this.y + 300,
    );

    const expRatio = Math.max(0, Math.min(1, currentExp / requiredExp));
    const expBarX = this.x + this.padding;
    const expBarY = this.y + 320;

    const expBarWidth = 220;
    const expBarHeight = 12;

    context.fillStyle = "#333333";
    context.fillRect(expBarX, expBarY, expBarWidth, expBarHeight);

    context.fillStyle = "#ffffff";
    context.fillRect(expBarX, expBarY, expBarWidth * expRatio, expBarHeight);

    // =====================================
    // STATS
    // =====================================

    context.fillText(
      `Attack   ${$gameActor.totalAttack()}`,
      this.x + 300,
      this.y + 260,
    );

    context.fillText(
      `Defense  ${$gameActor.totalDefense()}`,
      this.x + 300,
      this.y + 300,
    );

    context.restore();
  }
}
