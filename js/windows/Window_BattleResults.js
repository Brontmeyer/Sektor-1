"use strict";

class Window_BattleResults {
  static PAGE_COUNT = 2;

  constructor(scene = null) {
    this.scene = scene;
    this.visible = false;
    this.result = null;
    this.pageIndex = 0;
    this.lines = [];
    this.progressionLines = [];
    this.lootLines = [];
    this.scrollIndex = 0;
    this.viewport = new Window_ListViewport(11);

    this.width = Math.min(980, Graphics.width - 48);
    this.height = Math.min(650, Graphics.height - 48);
    this.x = Math.floor((Graphics.width - this.width) / 2);
    this.y = Math.floor((Graphics.height - this.height) / 2);
  }

  show(result) {
    if (!result || result.outcome !== "victory") {
      return false;
    }

    this.result = result;
    this.pageIndex = 0;
    this.progressionLines = this.buildProgressionLines(result);
    this.lootLines = this.buildLootLines(result);
    this.syncPageLines();
    this.visible = true;
    return true;
  }

  hide() {
    this.visible = false;
  }

  isOpen() {
    return this.visible;
  }

  isFinalPage() {
    return this.pageIndex >= Window_BattleResults.PAGE_COUNT - 1;
  }

  advancePage() {
    if (!this.visible || this.isFinalPage()) {
      return false;
    }

    this.pageIndex += 1;
    this.syncPageLines();
    return true;
  }

  syncPageLines() {
    this.lines = this.pageIndex === 0 ? this.progressionLines : this.lootLines;
    this.scrollIndex = 0;
    this.viewport.reset(this.scrollIndex, this.lines.length);
  }

  update() {
    if (!this.visible || this.lines.length === 0) {
      return;
    }

    if (Input.isActionTriggered("up")) {
      this.scrollIndex = Math.max(0, this.scrollIndex - 1);
      this.viewport.ensureVisible(this.scrollIndex, this.lines.length);
    }

    if (Input.isActionTriggered("down")) {
      this.scrollIndex = Math.min(this.lines.length - 1, this.scrollIndex + 1);
      this.viewport.ensureVisible(this.scrollIndex, this.lines.length);
    }
  }

  buildProgressionLines(result) {
    const lines = [];
    const party = Array.isArray(result.party) ? result.party : [];

    for (const actor of party) {
      const actorName = actor?.name || "Unknown Actor";
      const expGained = Number(actor?.expGained) || 0;

      lines.push({
        kind: "actor",
        text: `${actorName}   +${expGained} EXP`,
      });

      if (Number(actor?.levelAfter) > Number(actor?.levelBefore)) {
        lines.push({
          kind: "highlight",
          text: `  Level ${actor.levelBefore} → ${actor.levelAfter}!`,
        });
      }

      if (actor?.wasDefeated === true) {
        lines.push({
          kind: "muted",
          text: "  Defeated in battle — EXP awarded, no Essence Resonance",
        });
      }

      const essenceRewards = Array.isArray(actor?.essenceRewards)
        ? actor.essenceRewards
        : [];

      for (const essence of essenceRewards) {
        const gained = Number(essence?.gained) || 0;
        const newResonance = Number(essence?.newResonance) || 0;
        const name = essence?.name || "Unknown Essence";

        lines.push({
          kind: "normal",
          text: `  ${name} +${gained} Resonance (${newResonance}/1500)`,
        });

        if (essence?.leveledUp === true) {
          lines.push({
            kind: "highlight",
            text: `    Essence Level ${essence.oldLevel} → ${essence.newLevel}!`,
          });
        }

        const awakenedMagick = Array.isArray(essence?.awakenedMagick)
          ? essence.awakenedMagick
          : [];

        if (awakenedMagick.length > 0) {
          lines.push({
            kind: "highlight",
            text: `    Awakened: ${awakenedMagick
              .map((magick) => magick?.name)
              .filter((name) => typeof name === "string" && name.length > 0)
              .join(", ")}`,
          });
        }

        if (essence?.becameMasteryReady === true) {
          lines.push({
            kind: "mastery",
            text: `    ${name} is MASTERY READY!`,
          });
        }
      }

      lines.push({ kind: "spacer", text: "" });
    }

    if (lines.length > 0 && lines[lines.length - 1].kind === "spacer") {
      lines.pop();
    }

    if (lines.length === 0) {
      lines.push({ kind: "muted", text: "No party progression to report." });
    }

    return lines;
  }

