"use strict";

class BattleHudLayout {
  static PARTY_SLOTS = 4;

  constructor(scene) {
    this.scene = scene;
  }

  hudBounds() {
    const height = 172;

    return {
      x: 18,
      y: Graphics.height - height - 12,
      width: Math.max(640, Graphics.width - 36),
      height,
    };
  }

  nameColumnBounds() {
    const hud = this.hudBounds();
    const width = Math.max(132, Math.min(176, hud.width * 0.14));

    return {
      x: hud.x,
      y: hud.y,
      width,
      height: hud.height,
    };
  }

  commandBounds() {
    const hud = this.hudBounds();
    const names = this.nameColumnBounds();
    const width = Math.max(200, Math.min(232, hud.width * 0.19));

    return {
      x: names.x + names.width,
      y: hud.y,
      width,
      height: hud.height,
    };
  }

  statsBounds() {
    const hud = this.hudBounds();
    const command = this.commandBounds();
    const right = hud.x + hud.width;
    const x = command.x + command.width;

    return {
      x,
      y: hud.y,
      width: Math.max(260, right - x),
      height: hud.height,
    };
  }

  partyRowBounds(index) {
    const hud = this.hudBounds();
    const safeIndex = Math.max(
      0,
      Math.min(Number(index) || 0, BattleHudLayout.PARTY_SLOTS - 1),
    );
    const height = hud.height / BattleHudLayout.PARTY_SLOTS;

    return {
      x: hud.x,
      y: hud.y + safeIndex * height,
      width: hud.width,
      height,
    };
  }

  nameRowBounds(index) {
    const names = this.nameColumnBounds();
    const row = this.partyRowBounds(index);

    return {
      x: names.x,
      y: row.y,
      width: names.width,
      height: row.height,
    };
  }

  statRowBounds(index) {
    const stats = this.statsBounds();
    const row = this.partyRowBounds(index);

    return {
      x: stats.x,
      y: row.y,
      width: stats.width,
      height: row.height,
    };
  }

  bannerBounds(textWidth = 0) {
    const paddingX = 22;
    const width = Math.max(
      150,
      Math.min(Graphics.width * 0.46, Number(textWidth) + paddingX * 2 || 150),
    );

    return {
      x: (Graphics.width - width) / 2,
      y: 18,
      width,
      height: 42,
      paddingX,
    };
  }

  hintY() {
    return this.hudBounds().y - 10;
  }
}
