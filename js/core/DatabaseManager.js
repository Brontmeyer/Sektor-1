"use strict";

class DatabaseManager {
  static async loadJSON(filename) {
    const response = await fetch(filename);

    if (!response.ok) {
      throw new Error(`Failed to load ${filename}`);
    }

    return await response.json();
  }

  static async loadDatabase() {
    console.log("Loading database...");

    this.system = await this.loadJSON("data/System.json");

    this.mapInfos = await this.loadJSON("data/MapInfos.json");

    this.items = await this.loadJSON("data/Items.json");

    console.log("Database loaded.");
  }

  static async loadMap(mapId) {
    const mapInfo = this.mapInfos.find((info) => info.id === mapId);

    if (!mapInfo) {
      throw new Error(`Map ID ${mapId} does not exist.`);
    }

    console.log(`Loading map ${mapId}: ${mapInfo.name}`);

    const mapData = await this.loadJSON(`data/${mapInfo.file}`);

    console.log(`Map ${mapId} loaded.`);

    return mapData;
  }

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
}
