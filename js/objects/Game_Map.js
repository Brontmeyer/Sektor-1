"use strict";

class Game_Map {
  constructor(mapData) {
    this.id = mapData.id;
    this.name = mapData.name;
    this.width = mapData.width;
    this.height = mapData.height;

    this.playerStart = {
      x: mapData.playerStart.x,
      y: mapData.playerStart.y,
    };

    this.obstacles = mapData.obstacles || [];
    this.transfers = mapData.transfers || [];
    this.menuAccess = mapData.menuAccess || {};
    this.areaMap = this.normalizeAreaMap(mapData.areaMap);

    this.events = (mapData.events || []).map(
      (eventData) => new Game_Event(eventData, this.id),
    );

    DebugManager.log(`Map loaded: ${this.name}`);
  }

  normalizeAreaMap(areaMap) {
    const source = areaMap && typeof areaMap === "object" ? areaMap : {};
    const locations = Array.isArray(source.locations)
      ? source.locations.map((location) => ({ ...location }))
      : [];

    return {
      enabled: source.enabled !== false && locations.length > 0,
      locations,
    };
  }

  areaMapEnabled() {
    return this.areaMap?.enabled === true && this.areaMap.locations.length > 0;
  }

  areaMapLocations() {
    return this.areaMapEnabled() ? this.areaMap.locations : [];
  }

  playerMapPoint(player) {
    return {
      x: Number(player?.x || 0) + Number(player?.width || 0) / 2,
      y: Number(player?.y || 0) + Number(player?.height || 0) / 2,
    };
  }

  updateAreaDiscovery(player) {
    if (!this.areaMapEnabled() || !globalThis.$gameSystem) {
      return [];
    }

    const point = this.playerMapPoint(player);
    const discovered = [];

    for (const location of this.areaMapLocations()) {
      const radius = Math.max(0, Number(location.discoverRadius) || 0);
      const dx = Number(location.x) - point.x;
      const dy = Number(location.y) - point.y;
      const withinRadius = Math.sqrt(dx * dx + dy * dy) <= radius;

      if (location.initiallyDiscovered !== true && !withinRadius) {
        continue;
      }

      if ($gameSystem.discoverLocation?.(this.id, location.id) === true) {
        discovered.push(location.id);
        DebugManager.log(`Discovered area-map location: ${location.name}`);
      }
    }

    return discovered;
  }

  areaMapSnapshot(player) {
    if (!this.areaMapEnabled()) {
      return null;
    }

    this.updateAreaDiscovery(player);
    const point = this.playerMapPoint(player);

    return {
      mapId: this.id,
      name: this.name,
      width: this.width,
      height: this.height,
      player: point,
      obstacles: this.obstacles.map((obstacle) => ({ ...obstacle })),
      transfers: this.transfers.map((transfer) => ({ ...transfer })),
      locations: this.areaMapLocations().map((location) => ({
        ...location,
        discovered:
          $gameSystem?.isLocationDiscovered?.(this.id, location.id) === true,
      })),
    };
  }

  getCollisionObstacles() {
    const solidEvents = this.events.filter((event) => event.solid);
    return [...this.obstacles, ...solidEvents];
  }

  draw(cameraX, cameraY) {
    const context = Graphics.context;

    context.fillStyle = "#2f2f2f";
    context.fillRect(-cameraX, -cameraY, this.width, this.height);

    // Temporary grid so we can see movement through the world.
    const gridSize = 64;

    context.strokeStyle = "#444444";
    context.lineWidth = 1;

    for (let x = 0; x <= this.width; x += gridSize) {
      context.beginPath();
      context.moveTo(x - cameraX, -cameraY);
      context.lineTo(x - cameraX, this.height - cameraY);
      context.stroke();
    }

    for (let y = 0; y <= this.height; y += gridSize) {
      context.beginPath();
      context.moveTo(-cameraX, y - cameraY);
      context.lineTo(this.width - cameraX, y - cameraY);
      context.stroke();
    }

    context.fillStyle = "#666666";

    for (const obstacle of this.obstacles) {
      context.fillRect(
        obstacle.x - cameraX,
        obstacle.y - cameraY,
        obstacle.width,
        obstacle.height,
      );
    }

    // Temporary transfer-zone visualization.
    context.fillStyle = "rgba(0, 150, 255, 0.5)";

    for (const transfer of this.transfers) {
      context.fillRect(
        transfer.x - cameraX,
        transfer.y - cameraY,
        transfer.width,
        transfer.height,
      );
    }

    for (const event of this.events) {
      event.draw(cameraX, cameraY);
    }
  }
}
