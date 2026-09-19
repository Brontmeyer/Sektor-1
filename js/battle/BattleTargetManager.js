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

  // =================================
  // Scope and Target Management
  // =================================

  allowedScopes(magick) {
    if (!magick) {
      return ["single"];
    }

    if (Array.isArray(magick.scope)) {
      return magick.scope;
    }

    if (typeof magick.scope === "string") {
      return [magick.scope];
    }

    return ["single"];
  }

  canUseScope(magick, scope) {
    return this.allowedScopes(magick).includes(scope);
  }

  toggleScope(magick) {
    const scopes = this.allowedScopes(magick);

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

  allowedTargetGroups(magick) {
    if (!magick) {
      return ["enemy"];
    }

    if (Array.isArray(magick.target)) {
      return magick.target;
    }

    if (typeof magick.target === "string") {
      return [magick.target];
    }

    return ["enemy"];
  }

  canTargetGroup(magick, group) {
    return this.allowedTargetGroups(magick).includes(group);
  }

  currentMagick() {
    return this.scene.pendingMagick || null;
  }

  currentCaster() {
    return this.scene?.partyController?.currentBattler?.() || null;
  }

  isSelectableTarget(battler, magick = this.currentMagick()) {
    if (!battler) {
      return false;
    }

    if (magick) {
      const caster = this.currentCaster();

      if (caster && typeof caster.isValidMagickTarget === "function") {
        return caster.isValidMagickTarget(magick, battler);
      }
    }

    if (typeof battler.isAlive === "function") {
      return battler.isAlive();
    }

    return !(typeof battler.isDead === "function" && battler.isDead());
  }

  selectableBattlers(group, magick = this.currentMagick()) {
    const battlers =
      group === "ally" ? $gameParty.battleMembers() : this.scene.enemies;

    return battlers.filter((battler) => this.isSelectableTarget(battler, magick));
  }

  selectBattler(target) {
    if (!target) {
      return null;
    }

    const allies = $gameParty.battleMembers();
    const allyIndex = allies.indexOf(target);

    if (allyIndex >= 0) {
      this.scene.targetGroup = "ally";
      this.scene.selectedAllyIndex = allyIndex;
      return target;
    }

    const enemyIndex = this.scene.enemies.indexOf(target);

    if (enemyIndex >= 0) {
      this.scene.targetGroup = "enemy";
      this.scene.selectedEnemyIndex = enemyIndex;
      return target;
    }

    return null;
  }

  // =================================
  // Target Movement
  // =================================

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

      if (this.isSelectableTarget(enemies[index])) {
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

      if (this.isSelectableTarget(allies[index])) {
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

    if (!this.isSelectableTarget(current)) {
      if (isAlly) {
        this.selectFirstSelectableAlly();
      } else {
        this.selectFirstSelectableEnemy();
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

      if (!this.isSelectableTarget(battler) || i === selectedIndex) {
        continue;
      }

      const position = isAlly
        ? this.scene.getAllyPosition(battler)
        : this.scene.getEnemyPosition(battler);

      const offsetX = position.x - currentPosition.x;
      const offsetY = position.y - currentPosition.y;
      const forward = offsetX * dx + offsetY * dy;

      if (forward <= 0) {
        continue;
      }

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

  // =================================
  // Target Selection
  // =================================

  selectFirstSelectableEnemy(magick = this.currentMagick()) {
    const { enemies } = this.scene;
    const index = enemies.findIndex((enemy) =>
      this.isSelectableTarget(enemy, magick),
    );

    if (index < 0) {
      return null;
    }

    this.scene.selectedEnemyIndex = index;
    return enemies[index];
  }

  selectFirstSelectableAlly(magick = this.currentMagick()) {
    const allies = $gameParty.battleMembers();
    const index = allies.findIndex((ally) =>
      this.isSelectableTarget(ally, magick),
    );

    if (index < 0) {
      return null;
    }

    this.scene.selectedAllyIndex = index;
    return allies[index];
  }

  selectFirstLivingEnemy() {
    return this.selectFirstSelectableEnemy(null);
  }

  selectFirstLivingAlly() {
    return this.selectFirstSelectableAlly(null);
  }

  selectFrontSelectableAlly(magick = this.currentMagick()) {
    const allies = $gameParty.battleMembers();
    const enemy = this.getSelectedEnemy();

    if (!enemy) {
      return this.selectFirstSelectableAlly(magick);
    }

    const enemyPosition = this.scene.getEnemyPosition(enemy);

    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i];

      if (!this.isSelectableTarget(ally, magick)) {
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

  selectFrontSelectableEnemy(magick = this.currentMagick()) {
    const enemies = this.scene.enemies;
    const ally = this.getSelectedAlly();

    if (!ally) {
      return this.selectFirstSelectableEnemy(magick);
    }

    const allyPosition = this.scene.getAllyPosition(ally);

    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];

      if (!this.isSelectableTarget(enemy, magick)) {
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

  selectFrontLivingAlly() {
    return this.selectFrontSelectableAlly(null);
  }

  selectFrontLivingEnemy() {
    return this.selectFrontSelectableEnemy(null);
  }

  // =================================
  // Target Retrieval
  // =================================

  getCurrentTargets() {
    if (this.scene.targetScope === "all") {
      return this.selectableBattlers(this.scene.targetGroup);
    }

    const target = this.getSelectedTarget();
    return this.isSelectableTarget(target) ? [target] : [];
  }

  getSelectedAlly() {
    return $gameParty.battleMembers()[this.scene.selectedAllyIndex] || null;
  }

  getSelectedEnemy() {
    return this.scene.enemies[this.scene.selectedEnemyIndex] || null;
  }

  getSelectedTarget() {
    if (this.scene.targetGroup === "ally") {
      return this.getSelectedAlly();
    }

    return this.getSelectedEnemy();
  }
}
