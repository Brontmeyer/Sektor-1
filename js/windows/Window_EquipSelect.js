"use strict";

class Window_EquipSelect {
  constructor(actor) {
    this.actor = actor;
    this.visible = false;
    this.type = null;
    this.index = 0;
    this.result = null;
    this.lineHeight = 42;
    this.visibleRows = 8;
    this.listViewport = new Window_ListViewport(this.visibleRows);
    this.setBounds({ x: 0, y: 0, width: 420, height: 420 });
  }

  setBounds(bounds = {}) {
    this.x = Number(bounds.x) || 0;
    this.y = Number(bounds.y) || 0;
    this.width = Math.max(300, Number(bounds.width) || 420);
    this.height = Math.max(300, Number(bounds.height) || 420);
    this.padding = 20;
    this.visibleRows = Math.max(
      4,
      Math.floor((this.height - 72) / this.lineHeight),
    );
    this.listViewport.maxVisibleRows = this.visibleRows;
  }

  directionRepeated(action) {
    return typeof Input.isActionRepeated === "function"
      ? Input.isActionRepeated(action)
      : Input.isActionTriggered(action);
  }

  equipmentConfig() {
    if (this.type === "weapon") {
      return {
        title: "WEAPON",
        inventory: $gameParty.weapons,
        count: (id) => $gameParty.weaponCount(id),
        lookup: (id) => DatabaseManager.weapon(id),
        equippedId: () => this.actor?.weaponId ?? 0,
      };
    }

    if (this.type === "armor") {
      return {
        title: "ARMOR",
        inventory: $gameParty.armors,
        count: (id) => $gameParty.armorCount(id),
        lookup: (id) => DatabaseManager.armor(id),
        equippedId: () => this.actor?.armorId ?? 0,
      };
    }

    if (this.type === "accessory") {
      return {
        title: "ACCESSORY",
        inventory: $gameParty.accessories,
        count: (id) => $gameParty.accessoryCount(id),
        lookup: (id) => DatabaseManager.accessory(id),
        equippedId: () => this.actor?.accessoryId ?? 0,
      };
    }

    return null;
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (Input.isActionTriggered("cancel")) {
      this.hide();
      return;
    }

    const entries = this.entries();

    if (entries.length > 0) {
      if (this.directionRepeated("up")) {
        this.index = (this.index - 1 + entries.length) % entries.length;
      } else if (this.directionRepeated("down")) {
        this.index = (this.index + 1) % entries.length;
      }

      this.listViewport.ensureVisible(this.index, entries.length);
    }

    if (Input.isActionTriggered("confirm")) {
      this.result = this.currentEntry();
      this.visible = false;
    }
  }

  show(type) {
    this.visible = true;
    this.type = type;
    this.result = null;

    const config = this.equipmentConfig();
    const entries = this.entries();
    const equippedId = config?.equippedId?.() ?? 0;
    const equippedIndex = entries.findIndex((entry) => entry.id === equippedId);

    this.index = equippedIndex >= 0 ? equippedIndex : 0;
    this.listViewport.reset(this.index, entries.length);
  }

  hide() {
    this.visible = false;
    this.type = null;
  }

  isOpen() {
    return this.visible;
  }

  entries() {
    const result = [{ id: 0, name: "None", count: 0, data: null }];
    const config = this.equipmentConfig();

    if (!config) {
      return result;
    }

    const ids = Object.keys(config.inventory || {})
      .map(Number)
      .filter((id) => config.count(id) > 0)
      .sort((a, b) => a - b);

    for (const id of ids) {
      const data = config.lookup(id);

      if (!data) {
        continue;
      }

      result.push({
        id: data.id,
        name: data.name,
        count: config.count(id),
        data,
      });
    }

    return result;
  }

  currentEntry() {
    return this.entries()[this.index] || null;
  }

  selectedEquipment() {
    return this.currentEntry()?.data || null;
  }

  selectedDescription() {
    return this.selectedEquipment()?.description || "No equipment selected.";
  }

  essenceGrowthLabel() {
    const equipment = this.selectedEquipment();
    const growth = String(equipment?.essenceGrowth || "Normal").trim();
    return growth || "Normal";
  }

  hasResult() {
    return this.result !== null;
  }

  takeResult() {
    const result = this.result;
    this.result = null;
    return result;
  }

