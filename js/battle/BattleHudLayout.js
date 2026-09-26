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

  selectorBounds() {
    const stats = this.statsBounds();
    const width = Math.min(430, Math.max(330, stats.width * 0.54));

    return {
      x: stats.x,
      y: stats.y,
      width,
      height: stats.height,
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
    const width = Math.min(1200, Math.max(640, hud.width * 0.78));
    const height = 64;

    return {
      x: hud.x + (hud.width - width) / 2,
      y: hud.y - height - 12,
      width,
      height,
    };
  }

  surgeContextBounds() {
    const hud = this.hudBounds();
    const command = this.commandBounds();
    const selector = this.scene?.skillsWindow || null;
    const selectorX = Number(selector?.x) || command.x;
    const selectorWidth = Number(selector?.width) || command.width;
    const selectorY = Number(selector?.y) || Math.max(10, command.y - 122);
    const lineHeight = Number(selector?.lineHeight) || 34;
    const selectedIndex = Math.max(0, Math.min(1, Number(selector?.index) || 0));
    const selectedRowCenterY = selectorY + 58 + selectedIndex * lineHeight;
    const height = 54;
    const x = selectorX + selectorWidth + 10;
    const availableWidth = Math.max(260, hud.x + hud.width - x);

    return {
      x,
      y: Math.max(10, selectedRowCenterY - height / 2),
      width: Math.min(680, availableWidth),
      height,
    };
  }

  contextPanelBounds() {
    if (
      this.scene?.skillsWindow?.isOpen?.() === true &&
      this.scene?.skillsWindow?.mode === "surge"
    ) {
      return this.surgeContextBounds();
    }

    return this.tacticalHelpBounds();
  }

  contextHelpVisible() {
    if (this.scene?.outcome) {
      return false;
    }

    if (this.scene?.selectingEnemyTarget === true) {
      return true;
    }

    const selectorOpen = [
      this.scene?.skillsWindow,
      this.scene?.magickWindow,
      this.scene?.itemWindow,
    ].some((window) => window?.isOpen?.() === true);

    return selectorOpen || this.scene?.scanManager?.isHelpVisible?.() === true;
  }

  bannerBounds(textWidth = 0) {
    const paddingX = 26;
    const width = Math.max(
      220,
      Math.min(Graphics.width * 0.48, Number(textWidth) + paddingX * 2 || 220),
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
    if (this.contextHelpVisible()) {
      return this.contextPanelBounds().y - 7;
    }

    return this.hudBounds().y - 9;
  }
}
