"use strict";

class Window_Skills {
  constructor(source) {
    this.actorNavigation = new Window_ActorNavigator(source);
    this.visible = false;
    this.index = 0;

    this.columns = 3;
    this.visibleRows = 7;
    this.rowHeight = 42;
    this.listViewport = new Window_ListViewport(this.visibleRows);

    this.refreshLayout();
  }

  get actor() {
    return this.actorNavigation.actor();
  }

  refreshLayout() {
    const margin = Math.max(12, Math.min(22, Math.floor(Graphics.width * 0.014)));
    const gap = 8;
    const totalWidth = Graphics.width - margin * 2;
    const totalHeight = Graphics.height - margin * 2;
    const headerHeight = Math.max(150, Math.min(174, Math.floor(totalHeight * 0.245)));
    const descriptionHeight = 56;
    const infoWidth = Math.max(240, Math.min(310, Math.floor(totalWidth * 0.245)));

    this.x = margin;
    this.y = margin;
    this.width = totalWidth;
    this.height = totalHeight;

    this.actorBounds = {
      x: this.x,
      y: this.y,
      width: this.width - infoWidth - gap,
      height: headerHeight,
    };
    this.infoBounds = {
      x: this.actorBounds.x + this.actorBounds.width + gap,
      y: this.y,
      width: infoWidth,
      height: headerHeight,
    };
    this.descriptionBounds = {
      x: this.x,
      y: this.y + headerHeight + gap,
      width: this.width,
      height: descriptionHeight,
    };
    this.listBounds = {
      x: this.x,
      y: this.descriptionBounds.y + descriptionHeight + gap,
      width: this.width,
      height:
        this.y + this.height -
        (this.descriptionBounds.y + descriptionHeight + gap),
    };
  }

  onActorChanged() {
    this.index = 0;
    this.resetViewport();
  }

  skillList() {
    if (!this.actor || typeof this.actor.knownSkills !== "function") {
      return [];
    }

    // The player-facing Skill menu is now the home for ordinary techniques.
    // Valor Arts keep using the shared Skill runtime, but their field
    // presentation belongs to the dedicated Valor destination planned later.
    return this.actor
      .knownSkills()
      .filter((skill) => skill?.type === "skill" && skill?.valorArt !== true);
  }

  currentSkill() {
    return this.skillList()[this.index] || null;
  }

  rowCount(totalEntries = this.skillList().length) {
    return Math.ceil(Math.max(0, Number(totalEntries) || 0) / this.columns);
  }

  selectedRow() {
    return Math.floor(this.index / this.columns);
  }

  resetViewport() {
    this.listViewport.reset(this.selectedRow(), this.rowCount());
  }

  ensureSelectionVisible() {
    this.listViewport.ensureVisible(this.selectedRow(), this.rowCount());
  }

  directionRepeated(action) {
    return typeof Input.isActionRepeated === "function"
      ? Input.isActionRepeated(action)
      : Input.isActionTriggered(action);
  }

  moveHorizontal(direction, totalEntries) {
    const total = Math.max(0, Number(totalEntries) || 0);

    if (total <= 0) {
      return false;
    }

    const row = Math.floor(this.index / this.columns);
    const column = this.index % this.columns;
    const nextColumn = column + (direction < 0 ? -1 : 1);

    if (nextColumn < 0 || nextColumn >= this.columns) {
      return false;
    }

    const nextIndex = row * this.columns + nextColumn;

    if (nextIndex < 0 || nextIndex >= total) {
      return false;
    }

    this.index = nextIndex;
    this.ensureSelectionVisible();
    return true;
  }

