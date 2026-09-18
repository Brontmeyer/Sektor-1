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

  currentSkill() {
    return this.scene.pendingMagicSkill || null;
  }

  currentCaster() {
    return this.scene?.partyController?.currentBattler?.() || null;
  }

  isSelectableTarget(battler, skill = this.currentSkill()) {
    if (!battler) {
      return false;
    }

    if (skill) {
      const caster = this.currentCaster();

      if (caster && typeof caster.isValidSkillTarget === "function") {
        return caster.isValidSkillTarget(skill, battler);
      }
    }

    if (typeof battler.isAlive === "function") {
      return battler.isAlive();
    }

    return !(typeof battler.isDead === "function" && battler.isDead());
  }

  selectableBattlers(group, skill = this.currentSkill()) {
    const battlers =
      group === "ally" ? $gameParty.battleMembers() : this.scene.enemies;

    return battlers.filter((battler) => this.isSelectableTarget(battler, skill));
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

  selectFirstSelectableEnemy(skill = this.currentSkill()) {
    const { enemies } = this.scene;
    const index = enemies.findIndex((enemy) =>
      this.isSelectableTarget(enemy, skill),
    );

    if (index < 0) {
      return null;
    }

    this.scene.selectedEnemyIndex = index;
    return enemies[index];
  }

  selectFirstSelectableAlly(skill = this.currentSkill()) {
    const allies = $gameParty.battleMembers();
    const index = allies.findIndex((ally) =>
      this.isSelectableTarget(ally, skill),
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

  selectFrontSelectableAlly(skill = this.currentSkill()) {
    const allies = $gameParty.battleMembers();
    const enemy = this.getSelectedEnemy();

    if (!enemy) {
      return this.selectFirstSelectableAlly(skill);
    }

    const enemyPosition = this.scene.getEnemyPosition(enemy);

    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i];

      if (!this.isSelectableTarget(ally, skill)) {
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

  selectFrontSelectableEnemy(skill = this.currentSkill()) {
    const enemies = this.scene.enemies;
    const ally = this.getSelectedAlly();

    if (!ally) {
      return this.selectFirstSelectableEnemy(skill);
    }

    const allyPosition = this.scene.getAllyPosition(ally);

    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];

      if (!this.isSelectableTarget(enemy, skill)) {
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
