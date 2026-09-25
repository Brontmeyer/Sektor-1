"use strict";

/**
 * Battle-local Active Time foundation.
 *
 * Pass 95 deliberately keeps Time separate from the existing round scheduler.
 * The gauge fills continuously for actors and enemies and exposes readiness,
 * while Pass 96 can promote that readiness into battle-turn authority without
 * making presentation or persistent actor data own the clock.
 */
class BattleTimeManager {
  static MAX_TIME = 100;
  static BASE_FILL_PER_SECOND = 8;
  static AGILITY_FILL_PER_SECOND = 1.2;

  constructor(scene) {
    this.scene = scene;
    this.progress = new Map();
  }

  battlers() {
    const party =
      typeof this.scene?.getBattlePartyMembers === "function"
        ? this.scene.getBattlePartyMembers()
        : [];
    const enemies = Array.isArray(this.scene?.enemies) ? this.scene.enemies : [];

    return [...party, ...enemies].filter(Boolean);
  }

  initialize() {
    this.progress.clear();

    for (const battler of this.battlers()) {
      this.progress.set(battler, 0);
    }
  }

  maximum() {
    return BattleTimeManager.MAX_TIME;
  }

  value(battler) {
    if (!battler) {
      return 0;
    }

    const value = Number(this.progress.get(battler));
    return Number.isFinite(value)
      ? Math.max(0, Math.min(this.maximum(), value))
      : 0;
  }

  setValue(battler, value) {
    if (!battler) {
      return 0;
    }

    const numeric = Number(value);
    const normalized = Number.isFinite(numeric)
      ? Math.max(0, Math.min(this.maximum(), numeric))
      : 0;

    this.progress.set(battler, normalized);
    return normalized;
  }

  reset(battler) {
    return this.setValue(battler, 0);
  }

  isReady(battler) {
    return this.value(battler) >= this.maximum();
  }

  battlerIsDefeated(battler) {
    if (!battler) {
      return true;
    }

    if (typeof battler.isDefeated === "function") {
      return battler.isDefeated();
    }

    return typeof battler.isDead === "function" ? battler.isDead() : false;
  }

  battlerHaltsTime(battler) {
    return Boolean(
      battler &&
        typeof battler.haltsTurnProgression === "function" &&
        battler.haltsTurnProgression(),
    );
  }

  turnSpeedMultiplier(battler) {
    if (!battler || typeof battler.turnSpeedMultiplier !== "function") {
      return 1;
    }

    const multiplier = Number(battler.turnSpeedMultiplier());
    return Number.isFinite(multiplier) ? Math.max(0, multiplier) : 1;
  }

  agility(battler) {
    const agility = Number(battler?.agility);
    return Number.isFinite(agility) ? Math.max(0, agility) : 0;
  }

  fillPerSecond(battler) {
    if (
      !battler ||
      this.battlerIsDefeated(battler) ||
      this.battlerHaltsTime(battler)
    ) {
      return 0;
    }

    const base =
      BattleTimeManager.BASE_FILL_PER_SECOND +
      this.agility(battler) * BattleTimeManager.AGILITY_FILL_PER_SECOND;

    return Math.max(0, base * this.turnSpeedMultiplier(battler));
  }

  updateBattler(battler, deltaTime) {
    if (!battler) {
      return 0;
    }

    if (this.battlerIsDefeated(battler)) {
      return this.reset(battler);
    }

    if (this.isReady(battler) || this.battlerHaltsTime(battler)) {
      return this.value(battler);
    }

    const seconds = Math.max(0, Number(deltaTime) || 0);
    return this.setValue(
      battler,
      this.value(battler) + this.fillPerSecond(battler) * seconds,
    );
  }

  update(deltaTime) {
    if (this.scene?.outcome) {
      return;
    }

    for (const battler of this.battlers()) {
      this.updateBattler(battler, deltaTime);
    }
  }
}
