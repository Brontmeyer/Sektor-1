"use strict";

class Window_EquipSelect {
  constructor() {
    this.visible = false;
    this.type = null;

    this.index = 0;
    this.result = null;

    this.width = 500;
    this.height = 360;
    this.padding = 30;
    this.lineHeight = 40;

    this.x = (Graphics.width - this.width) / 2;
    this.y = (Graphics.height - this.height) / 2;
  }

  show(type) {
    this.visible = true;
    this.type = type;

    this.result = null;

    const entries = this.entries();

    let equippedId = 0;

    if (type === "weapon") {
      equippedId = $gameActor.weaponId;
    } else if (type === "armor") {
      equippedId = $gameActor.armorId;
    }

    const equippedIndex = entries.findIndex((entry) => entry.id === equippedId);

    if (equippedIndex >= 0) {
      this.index = equippedIndex;
    } else {
      this.index = 0;
    }
  }

  hide() {
    this.visible = false;
    this.type = null;
  }

  isOpen() {
    return this.visible;
  }

  entries() {
    const result = [
      {
        id: 0,
        name: "None",
      },
    ];

    // =====================================
    // OWNED WEAPONS
    // =====================================

    if (this.type === "weapon") {
      const weaponIds = Object.keys($gameParty.weapons)
        .map(Number)
        .filter((weaponId) => $gameParty.weaponCount(weaponId) > 0)
        .sort((a, b) => a - b);

      for (const weaponId of weaponIds) {
        const weapon = DatabaseManager.weapon(weaponId);

        if (weapon) {
          result.push({
            id: weapon.id,
            name: weapon.name,
            bonus: weapon.attack || 0,
            count: $gameParty.weaponCount(weaponId),
          });
        }
      }

      // =====================================
      // OWNED ARMOR
      // =====================================
    } else if (this.type === "armor") {
      const armorIds = Object.keys($gameParty.armors)
        .map(Number)
        .filter((armorId) => $gameParty.armorCount(armorId) > 0)
        .sort((a, b) => a - b);

      for (const armorId of armorIds) {
        const armor = DatabaseManager.armor(armorId);

        if (armor) {
          result.push({
            id: armor.id,
            name: armor.name,
            bonus: armor.defense || 0,
            count: $gameParty.armorCount(armorId),
          });
        }
      }
    }
    return result;
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (Input.isTriggered("Escape") || Input.isTriggered("KeyQ")) {
      this.hide();

      return;
    }

    const entries = this.entries();

    if (Input.isTriggered("ArrowUp") || Input.isTriggered("KeyW")) {
      this.index--;

      if (this.index < 0) {
        this.index = entries.length - 1;
      }
    }

    if (Input.isTriggered("ArrowDown") || Input.isTriggered("KeyS")) {
      this.index++;

      if (this.index >= entries.length) {
        this.index = 0;
      }
    }

    if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
      this.result = this.currentEntry();

      this.visible = false;

      return;
    }
  }

  currentEntry() {
    const entries = this.entries();

    return entries[this.index] || null;
  }

  draw() {
    if (!this.visible) {
      return;
    }
    
    const context = Graphics.context;
    const entries = this.entries();

    context.save();

    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    // Background

    context.fillStyle = "rgba(0, 0, 0, 0.98)";
    context.fillRect(this.x, this.y, this.width, this.height);

    // Border

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(this.x, this.y, this.width, this.height);

    // Title

    context.fillStyle = "#ffffff";
    context.font = "26px sans-serif";

    const title = this.type === "weapon" ? "Select Weapon" : "Select Armor";
    context.fillText(title, this.x + this.padding, this.y + 45);

    // Divider

    context.beginPath();
    context.moveTo(this.x + this.padding, this.y + 65);
    context.lineTo(this.x + this.width - this.padding, this.y + 65);

    context.stroke();

    // =====================================
    // ITEM ENTRIES
    // =====================================

    context.font = "20px sans-serif";

    let drawY = this.y + 110;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const prefix = i === this.index ? "▶ " : "  ";

      let text = `${prefix}${entry.name}`;

      if (entry.id !== 0 && entry.count > 1) {
        text += ` x${entry.count}`;
      }

      // =====================================
      // EQUIPPED STATUS
      // =====================================

      let equippedId = 0;

      if (this.type === "weapon") {
        equippedId = $gameActor.weaponId;
      } else if (this.type === "armor") {
        equippedId = $gameActor.armorId;
      }

      if (entry.id !== 0) {
        if (this.type === "weapon") {
          text += `   +${entry.bonus} Attack`;
        } else {
          text += `   +${entry.bonus} Defense`;
        }
      }

      if (entry.id === equippedId) {
        text += "   [Equipped]";
      }

      context.fillText(text, this.x + this.padding, drawY);
      drawY += this.lineHeight;
    }

    // =====================================
    // PREVIEW STAT
    // =====================================

    const preview = this.previewStat();

    if (preview) {
      context.font = "22px Arial";

      context.textAlign = "left";

      context.fillText(
        `${preview.name}: ${preview.current} → ${preview.preview}`,
        this.x + this.padding,
        this.y + this.height - 45,
      );
    }
    context.restore();
  }

  hasResult() {
    return this.result !== null;
  }

  takeResult() {
    const result = this.result;

    this.result = null;

    return result;
  }

  previewStat() {
    const entries = this.entries();

    const entry = entries[this.index];

    if (!entry) {
      return null;
    }

    if (this.type === "weapon") {
      const current = $gameActor.totalAttack();

      const weapon = entry.id === 0 ? null : DatabaseManager.weapon(entry.id);

      const preview = $gameActor.attackWithWeapon(weapon);

      return {
        name: "Attack",
        current: current,
        preview: preview,
      };
    }

    if (this.type === "armor") {
      const current = $gameActor.totalDefense();

      const armor = entry.id === 0 ? null : DatabaseManager.armor(entry.id);

      const preview = $gameActor.defenseWithArmor(armor);

      return {
        name: "Defense",
        current: current,
        preview: preview,
      };
    }
    return null;
  }
}
