"use strict";

class DatabaseManager {
  static async loadDatabase() {
    DebugManager.log("Loading database...");

    this.system = await this.loadJSON("data/System.json");
    DebugManager.setEnabled(this.system.debugMode !== false);

    this.mapInfos = await this.loadJSON("data/MapInfos.json");

    this.items = await this.loadJSON("data/Items.json");
    this.actors = await this.loadJSON("data/Actors.json");

    this.weapons = await this.loadJSON("data/Weapons.json");
    this.armors = await this.loadJSON("data/Armors.json");
    this.skills = await this.loadJSON("data/Skills.json");
    this.essences = await this.loadJSON("data/Essences.json");
    this.statuses = await this.loadJSON("data/Statuses.json");
    this.enemies = await this.loadJSON("data/Enemies.json");
    this.encounters = await this.loadJSON("data/Encounters.json");

    DatabaseValidator.validate(this);

    DebugManager.log("Database loaded.");
  }

  static async loadJSON(filename) {
    const response = await fetch(filename);

    if (!response.ok) {
      throw new Error(`Failed to load ${filename}`);
    }

    return await response.json();
  }

  static async loadMap(mapId) {
    const mapInfo = this.mapInfos.find((info) => info.id === mapId);

    if (!mapInfo) {
      throw new Error(`Map ID ${mapId} does not exist.`);
    }

    DebugManager.log(`Loading map ${mapId}: ${mapInfo.name}`);

    const mapData = await this.loadJSON(`data/${mapInfo.file}`);

    DebugManager.log(`Map ${mapId} loaded.`);

    return mapData;
  }

  // =================================
  // Actors
  // =================================

  static actor(actorId) {
    return this.actors[actorId] || null;
  }

  static actorName(actorId) {
    const actor = this.actor(actorId);

    if (!actor) {
      return `Unknown Actor ${actorId}`;
    }

    return actor.name;
  }

  // =================================
  // Enemies
  // =================================

  static enemy(id) {
    return this.enemies?.[id] || null;
  }

  static enemyName(id) {
    const enemy = this.enemy(id);

    return enemy ? enemy.name : "Unknown Enemy";
  }

  // =================================
  // Encounters
  // =================================

  static encounter(id) {
    return this.encounters?.[id] || null;
  }

  static encounterName(id) {
    const encounter = this.encounter(id);

    return encounter ? encounter.name : "Unknown Encounter";
  }

  // =================================
  // Items
  // =================================

  static item(itemId) {
    return this.items[itemId] || null;
  }

  static itemName(itemId) {
    const item = this.item(itemId);

    if (!item) {
      return `Unknown Item ${itemId}`;
    }

    return item.name;
  }

  // =================================
  // Weapons
  // =================================

  static weapon(weaponId) {
    return this.weapons[weaponId] || null;
  }

  static weaponName(weaponId) {
    const weapon = this.weapon(weaponId);

    if (!weapon) {
      return `Unknown Weapon ${weaponId}`;
    }

    return weapon.name;
  }

  // =================================
  // Armors
  // =================================

  static armor(armorId) {
    return this.armors[armorId] || null;
  }

  static armorName(armorId) {
    const armor = this.armor(armorId);

    if (!armor) {
      return `Unknown Armor ${armorId}`;
    }

    return armor.name;
  }

  // =================================
  // Skills
  // =================================

  static skill(id) {
    return this.skills?.[id] || null;
  }

  static skillName(id) {
    const skill = this.skill(id);

    return skill ? skill.name : "Unknown Skill";
  }

  // =================================
  // Essences
  // =================================

  static essence(id) {
    return this.essences?.[id] || null;
  }

  static essenceName(id) {
    const essence = this.essence(id);

    return essence ? essence.name : "Unknown Essence";
  }

  // =================================
  // Statuses
  // =================================

  static status(id) {
    return this.statuses?.[id] || null;
  }

  static statusName(id) {
    const status = this.status(id);

    return status ? status.name : "Unknown Status";
  }
}
