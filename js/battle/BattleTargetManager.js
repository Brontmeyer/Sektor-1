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

  allowedScopes(definition) {
    if (!definition) {
      return ["single"];
    }

    if (Array.isArray(definition.scope)) {
      return definition.scope;
    }

    if (typeof definition.scope === "string") {
      return [definition.scope];
    }

    return ["single"];
  }

  canUseScope(definition, scope) {
    return this.allowedScopes(definition).includes(scope);
  }

  toggleScope(definition) {
    const scopes = this.allowedScopes(definition);

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

  allowedTargetGroups(definition) {
    if (!definition) {
      return ["enemy"];
    }

    const targets = Array.isArray(definition.target)
      ? definition.target
      : typeof definition.target === "string"
        ? [definition.target]
        : [];
    const groups = [];

    for (const target of targets) {
      // Self-targeted actions use the ally-side selector, while target validity
      // still restricts the legal battler to the caster itself.
      const group = target === "self" ? "ally" : target;

      if (["ally", "enemy"].includes(group) && !groups.includes(group)) {
        groups.push(group);
      }
    }

    return groups.length > 0 ? groups : ["enemy"];
  }

  canTargetGroup(definition, group) {
    return this.allowedTargetGroups(definition).includes(group);
  }

  currentActionDefinition() {
    return this.scene.pendingSkill || this.scene.pendingMagick || null;
  }

  currentMagick() {
    return this.scene.pendingMagick || null;
  }

  currentCaster() {
    return this.scene?.partyController?.currentBattler?.() || null;
  }

  isSelectableTarget(battler, definition = this.currentActionDefinition()) {
    if (!battler) {
      return false;
    }

    if (definition) {
      const caster = this.currentCaster();

      if (definition.type === "skill" && caster?.isValidSkillTarget) {
        return caster.isValidSkillTarget(definition, battler);
      }

      if (definition.type === "magick" && caster?.isValidMagickTarget) {
        return caster.isValidMagickTarget(definition, battler);
      }
    }

    if (typeof battler.isAlive === "function") {
      return battler.isAlive();
    }

    return !(typeof battler.isDead === "function" && battler.isDead());
  }

  selectableBattlers(group, definition = this.currentActionDefinition()) {
    const battlers =
      group === "ally" ? $gameParty.battleMembers() : this.scene.enemies;

    return battlers.filter((battler) =>
      this.isSelectableTarget(battler, definition),
    );
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

  selectFirstSelectableEnemy(definition = this.currentActionDefinition()) {
    const { enemies } = this.scene;
    const index = enemies.findIndex((enemy) =>
      this.isSelectableTarget(enemy, definition),
    );

    if (index < 0) {
      return null;
    }

    this.scene.selectedEnemyIndex = index;
    return enemies[index];
  }

  selectFirstSelectableAlly(definition = this.currentActionDefinition()) {
    const allies = $gameParty.battleMembers();
    const index = allies.findIndex((ally) =>
      this.isSelectableTarget(ally, definition),
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

  selectFrontSelectableAlly(definition = this.currentActionDefinition()) {
    const allies = $gameParty.battleMembers();
    const enemy = this.getSelectedEnemy();

    if (!enemy) {
      return this.selectFirstSelectableAlly(definition);
    }

    const enemyPosition = this.scene.getEnemyPosition(enemy);

    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i];

      if (!this.isSelectableTarget(ally, definition)) {
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

  selectFrontSelectableEnemy(definition = this.currentActionDefinition()) {
    const enemies = this.scene.enemies;
    const ally = this.getSelectedAlly();

    if (!ally) {
      return this.selectFirstSelectableEnemy(definition);
    }

    const allyPosition = this.scene.getAllyPosition(ally);

    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];

      if (!this.isSelectableTarget(enemy, definition)) {
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
