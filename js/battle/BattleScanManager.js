"use strict";

class BattleScanManager {
  constructor(scene) {
    this.scene = scene;
    this.helpVisible = false;
    this.scannedEnemies = new Set();
  }

  toggleHelp() {
    this.helpVisible = !this.helpVisible;
    return this.helpVisible;
  }

  setHelpVisible(visible) {
    this.helpVisible = visible === true;
    return this.helpVisible;
  }

  isHelpVisible() {
    return this.helpVisible === true;
  }

  scan(enemy) {
    if (!enemy || !this.scene.enemies.includes(enemy)) {
      return false;
    }

    this.scannedEnemies.add(enemy);
    return true;
  }

  isScanned(enemy) {
    return !!enemy && this.scannedEnemies.has(enemy);
  }

  currentEnemyTarget() {
    if (
      !this.scene.selectingEnemyTarget ||
      this.scene.targetGroup !== "enemy"
    ) {
      return null;
    }

    return this.scene.targetManager?.getSelectedEnemy?.() || null;
  }

  displayElementName(element) {
    const value = String(element || "").trim();

    if (!value) {
      return "";
    }

    return value
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  elementAffinities(enemy) {
    const weak = [];
    const resist = [];
    const immune = [];
    const rates = enemy?.elementRates;

    if (!rates || typeof rates !== "object" || Array.isArray(rates)) {
      return { weak, resist, immune };
    }

    for (const [element, rawRate] of Object.entries(rates)) {
      if (["none", "restorative"].includes(element)) {
        continue;
      }

      const rate =
        typeof enemy.elementRate === "function"
          ? Number(enemy.elementRate(element))
          : Number(rawRate);

      if (!Number.isFinite(rate) || rate < 0 || rate === 1) {
        continue;
      }

      const name = this.displayElementName(element);

      if (!name) {
        continue;
      }

      if (rate === 0) {
        immune.push(name);
      } else if (rate > 1) {
        weak.push(name);
      } else if (rate < 1) {
        resist.push(name);
      }
    }

    return { weak, resist, immune };
  }

  tacticalProfile(enemy) {
    if (!enemy) {
      return null;
    }

    const scanned = this.isScanned(enemy);

    if (!scanned) {
      return {
        scanned: false,
        name: enemy.name || "Enemy",
        hp: null,
        maxHp: null,
        mp: null,
        maxMp: null,
        weak: null,
        resist: null,
        immune: null,
      };
    }

    const affinities = this.elementAffinities(enemy);

    return {
      scanned: true,
      name: enemy.name || "Enemy",
      hp: Math.max(0, Number(enemy.hp) || 0),
      maxHp: Math.max(0, Number(enemy.maxHp) || 0),
      mp: Math.max(0, Number(enemy.mp) || 0),
      maxMp: Math.max(0, Number(enemy.maxMp) || 0),
      weak: affinities.weak,
      resist: affinities.resist,
      immune: affinities.immune,
    };
  }
}
