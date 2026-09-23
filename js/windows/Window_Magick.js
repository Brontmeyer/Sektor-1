"use strict";

class Window_Magick {
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

  changeActor(offset) {
    if (!this.actorNavigation.changeActor(offset)) {
      return false;
    }

    this.onActorChanged();
    return true;
  }

  magickList() {
    const magick = this.actor
      ?.knownMagick?.()
      ?.filter((entry) => entry?.type === "magick") || [];

    return typeof ConfigManager === "undefined"
      ? magick
      : ConfigManager.sortMagick(magick);
  }

  currentMagick() {
    return this.magickList()[this.index] || null;
  }

  rowCount(totalEntries = this.magickList().length) {
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

    const magickList = this.magickList();

    if (magickList.length === 0) {
      return;
    }

    if (this.directionRepeated("up")) {
      this.moveVertical(-1, magickList.length);
    } else if (this.directionRepeated("down")) {
      this.moveVertical(1, magickList.length);
    } else if (this.directionRepeated("left")) {
      this.moveHorizontal(-1, magickList.length);
    } else if (this.directionRepeated("right")) {
      this.moveHorizontal(1, magickList.length);
    }

    if (Input.isActionTriggered("confirm")) {
      const currentMagick = this.currentMagick();

      if (!currentMagick) {
        return;
      }

      if (!this.canUseFromField(currentMagick)) {
        DebugManager.log(`${currentMagick.name} cannot be used from the field menu.`);
        return;
      }

      this.actor.useMagick(currentMagick.id, this.actor);
    }
  }

  canUseFromField(magick) {
    if (!magick || !this.actor) {
      return false;
    }

    const canTargetPlayer =
      Array.isArray(magick.target) &&
      (magick.target.includes("ally") || magick.target.includes("self"));
    const isFieldEffect = magick.effect === "heal";

    return canTargetPlayer && isFieldEffect && this.actor.canUseMagick(magick.id);
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

  drawActorPanel(context) {
    Window_ActorSummary.draw(context, this.actor, this.actorBounds);
  }

  titleCase(value, fallback = "--") {
    const text = String(value || "").trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : fallback;
  }

  scopeLabel(magick) {
    const scope = Array.isArray(magick?.scope) ? magick.scope : [];

    if (scope.includes("single") && scope.includes("all")) {
      return "Single / All";
    }

    return scope.length > 0 ? scope.map((entry) => this.titleCase(entry)).join(" / ") : "--";
  }

  drawMagickInfoPanel(context) {
    const bounds = this.infoBounds;
    const magick = this.currentMagick();
    this.drawPanel(context, bounds);

    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#ffffff";
    context.font = "600 22px sans-serif";
    context.fillText("MAGICK", bounds.x + bounds.width / 2, bounds.y + 34);

    context.textAlign = "left";
    context.font = "14px sans-serif";
    context.fillStyle = "#aebbd0";
    context.fillText("Category", bounds.x + 18, bounds.y + 64);
    context.fillText("Element", bounds.x + 18, bounds.y + 87);
    context.fillText("Scope", bounds.x + 18, bounds.y + 110);

    context.textAlign = "right";
    context.fillStyle = "#ffffff";
    context.fillText(this.titleCase(magick?.category), bounds.x + bounds.width - 18, bounds.y + 64);
    context.fillText(this.titleCase(magick?.element), bounds.x + bounds.width - 18, bounds.y + 87);
    context.fillText(this.scopeLabel(magick), bounds.x + bounds.width - 18, bounds.y + 110);

    context.textAlign = "center";
    context.fillStyle = "#cbd5e3";
    context.font = "600 14px sans-serif";
    context.fillText("MP NEEDED", bounds.x + bounds.width / 2, bounds.y + 136);
    context.fillStyle = "#ffffff";
    context.font = "600 20px sans-serif";
    context.fillText(
      String(Math.max(0, Number(magick?.mpCost) || 0)).padStart(3, "0"),
      bounds.x + bounds.width / 2,
      bounds.y + 160,
    );
  }

  drawDescription(context) {
    const bounds = this.descriptionBounds;
    const magick = this.currentMagick();
    this.drawPanel(context, bounds, { assetAlpha: 0.46 });

    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.font = "16px sans-serif";

    if (typeof Window_TextLayout !== "undefined" && Window_TextLayout.drawWrappedText) {
      Window_TextLayout.drawWrappedText(
        context,
        magick?.description || "No Magick selected.",
        bounds.x + 18,
        bounds.y + 21,
        bounds.width - 36,
        18,
        2,
      );
    } else {
      context.fillText(
        magick?.description || "No Magick selected.",
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
    const magickList = this.magickList();
    const totalRows = this.rowCount(magickList.length);
    const range = this.listViewport.visibleRange(this.selectedRow(), totalRows);
    this.drawPanel(context, bounds);

    if (magickList.length === 0) {
      context.fillStyle = "#ffffff";
      context.font = "18px sans-serif";
      context.textAlign = "left";
      context.fillText("(No Magick learned)", bounds.x + 24, bounds.y + 42);
      return;
    }

    const horizontalPadding = 24;
    const columnGap = 16;
    const contentWidth = bounds.width - horizontalPadding * 2 - 28;
    const columnWidth = (contentWidth - columnGap * (this.columns - 1)) / this.columns;
    const firstY = bounds.y + 42;

    context.textBaseline = "middle";
    context.font = "18px sans-serif";

    for (let row = range.start; row < range.end; row++) {
      const visibleRow = row - range.start;
      const drawY = firstY + visibleRow * this.rowHeight;

      for (let column = 0; column < this.columns; column++) {
        const index = row * this.columns + column;

        if (index >= magickList.length) {
          continue;
        }

        const magick = magickList[index];
        const selected = index === this.index;
        const usable = this.canUseFromField(magick);
        const columnX = bounds.x + horizontalPadding + column * (columnWidth + columnGap);

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

        context.globalAlpha = usable ? 1 : 0.46;
        context.fillStyle = selected ? "#ffd75a" : "#ffffff";
        context.textAlign = "left";
        context.fillText(`${selected ? "▶ " : "  "}${magick.name}`, columnX, drawY);
        context.globalAlpha = 1;
      }
    }

    this.drawScrollIndicators(context, totalRows);

    context.fillStyle = "#aebbd0";
    context.font = "13px sans-serif";
    context.textAlign = "right";
    context.fillText(
      `${Input.actionLabel("up")}/${Input.actionLabel("down")}/${Input.actionLabel("left")}/${Input.actionLabel("right")}: Choose   ` +
        `${Input.actionLabel("confirm")}: Use   ${Input.actionLabel("cancel")}: Back`,
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
    this.drawMagickInfoPanel(context);
    this.drawDescription(context);
    this.drawList(context);

    context.restore();
  }
}
