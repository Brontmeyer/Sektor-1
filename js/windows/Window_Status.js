"use strict";

class Window_Status {
  static PAGE_COUNT = 3;

  constructor(source) {
    this.actorNavigation = new Window_ActorNavigator(source);
    this.visible = false;
    this.pageIndex = 0;
    this.refreshLayout();
  }

  get actor() {
    return this.actorNavigation.actor();
  }

  refreshLayout() {
    const layout = CharacterMenuLayout.calculate({ description: false });

    this.x = layout.x;
    this.y = layout.y;
    this.width = layout.width;
    this.height = layout.height;
    this.actorBounds = layout.actorBounds;
    this.metaBounds = layout.infoBounds;
    this.contentBounds = layout.contentBounds;
  }

  changeActor(offset) {
    return this.actorNavigation.changeActor(offset);
  }

  actionTriggered(action) {
    return typeof Input.isActionTriggered === "function"
      ? Input.isActionTriggered(action)
      : typeof Input.isTriggered === "function"
        ? Input.isTriggered(action)
        : false;
  }

  changePage(offset) {
    const amount = Number(offset);

    if (!Number.isInteger(amount) || amount === 0) {
      return false;
    }

    this.pageIndex =
      ((this.pageIndex + amount) % Window_Status.PAGE_COUNT +
        Window_Status.PAGE_COUNT) %
      Window_Status.PAGE_COUNT;
    return true;
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (this.actionTriggered("cancel")) {
      this.hide();
      return;
    }

    if (this.actorNavigation.update()) {
      return;
    }

    if (this.actionTriggered("up")) {
      this.changePage(-1);
      return;
    }

    if (this.actionTriggered("down") || this.actionTriggered("confirm")) {
      this.changePage(1);
    }
  }

