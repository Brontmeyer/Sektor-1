"use strict";

class Window_EquipSelect {
  constructor(actor) {
    this.actor = actor;
    this.visible = false;
    this.type = null;

    this.index = 0;
    this.result = null;

    this.width = 620;
    this.height = 480;
    this.padding = 30;
    this.lineHeight = 40;
    this.listViewport = new Window_ListViewport(5);

    this.x = (Graphics.width - this.width) / 2;
    this.y = (Graphics.height - this.height) / 2;
  }

  equipmentConfig() {
    if (this.type === "weapon") {
      return {
        title: "Select Weapon",
        inventory: $gameParty.weapons,
        count: (id) => $gameParty.weaponCount(id),
        lookup: (id) => DatabaseManager.weapon(id),
        equippedId: () => this.actor?.weaponId ?? 0,
        bonusText: (weapon) => {
          const parts = [`+${weapon.attack || 0} Attack`];

          if ((weapon.magicAttack || 0) > 0) {
            parts.push(`+${weapon.magicAttack} Magic Attack`);
          }

          if ((weapon.criticalBonus || 0) > 0) {
            parts.push(`+${weapon.criticalBonus} Critical`);
          }

          return parts.join(", ");
        },
      };
    }

    if (this.type === "armor") {
      return {
        title: "Select Armor",
        inventory: $gameParty.armors,
        count: (id) => $gameParty.armorCount(id),
        lookup: (id) => DatabaseManager.armor(id),
        equippedId: () => this.actor?.armorId ?? 0,
        bonusText: (armor) => `+${armor.defense || 0} Defense`,
      };
    }

    if (this.type === "accessory") {
      return {
        title: "Select Accessory",
        inventory: $gameParty.accessories,
        count: (id) => $gameParty.accessoryCount(id),
        lookup: (id) => DatabaseManager.accessory(id),
        equippedId: () => this.actor?.accessoryId ?? 0,
        bonusText: (accessory) => this.accessoryBonusText(accessory),
      };
    }

    return null;
  }

  accessoryBonusText(accessory) {
    const labels = {
      attack: "Attack",
      defense: "Defense",
      magicAttack: "Magic Attack",
      magicDefense: "Magic Defense",
      criticalBonus: "Critical",
    };
    const parts = [];

    for (const [key, label] of Object.entries(labels)) {
      const value = Number(accessory?.bonuses?.[key]);

      if (Number.isFinite(value) && value !== 0) {
        parts.push(`+${value} ${label}`);
      }
    }

    return parts.join(", ") || "No combat bonus";
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

    if (Input.isActionTriggered("up")) {
      this.index = (this.index - 1 + entries.length) % entries.length;
    }

    if (Input.isActionTriggered("down")) {
      this.index = (this.index + 1) % entries.length;
    }

    this.listViewport.ensureVisible(this.index, entries.length);

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
        bonusText: config.bonusText(data),
      });
    }

    return result;
  }

  currentEntry() {
    return this.entries()[this.index] || null;
  }

  hasResult() {
    return this.result !== null;
  }

  takeResult() {
    const result = this.result;
    this.result = null;
    return result;
  }

  previewStats() {
    const entry = this.currentEntry();

    if (!entry || !this.actor) {
      return [];
    }

    if (this.type === "weapon") {
      const weapon = entry.id === 0 ? null : entry.data;

      return [
        {
          name: "Attack",
          current: this.actor.totalAttack(),
          preview: this.actor.attackWithWeapon(weapon),
        },
        {
          name: "Magic Attack",
          current: this.actor.totalMagicAttack(),
          preview: this.actor.magicAttackWithWeapon(weapon),
        },
      ];
    }

    if (this.type === "armor") {
      const armor = entry.id === 0 ? null : entry.data;

      return [
        {
          name: "Defense",
          current: this.actor.totalDefense(),
          preview: this.actor.defenseWithArmor(armor),
        },
      ];
    }

    if (this.type === "accessory") {
      const accessory = entry.id === 0 ? null : entry.data;

      return [
        {
          name: "Attack",
          current: this.actor.totalAttack(),
          preview: this.actor.attackWithWeapon(this.actor.weapon(), accessory),
        },
        {
          name: "Defense",
          current: this.actor.totalDefense(),
          preview: this.actor.defenseWithArmor(this.actor.armor(), accessory),
        },
        {
          name: "Magic Attack",
          current: this.actor.totalMagicAttack(),
          preview: this.actor.magicAttackWithWeapon(this.actor.weapon(), accessory),
        },
        {
          name: "Magic Defense",
          current: this.actor.totalMagicDefense(),
          preview: this.actor.magicDefenseWithAccessory(accessory),
        },
        {
          name: "Critical",
          current: this.actor.totalCritical(),
          preview: this.actor.criticalWithWeapon(this.actor.weapon(), accessory),
        },
      ];
    }

    return [];
  }

  drawScrollIndicators(context, totalEntries) {
    context.save();
    context.fillStyle = "#ffffff";
    context.font = "16px sans-serif";
    context.textAlign = "right";

    if (this.listViewport.hasPrevious()) {
      context.fillText("▲", this.x + this.width - 8, this.y + 110);
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
    const entries = this.entries();
    const config = this.equipmentConfig();

    context.save();
    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    context.fillStyle = "rgba(0, 0, 0, 0.98)";
    context.fillRect(this.x, this.y, this.width, this.height);

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(this.x, this.y, this.width, this.height);

    context.fillStyle = "#ffffff";
    context.font = "26px sans-serif";
    context.fillText(config?.title || "Select Equipment", this.x + this.padding, this.y + 45);

    context.beginPath();
    context.moveTo(this.x + this.padding, this.y + 65);
    context.lineTo(this.x + this.width - this.padding, this.y + 65);
    context.stroke();

    context.font = "19px sans-serif";
    const range = this.listViewport.visibleRange(this.index, entries.length);
    let drawY = this.y + 110;
    const equippedId = config?.equippedId?.() ?? 0;

    for (let i = range.start; i < range.end; i++) {
      const entry = entries[i];
      const prefix = i === this.index ? "▶ " : "  ";
      let text = `${prefix}${entry.name}`;

      if (entry.id !== 0 && entry.count > 1) {
        text += ` x${entry.count}`;
      }

      if (entry.id !== 0 && entry.bonusText) {
        text += `   ${entry.bonusText}`;
      }

      if (entry.id === equippedId) {
        text += "   [Equipped]";
      }

      context.fillText(text, this.x + this.padding, drawY);
      drawY += this.lineHeight;
    }

    this.drawScrollIndicators(context, entries.length);

    const preview = this.previewStats();
    context.font = "18px sans-serif";
    let previewY = this.y + 340;

    for (const stat of preview) {
      context.fillText(
        `${stat.name}: ${stat.current} → ${stat.preview}`,
        this.x + this.padding,
        previewY,
      );
      previewY += 24;
    }

    context.restore();
  }
}
