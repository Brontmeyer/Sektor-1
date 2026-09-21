"use strict";

class Window_BattleSkills {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this.index = 0;

    this.width = 360;
    this.height = 260;

    this.padding = 20;
    this.lineHeight = 40;
    this.listViewport = new Window_ListViewport(5);

    this.x = 290;
    this.y = Graphics.height - this.height - 40;
  }

  actor() {
    return this.scene?.partyController?.currentBattler() || $gameParty.battleLeader();
  }

  skillList() {
    const actor = this.actor();

    if (!actor || typeof actor.knownSkills !== "function") {
      return [];
    }

    return actor.knownSkills().filter((skill) => skill?.type === "skill");
  }

  currentSkill() {
    return this.skillList()[this.index] || null;
  }

  skillLabel(skill) {
    return skill?.valorArt === true
      ? `[VALOR] ${skill.name}`
      : skill?.name || "";
  }

  update() {
    if (!this.visible) {
      return;
    }

    const skills = this.skillList();

    if (skills.length === 0) {
      return;
    }

    if (Input.isActionTriggered("up")) {
      this.index = (this.index - 1 + skills.length) % skills.length;
    }

    if (Input.isActionTriggered("down")) {
      this.index = (this.index + 1) % skills.length;
    }

    this.listViewport.ensureVisible(this.index, skills.length);
  }

  show({ preserveIndex = false } = {}) {
    const entries = this.skillList();

    this.visible = true;

    if (!preserveIndex) {
      this.index = 0;
      this.listViewport.reset(this.index, entries.length);
      return;
    }

    this.index = Math.max(
      0,
      Math.min(this.index, Math.max(0, entries.length - 1)),
    );
    this.listViewport.ensureVisible(this.index, entries.length);
  }

  hide() {
    this.visible = false;
  }

  isOpen() {
    return this.visible;
  }

  drawScrollIndicators(context, totalEntries) {
    context.save();
    context.fillStyle = "#ffffff";
    context.font = "16px Arial";
    context.textAlign = "right";

    if (this.listViewport.hasPrevious()) {
      context.fillText("▲", this.x + this.width - 8, this.y + 76);
    }

    if (this.listViewport.hasNext(totalEntries)) {
      context.fillText("▼", this.x + this.width - 8, this.y + this.height - 10);
    }

    context.restore();
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    const skills = this.skillList();

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
    context.fillText("Skills", this.x + this.padding, this.y + 30);

    if (skills.length === 0) {
      context.fillText("(No skills)", this.x + this.padding, this.y + 80);
      context.restore();
      return;
    }

    const range = this.listViewport.visibleRange(this.index, skills.length);

    for (let i = range.start; i < range.end; i++) {
      const skill = skills[i];
      const prefix = i === this.index ? "▶ " : "   ";
      const row = i - range.start;
      const drawY = this.y + 75 + row * this.lineHeight;
      const usable = this.actor().canUseSkill(skill.id);

      context.globalAlpha = usable ? 1 : 0.4;
      context.fillText(`${prefix}${this.skillLabel(skill)}`, this.x + this.padding, drawY);
      context.globalAlpha = 1;
    }

    this.drawScrollIndicators(context, skills.length);
    context.restore();
  }
}
