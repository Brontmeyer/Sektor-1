"use strict";

class Window_BattleSkills {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this.index = 0;
    this.mode = "skills";

    this.width = 360;
    this.height = 156;

    this.padding = 14;
    this.lineHeight = 32;
    this.listViewport = new Window_ListViewport(4);

    this.x = 290;
    this.y = Graphics.height - this.height - 40;
    this.refreshLayout();
  }

  refreshLayout() {
    const command = this.scene?.hudLayout?.commandBounds?.() || null;

    if (!command) {
      return false;
    }

    if (this.mode === "surge") {
      const count = Math.max(1, Math.min(2, this.skillList().length || 1));
      this.width = command.width;
      this.lineHeight = 34;
      this.padding = 14;
      this.height = 54 + count * this.lineHeight + 10;
      this.x = command.x;
      this.y = Math.max(10, command.y - this.height);
      return true;
    }

    const bounds = this.scene?.hudLayout?.selectorBounds?.() || null;

    this.width = bounds?.width || 360;
    this.height = bounds?.height || command.height;
    this.lineHeight = 32;
    this.padding = 14;
    this.x = bounds?.x ?? command.x + command.width;
    this.y = bounds?.y ?? command.y;
    return true;
  }

  actor() {
    return this.scene?.partyController?.currentBattler() || $gameParty.battleLeader();
  }

  skillList() {
    const actor = this.actor();

    if (!actor || typeof actor.knownSkills !== "function") {
      return [];
    }

    if (this.mode === "surge") {
      return typeof actor.selectedValorArts === "function"
        ? actor.selectedValorArts()
        : [];
    }

    return actor.knownSkills().filter((skill) => skill?.type === "skill");
  }

  currentSkill() {
    return this.skillList()[this.index] || null;
  }

  currentDescription() {
    const entry = this.currentSkill();
    return typeof entry?.description === "string" ? entry.description.trim() : "";
  }

  skillLabel(skill) {
    return skill?.name || "";
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
      this.index = Math.max(0, this.index - 1);
    }

    if (Input.isActionTriggered("down")) {
      this.index = Math.min(skills.length - 1, this.index + 1);
    }

    if (this.mode !== "surge" && Input.isActionTriggered("left")) {
      this.index = this.listViewport.pageSelection(this.index, -1, skills.length);
    }

    if (this.mode !== "surge" && Input.isActionTriggered("right")) {
      this.index = this.listViewport.pageSelection(this.index, 1, skills.length);
    }

    this.listViewport.ensureVisible(this.index, skills.length);
  }

  show({ preserveIndex = false, mode = null } = {}) {
    const nextMode = mode === "surge" ? "surge" : mode === "skills" ? "skills" : this.mode;
    const modeChanged = nextMode !== this.mode;
    this.mode = nextMode;
    const entries = this.skillList();

    this.visible = true;
    this.refreshLayout();

    if (modeChanged) {
      preserveIndex = false;
    }

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
      context.fillText("▲", this.x + this.width - 8, this.y + 14);
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
    this.refreshLayout();

    context.save();

    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      UIAssetManager.drawPanel(
        context,
        "battlePanel",
        this.x,
        this.y,
        this.width,
        this.height,
        {
          fallbackFill: "rgba(7, 10, 15, 0.84)",
          fallbackStroke: "rgba(151, 196, 229, 0.6)",
          lineWidth: 1.5,
          assetAlpha: 0.38,
          sourceMargin: 12,
          destMargin: 10,
        },
      );
    } else {
      context.fillStyle = "rgba(7, 10, 15, 0.84)";
      context.fillRect(this.x, this.y, this.width, this.height);
      context.strokeStyle = "rgba(151, 196, 229, 0.6)";
      context.lineWidth = 1.5;
      context.strokeRect(this.x, this.y, this.width, this.height);
    }

    context.textAlign = "left";
    context.textBaseline = "middle";
    context.font = "19px Arial";
    context.fillStyle = "#ffffff";
    if (this.mode === "surge") {
      context.fillText(
        `Surge · Level ${this.actor()?.selectedValorLevel?.() || 1}`,
        this.x + this.padding,
        this.y + 24,
      );
    }

    if (skills.length === 0) {
      context.fillText(
        this.mode === "surge" ? "(No Arts at set level)" : "(No skills)",
        this.x + this.padding,
        this.mode === "surge" ? this.y + 62 : this.y + 28,
      );
      context.restore();
      return;
    }

    const range = this.listViewport.visibleRange(this.index, skills.length);

    for (let i = range.start; i < range.end; i++) {
      const skill = skills[i];
      const prefix = i === this.index ? "▶ " : "   ";
      const row = i - range.start;
      const listStartY = this.mode === "surge" ? this.y + 58 : this.y + 24;
      const drawY = listStartY + row * this.lineHeight;
      const selected = i === this.index;
      const usable = this.mode === "surge"
        ? this.actor().canUseValorArt?.(skill.id) === true
        : this.actor().canUseSkill(skill.id);

      if (selected) {
        const drawn =
          typeof UIAssetManager !== "undefined" &&
          typeof UIAssetManager.drawSelectionPanel === "function" &&
          UIAssetManager.drawSelectionPanel(
            context,
            this.x + 10,
            drawY - this.lineHeight / 2 + 4,
            this.width - 20,
            this.lineHeight - 8,
            { alpha: 0.18 },
          );

        if (!drawn) {
          context.fillStyle = "rgba(255, 215, 90, 0.08)";
          context.fillRect(
            this.x + 10,
            drawY - this.lineHeight / 2 + 4,
            this.width - 20,
            this.lineHeight - 8,
          );
        }
      }

      context.globalAlpha = usable ? 1 : 0.4;
      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.fillText(`${prefix}${this.skillLabel(skill)}`, this.x + this.padding, drawY);
      context.globalAlpha = 1;
    }

    if (this.mode !== "surge") {
      this.drawScrollIndicators(context, skills.length);
    }
    context.restore();
  }
}
