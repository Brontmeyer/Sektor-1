"use strict";

class BattleTargetManager {
  constructor(scene) {
    this.scene = scene;
  }

  reset() {
    this.scene.targetGroup = "enemy";
    this.scene.targetScope = "single";
    this.selectFirstLivingEnemy();
    this.selectFirstLivingAlly();
  }

  selectFirstLivingEnemy() {
    const { enemies } = this.scene;
    const index = enemies.findIndex((enemy) => enemy && enemy.isAlive());

    if (index < 0) {
      return null;
    }

    this.scene.selectedEnemyIndex = index;
    return enemies[index];
  }

  selectFirstLivingAlly() {
    const allies = $gameParty.livingBattleMembers();

    if (allies.length === 0) {
      return null;
    }

    const allMembers = $gameParty.battleMembers();
    const index = allMembers.indexOf(allies[0]);

    this.scene.selectedAllyIndex = Math.max(0, index);
    return allies[0];
  }

  moveEnemySelection(direction) {
    const { enemies } = this.scene;

    if (enemies.length === 0) {
      return;
    }

    let index = this.scene.selectedEnemyIndex;

    for (let i = 0; i < enemies.length; i++) {
      index += direction;

      if (index < 0) {
        index = enemies.length - 1;
      } else if (index >= enemies.length) {
        index = 0;
      }

      if (enemies[index] && enemies[index].isAlive()) {
        this.scene.selectedEnemyIndex = index;
        return;
      }
    }
  }

  moveAllySelection(direction) {
    const allies = $gameParty.battleMembers();

    if (allies.length === 0) {
      return;
    }

    let index = this.scene.selectedAllyIndex;

    for (let i = 0; i < allies.length; i++) {
      index += direction;

      if (index < 0) {
        index = allies.length - 1;
      } else if (index >= allies.length) {
        index = 0;
      }

      if (allies[index] && allies[index].isAlive()) {
        this.scene.selectedAllyIndex = index;
        return;
      }
    }
  }

  getSelectedEnemy() {
    return this.scene.enemies[this.scene.selectedEnemyIndex] || null;
  }

  getSelectedAlly() {
    return $gameParty.battleMembers()[this.scene.selectedAllyIndex] || null;
  }

  getSelectedTarget() {
    if (this.scene.targetGroup === "ally") {
      return this.getSelectedAlly();
    }

    return this.getSelectedEnemy();
  }

  getCurrentTargets() {
    if (this.scene.targetScope === "all") {
      if (this.scene.targetGroup === "ally") {
        return $gameParty.livingBattleMembers();
      }

      return this.scene.enemies.filter((enemy) => enemy && enemy.isAlive());
    }

    const target = this.getSelectedTarget();
    return target ? [target] : [];
  }
}
