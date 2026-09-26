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
    this.accessories = await this.loadJSON("data/Accessories.json");
    this.magickData = await this.loadJSON("data/Magick.json");
    this.skills = await this.loadJSON("data/Skills.json");
    this.valorArts = await this.loadJSON("data/Valor.json");
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

    DatabaseValidator.validateMapData(mapData, this, mapId);

    DebugManager.log(`Map ${mapId} loaded.`);

    return mapData;
  }

  // =================================
  // Indexed Accessor Helpers
  // =================================

  static indexedRecord(collection, id) {
    if (!Array.isArray(collection)) {
      return null;
    }

    return collection[id] || null;
  }

  static indexedRecordName(collection, id, label) {
    const record = this.indexedRecord(collection, id);

    return record ? record.name : `Unknown ${label} ${id}`;
  }

  // =================================
  // Actors
  // =================================

  static actor(actorId) {
    return this.indexedRecord(this.actors, actorId);
  }

  static actorName(actorId) {
    return this.indexedRecordName(this.actors, actorId, "Actor");
  }

  // =================================
  // Enemies
  // =================================

  static enemy(id) {
    return this.indexedRecord(this.enemies, id);
  }

  static enemyName(id) {
    return this.indexedRecordName(this.enemies, id, "Enemy");
  }

  // =================================
  // Encounters
  // =================================

  static encounter(id) {
    return this.indexedRecord(this.encounters, id);
  }

  static encounterName(id) {
    return this.indexedRecordName(this.encounters, id, "Encounter");
  }

  // =================================
  // Items
  // =================================

  static item(itemId) {
    return this.indexedRecord(this.items, itemId);
  }

  static itemName(itemId) {
    return this.indexedRecordName(this.items, itemId, "Item");
  }

  // =================================
  // Weapons
  // =================================

  static weapon(weaponId) {
    return this.indexedRecord(this.weapons, weaponId);
  }

  static weaponName(weaponId) {
    return this.indexedRecordName(this.weapons, weaponId, "Weapon");
  }

  // =================================
  // Armors
  // =================================

  static armor(armorId) {
    return this.indexedRecord(this.armors, armorId);
  }

  static armorName(armorId) {
    return this.indexedRecordName(this.armors, armorId, "Armor");
  }

  // =================================
  // Accessories
  // =================================

  static accessory(accessoryId) {
    return this.indexedRecord(this.accessories, accessoryId);
  }

  static accessoryName(accessoryId) {
    return this.indexedRecordName(this.accessories, accessoryId, "Accessory");
  }

  // =================================
  // Magick
  // =================================

  static magick(id) {
    return this.indexedRecord(this.magickData, id);
  }

  static magickName(id) {
    return this.indexedRecordName(this.magickData, id, "Magick");
  }

  // =================================
  // Skills
  // =================================

  static skill(id) {
    return this.indexedRecord(this.skills, id);
  }

  static skillName(id) {
    return this.indexedRecordName(this.skills, id, "Skill");
  }

  // =================================
  // Valor Arts
  // =================================

  static valorArt(id) {
    return this.indexedRecord(this.valorArts, id);
  }

  static valorArtName(id) {
    return this.indexedRecordName(this.valorArts, id, "Valor Art");
  }

  // =================================
  // Essences
  // =================================

  static essence(id) {
    return this.indexedRecord(this.essences, id);
  }

  static essenceName(id) {
    return this.indexedRecordName(this.essences, id, "Essence");
  }

  // =================================
  // Statuses
  // =================================

  static status(id) {
    return this.indexedRecord(this.statuses, id);
  }

  static statusName(id) {
    return this.indexedRecordName(this.statuses, id, "Status");
  }

  static statusByKey(key) {
    if (!key || !Array.isArray(this.statuses)) {
      return null;
    }

    return this.statuses.find((status) => status?.key === key) || null;
  }

  static statusNameByKey(key) {
    const status = this.statusByKey(key);

    return status ? status.name : `Unknown Status ${key}`;
  }
}
