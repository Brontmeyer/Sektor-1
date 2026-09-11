"use strict";

class Window_BattleMagic {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this.index = 0;

    this.width = 360;
    this.height = 260;

    this.padding = 20;
    this.lineHeight = 40;

    this.x = 290;
    this.y = Graphics.height - this.height - 40;
  }

  update() {
    if (!this.visible) {
      return;
    }

    const skills = this.skills();

    if (skills.length === 0) {
      return;
    }

    if (Input.isTriggered("ArrowUp") || Input.isTriggered("KeyW")) {
      this.index--;

      if (this.index < 0) {
        this.index = skills.length - 1;
      }
    }

    if (Input.isTriggered("ArrowDown") || Input.isTriggered("KeyS")) {
      this.index++;

      if (this.index >= skills.length) {
        this.index = 0;
      }
    }
  }

  actor() {
    return this.scene?.partyController?.currentBattler() || $gameActor;
  }

  skills() {
    return this.actor()
      .knownSkills()
      .filter((skill) => skill.type === "magic");
  }

  currentSkill() {
    const skills = this.skills();

    return skills[this.index] || null;
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
    const skills = this.skills();

    context.save();

    context.fillStyle = "rgba(0, 0, 0, 0.9)";

    context.fillRect(this.x, this.y, this.width, this.height);

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;

    context.strokeRect(this.x, this.y, this.width, this.height);

    context.textAlign = "left";
    context.textBaseline = "middle";
    context.font = "22px Arial";
    context.fillStyle = "#ffffff";

    context.fillText("Magic", this.x + this.padding, this.y + 30);

    if (skills.length === 0) {
      context.fillText("(No magic)", this.x + this.padding, this.y + 80);

      context.restore();
      return;
    }

    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];

      const prefix = i === this.index ? "▶ " : "   ";
      const drawY = this.y + 75 + i * this.lineHeight;

      const usable = this.actor().canUseSkill(skill.id);
      
      context.globalAlpha = usable ? 1.0 : 0.4;
      context.fillText(`${prefix}${skill.name}`, this.x + this.padding, drawY);
      context.textAlign = "right";

      context.fillText(
        `${skill.mpCost || 0} MP`,
        this.x + this.width - this.padding,
        drawY,
      );

      context.textAlign = "left";
      context.globalAlpha = 1.0;
    }

    context.restore();
  }
}
