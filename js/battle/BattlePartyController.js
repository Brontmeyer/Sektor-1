"use strict";

class BattlePartyController {
  constructor(scene) {
    this.scene = scene;

    this.partyTurnQueue = [];
    this.currentPartyTurn = 0;
    this.activeBattler = null;
  }

  // =================================
  // Party Turn Queue Management
  // =================================

  initializePartyTurnQueue() {
    this.partyTurnQueue = this.buildScheduledPartyQueue();
    this.currentPartyTurn = 0;
    this.activeBattler = this.partyTurnQueue[0] || null;
  }

  buildScheduledPartyQueue() {
    const battlers = $gameParty.livingBattleMembers();
    const manager = this.scene?.battleManager;

    if (!manager || typeof manager.buildTurnQueue !== "function") {
      return battlers;
    }

    return manager.buildTurnQueue(battlers);
  }

  battlerAvailableForTurn(battler) {
    if (!battler) {
      return false;
    }

    if (typeof battler.isDefeated === "function") {
      return !battler.isDefeated();
    }

    return typeof battler.isAlive === "function" && battler.isAlive();
  }

  battleContext() {
    return {
      battler: this.currentBattler(),
      turnState: this.scene.battleManager.currentTurnState(),
      turnIndex: this.currentPartyTurn,
      partySize: this.partyTurnQueue.length,
      isFirstTurn: this.currentPartyTurn === 0,
      isLastTurn: this.currentPartyTurn === this.partyTurnQueue.length - 1,
    };
  }

  battlePosition(index) {
    if (this.scene.formationManager) {
      return this.scene.formationManager.partyPosition(index);
    }

    const positions = this.formationPositions();
    const safeIndex = Math.max(0, Math.min(index, positions.length - 1));

    return positions[safeIndex];
  }

  formationPositions() {
    if (this.scene.formationManager) {
      return this.scene.formationManager.verticalPartyPositions().map(
        (position, index) => ({
          x: this.scene.formationManager.partyPosition(index).x,
          y: position.y,
        }),
      );
    }

    const battlefieldBottom = Graphics.height - 190;

    return [
      { x: 400, y: battlefieldBottom - 180 },
      { x: 140, y: battlefieldBottom - 180 },
      { x: 260, y: battlefieldBottom - 310 },
      { x: 260, y: battlefieldBottom - 50 },
    ];
  }

  positionForBattler(battler) {
    const formationIndex =
      $gameParty.battleFormationIndex?.(battler) ??
      $gameParty.battleMemberIndex(battler);

    if (formationIndex < 0) {
      return this.battlePosition(0);
    }

    return this.battlePosition(formationIndex);
  }

  currentBattler() {
    return this.activeBattler;
  }

  nextBattler() {
    while (this.hasNextBattler()) {
      this.currentPartyTurn++;

      const battler = this.partyTurnQueue[this.currentPartyTurn] || null;

      if (this.battlerAvailableForTurn(battler)) {
        this.activeBattler = battler;
        return battler;
      }
    }

    this.activeBattler = null;
    return null;
  }

  hasNextBattler() {
    for (
      let i = this.currentPartyTurn + 1;
      i < this.partyTurnQueue.length;
      i++
    ) {
      const battler = this.partyTurnQueue[i];

      if (this.battlerAvailableForTurn(battler)) {
        return true;
      }
    }

    return false;
  }

  resetPartyTurnQueue() {
    for (const battler of $gameParty.battleMembers()) {
      battler.stopDefending();
    }

    this.partyTurnQueue = this.buildScheduledPartyQueue();
    this.currentPartyTurn = 0;
    this.activeBattler = this.partyTurnQueue[0] || null;
  }
}