  show() {
    this.visible = true;
    this.pageIndex = 0;
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

  valorText(actor) {
    const value = Math.round(Math.max(0, Number(actor?.valor) || 0) * 10) / 10;
    return actor?.isValorReady?.() === true
      ? "READY"
      : `${value} / ${actor?.maxValor ?? 0}`;
  }

  pageTitle() {
    return ["MAIN", "ELEMENT", "EFFECT"][this.pageIndex] || "MAIN";
  }

  drawMetaPanel(context) {
    const actor = this.actor;
    const bounds = this.metaBounds;
    this.drawPanel(context, bounds);

    context.save();
    const subtitle = `${this.pageTitle()}  ${this.pageIndex + 1}/${Window_Status.PAGE_COUNT}`;
    const heading = CharacterMenuLayout.drawInfoHeading(context, bounds, {
      title: "STATUS",
      subtitle,
    });
    context.textBaseline = "middle";

    if (!actor) {
      context.restore();
      return;
    }

    const labelX = heading.labelX;
    const valueX = heading.valueX;
    const expNeeded = actor.expForNextLevel?.() ?? "--";
    const rows = [
      ["EXP", actor.exp ?? 0],
      ["Next Level", expNeeded],
      ["Valor", this.valorText(actor)],
    ];

    rows.forEach(([label, value], index) => {
      const y = CharacterMenuLayout.infoRowY(bounds, index, { subtitle });
      context.textAlign = "left";
      context.font = "14px sans-serif";
      context.fillStyle = label === "Valor"
        ? UIResourcePalette.text("valor", { ready: actor.isValorReady?.() === true })
        : "#aebbd0";
      context.fillText(`${label}:`, labelX, y);
      context.textAlign = "right";
      context.fillStyle = UIResourcePalette.valueText();
      context.fillText(String(value), valueX, y);
    });

    context.restore();
  }

  statRows() {
    const actor = this.actor;

    if (!actor) {
      return { primary: [], derived: [] };
    }

    return {
      primary: [
        ["Strength", actor.strength],
        ["Dexterity", actor.dexterity],
        ["Vitality", actor.vitality],
        ["Magic", actor.magic],
        ["Spirit", actor.spirit],
        ["Agility", actor.agility],
        ["Luck", actor.luck],
      ],
      derived: [
        ["Attack", actor.totalAttack?.() ?? actor.attack],
        ["Attack %", actor.totalAttackPercent?.() ?? actor.attackPercent],
        ["Defense", actor.totalDefense?.() ?? actor.defense],
        ["Defense %", actor.totalDefensePercent?.() ?? actor.defensePercent],
        ["Magic Attack", actor.totalMagicAttack?.() ?? actor.magicAttack],
        ["Magic Defense", actor.totalMagicDefense?.() ?? actor.magicDefense],
        [
          "Magic Defense %",
          actor.totalMagicDefensePercent?.() ?? actor.magicDefensePercent,
        ],
        ["Critical", actor.totalCritical?.() ?? 0],
      ],
    };
  }

  drawStatColumn(context, title, rows, x, y, width) {
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText(title, x, y);

    rows.forEach(([label, value], index) => {
      const rowY = y + 32 + index * 29;
      context.fillStyle = "#aebbd0";
      context.font = "16px sans-serif";
      context.textAlign = "left";
      context.fillText(label, x, rowY);
      context.fillStyle = "#ffffff";
      context.textAlign = "right";
      context.fillText(String(value ?? 0), x + width, rowY);
    });
  }

  equippedEssenceNames() {
    const actor = this.actor;
    const slotCount = Math.max(0, Number(actor?.essenceSlotCount?.()) || 0);
    const names = [];

    for (let slot = 0; slot < slotCount; slot++) {
      const essence = actor?.equippedEssenceAt?.(slot);
      names.push(essence?.name?.() || "Empty");
    }

    return names;
  }

  activeStatusText() {
    const actor = this.actor;
    const entries = actor?.statusDisplayEntries?.() || [];

    if (entries.length === 0) {
      return "Normal";
    }

    return entries
      .map((entry) =>
        entry.turnsRemaining === null
          ? entry.name
          : `${entry.name} ${entry.turnsRemaining}`,
      )
      .join(", ");
  }

  drawMainPage(context, bounds) {
    this.drawPanel(context, bounds);
    const actor = this.actor;

    if (!actor) {
      return;
    }

    const pad = 22;
    const bodyBottom = bounds.y + bounds.height - 16;
    const splitX = bounds.x + Math.floor(bounds.width * 0.56);
    const statsWidth = splitX - bounds.x - pad * 2;
    const columnGap = 34;
    const statColumnWidth = Math.floor((statsWidth - columnGap) / 2);
    const topY = bounds.y + 32;
    const stats = this.statRows();

    context.save();
    this.drawStatColumn(
      context,
      "PARAMETERS",
      stats.primary,
      bounds.x + pad,
      topY,
      statColumnWidth,
    );
    this.drawStatColumn(
      context,
      "COMBAT",
      stats.derived,
      bounds.x + pad + statColumnWidth + columnGap,
      topY,
      statColumnWidth,
    );

    context.strokeStyle = "rgba(210, 222, 242, 0.34)";
    context.beginPath();
    context.moveTo(splitX, bounds.y + 18);
    context.lineTo(splitX, bodyBottom - 12);
    context.stroke();

    const infoX = splitX + 24;
    const infoValueX = bounds.x + bounds.width - 24;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("EQUIPMENT", infoX, topY);

    const equipmentRows = [
      ["Weapon", actor.weapon?.()?.name || "None"],
      ["Armor", actor.armor?.()?.name || "None"],
      ["Accessory", actor.accessory?.()?.name || "None"],
    ];

    equipmentRows.forEach(([label, value], index) => {
      const y = topY + 34 + index * 30;
      context.fillStyle = "#aebbd0";
      context.font = "16px sans-serif";
      context.textAlign = "left";
      context.fillText(label, infoX, y);
      context.fillStyle = "#ffffff";
      context.textAlign = "right";
      context.fillText(value, infoValueX, y);
    });

    const essenceY = topY + 144;
    context.textAlign = "left";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("ESSENCE", infoX, essenceY);

    const essenceNames = this.equippedEssenceNames();
    if (essenceNames.length === 0) {
      essenceNames.push("None");
    }

    essenceNames.forEach((name, index) => {
      const y = essenceY + 32 + index * 28;
      context.fillStyle = name === "Empty" ? "#7f8ca4" : "#ffffff";
      context.font = "16px sans-serif";
      context.fillText(`Slot ${index + 1}`, infoX, y);
      context.textAlign = "right";
      context.fillText(name, infoValueX, y);
      context.textAlign = "left";
    });

    const statusY = Math.min(bodyBottom - 52, essenceY + 32 + essenceNames.length * 28 + 26);
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("CURRENT STATUS", infoX, statusY);
    context.fillStyle = "#ffffff";
    context.font = "16px sans-serif";

    if (typeof Window_TextLayout !== "undefined" && Window_TextLayout.drawWrappedText) {
      Window_TextLayout.drawWrappedText(
        context,
        this.activeStatusText(),
        infoX,
        statusY + 24,
        Math.max(120, infoValueX - infoX),
        20,
        2,
      );
    } else {
      context.fillText(this.activeStatusText(), infoX, statusY + 26);
    }

    context.restore();
  }

  elementKeys() {
    const source = Array.isArray(DatabaseManager.magickData)
      ? DatabaseManager.magickData
      : [];
    const keys = [];

    for (const magick of source) {
      const element = String(magick?.element || "").trim().toLowerCase();

      if (!element || element === "none" || element === "restorative") {
        continue;
      }

      if (!keys.includes(element)) {
        keys.push(element);
      }
    }

    for (const element of Object.keys(this.actor?.elementRates || {})) {
      if (!keys.includes(element)) {
        keys.push(element);
      }
    }

    return keys;
  }

  displayName(key) {
    return String(key || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (character) => character.toUpperCase());
  }

  rateLabel(rate) {
    const value = Number(rate);

    if (!Number.isFinite(value)) {
      return "Normal";
    }

    if (value <= 0) {
      return "Immune";
    }

    if (value < 1) {
      return `Resist ${Math.round(value * 100)}%`;
    }

    if (value > 1) {
      return `Weak ${Math.round(value * 100)}%`;
    }

    return "Normal";
  }

  rateColor(rate) {
    const value = Number(rate);

    if (value <= 0) return "#8ad7ff";
    if (value < 1) return "#7dffb2";
    if (value > 1) return "#ff8b8b";
    return "#ffffff";
  }

  drawElementPage(context, bounds) {
    this.drawPanel(context, bounds);
    const actor = this.actor;
    const keys = this.elementKeys();

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = "#7ff0d5";
    context.font = "600 20px sans-serif";
    context.fillText("ELEMENTAL AFFINITY", bounds.x + 24, bounds.y + 32);
    context.fillStyle = "#aebbd0";
    context.font = "14px sans-serif";
    context.fillText(
      "Shows the actor's current damage rate for elements supported by Sektor 1.",
      bounds.x + 24,
      bounds.y + 58,
    );

    const columns = 2;
    const columnWidth = Math.floor((bounds.width - 72) / columns);
    const rowsPerColumn = Math.max(1, Math.ceil(keys.length / columns));

    keys.forEach((key, index) => {
      const column = Math.floor(index / rowsPerColumn);
      const row = index % rowsPerColumn;
      const x = bounds.x + 36 + column * columnWidth;
      const y = bounds.y + 104 + row * 44;
      const rate = actor?.elementRate?.(key) ?? 1;

      context.textAlign = "left";
      context.fillStyle = "#aebbd0";
      context.font = "18px sans-serif";
      context.fillText(this.displayName(key), x, y);
      context.textAlign = "right";
      context.fillStyle = this.rateColor(rate);
      context.fillText(this.rateLabel(rate), x + columnWidth - 38, y);
    });

    if (keys.length === 0) {
      context.fillStyle = "#aebbd0";
      context.textAlign = "left";
      context.fillText("No elemental rate data is currently available.", bounds.x + 36, bounds.y + 112);
    }

    context.restore();
  }

  resistanceDefinitions() {
    const definitions = this.actor?.statusDefinitions?.() || [];
    return definitions.filter(
      (definition) => definition && definition.duration?.type !== "derived",
    );
  }

  drawEffectPage(context, bounds) {
    this.drawPanel(context, bounds);
    const actor = this.actor;
    const active = actor?.statusDisplayEntries?.() || [];
    const definitions = this.resistanceDefinitions();

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = "#7ff0d5";
    context.font = "600 20px sans-serif";
    context.fillText("STATUS EFFECTS", bounds.x + 24, bounds.y + 32);

    const columns = 3;
    const columnWidth = Math.floor((bounds.width - 72) / columns);
    const activeY = bounds.y + 66;
    const activeColumnX = bounds.x + 30;
    const activeLabelX = activeColumnX;
    const activeValueX = activeColumnX + columnWidth - 28;

    context.fillStyle = "#aebbd0";
    context.font = "15px sans-serif";
    context.textAlign = "left";
    context.fillText("Active", activeLabelX, activeY);

    const activeText = active.length === 0
      ? "None"
      : active
          .map((entry) =>
            entry.turnsRemaining === null
              ? entry.name
              : `${entry.name} (${entry.turnsRemaining})`,
          )
          .join(", ");
    const activeMaxWidth = Math.max(80, activeValueX - activeLabelX - 76);
    const activeValue =
      typeof Window_TextLayout !== "undefined" &&
      typeof Window_TextLayout.ellipsize === "function" &&
      context.measureText(activeText).width > activeMaxWidth
        ? Window_TextLayout.ellipsize(context, activeText, activeMaxWidth)
        : activeText;

    context.fillStyle = "#ffffff";
    context.font = "16px sans-serif";
    context.textAlign = "right";
    context.fillText(activeValue, activeValueX, activeY);
    context.textAlign = "left";

    const dividerY = bounds.y + 104;
    context.strokeStyle = "rgba(210, 222, 242, 0.34)";
    context.beginPath();
    context.moveTo(bounds.x + 22, dividerY);
    context.lineTo(bounds.x + bounds.width - 22, dividerY);
    context.stroke();

    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("STATUS RESISTANCE", bounds.x + 24, dividerY + 28);

    const rowsPerColumn = Math.max(1, Math.ceil(definitions.length / columns));

    definitions.forEach((definition, index) => {
      const column = Math.floor(index / rowsPerColumn);
      const row = index % rowsPerColumn;
      const x = bounds.x + 30 + column * columnWidth;
      const y = dividerY + 66 + row * 31;
      const rate = actor?.statusRate?.(definition.key) ?? 1;

      context.textAlign = "left";
      context.fillStyle = "#aebbd0";
      context.font = "15px sans-serif";
      context.fillText(definition.name, x, y);
      context.textAlign = "right";
      context.fillStyle = this.rateColor(rate);
      context.fillText(this.rateLabel(rate), x + columnWidth - 28, y);
    });

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

    this.drawActorPanel(context);
    this.drawMetaPanel(context);

    if (this.pageIndex === 1) {
      this.drawElementPage(context, this.contentBounds);
    } else if (this.pageIndex === 2) {
      this.drawEffectPage(context, this.contentBounds);
    } else {
      this.drawMainPage(context, this.contentBounds);
    }

    context.restore();
  }
}