  statRows() {
    const actor = this.actor;

    if (!actor) {
      return [];
    }

    const current = {
      attack: actor.totalAttack(),
      attackPercent: actor.totalAttackPercent(),
      defense: actor.totalDefense(),
      defensePercent: actor.totalDefensePercent?.() ?? actor.defensePercent ?? 0,
      magicAttack: actor.totalMagicAttack(),
      magicDefense: actor.totalMagicDefense(),
      magicDefensePercent:
        actor.totalMagicDefensePercent?.() ?? actor.magicDefensePercent ?? 0,
      critical: actor.totalCritical(),
    };
    const preview = { ...current };
    const entry = this.currentEntry();

    if (entry) {
      if (this.type === "weapon") {
        const weapon = entry.id === 0 ? null : entry.data;
        preview.attack = actor.attackWithWeapon(weapon);
        preview.attackPercent = actor.attackPercentWithWeapon(weapon);
        preview.magicAttack = actor.magicAttackWithWeapon(weapon);
        preview.critical = actor.criticalWithWeapon(weapon);
      } else if (this.type === "armor") {
        const armor = entry.id === 0 ? null : entry.data;
        preview.defense = actor.defenseWithArmor(armor);
      } else if (this.type === "accessory") {
        const accessory = entry.id === 0 ? null : entry.data;
        preview.attack = actor.attackWithWeapon(actor.weapon(), accessory);
        preview.defense = actor.defenseWithArmor(actor.armor(), accessory);
        preview.magicAttack = actor.magicAttackWithWeapon(actor.weapon(), accessory);
        preview.magicDefense = actor.magicDefenseWithAccessory(accessory);
        preview.critical = actor.criticalWithWeapon(actor.weapon(), accessory);
      }
    }

    return [
      ["Attack", current.attack, preview.attack],
      ["Attack %", current.attackPercent, preview.attackPercent],
      ["Defense", current.defense, preview.defense],
      ["Defense %", current.defensePercent, preview.defensePercent],
      ["Magic Attack", current.magicAttack, preview.magicAttack],
      ["Magic Defense", current.magicDefense, preview.magicDefense],
      ["Magic Defense %", current.magicDefensePercent, preview.magicDefensePercent],
      ["Critical", current.critical, preview.critical],
    ].map(([name, currentValue, previewValue]) => ({
      name,
      current: currentValue,
      preview: previewValue,
    }));
  }

  previewStats() {
    return this.statRows();
  }

  drawPanel(context, bounds, options = {}) {
    return Window_ActorSummary.drawPanel(context, bounds, options);
  }

  drawScrollIndicators(context, entries) {
    const arrowX = this.x + this.width - 18;

    context.save();
    context.fillStyle = "#ffffff";
    context.font = "16px sans-serif";
    context.textAlign = "center";

    if (this.listViewport.hasPrevious()) {
      context.fillText("▲", arrowX, this.y + 58);
    }

    if (this.listViewport.hasNext(entries.length)) {
      context.fillText("▼", arrowX, this.y + this.height - 38);
    }

    context.restore();
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    const entries = this.entries();
    const config = this.equipmentConfig();
    const bounds = {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    };

    this.drawPanel(context, bounds);
    context.save();
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.font = "600 20px sans-serif";
    context.textAlign = "left";
    context.fillText(config?.title || "EQUIPMENT", this.x + 18, this.y + 28);

    const range = this.listViewport.visibleRange(this.index, entries.length);
    const equippedId = config?.equippedId?.() ?? 0;
    let drawY = this.y + 68;

    context.font = "18px sans-serif";

    for (let i = range.start; i < range.end; i++) {
      const entry = entries[i];
      const selected = i === this.index;

      if (selected) {
        const drawn =
          typeof UIAssetManager !== "undefined" &&
          typeof UIAssetManager.drawSelectionPanel === "function" &&
          UIAssetManager.drawSelectionPanel(
            context,
            this.x + 10,
            drawY - this.lineHeight / 2 + 2,
            this.width - 38,
            this.lineHeight - 4,
            { alpha: 0.2 },
          );

        if (!drawn) {
          context.fillStyle = "rgba(255, 215, 90, 0.1)";
          context.fillRect(
            this.x + 10,
            drawY - this.lineHeight / 2 + 2,
            this.width - 38,
            this.lineHeight - 4,
          );
        }
      }

      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.textAlign = "left";
      context.fillText(`${selected ? "▶ " : "  "}${entry.name}`, this.x + 20, drawY);

      let suffix = "";

      if (entry.id !== 0 && entry.count > 1) {
        suffix += `x${entry.count}`;
      }

      if (entry.id === equippedId) {
        suffix += `${suffix ? "  " : ""}Equipped`;
      }

      if (suffix) {
        context.fillStyle = "#aebbd0";
        context.font = "13px sans-serif";
        context.textAlign = "right";
        context.fillText(suffix, this.x + this.width - 28, drawY);
        context.font = "18px sans-serif";
      }

      drawY += this.lineHeight;
    }

    this.drawScrollIndicators(context, entries);

    context.restore();
  }
}
