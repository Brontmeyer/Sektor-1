"use strict";

class BattleHudLayout {
  static PARTY_SLOTS = 4;

  constructor(scene) {
    this.scene = scene;
  }

  topHeaderBounds() {
    return {
      x: 20,
      y: 18,
      width: Math.max(220, Graphics.width - 40),
      height: 44,
    };
  }

  messageBounds() {
    return {
      x: 20,
      y: 66,
      width: Math.max(220, Graphics.width - 40),
      height: 66,
    };
  }

  hudBounds() {
    const height = 190;

    return {
      x: 20,
      y: Graphics.height - height - 10,
      width: Math.max(320, Graphics.width - 40),
      height,
    };
  }

  commandReserveRight() {
    const window = this.scene.commandWindow;

    if (
      window &&
      [window.x, window.width, window.sideGap, window.sideWidth].every(
        Number.isFinite,
      )
    ) {
      return window.x + window.width + window.sideGap + window.sideWidth + 16;
    }

    return Math.max(420, Graphics.width * 0.35);
  }

  partyBounds() {
    const hud = this.hudBounds();
    const right = hud.x + hud.width - 12;
    const left = Math.min(
      right - 320,
      Math.max(this.commandReserveRight(), hud.x + hud.width * 0.34),
    );

    return {
      x: left,
      y: hud.y + 9,
      width: Math.max(320, right - left),
      height: hud.height - 18,
    };
  }

  partyRowBounds(index) {
    const party = this.partyBounds();
    const safeIndex = Math.max(
      0,
      Math.min(Number(index) || 0, BattleHudLayout.PARTY_SLOTS - 1),
    );
    const height = party.height / BattleHudLayout.PARTY_SLOTS;

    return {
      x: party.x,
      y: party.y + safeIndex * height,
      width: party.width,
      height,
    };
  }

  hintY() {
    return this.hudBounds().y - 10;
  }
}
