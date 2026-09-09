"use strict";

class Window_Magic {
  constructor() {
    this.visible = false;
    this.index = 0;

    this.width = 500;
    this.height = 420;

    this.padding = 24;
    this.itemHeight = 40;

    this.x = (Graphics.width - this.width) / 2;
    this.y = (Graphics.height - this.height) / 2;
  }

  skills() {
    return $gameActor.knownSkills().filter((skill) => skill.type === "magic");
  }

  currentSkill() {
    const skills = this.skills();

    return skills[this.index] || null;
  }

  canUseFromField(skill) {
    if (!skill) {
      return false;
    }

    const canTargetPlayer =
      Array.isArray(skill.target) &&
      (skill.target.includes("ally") || skill.target.includes("self"));

    if (!canTargetPlayer) {
      return false;
    }

    return $gameActor.canUseSkill(skill.id);
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

    if (Input.isTriggered("Escape") || Input.isTriggered("KeyQ")) {
      this.hide();
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

    if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
      const skill = this.currentSkill();

      if (!skill) {
        return;
      }

      // Field menu currently only supports
      // magic that can target the player.
      const canTargetPlayer =
        Array.isArray(skill.target) &&
        (skill.target.includes("ally") || skill.target.includes("self"));

      if (!canTargetPlayer) {
        console.log(`${skill.name} cannot be used from the field menu.`);

        return;
      }

      $gameActor.useSkill(skill.id, $gameActor);
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

    // Background
    context.fillStyle = "rgba(0, 0, 0, 0.95)";
    context.fillRect(this.x, this.y, this.width, this.height);

    // Border
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(this.x, this.y, this.width, this.height);

    // Title
    context.fillStyle = "#ffffff";
    context.font = "26px sans-serif";

    context.fillText("Magic", this.x + this.padding, this.y + 42);

    // Divider
    context.beginPath();
    context.moveTo(this.x + this.padding, this.y + 60);
    context.lineTo(this.x + this.width - this.padding, this.y + 60);
    context.stroke();

    // =====================================
    // SKILL LIST
    // =====================================

    const skills = this.skills();

    context.font = "22px sans-serif";

    if (skills.length === 0) {
      context.fillText("(No magic)", this.x + this.padding, this.y + 105);

      context.restore();
      return;
    }

    let drawY = this.y + 105;

    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];

      const prefix = i === this.index ? "▶ " : "   ";

      const usable = this.canUseFromField(skill);

      context.globalAlpha = usable ? 1.0 : 0.4;

      context.fillText(`${prefix}${skill.name}`, this.x + this.padding, drawY);

      context.fillText(
        `${skill.mpCost || 0} MP`,
        this.x + this.width - 110,
        drawY,
      );

      context.globalAlpha = 1.0;

      drawY += this.itemHeight;
    }

    // =====================================
    // CURRENT SKILL DETAILS
    // =====================================

    const skill = this.currentSkill();

    if (skill) {
      context.font = "18px sans-serif";

      context.fillText(
        `MP: ${$gameActor.mp} / ${$gameActor.maxMp}`,
        this.x + 24,
        this.y + this.height - 95,
      );

      context.fillText(
        skill.description || "",
        this.x + 24,
        this.y + this.height - 60,
      );

      context.fillText(
        `Category: ${skill.category || "other"}`,
        this.x + 24,
        this.y + this.height - 30,
      );
    }
    context.restore();
  }
}
