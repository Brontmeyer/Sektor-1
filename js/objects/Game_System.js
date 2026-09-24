"use strict";

class Game_System {
  constructor() {
    this.actors = DatabaseManager.actors
      .filter((actorData) => actorData !== null)
      .map((actorData) => new Game_Actor(actorData.id));

    this.party = new Game_Party(this.actors);

    this.selfSwitches = new Game_SelfSwitches();
    this.switches = new Game_Switches();

    this.variables = new Game_Variables();

    // Canonical persistent play-time clock. Keep fractional seconds internally
    // so frame cadence never loses time; presentation and save metadata use
    // whole elapsed seconds.
    this._playTimeSeconds = 0;
  }

  actor(actorId) {
    const id = Number(actorId);
    return this.actors.find((actor) => actor.actorId === id) || null;
  }

  actorName(actorId) {
    return this.actor(actorId)?.name || "";
  }

  renameActor(actorId, name) {
    return this.actor(actorId)?.rename?.(name) === true;
  }

  updatePlayTime(deltaTime) {
    const seconds = Number(deltaTime);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return false;
    }

    this._playTimeSeconds += seconds;
    return true;
  }

  playTimeSeconds() {
    return Math.max(0, Math.floor(Number(this._playTimeSeconds) || 0));
  }

  setPlayTimeSeconds(seconds) {
    const value = Number(seconds);
    this._playTimeSeconds = Number.isFinite(value) && value >= 0 ? value : 0;
    return true;
  }

  formattedPlayTime() {
    return Game_System.formatPlayTime(this.playTimeSeconds());
  }

  static formatPlayTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainingSeconds = total % 60;

    return [hours, minutes, remainingSeconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }
}
