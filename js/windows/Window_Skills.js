"use strict";

class Window_Skills {
  constructor(source) {
    this.actorNavigation = new Window_ActorNavigator(source);
    this.visible = false;
    this.index = 0;

    this.width = 500;
    this.height = 420;
    this.padding = 24;
    this.itemHeight = 40;
    this.listViewport = new Window_ListViewport(5);

    this.x = (Graphics.width - this.width) / 2;
    this.y = (Graphics.height - this.height) / 2;
  }

  get actor() {
    return this.actorNavigation.actor();
  }

  skillList() {
    if (!this.actor || typeof this.actor.knownSkills !== "function") {
      return [];
    }

    return this.actor.knownSkills().filter((skill) => skill?.type === "skill");
  }

  currentSkill() {
    return this.skillList()[this.index] || null;
  }

  skillLabel(skill) {
    return skill?.valorArt === true
      ? `[VALOR] ${skill.name}`
      : skill?.name || "";
  }

  skillCategoryLabel(skill) {
    return skill?.valorArt === true ? "Valor Art" : skill?.category || "other";
  }

  onActorChanged() {
    this.index = 0;
    this.listViewport.reset(this.index, this.skillList().length);
  }

  update() {
    if (!this.visible) {
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

  show() {
    this.visible = true;
    this.index = 0;
    this.listViewport.reset(this.index, this.skillList().length);
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
    context.font = "16px sans-serif";
    context.textAlign = "right";

    if (this.listViewport.hasPrevious()) {
      context.fillText("▲", this.x + this.width - 8, this.y + 105);
    }

    if (this.listViewport.hasNext(totalEntries)) {
      context.fillText("▼", this.x + this.width - 8, this.y + 285);
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
    context.fillStyle = "rgba(0, 0, 0, 0.95)";
    context.fillRect(this.x, this.y, this.width, this.height);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(this.x, this.y, this.width, this.height);

    this.actorNavigation.drawHeader(
      context,
      "SKILL",
      this.x,
      this.y,
      this.width,
      this.padding,
    );

    context.fillStyle = "#ffffff";
    context.font = "22px sans-serif";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    if (skills.length === 0) {
      context.fillText("(No skills)", this.x + this.padding, this.y + 105);
      context.restore();
      return;
    }

    const range = this.listViewport.visibleRange(this.index, skills.length);
    let drawY = this.y + 105;

    for (let i = range.start; i < range.end; i++) {
      const skill = skills[i];
      const prefix = i === this.index ? "▶ " : "   ";
      context.fillText(`${prefix}${this.skillLabel(skill)}`, this.x + this.padding, drawY);
      drawY += this.itemHeight;
    }

    this.drawScrollIndicators(context, skills.length);

    const skill = this.currentSkill();

    if (skill) {
      const dividerY = this.y + 295;
      const detailX = this.x + this.padding;
      const detailWidth = this.width - this.padding * 2;

      context.beginPath();
      context.moveTo(detailX, dividerY);
      context.lineTo(this.x + this.width - this.padding, dividerY);
      context.stroke();

      context.font = "18px sans-serif";
      Window_TextLayout.drawWrappedText(
        context,
        skill.description || "",
        detailX,
        dividerY + 30,
        detailWidth,
        22,
        3,
      );
      context.fillText(
        `Category: ${this.skillCategoryLabel(skill)}`,
        detailX,
        this.y + this.height - 13,
      );
    }

    context.restore();
  }
}
