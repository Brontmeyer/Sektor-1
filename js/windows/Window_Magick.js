"use strict";

class Window_Magick {
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

  onActorChanged() {
    this.index = 0;
    this.listViewport.reset(this.index, this.magickList().length);
  }

  changeActor(offset) {
    if (!this.actorNavigation.changeActor(offset)) {
      return false;
    }

    this.onActorChanged();
    return true;
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (Input.isTriggered("Escape") || Input.isTriggered("KeyQ")) {
      this.hide();
      return;
    }

    if (this.actorNavigation.update()) {
      this.onActorChanged();
      return;
    }

    const magickList = this.magickList();

    if (magickList.length === 0) {
      return;
    }

    if (Input.isTriggered("ArrowUp") || Input.isTriggered("KeyW")) {
      this.index--;

      if (this.index < 0) {
        this.index = magickList.length - 1;
      }
    }

    if (Input.isTriggered("ArrowDown") || Input.isTriggered("KeyS")) {
      this.index++;

      if (this.index >= magickList.length) {
        this.index = 0;
      }
    }

    this.listViewport.ensureVisible(this.index, magickList.length);

    if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
      const currentMagick = this.currentMagick();

      if (!currentMagick) {
        return;
      }

      // Field menu currently only supports
      // magick that can target the player.
      if (!this.canUseFromField(currentMagick)) {
        DebugManager.log(`${currentMagick.name} cannot be used from the field menu.`);
        return;
      }

      this.actor.useMagick(currentMagick.id, this.actor);
    }
  }

  magickList() {
    return this.actor.knownMagick().filter((magick) => magick.type === "magick");
  }

  currentMagick() {
    const magickList = this.magickList();

    return magickList[this.index] || null;
  }

  canUseFromField(magick) {
    if (!magick) {
      return false;
    }

    const canTargetPlayer =
      Array.isArray(magick.target) &&
      (magick.target.includes("ally") || magick.target.includes("self"));

    const isFieldEffect = magick.effect === "heal";

    if (!canTargetPlayer || !isFieldEffect) {
      return false;
    }

    return this.actor.canUseMagick(magick.id);
  }

  show() {
    this.visible = true;
    this.index = 0;
    this.listViewport.reset(this.index, this.magickList().length);
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

    this.actorNavigation.drawHeader(
      context,
      "Magick",
      this.x,
      this.y,
      this.width,
      this.padding,
    );

    // =====================================
    // MAGICK LIST
    // =====================================

    const magickList = this.magickList();

    context.font = "22px sans-serif";

    if (magickList.length === 0) {
      context.fillText("(No magick)", this.x + this.padding, this.y + 105);

      context.restore();
      return;
    }

    const range = this.listViewport.visibleRange(this.index, magickList.length);
    let drawY = this.y + 105;

    for (let i = range.start; i < range.end; i++) {
      const magick = magickList[i];

      const prefix = i === this.index ? "▶ " : "   ";

      const usable = this.canUseFromField(magick);

      context.globalAlpha = usable ? 1.0 : 0.4;

      context.fillText(`${prefix}${magick.name}`, this.x + this.padding, drawY);

      context.fillText(
        `${magick.mpCost || 0} MP`,
        this.x + this.width - 110,
        drawY,
      );

      context.globalAlpha = 1.0;

      drawY += this.itemHeight;
    }

    this.drawScrollIndicators(context, magickList.length);

    // =====================================
    // CURRENT MAGICK DETAILS
    // =====================================

    const currentMagick = this.currentMagick();

    if (currentMagick) {
      const dividerY = this.y + 295;
      const detailX = this.x + this.padding;
      const detailWidth = this.width - this.padding * 2;

      context.beginPath();
      context.moveTo(detailX, dividerY);
      context.lineTo(this.x + this.width - this.padding, dividerY);
      context.stroke();

      context.font = "18px sans-serif";
      context.fillText(
        `MP: ${this.actor.mp} / ${this.actor.maxMp}`,
        detailX,
        dividerY + 23,
      );

      Window_TextLayout.drawWrappedText(
        context,
        currentMagick.description || "",
        detailX,
        dividerY + 47,
        detailWidth,
        20,
        3,
      );

      context.fillText(
        `Category: ${currentMagick.category || "other"}`,
        detailX,
        this.y + this.height - 13,
      );
    }
    context.restore();
  }
}
