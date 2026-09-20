"use strict";

class Window_BattleMagick {
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

  update() {
    if (!this.visible) {
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
  }

  actor() {
    return this.scene?.partyController?.currentBattler() || $gameParty.battleLeader();
  }

  magickList() {
    return this.actor()
      .knownMagick()
      .filter((magick) => magick.type === "magick");
  }

  currentMagick() {
    const magickList = this.magickList();

    return magickList[this.index] || null;
  }

  show({ preserveIndex = false } = {}) {
    const entries = this.magickList();

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
      context.fillText(
        "▼",
        this.x + this.width - 8,
        this.y + this.height - 10,
      );
    }

    context.restore();
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    const magickList = this.magickList();

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

    context.fillText("Magick", this.x + this.padding, this.y + 30);

    if (magickList.length === 0) {
      context.fillText("(No magick)", this.x + this.padding, this.y + 80);

      context.restore();
      return;
    }

    const range = this.listViewport.visibleRange(this.index, magickList.length);

    for (let i = range.start; i < range.end; i++) {
      const magick = magickList[i];

      const prefix = i === this.index ? "▶ " : "   ";
      const visibleRow = i - range.start;
      const drawY = this.y + 75 + visibleRow * this.lineHeight;

      const usable = this.actor().canUseMagick(magick.id);

      context.globalAlpha = usable ? 1.0 : 0.4;
      context.fillText(`${prefix}${magick.name}`, this.x + this.padding, drawY);
      context.textAlign = "right";

      context.fillText(
        `${magick.mpCost || 0} MP`,
        this.x + this.width - this.padding,
        drawY,
      );

      context.textAlign = "left";
      context.globalAlpha = 1.0;
    }

    this.drawScrollIndicators(context, magickList.length);

    context.restore();
  }
}
