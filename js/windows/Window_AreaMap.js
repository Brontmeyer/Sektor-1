"use strict";

class Window_AreaMap {
  constructor(snapshot = null) {
    this.snapshot = snapshot || {
      mapId: 0,
      name: "Unknown Area",
      width: 1,
      height: 1,
      player: { x: 0, y: 0 },
      obstacles: [],
      transfers: [],
      locations: [],
    };
    this.index = 0;
  }

  discoveredLocations() {
    return (this.snapshot.locations || []).filter(
      (location) => location?.discovered === true,
    );
  }

  currentLocation() {
    const locations = this.discoveredLocations();
    if (locations.length === 0) {
      return null;
    }

    this.index = Math.max(0, Math.min(this.index, locations.length - 1));
    return locations[this.index] || null;
  }

  update() {
    const locations = this.discoveredLocations();
    if (locations.length <= 1) {
      this.index = 0;
      return;
    }

    if (Input.isActionRepeated?.("up") || Input.isActionTriggered("up")) {
      this.index = (this.index - 1 + locations.length) % locations.length;
    } else if (
      Input.isActionRepeated?.("down") ||
      Input.isActionTriggered("down")
    ) {
      this.index = (this.index + 1) % locations.length;
    }
  }

  panel(context, bounds, options = {}) {
    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      return UIAssetManager.drawPanel(
        context,
        "menuPanel",
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        {
          fallbackFill: "rgba(12, 20, 48, 0.96)",
          fallbackStroke: "rgba(145, 162, 238, 0.76)",
          innerStroke: "rgba(232, 234, 255, 0.16)",
          assetAlpha: 0.5,
          lineWidth: 1.5,
          sourceMargin: 12,
          destMargin: 12,
          ...options,
        },
      );
    }

