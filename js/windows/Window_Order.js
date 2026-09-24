"use strict";

class Window_Order {
  constructor(party) {
    this.party = party;
    this.visible = false;
    this.refreshLayout();
    this.formationWindow = new Window_MainMenuParty(
      this.party,
      this.contentBounds,
    );
  }

  refreshLayout() {
    const layout = CharacterMenuLayout.calculate();

    this.x = layout.x;
    this.y = layout.y;
    this.width = layout.width;
    this.height = layout.height;
    this.summaryBounds = layout.actorBounds;
    this.infoBounds = layout.infoBounds;
    this.descriptionBounds = layout.descriptionBounds;
    this.contentBounds = layout.contentBounds;

    this.formationWindow?.setBounds(this.contentBounds);
  }

  show() {
    this.visible = true;
    this.refreshLayout();
    this.formationWindow.setBounds(this.contentBounds);
    this.formationWindow.activate("order");
  }

  hide() {
    this.visible = false;
    this.formationWindow.deactivate();
  }

  isOpen() {
    return this.visible;
  }

  members() {
    return this.party?.battleFormationMembers?.() || [];
  }

  selectedActor() {
    return this.formationWindow.currentActor?.() || null;
  }

  selectedRow() {
    const actor = this.selectedActor();
    return actor ? this.party?.battleRow?.(actor) || "front" : "—";
  }

  rowCounts() {
    const counts = { front: 0, back: 0 };

    this.members().forEach((actor) => {
      const row = this.party?.battleRow?.(actor) === "back" ? "back" : "front";
      counts[row] += 1;
    });

    return counts;
  }

  swapActor() {
    const index = Number(this.formationWindow.swapSourceIndex);
    return Number.isInteger(index) && index >= 0
      ? this.members()[index] || null
      : null;
  }

  update() {
    if (!this.visible) {
      return;
    }

    const result = this.formationWindow.update();

    if (result?.type === "cancel") {
      this.hide();
    }
  }

  drawPanel(context, bounds, options = {}) {
    return Window_ActorSummary.drawPanel(context, bounds, options);
  }

  drawSummary(context) {
    const bounds = this.summaryBounds;
    const members = this.members();
    const rows = this.rowCounts();

    this.drawPanel(context, bounds);

    context.save();
    CharacterMenuLayout.drawContextHeading(context, bounds, {
      title: "BATTLE FORMATION",
      description: "Set visual formation order and each actor's battle row.",
    });

    const summaries = [
      ["Active Party", String(members.length)],
      ["Front Row", String(rows.front)],
      ["Back Row", String(rows.back)],
      ["Slots", String(Math.min(4, members.length))],
    ];
    const metricsX = bounds.x + 20;
    const metricsWidth = bounds.width - 40;
    const cellWidth = metricsWidth / summaries.length;
    const dividerY = bounds.y + 82;
    const labelY = dividerY + 20;
    const valueY = labelY + 24;

    context.strokeStyle = "rgba(210, 222, 242, 0.24)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(metricsX, dividerY);
    context.lineTo(metricsX + metricsWidth, dividerY);
    context.stroke();

    context.textAlign = "center";
    summaries.forEach(([label, value], index) => {
      const centerX = metricsX + cellWidth * index + cellWidth / 2;
      context.fillStyle = UIThemePalette?.accent?.() || "#7ff0d5";
      context.font = "600 13px sans-serif";
      context.fillText(label, centerX, labelY);
      context.fillStyle = UIThemePalette?.primary?.() || "#ffffff";
      context.font = "600 18px sans-serif";
      context.fillText(value, centerX, valueY);
    });

    context.restore();
  }

  drawInfo(context) {
    const bounds = this.infoBounds;
    const actor = this.selectedActor();
    const slot = this.formationWindow.index + 1;
    const swapActor = this.swapActor();

    this.drawPanel(context, bounds);

    context.save();
    const subtitle = "FORMATION";
    const heading = CharacterMenuLayout.drawInfoHeading(context, bounds, {
      title: "ORDER",
      subtitle,
    });
    context.textBaseline = "middle";

    const rows = [
      ["Selected", actor?.name || "—"],
      ["Slot", actor ? String(slot) : "—"],
      ["Row", actor ? this.selectedRow().toUpperCase() : "—"],
      ["Swap", swapActor?.name || "—"],
    ];
    const labelX = heading.labelX;
    const valueX = heading.valueX;

    rows.forEach(([label, value], index) => {
      const y = CharacterMenuLayout.infoRowY(bounds, index, { subtitle });
      context.textAlign = "left";
      context.fillStyle = label === "Swap"
        ? UIThemePalette?.hint?.() || "#c7a7ff"
        : UIThemePalette?.secondary?.() || "#aebbd0";
      context.font = "14px sans-serif";
      context.fillText(label, labelX, y);
      context.textAlign = "right";
      context.fillStyle = UIThemePalette?.primary?.() || "#ffffff";
      context.fillText(String(value), valueX, y);
    });

    context.restore();
  }

  descriptionText() {
    const swapActor = this.swapActor();

    if (swapActor) {
      return `Choose a destination slot for ${swapActor.name}. Confirm swaps the two formation positions; Back cancels the pending swap.`;
    }

    const actor = this.selectedActor();
    if (!actor) {
      return "No active party members are available to arrange.";
    }

    return `Arrange ${actor.name}: Left sets the back row, Right sets the front row, and Confirm picks the actor up for a slot swap.`;
  }

  drawDescription(context) {
    const bounds = this.descriptionBounds;
    this.drawPanel(context, bounds, { assetAlpha: 0.46 });

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = UIThemePalette?.primary?.() || "#ffffff";
    context.font = "16px sans-serif";

    if (
      typeof Window_TextLayout !== "undefined" &&
      typeof Window_TextLayout.drawWrappedTextCentered === "function"
    ) {
      Window_TextLayout.drawWrappedTextCentered(
        context,
        this.descriptionText(),
        bounds.x + 18,
        bounds.y + bounds.height / 2,
        bounds.width - 36,
        18,
        2,
      );
    } else {
      context.fillText(
        this.descriptionText(),
        bounds.x + 18,
        bounds.y + bounds.height / 2,
      );
    }

    context.restore();
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    context.save();
    context.fillStyle = UIThemePalette?.backdrop?.() || "#0b0e13";
    context.fillRect(0, 0, Graphics.width, Graphics.height);

    this.drawSummary(context);
    this.drawInfo(context);
    this.drawDescription(context);
    this.formationWindow.draw();

    context.restore();
  }
}
