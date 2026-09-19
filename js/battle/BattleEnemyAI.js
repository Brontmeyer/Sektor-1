"use strict";

class BattleEnemyAI {
  static ACTION_ATTACK = "attack";
  static ACTION_MAGICK = "magick";

  constructor(manager) {
    this.manager = manager;
  }

  actionDefinitions(enemy) {
    if (!enemy || typeof enemy.actionDefinitions !== "function") {
      return [];
    }

    return enemy.actionDefinitions();
  }

  conditionMet(enemy, condition) {
    if (!condition) {
      return true;
    }

    const type = condition.type || "always";
    const value = Number(condition.value);

    if (type === "always") {
      return true;
    }

    if (type === "selfHpBelow") {
      return Number.isFinite(value) && enemy.hpRate() < value;
    }

    if (type === "selfHpAbove") {
      return Number.isFinite(value) && enemy.hpRate() > value;
    }

    if (type === "allyHpBelow") {
      return (
        Number.isFinite(value) &&
        this.relativeBattlers(enemy, "ally", { includeDefeated: false }).some(
          (ally) => ally.hpRate() < value,
        )
      );
    }

    if (type === "allyDefeated") {
      return this.relativeBattlers(enemy, "ally", { includeDefeated: true }).some(
        (ally) => this.manager.battlerIsDefeated(ally),
      );
    }

    return false;
  }

  relativeBattlers(enemy, group, { includeDefeated = false } = {}) {
    if (!enemy) {
      return [];
    }

    if (group === "self") {
      return includeDefeated || !this.manager.battlerIsDefeated(enemy)
        ? [enemy]
        : [];
    }

    const side = this.manager.battlerSide(enemy);
    const requestedSide =
      group === "ally" ? side : this.manager.opposingBattleSide(side);

    if (requestedSide === "ally") {
      const battlers = $gameParty.battleMembers();
      return includeDefeated
        ? [...battlers]
        : battlers.filter((battler) => !this.manager.battlerIsDefeated(battler));
    }

    if (requestedSide === "enemy") {
      const battlers = this.manager.scene.enemies || [];
      return includeDefeated
        ? [...battlers]
        : battlers.filter((battler) => !this.manager.battlerIsDefeated(battler));
    }

    return [];
  }

  targetGroupForAction(enemy, action, magick = null) {
    if (action?.targetGroup) {
      return action.targetGroup;
    }

    if (action?.type === BattleEnemyAI.ACTION_ATTACK) {
      return "enemy";
    }

    const groups = Array.isArray(magick?.target) ? magick.target : [];

    if (groups.includes("enemy")) {
      return "enemy";
    }

    if (groups.includes("ally")) {
      return "ally";
    }

    if (groups.includes("self")) {
      return "self";
    }

    return "enemy";
  }

  targetIsMeaningful(enemy, action, target, magick = null) {
    if (!target) {
      return false;
    }

    if (action.type === BattleEnemyAI.ACTION_ATTACK) {
      return !this.manager.battlerIsDefeated(target);
    }

    if (!magick || !enemy.isValidMagickTarget(magick, target)) {
      return false;
    }

    if (magick.effect === "heal") {
      return typeof target.isFullHp !== "function" || !target.isFullHp();
    }

    if (magick.effect === "removeStatus") {
      const statuses = Object.keys(magick.status || {});
      return statuses.some(
        (statusKey) =>
          typeof target.hasStatus === "function" && target.hasStatus(statusKey),
      );
    }

    return true;
  }

  targetCandidates(enemy, action) {
    if (!enemy || !action) {
      return [];
    }

    const magick =
      action.type === BattleEnemyAI.ACTION_MAGICK
        ? DatabaseManager.magick(action.magickId)
        : null;
    const includeDefeated = magick?.effect === "revive";

    if (this.manager.battlerForcesRandomTarget(enemy)) {
      if (action.type === BattleEnemyAI.ACTION_ATTACK) {
        return this.manager.allLivingBattlers();
      }

      const battlers = [
        ...$gameParty.battleMembers(),
        ...(this.manager.scene.enemies || []),
      ];

      return battlers.filter((target) => {
        if (!includeDefeated && this.manager.battlerIsDefeated(target)) {
          return false;
        }

        return this.targetIsMeaningful(enemy, action, target, magick);
      });
    }

    const group = this.targetGroupForAction(enemy, action, magick);

    return this.relativeBattlers(enemy, group, { includeDefeated }).filter(
      (target) => this.targetIsMeaningful(enemy, action, target, magick),
    );
  }

  actionUsable(enemy, action) {
    if (!enemy || !action || !this.conditionMet(enemy, action.condition)) {
      return false;
    }

    if (action.type === BattleEnemyAI.ACTION_ATTACK) {
      return (
        this.manager.battlerCanUseAction(enemy, "attack") &&
        this.targetCandidates(enemy, action).length > 0
      );
    }

    if (action.type === BattleEnemyAI.ACTION_MAGICK) {
      const magick = DatabaseManager.magick(action.magickId);

      if (
        !magick ||
        !this.manager.battlerCanUseAction(enemy, "magick") ||
        !enemy.canUseMagick(action.magickId)
      ) {
        return false;
      }

      const scopes = Array.isArray(magick.scope) ? magick.scope : ["single"];
      const scope = action.scope || "single";

      return scopes.includes(scope) && this.targetCandidates(enemy, action).length > 0;
    }

    return false;
  }

  usableActions(enemy) {
    return this.actionDefinitions(enemy).filter((action) =>
      this.actionUsable(enemy, action),
    );
  }

  fallbackAction(enemy) {
    const fallback = {
      type: BattleEnemyAI.ACTION_ATTACK,
      weight: 1,
      targetStrategy: "first",
      fallback: true,
    };

    return this.actionUsable(enemy, fallback) ? fallback : null;
  }

  selectAction(enemy, random = Math.random) {
    const actions = this.usableActions(enemy);

    if (actions.length === 0) {
      return this.fallbackAction(enemy);
    }

    const totalWeight = actions.reduce(
      (total, action) => total + Math.max(0, Number(action.weight) || 0),
      0,
    );

    if (totalWeight <= 0) {
      return actions[0];
    }

    const roll = typeof random === "function" ? Number(random()) : Math.random();
    const normalizedRoll = Number.isFinite(roll)
      ? Math.max(0, Math.min(0.999999999, roll))
      : 0;
    let cursor = normalizedRoll * totalWeight;

    for (const action of actions) {
      cursor -= Math.max(0, Number(action.weight) || 0);

      if (cursor < 0) {
        return action;
      }
    }

    return actions[actions.length - 1];
  }

  selectTarget(enemy, action, random = Math.random) {
    const candidates = this.targetCandidates(enemy, action);

    if (candidates.length === 0) {
      return null;
    }

    const strategy = action?.targetStrategy || "first";

    if (strategy === "random") {
      return this.manager.randomBattleTarget(candidates, random);
    }

    if (strategy === "lowestHp") {
      return [...candidates].sort((left, right) => left.hp - right.hp)[0] || null;
    }

    if (strategy === "lowestHpRate") {
      return (
        [...candidates].sort((left, right) => left.hpRate() - right.hpRate())[0] ||
        null
      );
    }

    return candidates[0] || null;
  }
}
