"use strict";

class Game_System {
  constructor() {
    this.actors = DatabaseManager.actors
      .filter((actorData) => actorData !== null)
      .map((actorData) => new Game_Actor(actorData.id));

    // The protagonist begins the story before their identity is established.
    // Keep the canonical database name untouched as Game_Actor.defaultName()
    // so the later story naming event can still offer it as the default.
    const protagonist = this.actor(this.protagonistActorId());

    if (protagonist) {
      const unidentifiedName = this.unidentifiedActorName();
      protagonist.rename?.(unidentifiedName);
    }

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

    // Shared world-discovery state. Map data owns the canonical location
    // definitions; Game_System owns only what the player has discovered so
    // Area Map and future World Map presentation can consume one contract.
    this._areaDiscoveries = {};
  }

  actor(actorId) {
    const id = Number(actorId);
    return this.actors.find((actor) => actor.actorId === id) || null;
  }

  protagonistActorId() {
    const configured = Number(DatabaseManager.system?.protagonistActorId);

    if (
      Number.isInteger(configured) &&
      configured > 0 &&
      DatabaseManager.actor?.(configured)
    ) {
      return configured;
    }

    return 1;
  }

  unidentifiedActorName() {
    const configured = Game_Actor.normalizeName(
      DatabaseManager.system?.unidentifiedActorName || "Unknown",
    );
    return configured || "Unknown";
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

  normalizeLocationId(locationId) {
    return String(locationId ?? "").trim();
  }

  discoveredLocationIds(mapId) {
    const id = Number(mapId);
    if (!Number.isInteger(id) || id <= 0) {
      return [];
    }

    const values = this._areaDiscoveries?.[id];
    return Array.isArray(values) ? [...values] : [];
  }

  isLocationDiscovered(mapId, locationId) {
    const id = this.normalizeLocationId(locationId);
    return id !== "" && this.discoveredLocationIds(mapId).includes(id);
  }

  discoverLocation(mapId, locationId) {
    const id = Number(mapId);
    const key = this.normalizeLocationId(locationId);

    if (!Number.isInteger(id) || id <= 0 || !key) {
      return false;
    }

    const current = this.discoveredLocationIds(id);
    if (current.includes(key)) {
      return false;
    }

    current.push(key);
    this._areaDiscoveries[id] = current;
    return true;
  }

  areaDiscoveryState() {
    const result = {};

    for (const [rawMapId, rawLocations] of Object.entries(
      this._areaDiscoveries || {},
    )) {
      const mapId = Number(rawMapId);
      if (!Number.isInteger(mapId) || mapId <= 0 || !Array.isArray(rawLocations)) {
        continue;
      }

      const locations = [...new Set(
        rawLocations
          .map((locationId) => this.normalizeLocationId(locationId))
          .filter((locationId) => locationId !== ""),
      )];

      if (locations.length > 0) {
        result[mapId] = locations;
      }
    }

    return result;
  }

  restoreAreaDiscoveryState(state) {
    this._areaDiscoveries = {};

    if (!state || typeof state !== "object" || Array.isArray(state)) {
      return false;
    }

    for (const [rawMapId, rawLocations] of Object.entries(state)) {
      const mapId = Number(rawMapId);
      if (!Number.isInteger(mapId) || mapId <= 0 || !Array.isArray(rawLocations)) {
        continue;
      }

      for (const locationId of rawLocations) {
        this.discoverLocation(mapId, locationId);
      }
    }

    return true;
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
