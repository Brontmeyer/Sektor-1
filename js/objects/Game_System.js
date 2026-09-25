"use strict";

class Game_System {
  constructor() {
    this.actors = DatabaseManager.actors
      .filter((actorData) => actorData !== null)
      .map((actorData) => new Game_Actor(actorData.id));

    const startingActorIds = this.startingActorIds();
    const startingActors = startingActorIds
      .map((actorId) => this.actor(actorId))
      .filter((actor) => actor !== null);

    this.party = new Game_Party(startingActors);

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

  startingActorIds() {
    const configured = Array.isArray(DatabaseManager.system?.startingActorIds)
      ? DatabaseManager.system.startingActorIds
      : [1];
    const ids = configured
      .map((actorId) => Number(actorId))
      .filter(
        (actorId, index, source) =>
          Number.isInteger(actorId) &&
          actorId > 0 &&
          source.indexOf(actorId) === index &&
          Boolean(DatabaseManager.actor?.(actorId)),
      );

    return ids.length > 0 ? ids : [1];
  }

  actorName(actorId) {
    return this.actor(actorId)?.name || "";
  }

  renameActor(actorId, name) {
    return this.actor(actorId)?.rename?.(name) === true;
  }

  recruitActor(actorId) {
    return this.party?.addActorToParty?.(actorId) === true;
  }

  dismissActor(actorId) {
    return this.party?.removeActorFromParty?.(actorId) === true;
  }

  hasMetActor(actorId) {
    return this.party?.hasMetActor?.(actorId) === true;
  }

  isActorRecruited(actorId) {
    return this.party?.isActorRecruited?.(actorId) === true;
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
