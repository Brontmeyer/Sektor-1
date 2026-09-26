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

  effectiveAllowedScopes(
    definition = this.currentActionDefinition(),
    group = this.scene.targetGroup,
  ) {
    const scopes = this.allowedScopes(definition);

    // An intrinsically all-target action remains all-target even when only one
    // legal battler is present. Dual-scope actions collapse to single when the
    // currently selected target bucket contains fewer than two battlers.
    if (!scopes.includes("single") || !scopes.includes("all")) {
      return [...scopes];
    }

    const bucket = this.currentTargetBucket(definition, group);
    const targetCount = bucket?.battlers?.length || 0;

    return targetCount > 1 ? [...scopes] : scopes.filter((scope) => scope !== "all");
  }

  normalizeScope(definition = this.currentActionDefinition()) {
    const scopes = this.effectiveAllowedScopes(definition);

    if (scopes.includes(this.scene.targetScope)) {
      return this.scene.targetScope;
    }

    this.scene.targetScope = scopes.includes("single")
      ? "single"
      : scopes[0] || "single";

    return this.scene.targetScope;
  }

  canUseScope(definition, scope) {
    return this.effectiveAllowedScopes(definition).includes(scope);
  }

  toggleScope(definition) {
    const scopes = this.effectiveAllowedScopes(definition);

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

    if (groups.length > 0) {
      return groups;
    }

    // Battle items are permissive by default: unless their data narrows the
    // target contract, the player may aim them at either battle side. This
    // keeps future offensive items and restorative-vs-undead interactions on
    // the same selector path instead of hard-coding Items as ally-only.
    return definition.type === "item" ? ["ally", "enemy"] : ["enemy"];
  }

  navigableTargetGroups(definition = this.currentActionDefinition()) {
    if (definition) {
      return this.allowedTargetGroups(definition);
    }

    // Manual Attack historically permits selecting either battle side. Forced
    // random targeting still bypasses this selector through BattleManager.
    if (this.scene.enemyTargetAction === "attack") {
      return ["ally", "enemy"];
    }

    return [this.scene.targetGroup || "enemy"];
  }

  canTargetGroup(definition, group) {
    return this.allowedTargetGroups(definition).includes(group);
  }

  currentActionDefinition() {
    return (
      this.scene.pendingSkill ||
      this.scene.pendingMagick ||
      this.scene.pendingItem ||
      null
    );
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

      if (definition.type === "item" && caster?.isValidItemTarget) {
        return caster.isValidItemTarget(definition, battler);
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

  targetPosition(group, battler) {
    return group === "ally"
      ? this.scene.getAllyTargetPosition?.(battler) ||
        this.scene.getAllyPosition(battler)
      : this.scene.getEnemyPosition(battler);
  }

  isPincerFormation() {
    return (
      this.scene.getFormationType?.() === "pincer" ||
      this.scene.formationManager?.formation?.() === "pincer" ||
      this.scene.formationManager?.is?.("pincer") === true
    );
  }

  enemyFlankForIndex(index) {
    return this.scene.formationManager?.memberSide?.(index) || "right";
  }

  selectedEnemyFlank() {
    return this.enemyFlankForIndex(this.scene.selectedEnemyIndex);
  }

  targetBuckets(definition = this.currentActionDefinition()) {
    const buckets = [];
    const groups = this.navigableTargetGroups(definition);

    for (const group of groups) {
      if (group === "ally") {
        const allies = this.selectableBattlers("ally", definition);

        if (allies.length > 0) {
          buckets.push({
            key: "ally",
            group: "ally",
            flank: null,
            battlers: allies,
          });
        }

        continue;
      }

      if (group !== "enemy") {
        continue;
      }

      const enemies = this.selectableBattlers("enemy", definition);

      if (this.isPincerFormation()) {
        for (const flank of ["left", "right"]) {
          const flankEnemies = enemies.filter((enemy) => {
            const index = this.scene.enemies.indexOf(enemy);
            return index >= 0 && this.enemyFlankForIndex(index) === flank;
          });

          if (flankEnemies.length > 0) {
            buckets.push({
              key: `enemy:${flank}`,
              group: "enemy",
              flank,
              battlers: flankEnemies,
            });
          }
        }
      } else if (enemies.length > 0) {
        buckets.push({
          key: "enemy",
          group: "enemy",
          flank: null,
          battlers: enemies,
        });
      }
    }

    return buckets;
  }

  currentTargetBucket(
    definition = this.currentActionDefinition(),
    group = this.scene.targetGroup,
  ) {
    const buckets = this.targetBuckets(definition);

    if (group === "enemy" && this.isPincerFormation()) {
      const flank = this.selectedEnemyFlank();
      return (
        buckets.find(
          (bucket) => bucket.group === "enemy" && bucket.flank === flank,
        ) || buckets.find((bucket) => bucket.group === "enemy") || null
      );
    }

    return buckets.find((bucket) => bucket.group === group) || null;
  }

  bucketLabel(bucket) {
    if (!bucket) {
      return "targets";
    }

    if (bucket.group === "enemy" && bucket.flank) {
      return `all enemies on the ${bucket.flank} flank`;
    }

    return bucket.group === "ally" ? "all allies" : "all enemies";
  }

  bucketCenter(bucket) {
    if (!bucket || bucket.battlers.length === 0) {
      return null;
    }

    const points = bucket.battlers.map((battler) =>
      this.targetPosition(bucket.group, battler),
    );
    const total = points.reduce(
      (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
      { x: 0, y: 0 },
    );

    return {
      x: total.x / points.length,
      y: total.y / points.length,
    };
  }

  selectTargetBucket(bucket, definition = this.currentActionDefinition()) {
    if (!bucket || bucket.battlers.length === 0) {
      return null;
    }

    this.selectBattler(bucket.battlers[0]);
    this.normalizeScope(definition);
    return bucket;
  }

  scopedSelectableBattlers(
    group = this.scene.targetGroup,
    definition = this.currentActionDefinition(),
  ) {
    if (group !== this.scene.targetGroup) {
      return this.selectableBattlers(group, definition);
    }

    const bucket = this.currentTargetBucket(definition, group);
    return bucket ? [...bucket.battlers] : [];
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

  directionalScore(currentPosition, candidatePosition, dx, dy) {
    const offsetX = candidatePosition.x - currentPosition.x;
    const offsetY = candidatePosition.y - currentPosition.y;
    const forward = offsetX * dx + offsetY * dy;

    if (forward <= 0) {
      return Infinity;
    }

    const sideways = Math.abs(offsetX * dy - offsetY * dx);
    const distance = Math.hypot(offsetX, offsetY);
    return distance + sideways * 0.75;
  }

  moveDirectionalSelection(
    dx,
    dy,
    definition = this.currentActionDefinition(),
  ) {
    const current = this.getSelectedTarget();

    if (!this.isSelectableTarget(current, definition)) {
      const firstBucket = this.targetBuckets(definition)[0] || null;
      return this.selectTargetBucket(firstBucket, definition) !== null;
    }

    const currentPosition = this.targetPosition(this.scene.targetGroup, current);
    let bestTarget = null;
    let bestScore = Infinity;

    for (const group of this.navigableTargetGroups(definition)) {
      for (const battler of this.selectableBattlers(group, definition)) {
        if (battler === current) {
          continue;
        }

        const position = this.targetPosition(group, battler);
        const score = this.directionalScore(currentPosition, position, dx, dy);

        if (score < bestScore) {
          bestScore = score;
          bestTarget = battler;
        }
      }
    }

    if (!bestTarget) {
      return false;
    }

    this.selectBattler(bestTarget);
    this.normalizeScope(definition);
    return true;
  }

  moveTargetBucket(dx, dy, definition = this.currentActionDefinition()) {
    const buckets = this.targetBuckets(definition);
    const current = this.currentTargetBucket(definition);

    if (!current) {
      return this.selectTargetBucket(buckets[0] || null, definition) !== null;
    }

    const currentPosition = this.bucketCenter(current);
    let bestBucket = null;
    let bestScore = Infinity;

    for (const bucket of buckets) {
      if (bucket.key === current.key) {
        continue;
      }

      const position = this.bucketCenter(bucket);
      const score = this.directionalScore(currentPosition, position, dx, dy);

      if (score < bestScore) {
        bestScore = score;
        bestBucket = bucket;
      }
    }

    if (!bestBucket) {
      return false;
    }

    return this.selectTargetBucket(bestBucket, definition) !== null;
  }

  moveSpatialSelection(group, dx, dy) {
    if (group !== this.scene.targetGroup) {
      return false;
    }

    return this.moveDirectionalSelection(dx, dy);
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

      const allyPosition = this.targetPosition("ally", ally);
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

    const allyPosition = this.targetPosition("ally", ally);

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
      return this.scopedSelectableBattlers(this.scene.targetGroup);
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
