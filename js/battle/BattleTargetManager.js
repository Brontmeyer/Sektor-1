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

  allowedTargetGroups(skill) {
    if (!skill) {
      return ["enemy"];
    }

    if (Array.isArray(skill.target)) {
      return skill.target;
    }

    if (typeof skill.target === "string") {
      return [skill.target];
    }

    return ["enemy"];
  }

  canTargetGroup(skill, group) {
    return this.allowedTargetGroups(skill).includes(group);
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

  selectFrontLivingAlly() {
    const allies = $gameParty.battleMembers();
    const enemy = this.getSelectedEnemy();

    if (!enemy) {
      return this.selectFirstLivingAlly();
    }

    const enemyPosition = this.scene.getEnemyPosition(enemy);

    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i];

      if (!ally || ally.isDead()) {
        continue;
      }

      const allyPosition = this.scene.getAllyPosition(ally);

      const distance = Math.hypot(
        allyPosition.x - enemyPosition.x,
        allyPosition.y - enemyPosition.y,
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) {
      return null;
    }

    this.scene.selectedAllyIndex = bestIndex;
    return allies[bestIndex];
  }

  selectFrontLivingEnemy() {
    const enemies = this.scene.enemies;
    const ally = this.getSelectedAlly();

    if (!ally) {
      return this.selectFirstLivingEnemy();
    }

    const allyPosition = this.scene.getAllyPosition(ally);

    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];

      if (!enemy || enemy.isDead()) {
        continue;
      }

      const enemyPosition = this.scene.getEnemyPosition(enemy);

      const distance = Math.hypot(
        enemyPosition.x - allyPosition.x,
        enemyPosition.y - allyPosition.y,
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) {
      return null;
    }

    this.scene.selectedEnemyIndex = bestIndex;
    return enemies[bestIndex];
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

  moveSpatialSelection(group, dx, dy) {
    const isAlly = group === "ally";

    const battlers = isAlly ? $gameParty.battleMembers() : this.scene.enemies;

    const selectedIndex = isAlly
      ? this.scene.selectedAllyIndex
      : this.scene.selectedEnemyIndex;

    const current = battlers[selectedIndex];

    if (!current || current.isDead()) {
      if (isAlly) {
        this.selectFirstLivingAlly();
      } else {
        this.selectFirstLivingEnemy();
      }

      return false;
    }

    const currentPosition = isAlly
      ? this.scene.getAllyPosition(current)
      : this.scene.getEnemyPosition(current);

    let bestIndex = -1;
    let bestScore = Infinity;

    for (let i = 0; i < battlers.length; i++) {
      const battler = battlers[i];

      if (!battler || battler.isDead() || i === selectedIndex) {
        continue;
      }

      const position = isAlly
        ? this.scene.getAllyPosition(battler)
        : this.scene.getEnemyPosition(battler);

      const offsetX = position.x - currentPosition.x;
      const offsetY = position.y - currentPosition.y;

      // How far is the candidate in the requested direction?
      const forward = offsetX * dx + offsetY * dy;

      if (forward <= 0) {
        continue;
      }

      // Penalize targets that are far off the requested axis.
      const sideways = Math.abs(offsetX * dy - offsetY * dx);
      const distance = Math.hypot(offsetX, offsetY);

      const score = distance + sideways * 0.75;

      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) {
      return false;
    }

    if (isAlly) {
      this.scene.selectedAllyIndex = bestIndex;
    } else {
      this.scene.selectedEnemyIndex = bestIndex;
    }

    return true;
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

  allowedScopes(skill) {
    if (!skill) {
      return ["single"];
    }

    if (Array.isArray(skill.scope)) {
      return skill.scope;
    }

    if (typeof skill.scope === "string") {
      return [skill.scope];
    }

    return ["single"];
  }

  canUseScope(skill, scope) {
    return this.allowedScopes(skill).includes(scope);
  }

  toggleScope(skill) {
    const scopes = this.allowedScopes(skill);

    if (scopes.length <= 1) {
      this.scene.targetScope = scopes[0] || "single";
      return this.scene.targetScope;
    }

    const currentIndex = scopes.indexOf(this.scene.targetScope);
    const nextIndex =
      currentIndex >= 0 ? (currentIndex + 1) % scopes.length : 0;

    this.scene.targetScope = scopes[nextIndex];

    return this.scene.targetScope;
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