  moveVertical(direction, totalEntries) {
    const total = Math.max(0, Number(totalEntries) || 0);
    const rows = this.rowCount(total);

    if (total <= 0 || rows <= 0) {
      return false;
    }

    const row = Math.floor(this.index / this.columns);
    const column = this.index % this.columns;
    const nextRow = row + (direction < 0 ? -1 : 1);

    if (nextRow < 0 || nextRow >= rows) {
      return false;
    }

    this.index = Math.min(nextRow * this.columns + column, total - 1);
    this.ensureSelectionVisible();
    return true;
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (Input.isActionTriggered("cancel")) {
      this.hide();
      return;
    }

    const skills = this.skillList();

    if (skills.length === 0) {
      return;
    }

    if (this.directionRepeated("up")) {
      this.moveVertical(-1, skills.length);
    } else if (this.directionRepeated("down")) {
      this.moveVertical(1, skills.length);
    } else if (this.directionRepeated("left")) {
      this.moveHorizontal(-1, skills.length);
    } else if (this.directionRepeated("right")) {
      this.moveHorizontal(1, skills.length);
    }
  }

  show() {
    this.visible = true;
    this.index = 0;
    this.refreshLayout();
    this.resetViewport();
  }

  hide() {
    this.visible = false;
  }

  isOpen() {
    return this.visible;
  }

  drawPanel(context, bounds, options = {}) {
    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      return UIAssetManager.drawPanel(
        context,
        "menuPanel",
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        {
          fallbackFill: "rgba(11, 16, 28, 0.96)",
          fallbackStroke: "rgba(150, 176, 220, 0.78)",
          lineWidth: 1.5,
          assetAlpha: 0.54,
          sourceMargin: 12,
          destMargin: 12,
          ...options,
        },
      );
    }

