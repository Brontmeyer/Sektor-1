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

    this.events = (mapData.events || []).map(
      (eventData) => new Game_Event(eventData, this.id),
    );

    console.log(`Map loaded: ${this.name}`);
  }

  draw(cameraX, cameraY) {
    const context = Graphics.context;

    context.fillStyle = "#2f2f2f";
    context.fillRect(-cameraX, -cameraY, this.width, this.height);

    // Temporary grid so we can see movement
    // through the world.

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
