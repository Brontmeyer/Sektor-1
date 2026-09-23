"use strict";

class Window_Valor {
  constructor(source) {
    this.actorNavigation = new Window_ActorNavigator(source);
    this.visible = false;
    this.index = 0;
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
    const infoWidth = Math.max(260, Math.min(326, Math.floor(totalWidth * 0.255)));

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
    this.progressionBounds = {
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
  }

  directionRepeated(action) {
    return typeof Input.isActionRepeated === "function"
      ? Input.isActionRepeated(action)
      : Input.isActionTriggered(action);
  }

  knownArts() {
    return this.actor?.knownValorArts?.() || [];
  }

  artsForLevel(level, arts = this.knownArts()) {
    return arts.filter(
      (art) => this.actor?.valorArtLevel?.(art) === level,
    );
  }

  currentArt(arts = this.knownArts()) {
    return arts[this.index] || null;
  }

  highestKnownLevel() {
    return Math.max(1, this.actor?.highestKnownValorLevel?.() || 0);
  }

  moveSelection(offset) {
    const arts = this.knownArts();

    if (arts.length <= 1) {
      this.index = 0;
      return false;
    }

    this.index = ((this.index + offset) % arts.length + arts.length) % arts.length;
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

    if (this.actorNavigation.update()) {
      this.onActorChanged();
      return;
    }

    if (this.directionRepeated("up")) {
      this.moveSelection(-1);
    } else if (this.directionRepeated("down")) {
      this.moveSelection(1);
    }
  }

  show() {
    this.visible = true;
    this.index = 0;
    this.refreshLayout();
  }

  hide() {
    this.visible = false;
  }

  isOpen() {
    return this.visible;
  }

  drawPanel(context, bounds, options = {}) {
    return Window_ActorSummary.drawPanel(context, bounds, options);
  }

  drawActorPanel(context) {
    Window_ActorSummary.draw(context, this.actor, this.actorBounds);
  }

  valorText() {
    const value = Math.round(Math.max(0, Number(this.actor?.valor) || 0) * 10) / 10;
    const maximum = Math.max(0, Number(this.actor?.maxValor) || 0);
    return this.actor?.isValorReady?.() === true ? "READY" : `${value} / ${maximum}`;
  }

  valorTextColor() {
    const ready = this.actor?.isValorReady?.() === true;

    if (typeof UIResourcePalette !== "undefined") {
      return UIResourcePalette.text("valor", { ready });
    }

    return ready ? "#f0a6ff" : "#d47cff";
  }

  valorValueColor() {
    return typeof UIResourcePalette !== "undefined"
      ? UIResourcePalette.valueText()
      : "#ffffff";
  }

  drawValorInfoPanel(context, arts) {
    const bounds = this.infoBounds;
    const actor = this.actor;
    const ready = actor?.isValorReady?.() === true;
    this.drawPanel(context, bounds);

    context.save();
    context.textBaseline = "alphabetic";
    context.textAlign = "center";
    context.fillStyle = "#ffffff";
    context.font = "600 22px sans-serif";
    context.fillText("VALOR", bounds.x + bounds.width / 2, bounds.y + 32);

    context.fillStyle = "#aebbd0";
    context.font = "13px sans-serif";
    context.fillText(
      `VALOR LEVEL ${this.highestKnownLevel()}`,
      bounds.x + bounds.width / 2,
      bounds.y + 54,
    );

    const labelX = bounds.x + 18;
    const valueX = bounds.x + bounds.width - 18;
    context.font = "14px sans-serif";
    context.textAlign = "left";
    context.fillStyle = this.valorTextColor();
    context.fillText("Valor", labelX, bounds.y + 84);
    context.textAlign = "right";
    context.fillStyle = this.valorValueColor();
    context.fillText(this.valorText(), valueX, bounds.y + 84);

    Window_ActorSummary.drawGauge(
      context,
      actor?.valor ?? 0,
      actor?.maxValor ?? 0,
      labelX,
      bounds.y + 92,
      bounds.width - 36,
      "valor",
    );

    context.textAlign = "left";
    context.fillStyle = "#aebbd0";
    context.fillText("Arts", labelX, bounds.y + 123);
    context.fillText("State", labelX, bounds.y + 148);
    context.textAlign = "right";
    context.fillStyle = "#ffffff";
    context.fillText(String(arts.length), valueX, bounds.y + 123);
    context.fillStyle = ready ? this.valorTextColor() : "#ffffff";
    context.fillText(ready ? "Ready" : "Building", valueX, bounds.y + 148);
    context.restore();
  }

  drawDescription(context, art) {
    const bounds = this.descriptionBounds;
    this.drawPanel(context, bounds, { assetAlpha: 0.46 });

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.font = "16px sans-serif";

    const text = art?.description || "No Valor Arts learned.";

    if (
      typeof Window_TextLayout !== "undefined" &&
      Window_TextLayout.drawWrappedText
    ) {
      Window_TextLayout.drawWrappedText(
        context,
        text,
        bounds.x + 18,
        bounds.y + 21,
        bounds.width - 36,
        18,
        2,
      );
    } else {
      context.fillText(text, bounds.x + 18, bounds.y + bounds.height / 2);
    }

    context.restore();
  }

  drawSelection(context, x, y, width, height) {
    const drawn =
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawSelectionPanel === "function" &&
      UIAssetManager.drawSelectionPanel(context, x, y, width, height, {
        alpha: 0.2,
      });

    if (!drawn) {
      context.fillStyle = "rgba(255, 215, 90, 0.1)";
      context.fillRect(x, y, width, height);
    }
  }

  drawLevelGroup(context, level, bounds, allArts, selectedArt) {
    const arts = this.artsForLevel(level, allArts);
    const headingY = bounds.y + 24;

    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#78f0d2";
    context.font = "600 18px sans-serif";
    context.fillText(`LEVEL ${level}`, bounds.x + 12, headingY);

    context.strokeStyle = "rgba(210, 222, 242, 0.28)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(bounds.x + 12, bounds.y + 42);
    context.lineTo(bounds.x + bounds.width - 12, bounds.y + 42);
    context.stroke();

    if (arts.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText("No Arts learned", bounds.x + 20, bounds.y + 72);
      return;
    }

    const availableHeight = Math.max(34, bounds.height - 58);
    const rowSpacing = Math.max(
      24,
      Math.min(34, Math.floor(availableHeight / Math.max(1, arts.length))),
    );
    const firstY = bounds.y + 70;

    arts.forEach((art, localIndex) => {
      const selected = selectedArt?.id === art?.id;
      const y = firstY + localIndex * rowSpacing;

      if (selected) {
        this.drawSelection(
          context,
          bounds.x + 12,
          y - 14,
          bounds.width - 24,
          28,
        );
      }

      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.font = selected ? "600 17px sans-serif" : "17px sans-serif";
      context.fillText(
        `${selected ? "▶ " : "  "}${art.name}`,
        bounds.x + 20,
        y,
      );
    });
  }

  drawProgression(context, arts, selectedArt) {
    const bounds = this.progressionBounds;
    const footerHeight = 38;
    const contentTop = bounds.y + 14;
    const contentBottom = bounds.y + bounds.height - footerHeight;
    const contentHeight = Math.max(0, contentBottom - contentTop);
    const gap = 12;
    const columnWidth = (bounds.width - 36 - gap) / 2;
    const rowHeight = (contentHeight - 20 - gap) / 2;
    const leftX = bounds.x + 18;
    const rightX = leftX + columnWidth + gap;
    const topY = contentTop + 4;
    const bottomY = topY + rowHeight + gap;

    this.drawPanel(context, bounds);

    context.save();
    const groups = [
      { level: 1, x: leftX, y: topY },
      { level: 2, x: rightX, y: topY },
      { level: 3, x: leftX, y: bottomY },
      { level: 4, x: rightX, y: bottomY },
    ];

    for (const group of groups) {
      this.drawLevelGroup(
        context,
        group.level,
        {
          x: group.x,
          y: group.y,
          width: columnWidth,
          height: rowHeight,
        },
        arts,
        selectedArt,
      );
    }

    context.strokeStyle = "rgba(210, 222, 242, 0.34)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(bounds.x + 20, contentBottom);
    context.lineTo(bounds.x + bounds.width - 20, contentBottom);
    context.stroke();

    context.fillStyle = "#aebbd0";
    context.font = "13px sans-serif";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(
      `${Input.actionLabel("left")}/${Input.actionLabel("right")}: Actor   ` +
        `${Input.actionLabel("up")}/${Input.actionLabel("down")}: Art   ` +
        `${Input.actionLabel("cancel")}: Back`,
      bounds.x + 18,
      contentBottom + footerHeight / 2,
    );
    context.restore();
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    context.save();
    context.fillStyle = "#0b0e13";
    context.fillRect(0, 0, Graphics.width, Graphics.height);

    const arts = this.knownArts();
    const selectedArt = this.currentArt(arts);

    this.drawActorPanel(context);
    this.drawValorInfoPanel(context, arts);
    this.drawDescription(context, selectedArt);
    this.drawProgression(context, arts, selectedArt);

    context.restore();
  }
}