    context.fillStyle = options.fallbackFill || "rgba(11, 16, 28, 0.96)";
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle = options.fallbackStroke || "rgba(150, 176, 220, 0.78)";
    context.lineWidth = 1.5;
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    return false;
  }

  drawPortraitPlaceholder(context, x, y, size) {
    const initial =
      String(this.actor?.name || "?").trim().charAt(0).toUpperCase() || "?";

    context.fillStyle = "rgba(12, 23, 45, 0.94)";
    context.fillRect(x, y, size, size);
    context.strokeStyle = "rgba(137, 182, 235, 0.85)";
    context.lineWidth = 1.5;
    context.strokeRect(x, y, size, size);
    context.fillStyle = "#f3f7fc";
    context.font = `600 ${Math.max(28, Math.floor(size * 0.4))}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(initial, x + size / 2, y + size / 2);
  }

  resourceText(resource) {
    return typeof UIResourcePalette !== "undefined"
      ? UIResourcePalette.text(resource)
      : resource === "hp"
        ? "#66d7ff"
        : "#78ef91";
  }

  resourceFill(resource) {
    if (
      typeof UIResourcePalette !== "undefined" &&
      typeof UIResourcePalette.fill === "function"
    ) {
      return UIResourcePalette.fill(resource);
    }

    return resource === "hp" ? "#35baf3" : "#55d872";
  }

  valueText() {
    return typeof UIResourcePalette !== "undefined"
      ? UIResourcePalette.valueText()
      : "#ffffff";
  }

  drawGauge(context, value, maximum, x, y, width, resource) {
    const color = this.resourceFill(resource);

    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawGauge === "function"
    ) {
      UIAssetManager.drawGauge(context, value, maximum, x, y, width, 8, color);
      return;
    }

    const max = Math.max(1, Number(maximum) || 1);
    const current = Math.max(0, Number(value) || 0);
    const rate = Math.max(0, Math.min(1, current / max));
    context.fillStyle = "rgba(11, 15, 23, 0.92)";
    context.fillRect(x, y, width, 8);
    context.fillStyle = color;
    context.fillRect(x + 1, y + 1, Math.max(0, (width - 2) * rate), 6);
  }

  drawActorPanel(context) {
    const bounds = this.actorBounds;
    const actor = this.actor;
    this.drawPanel(context, bounds);

    const portraitSize = Math.min(104, bounds.height - 34);
    const portraitX = bounds.x + 18;
    const portraitY = bounds.y + (bounds.height - portraitSize) / 2;
    this.drawPortraitPlaceholder(context, portraitX, portraitY, portraitSize);

    const infoX = portraitX + portraitSize + 20;
    const nameY = bounds.y + 43;

    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#ffffff";
    context.font = "600 22px sans-serif";
    context.fillText(actor?.name || "Unknown", infoX, nameY);

    const levelY = nameY + 25;
    context.fillStyle = "#ffd75a";
    context.font = "600 16px sans-serif";
    context.fillText("LV", infoX, levelY);
    context.fillStyle = this.valueText();
    context.fillText(String(actor?.level ?? "?"), infoX + 28, levelY);

    const statsX = infoX + 155;
    const statGap = 18;
    const availableWidth = Math.max(260, bounds.x + bounds.width - statsX - 24);
    const statWidth = Math.max(120, Math.min(170, (availableWidth - statGap) / 2));
    const statY = bounds.y + 62;
    const gaugeY = statY + 9;

    context.font = "600 15px sans-serif";

    const stats = [
      {
        label: "HP",
        resource: "hp",
        value: actor?.hp ?? 0,
        maximum: actor?.maxHp ?? 0,
        x: statsX,
      },
      {
        label: "MP",
        resource: "mp",
        value: actor?.mp ?? 0,
        maximum: actor?.maxMp ?? 0,
        x: statsX + statWidth + statGap,
      },
    ];

    for (const stat of stats) {
      context.fillStyle = this.resourceText(stat.resource);
      context.fillText(stat.label, stat.x, statY);
      context.fillStyle = this.valueText();
      context.fillText(
        `${Math.floor(Math.max(0, Number(stat.value) || 0))}/${Math.floor(
          Math.max(0, Number(stat.maximum) || 0),
        )}`,
        stat.x + 28,
        statY,
      );
      this.drawGauge(
        context,
        stat.value,
        stat.maximum,
        stat.x,
        gaugeY,
        statWidth,
        stat.resource,
      );
    }
  }

  titleCase(value, fallback = "--") {
    const text = String(value || "").trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : fallback;
  }

  listLabel(value, fallback = "--") {
    const entries = Array.isArray(value) ? value : [];

    if (entries.length === 0) {
      return fallback;
    }

    return entries.map((entry) => this.titleCase(entry)).join(" / ");
  }

  scopeLabel(skill) {
    const scope = Array.isArray(skill?.scope) ? skill.scope : [];

    if (scope.includes("single") && scope.includes("all")) {
      return "Single / All";
    }

    return this.listLabel(scope);
  }

  drawSkillInfoPanel(context) {
    const bounds = this.infoBounds;
    const skill = this.currentSkill();
    this.drawPanel(context, bounds);

    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#ffffff";
    context.font = "600 22px sans-serif";
    context.fillText("SKILL", bounds.x + bounds.width / 2, bounds.y + 34);

    const labels = ["Category", "Effect", "Target", "Scope"];
    const values = [
      this.titleCase(skill?.category),
      this.titleCase(skill?.effect),
      this.listLabel(skill?.target),
      this.scopeLabel(skill),
    ];

    context.font = "14px sans-serif";

    labels.forEach((label, index) => {
      const rowY = bounds.y + 66 + index * 24;
      context.textAlign = "left";
      context.fillStyle = "#aebbd0";
      context.fillText(label, bounds.x + 18, rowY);
      context.textAlign = "right";
      context.fillStyle = "#ffffff";
      context.fillText(values[index], bounds.x + bounds.width - 18, rowY);
    });
  }

  drawDescription(context) {
    const bounds = this.descriptionBounds;
    const skill = this.currentSkill();
    this.drawPanel(context, bounds, { assetAlpha: 0.46 });

    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.font = "16px sans-serif";

    if (
      typeof Window_TextLayout !== "undefined" &&
      Window_TextLayout.drawWrappedText
    ) {
      Window_TextLayout.drawWrappedText(
        context,
        skill?.description || "No Skill selected.",
        bounds.x + 18,
        bounds.y + 21,
        bounds.width - 36,
        18,
        2,
      );
    } else {
      context.fillText(
        skill?.description || "No Skill selected.",
        bounds.x + 18,
        bounds.y + bounds.height / 2,
      );
    }
  }

  drawScrollIndicators(context, totalRows) {
    const bounds = this.listBounds;
    const arrowX = bounds.x + bounds.width - 18;

    context.save();
    context.fillStyle = "#ffffff";
    context.font = "17px sans-serif";
    context.textAlign = "center";

    if (this.listViewport.hasPrevious()) {
      context.fillText("▲", arrowX, bounds.y + 24);
    }

    if (this.listViewport.hasNext(totalRows)) {
      context.fillText("▼", arrowX, bounds.y + bounds.height - 44);
    }

    context.restore();
  }

  drawList(context) {
    const bounds = this.listBounds;
    const skills = this.skillList();
    const totalRows = this.rowCount(skills.length);
    const range = this.listViewport.visibleRange(this.selectedRow(), totalRows);
    this.drawPanel(context, bounds);

    if (skills.length === 0) {
      context.fillStyle = "#ffffff";
      context.font = "18px sans-serif";
      context.textAlign = "left";
      context.fillText("(No Skills learned)", bounds.x + 24, bounds.y + 42);
      return;
    }

    const horizontalPadding = 24;
    const columnGap = 16;
    const contentWidth = bounds.width - horizontalPadding * 2 - 28;
    const columnWidth =
      (contentWidth - columnGap * (this.columns - 1)) / this.columns;
    const firstY = bounds.y + 42;

    context.textBaseline = "middle";
    context.font = "18px sans-serif";

    for (let row = range.start; row < range.end; row++) {
      const visibleRow = row - range.start;
      const drawY = firstY + visibleRow * this.rowHeight;

      for (let column = 0; column < this.columns; column++) {
        const index = row * this.columns + column;

        if (index >= skills.length) {
          continue;
        }

        const skill = skills[index];
        const selected = index === this.index;
        const columnX =
          bounds.x + horizontalPadding + column * (columnWidth + columnGap);

        if (selected) {
          const drawn =
            typeof UIAssetManager !== "undefined" &&
            typeof UIAssetManager.drawSelectionPanel === "function" &&
            UIAssetManager.drawSelectionPanel(
              context,
              columnX - 7,
              drawY - this.rowHeight / 2 + 4,
              columnWidth + 2,
              this.rowHeight - 8,
              { alpha: 0.2 },
            );

          if (!drawn) {
            context.fillStyle = "rgba(255, 215, 90, 0.1)";
            context.fillRect(
              columnX - 7,
              drawY - this.rowHeight / 2 + 4,
              columnWidth + 2,
              this.rowHeight - 8,
            );
          }
        }

        context.fillStyle = selected ? "#ffd75a" : "#ffffff";
        context.textAlign = "left";
        context.fillText(
          `${selected ? "▶ " : "  "}${skill.name}`,
          columnX,
          drawY,
        );
      }
    }

    this.drawScrollIndicators(context, totalRows);

    context.fillStyle = "#aebbd0";
    context.font = "13px sans-serif";
    context.textAlign = "right";
    context.fillText(
      `${Input.actionLabel("up")}/${Input.actionLabel("down")}/${Input.actionLabel("left")}/${Input.actionLabel("right")}: Choose   ` +
        `${Input.actionLabel("cancel")}: Back`,
      bounds.x + bounds.width - 28,
      bounds.y + bounds.height - 14,
    );
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    context.save();
    context.fillStyle = "#0b0e13";
    context.fillRect(0, 0, Graphics.width, Graphics.height);

    this.drawActorPanel(context);
    this.drawSkillInfoPanel(context);
    this.drawDescription(context);
    this.drawList(context);

    context.restore();
  }
}
