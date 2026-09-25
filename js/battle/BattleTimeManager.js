"use strict";

/**
 * Battle-local Active Time clock and readiness queue.
 *
 * Pass 97 promotes the proven Time gauges into one shared readiness authority
 * for actors and enemies. BattleManager still owns action legality/effects, but
 * side-round queues no longer decide who acts in live battles.
 */
class BattleTimeManager {
  static MAX_TIME = 100;
  static BASE_FILL_PER_SECOND = 8;
  static AGILITY_FILL_PER_SECOND = 1.2;

  constructor(scene) {
    this.scene = scene;
    this.progress = new Map();
    this.haltedProgress = new Map();
    this.readyQueue = [];
    this.activeBattler = null;
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
    this.haltedProgress.clear();
    this.readyQueue = [];
    this.activeBattler = null;

    for (const battler of this.battlers()) {
      this.progress.set(battler, 0);
      this.haltedProgress.set(battler, 0);
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

    if (normalized >= this.maximum()) {
      this.enqueueReady(battler);
    } else {
      this.removeReady(battler);
    }

    return normalized;
  }

  reset(battler) {
    if (!battler) {
      return 0;
    }

    this.removeReady(battler);
    this.progress.set(battler, 0);
    this.haltedProgress.set(battler, 0);
    return 0;
  }

  isReady(battler) {
    return this.value(battler) >= this.maximum();
  }

  enqueueReady(battler) {
    if (
      !battler ||
      battler === this.activeBattler ||
      this.readyQueue.includes(battler) ||
      this.battlerIsDefeated(battler)
    ) {
      return false;
    }

    this.readyQueue.push(battler);
    return true;
  }

  removeReady(battler) {
    const index = this.readyQueue.indexOf(battler);

    if (index < 0) {
      return false;
    }

    this.readyQueue.splice(index, 1);
    return true;
  }

  queuedBattlers() {
    return [...this.readyQueue];
  }

  claimNextReadyBattler(predicate = null) {
    if (this.activeBattler) {
      return null;
    }

    const accepts = typeof predicate === "function" ? predicate : () => true;

    const currentBattlers = new Set(this.battlers());
    const candidates = this.readyQueue.length;

    for (let attempt = 0; attempt < candidates; attempt++) {
      const battler = this.readyQueue.shift();

      if (
        !currentBattlers.has(battler) ||
        this.battlerIsDefeated(battler) ||
        !this.isReady(battler)
      ) {
        continue;
      }

      if (!accepts(battler)) {
        this.readyQueue.push(battler);
        continue;
      }

      if (this.battlerHaltsTime(battler)) {
        this.readyQueue.push(battler);
        continue;
      }

      this.activeBattler = battler;
      return battler;
    }

    return null;
  }

  releaseActiveBattler(battler = this.activeBattler) {
    if (!this.activeBattler || battler !== this.activeBattler) {
      return false;
    }

    this.activeBattler = null;
    return true;
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

  unhaltedFillPerSecond(battler) {
    if (!battler || this.battlerIsDefeated(battler)) {
      return 0;
    }

    const base =
      BattleTimeManager.BASE_FILL_PER_SECOND +
      this.agility(battler) * BattleTimeManager.AGILITY_FILL_PER_SECOND;

    return Math.max(0, base * this.turnSpeedMultiplier(battler));
  }

  fillPerSecond(battler) {
    if (this.battlerHaltsTime(battler)) {
      return 0;
    }

    return this.unhaltedFillPerSecond(battler);
  }

  updateHaltedStatusClock(battler, deltaTime) {
    if (
      !battler ||
      !this.battlerHaltsTime(battler) ||
      typeof battler.tickStatusDurations !== "function"
    ) {
      return 0;
    }

    const seconds = Math.max(0, Number(deltaTime) || 0);
    let progress = Math.max(0, Number(this.haltedProgress.get(battler)) || 0);
    progress += this.unhaltedFillPerSecond(battler) * seconds;

    while (progress >= this.maximum() && this.battlerHaltsTime(battler)) {
      progress -= this.maximum();
      battler.tickStatusDurations({ mode: "haltedRound" });
    }

    if (!this.battlerHaltsTime(battler)) {
      progress = 0;
    }

    this.haltedProgress.set(battler, progress);
    return progress;
  }

  updateBattler(battler, deltaTime) {
    if (!battler) {
      return 0;
    }

    if (this.battlerIsDefeated(battler)) {
      return this.reset(battler);
    }

    if (this.battlerHaltsTime(battler)) {
      this.updateHaltedStatusClock(battler, deltaTime);
      return this.value(battler);
    }

    if (this.isReady(battler)) {
      this.enqueueReady(battler);
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