  buildLootLines(result) {
    const drops = Array.isArray(result.rewards?.drops) ? result.rewards.drops : [];

    if (drops.length === 0) {
      return [{ kind: "muted", text: "No item drops" }];
    }

    return drops.map((drop) => ({
      kind: "normal",
      text: `${drop?.name || "Unknown Item"} ×${Number(drop?.quantity) || 0}`,
    }));
  }

  pageTitle() {
    return this.pageIndex === 0 ? "EXP & RESONANCE" : "RUNES & ITEMS";
  }

  themeColor(role, fallback) {
    return typeof UIThemePalette !== "undefined"
      ? UIThemePalette.color(role, fallback)
      : fallback;
  }

  drawPanel(context, bounds, role = "menuPanel") {
    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      UIAssetManager.drawPanel(
        context,
        role,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        {
          fallbackFill: "rgba(18, 31, 104, 0.96)",
          fallbackStroke: "rgba(137, 182, 235, 0.82)",
          innerStroke: "rgba(232, 235, 255, 0.14)",
          assetAlpha: 0.48,
          sourceMargin: 12,
          destMargin: 12,
        },
      );
      return;
    }

    context.fillStyle = "rgba(18, 31, 104, 0.96)";
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle = "rgba(137, 182, 235, 0.82)";
    context.lineWidth = 1.5;
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  drawSummaryCard(context, bounds, label, value) {
    this.drawPanel(context, bounds, "accentPanel");
    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = this.themeColor("secondary", "#aebbd0");
    context.font = "600 15px sans-serif";
    context.fillText(label, bounds.x + bounds.width / 2, bounds.y + 23);
    context.fillStyle = this.themeColor("primary", "#ffffff");
    context.font = "700 25px sans-serif";
    context.fillText(value, bounds.x + bounds.width / 2, bounds.y + 54);
    context.restore();
  }

  drawLine(context, line, x, y, maxWidth) {
    if (line.kind === "spacer") {
      return;
    }

    if (line.kind === "actor") {
      context.font = "700 18px sans-serif";
      context.fillStyle = this.themeColor("primary", "#ffffff");
    } else if (line.kind === "highlight") {
      context.font = "17px sans-serif";
      context.fillStyle = this.themeColor("positive", "#7dff8a");
    } else if (line.kind === "mastery") {
      context.font = "700 17px sans-serif";
      context.fillStyle = this.themeColor("focus", "#ffd75a");
    } else if (line.kind === "muted") {
      context.font = "16px sans-serif";
      context.fillStyle = this.themeColor("muted", "#8897ac");
    } else {
      context.font = "16px sans-serif";
      context.fillStyle = this.themeColor("primary", "#ffffff");
    }

    context.fillText(line.text, x, y, maxWidth);
  }

