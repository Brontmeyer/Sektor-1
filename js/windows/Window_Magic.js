"use strict";

class Window_Magic {
  constructor() {
    this.visible = false;

    this.width = 600;
    this.height = 420;

    this.x = (Graphics.width - this.width) / 2;
    this.y = (Graphics.height - this.height) / 2;

    this.index = 0;
  }

  skills() {
    return $gameActor.knownSkills().filter((skill) => skill.type === "magic");
  }

  currentSkill() {
    const skills = this.skills();

    return skills[this.index] || null;
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
      return;
    }

    const skills = this.skills();

    if (skills.length === 0) {
      return;
    }

    if (Input.isTriggered("KeyW")) {
      this.index--;

      if (this.index < 0) {
        this.index = skills.length - 1;
      }
    }

    if (Input.isTriggered("KeyS")) {
      this.index++;

      if (this.index >= skills.length) {
        this.index = 0;
      }
    }
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const ctx = Graphics.context;

    ctx.save();

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.95)";
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "26px sans-serif";

    ctx.fillText("Magic", this.x + 24, this.y + 42);

    // Divider
    ctx.beginPath();

    ctx.moveTo(this.x + 24, this.y + 60);

    ctx.lineTo(this.x + this.width - 24, this.y + 60);

    ctx.stroke();

    const skills = this.skills();

    ctx.font = "22px sans-serif";

    if (skills.length === 0) {
      ctx.fillText("(No magic)", this.x + 24, this.y + 105);

      ctx.restore();
      return;
    }

    let drawY = this.y + 105;

    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];

      const prefix = i === this.index ? "▶ " : "   ";

      ctx.fillText(`${prefix}${skill.name}`, this.x + 24, drawY);

      ctx.fillText(`${skill.mpCost || 0} MP`, this.x + this.width - 110, drawY);

      drawY += 40;
    }

    const skill = this.currentSkill();

    if (skill) {
      ctx.font = "18px sans-serif";

      ctx.fillText(
        `MP: ${$gameActor.mp} / ${$gameActor.maxMp}`,
        this.x + 24,
        this.y + this.height - 95,
      );

      ctx.fillText(
        skill.description || "",
        this.x + 24,
        this.y + this.height - 60,
      );

      ctx.fillText(
        `Category: ${skill.category || "other"}`,
        this.x + 24,
        this.y + this.height - 30,
      );
    }

    ctx.restore();
  }
}
