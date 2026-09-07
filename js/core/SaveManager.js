"use strict";

class SaveManager {
  static saveKey(slotId) {
    return `Sektor1_Save_${slotId}`;
  }

  static save(slotId = 1) {
    const saveData = {
      version: 1,

      actor: {
        actorId: $gameActor.actorId,
        name: $gameActor.name,
        level: $gameActor.level,
        exp: $gameActor.exp,

        hp: $gameActor.hp,
        maxHp: $gameActor.maxHp,

        attack: $gameActor.attack,
        defense: $gameActor.defense,

        weaponId: $gameActor.weaponId,
        armorId: $gameActor.armorId,
      },

      party: {
        items: { ...$gameParty.items },
        weapons: { ...$gameParty.weapons },
        armors: { ...$gameParty.armors },
      },
    };

    const json = JSON.stringify(saveData);

    localStorage.setItem(this.saveKey(slotId), json);

    console.log(`Game saved to slot ${slotId}.`);

    return true;
  }

  static exists(slotId = 1) {
    return localStorage.getItem(this.saveKey(slotId)) !== null;
  }

  static read(slotId = 1) {
    const json = localStorage.getItem(this.saveKey(slotId));

    if (!json) {
      return null;
    }

    try {
      return JSON.parse(json);
    } catch (error) {
      console.error("Could not read save data:", error);

      return null;
    }
  }

  static load(slotId = 1) {
    const saveData = this.read(slotId);

    if (!saveData) {
      console.warn(`No save data exists in slot ${slotId}.`);

      return false;
    }

    // =========================
    // RESTORE ACTOR
    // =========================

    const actorData = saveData.actor;

    if (actorData) {
      $gameActor.actorId = actorData.actorId;

      $gameActor.name = actorData.name;

      $gameActor.level = actorData.level;

      $gameActor.exp = actorData.exp;

      $gameActor.hp = actorData.hp;

      $gameActor.maxHp = actorData.maxHp;

      $gameActor.attack = actorData.attack;

      $gameActor.defense = actorData.defense;

      $gameActor.weaponId = actorData.weaponId;

      $gameActor.armorId = actorData.armorId;
    }

    // =========================
    // RESTORE PARTY
    // =========================

    const partyData = saveData.party;

    if (partyData) {
      $gameParty.items = { ...(partyData.items || {}) };

      $gameParty.weapons = { ...(partyData.weapons || {}) };

      $gameParty.armors = { ...(partyData.armors || {}) };
    }

    console.log(`Game loaded from slot ${slotId}.`);

    return true;
  }
}