  draw() {
    if (!this.visible || !this.result) {
      return;
    }

    const context = Graphics.context;
    const rewards = this.result.rewards || {};
    const outer = { x: this.x, y: this.y, width: this.width, height: this.height };
    const inset = 16;
    const header = {
      x: this.x + inset,
      y: this.y + inset,
      width: this.width - inset * 2,
      height: 72,
    };
    const summaryY = header.y + header.height + 10;
    const summaryGap = 10;
    const summaryWidth = Math.floor((header.width - summaryGap) / 2);
    const summaryLeft = { x: header.x, y: summaryY, width: summaryWidth, height: 78 };
    const summaryRight = {
      x: header.x + summaryWidth + summaryGap,
      y: summaryY,
      width: header.width - summaryWidth - summaryGap,
      height: 78,
    };
    const content = {
      x: header.x,
      y: summaryY + 88,
      width: header.width,
      height: this.y + this.height - (summaryY + 88) - 54,
    };

    context.save();
    context.fillStyle = "rgba(5, 8, 16, 0.72)";
    context.fillRect(0, 0, Graphics.width, Graphics.height);
    this.drawPanel(context, outer);
    this.drawPanel(context, header, "accentPanel");
    this.drawPanel(context, content);

    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = this.themeColor("focus", "#ffd75a");
    context.font = "700 25px sans-serif";
    context.fillText("VICTORY", header.x + 18, header.y + 26);

    context.fillStyle = this.themeColor("primary", "#ffffff");
    context.font = "600 18px sans-serif";
    context.fillText(this.pageTitle(), header.x + 18, header.y + 52);

    context.textAlign = "right";
    context.fillStyle = this.themeColor("secondary", "#aebbd0");
    context.font = "15px sans-serif";
    context.fillText(
      this.result.encounter?.name || "Battle Complete",
      header.x + header.width - 18,
      header.y + 26,
    );
    context.fillText(
      `${this.pageIndex + 1} / ${Window_BattleResults.PAGE_COUNT}`,
      header.x + header.width - 18,
      header.y + 52,
    );

    if (this.pageIndex === 0) {
      this.drawSummaryCard(
        context,
        summaryLeft,
        "EXP",
        `+${Number(rewards.exp) || 0}`,
      );
      this.drawSummaryCard(
        context,
        summaryRight,
        "RESONANCE",
        `+${Number(rewards.resonance) || 0}`,
      );
    } else {
      const drops = Array.isArray(rewards.drops) ? rewards.drops : [];
      const totalDrops = drops.reduce(
        (total, drop) => total + Math.max(0, Number(drop?.quantity) || 0),
        0,
      );
      this.drawSummaryCard(
        context,
        summaryLeft,
        "RUNES",
        `+${Number(rewards.currency) || 0}`,
      );
      this.drawSummaryCard(
        context,
        summaryRight,
        "ITEM DROPS",
        String(totalDrops),
      );
    }

    context.textAlign = "left";
    context.fillStyle = this.themeColor("accent", "#7ff0d5");
    context.font = "700 17px sans-serif";
    context.fillText(
      this.pageIndex === 0 ? "PARTY PROGRESSION" : "ITEM DROPS",
      content.x + 18,
      content.y + 27,
    );

    const rowHeight = 27;
    const contentX = content.x + 22;
    const contentY = content.y + 62;
    const contentWidth = content.width - 44;
    this.viewport.maxVisibleRows = Math.max(
      1,
      Math.floor((content.height - 80) / rowHeight),
    );
    this.viewport.ensureVisible(this.scrollIndex, this.lines.length);
    const range = this.viewport.visibleRange(this.scrollIndex, this.lines.length);

    context.textAlign = "left";
    context.textBaseline = "middle";

    for (let lineIndex = range.start; lineIndex < range.end; lineIndex++) {
      const line = this.lines[lineIndex];
      const drawY = contentY + (lineIndex - range.start) * rowHeight;
      this.drawLine(context, line, contentX, drawY, contentWidth);
    }

    context.fillStyle = this.themeColor("secondary", "#aebbd0");
    context.font = "15px sans-serif";
    context.textAlign = "left";

    if (this.viewport.hasPrevious()) {
      context.fillText("▲", content.x + content.width - 24, content.y + 26);
    }

    if (this.viewport.hasNext(this.lines.length)) {
      context.fillText("▼", content.x + content.width - 24, content.y + content.height - 18);
    }

    context.textAlign = "right";
    context.fillStyle = this.themeColor("primary", "#ffffff");
    context.fillText(
      `${Input.actionLabel("confirm")}: ${this.isFinalPage() ? "Continue" : "Next"}`,
      this.x + this.width - 22,
      this.y + this.height - 22,
    );

    context.restore();
  }
}
