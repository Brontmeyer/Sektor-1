"use strict";

class BattleHudLayout {
  static PARTY_SLOTS = 4;

  constructor(scene) {
    this.scene = scene;
  }

  hudBounds() {
    const height = 156;

    return {
      x: 18,
      y: Graphics.height - height - 12,
      width: Math.max(640, Graphics.width - 36),
      height,
    };
  }

  nameColumnBounds() {
    const hud = this.hudBounds();
    const width = Math.max(126, Math.min(166, hud.width * 0.132));

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
    const width = Math.max(194, Math.min(220, hud.width * 0.178));

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

  tacticalHelpBounds() {
    const hud = this.hudBounds();
    const width = Math.min(860, Math.max(520, hud.width * 0.62));
    const height = 54;

    return {
      x: hud.x + (hud.width - width) / 2,
      y: hud.y - height - 14,
      width,
      height,
    };
  }

  bannerBounds(textWidth = 0) {
    const paddingX = 18;
    const width = Math.max(
      136,
      Math.min(Graphics.width * 0.42, Number(textWidth) + paddingX * 2 || 136),
    );

    return {
      x: (Graphics.width - width) / 2,
      y: 18,
      width,
      height: 36,
      paddingX,
    };
  }

  hintY() {
    if (this.scene.scanManager?.isHelpVisible?.()) {
      return this.tacticalHelpBounds().y - 7;
    }

    return this.hudBounds().y - 9;
  }
}
