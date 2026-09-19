"use strict";

class Window_BattleResults {
  constructor(scene = null) {
    this.scene = scene;
    this.visible = false;
    this.result = null;
    this.lines = [];
    this.scrollIndex = 0;
    this.viewport = new Window_ListViewport(12);

    this.width = Math.min(920, Graphics.width - 80);
    this.height = Math.min(620, Graphics.height - 80);
    this.x = Math.floor((Graphics.width - this.width) / 2);
    this.y = Math.floor((Graphics.height - this.height) / 2);
  }

  show(result) {
    if (!result || result.outcome !== "victory") {
      return false;
    }

    this.result = result;
    this.lines = this.buildContentLines(result);
    this.scrollIndex = 0;
    this.viewport.reset(this.scrollIndex, this.lines.length);
    this.visible = true;
    return true;
  }

  hide() {
    this.visible = false;
  }

  isOpen() {
    return this.visible;
  }

  update() {
    if (!this.visible || this.lines.length === 0) {
      return;
    }

    if (Input.isTriggered("ArrowUp") || Input.isTriggered("KeyW")) {
      this.scrollIndex = Math.max(0, this.scrollIndex - 1);
      this.viewport.ensureVisible(this.scrollIndex, this.lines.length);
    }

    if (Input.isTriggered("ArrowDown") || Input.isTriggered("KeyS")) {
      this.scrollIndex = Math.min(this.lines.length - 1, this.scrollIndex + 1);
      this.viewport.ensureVisible(this.scrollIndex, this.lines.length);
    }
  }

  buildContentLines(result) {
    const lines = [];
    const drops = Array.isArray(result.rewards?.drops) ? result.rewards.drops : [];
    const party = Array.isArray(result.party) ? result.party : [];

    lines.push({ kind: "section", text: "ITEM DROPS" });

    if (drops.length === 0) {
      lines.push({ kind: "muted", text: "No item drops" });
    } else {
      for (const drop of drops) {
        const quantity = Number(drop?.quantity) || 0;
        lines.push({
          kind: "normal",
          text: `${drop?.name || "Unknown Item"} ×${quantity}`,
        });
      }
    }

    lines.push({ kind: "spacer", text: "" });
    lines.push({ kind: "section", text: "PARTY PROGRESSION" });

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
    }

    return lines;
  }

  draw() {
    if (!this.visible || !this.result) {
      return;
    }

    const context = Graphics.context;
    const rewards = this.result.rewards || {};
    const contentX = this.x + 34;
    const contentWidth = this.width - 68;
    const summaryY = this.y + 105;
    const contentY = this.y + 205;
    const rowHeight = 28;

    context.save();

    context.fillStyle = "rgba(0, 0, 0, 0.72)";
    context.fillRect(0, 0, Graphics.width, Graphics.height);

    context.fillStyle = "rgba(8, 10, 18, 0.97)";
    context.fillRect(this.x, this.y, this.width, this.height);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;
    context.strokeRect(this.x, this.y, this.width, this.height);

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "bold 34px Arial";
    context.fillStyle = "#ffd866";
    context.fillText("VICTORY", this.x + this.width / 2, this.y + 42);

    context.font = "18px Arial";
    context.fillStyle = "#ffffff";
    context.fillText(
      this.result.encounter?.name || "Battle Complete",
      this.x + this.width / 2,
      this.y + 76,
    );

    const summaryEntries = [
      ["EXP", Number(rewards.exp) || 0],
      ["GIL", Number(rewards.currency) || 0],
      ["RESONANCE", Number(rewards.resonance) || 0],
    ];
    const summaryGap = 16;
    const summaryWidth =
      (contentWidth - summaryGap * (summaryEntries.length - 1)) /
      summaryEntries.length;

    for (let index = 0; index < summaryEntries.length; index++) {
      const [label, value] = summaryEntries[index];
      const x = contentX + index * (summaryWidth + summaryGap);

      context.fillStyle = "rgba(255, 255, 255, 0.06)";
      context.fillRect(x, summaryY, summaryWidth, 70);
      context.strokeStyle = "rgba(255, 255, 255, 0.35)";
      context.lineWidth = 1;
      context.strokeRect(x, summaryY, summaryWidth, 70);

      context.font = "15px Arial";
      context.fillStyle = "#cccccc";
      context.fillText(label, x + summaryWidth / 2, summaryY + 20);
      context.font = "bold 24px Arial";
      context.fillStyle = "#ffffff";
      context.fillText(`+${value}`, x + summaryWidth / 2, summaryY + 48);
    }

    const range = this.viewport.visibleRange(
      this.scrollIndex,
      this.lines.length,
    );

    context.textAlign = "left";
    context.textBaseline = "middle";

    for (let lineIndex = range.start; lineIndex < range.end; lineIndex++) {
      const line = this.lines[lineIndex];
      const drawY = contentY + (lineIndex - range.start) * rowHeight;

      if (line.kind === "section") {
        context.font = "bold 18px Arial";
        context.fillStyle = "#ffd866";
      } else if (line.kind === "actor") {
        context.font = "bold 18px Arial";
        context.fillStyle = "#ffffff";
      } else if (line.kind === "highlight") {
        context.font = "17px Arial";
        context.fillStyle = "#8fe388";
      } else if (line.kind === "mastery") {
        context.font = "bold 17px Arial";
        context.fillStyle = "#ffcc66";
      } else if (line.kind === "muted") {
        context.font = "16px Arial";
        context.fillStyle = "#aaaaaa";
      } else {
        context.font = "16px Arial";
        context.fillStyle = "#dddddd";
      }

      if (line.kind !== "spacer") {
        context.fillText(line.text, contentX, drawY, contentWidth);
      }
    }

    context.font = "16px Arial";
    context.fillStyle = "#bbbbbb";
    context.textAlign = "left";

    if (this.viewport.hasPrevious()) {
      context.fillText("▲ W / ↑", contentX, this.y + this.height - 30);
    }

    if (this.viewport.hasNext(this.lines.length)) {
      context.fillText("▼ S / ↓", contentX + 90, this.y + this.height - 30);
    }

    context.textAlign = "right";
    context.fillStyle = "#ffffff";
    context.fillText(
      "E / Enter: Continue",
      this.x + this.width - 28,
      this.y + this.height - 30,
    );

    context.restore();
  }
}