    context.fillStyle = options.fallbackFill || "rgba(12, 20, 48, 0.96)";
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle =
      options.fallbackStroke || "rgba(145, 162, 238, 0.76)";
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    return false;
  }

  layout() {
    const margin = 28;
    const gap = 16;
    const headerHeight = 54;
    const contentY = margin + headerHeight + 12;
    const contentHeight = Graphics.height - contentY - margin;
    const sideWidth = 360;
    const mapWidth = Graphics.width - margin * 2 - gap - sideWidth;

    return {
      header: {
        x: margin,
        y: margin,
        width: Graphics.width - margin * 2,
        height: headerHeight,
      },
      map: {
        x: margin,
        y: contentY,
        width: mapWidth,
        height: contentHeight,
      },
      side: {
        x: margin + mapWidth + gap,
        y: contentY,
        width: sideWidth,
        height: contentHeight,
      },
    };
  }

  mapViewport(bounds) {
    const padding = 34;
    const availableWidth = Math.max(1, bounds.width - padding * 2);
    const availableHeight = Math.max(1, bounds.height - padding * 2);
    const mapWidth = Math.max(1, Number(this.snapshot.width) || 1);
    const mapHeight = Math.max(1, Number(this.snapshot.height) || 1);
    const scale = Math.min(
      availableWidth / mapWidth,
      availableHeight / mapHeight,
    );
    const width = mapWidth * scale;
    const height = mapHeight * scale;

    return {
      x: bounds.x + (bounds.width - width) / 2,
      y: bounds.y + (bounds.height - height) / 2,
      width,
      height,
      scale,
    };
  }

  project(point, viewport) {
    return {
      x: viewport.x + Number(point?.x || 0) * viewport.scale,
      y: viewport.y + Number(point?.y || 0) * viewport.scale,
    };
  }

  drawHeader(context, bounds) {
    this.panel(context, bounds, { assetAlpha: 0.48 });
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle =
      typeof UIThemePalette !== "undefined"
        ? UIThemePalette.primary()
        : "#f4f7fb";
    context.font = "600 20px sans-serif";
    context.fillText("AREA MAP", bounds.x + 20, bounds.y + bounds.height / 2);

    context.fillStyle =
      typeof UIThemePalette !== "undefined"
        ? UIThemePalette.secondary()
        : "#bdc9d8";
    context.font = "14px sans-serif";
    context.fillText(
      this.snapshot.name || "Unknown Area",
      bounds.x + 150,
      bounds.y + bounds.height / 2,
    );

    context.textAlign = "right";
    context.fillText(
      `${Input.actionLabel?.("cancel") || "Back"}: Back`,
      bounds.x + bounds.width - 18,
      bounds.y + bounds.height / 2,
    );
  }

  drawMap(context, bounds) {
    this.panel(context, bounds, { assetAlpha: 0.42 });
    const viewport = this.mapViewport(bounds);

    context.fillStyle = "rgba(7, 13, 29, 0.9)";
    context.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
    context.strokeStyle = "rgba(153, 176, 230, 0.48)";
    context.lineWidth = 1.5;
    context.strokeRect(viewport.x, viewport.y, viewport.width, viewport.height);

    context.fillStyle = "rgba(119, 133, 160, 0.32)";
    for (const obstacle of this.snapshot.obstacles || []) {
      const topLeft = this.project(obstacle, viewport);
      context.fillRect(
        topLeft.x,
        topLeft.y,
        Math.max(1, Number(obstacle.width || 0) * viewport.scale),
        Math.max(1, Number(obstacle.height || 0) * viewport.scale),
      );
    }

    const selected = this.currentLocation();
    for (const location of this.discoveredLocations()) {
      const point = this.project(location, viewport);
      const isSelected = selected?.id === location.id;
      const size = isSelected ? 13 : 9;

      context.fillStyle = location.type === "exit" ? "#9f8cff" : "#70e0c0";
      context.fillRect(point.x - size / 2, point.y - size / 2, size, size);

      if (isSelected) {
        context.strokeStyle = "#ffd75a";
        context.lineWidth = 2;
        context.strokeRect(
          point.x - size / 2 - 4,
          point.y - size / 2 - 4,
          size + 8,
          size + 8,
        );
      }
    }

    const player = this.project(this.snapshot.player || {}, viewport);
    context.fillStyle = "#ffd75a";
    context.fillRect(player.x - 5, player.y - 5, 10, 10);
    context.strokeStyle = "rgba(255, 255, 255, 0.9)";
    context.lineWidth = 1;
    context.strokeRect(player.x - 7, player.y - 7, 14, 14);
  }

  drawLocationList(context, bounds) {
    this.panel(context, bounds, { assetAlpha: 0.46 });
    const locations = this.discoveredLocations();
    const left = bounds.x + 20;
    const right = bounds.x + bounds.width - 20;

    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#aebfd1";
    context.font = "600 13px sans-serif";
    context.fillText("DISCOVERED", left, bounds.y + 26);

    context.textAlign = "right";
    context.fillStyle = "#ffffff";
    context.font = "600 15px sans-serif";
    context.fillText(String(locations.length), right, bounds.y + 26);

    const listTop = bounds.y + 54;
    const rowHeight = 52;

    if (locations.length === 0) {
      context.textAlign = "left";
      context.fillStyle = "#8fa1b6";
      context.font = "15px sans-serif";
      context.fillText("No locations discovered.", left, listTop + 18);
    }

    locations.forEach((location, index) => {
      const rowY = listTop + index * rowHeight;
      const selected = index === this.index;

      if (selected) {
        context.fillStyle = "rgba(255, 215, 90, 0.1)";
        context.fillRect(left - 8, rowY, bounds.width - 24, rowHeight - 4);
      }

      context.textAlign = "left";
      context.fillStyle = selected ? "#ffd75a" : "#f0f3f7";
      context.font = "16px sans-serif";
      context.fillText(
        `${selected ? "▶ " : "  "}${location.name}`,
        left,
        rowY + 17,
      );

      context.fillStyle = location.type === "exit" ? "#b9aaff" : "#70e0c0";
      context.font = "600 11px sans-serif";
      context.fillText(
        String(location.type || "landmark").toUpperCase(),
        left + 20,
        rowY + 37,
      );
    });

    const current = this.currentLocation();
    const detailTop = Math.max(
      bounds.y + bounds.height - 150,
      listTop + locations.length * rowHeight + 18,
    );

    context.strokeStyle = "rgba(205, 216, 235, 0.18)";
    context.beginPath();
    context.moveTo(left, detailTop);
    context.lineTo(right, detailTop);
    context.stroke();

    context.fillStyle = "#aebfd1";
    context.font = "600 12px sans-serif";
    context.fillText("LOCATION", left, detailTop + 24);
    context.fillStyle = "#f4f7fb";
    context.font = "15px sans-serif";
    context.fillText(current?.name || "No location selected", left, detailTop + 48);

    context.fillStyle = "#aebfd1";
    context.font = "13px sans-serif";
    const description = String(current?.description || "Explore the area to reveal locations.");
    context.fillText(description.slice(0, 42), left, detailTop + 74);

    context.fillStyle = "#ffd75a";
    context.fillRect(left, bounds.y + bounds.height - 32, 8, 8);
    context.fillStyle = "#cbd8e7";
    context.font = "12px sans-serif";
    context.fillText("You", left + 16, bounds.y + bounds.height - 28);

    context.fillStyle = "#70e0c0";
    context.fillRect(left + 70, bounds.y + bounds.height - 32, 8, 8);
    context.fillStyle = "#cbd8e7";
    context.fillText("Landmark", left + 86, bounds.y + bounds.height - 28);

    context.fillStyle = "#9f8cff";
    context.fillRect(left + 180, bounds.y + bounds.height - 32, 8, 8);
    context.fillStyle = "#cbd8e7";
    context.fillText("Exit", left + 196, bounds.y + bounds.height - 28);
  }

  draw() {
    const context = Graphics.context;
    const layout = this.layout();

    context.save();
    this.drawHeader(context, layout.header);
    this.drawMap(context, layout.map);
    this.drawLocationList(context, layout.side);
    context.restore();
  }
}
