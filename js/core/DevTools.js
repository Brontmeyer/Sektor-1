"use strict";

/*
 * Development-only console helpers.
 *
 * The class is always safe to load, but $dev is only installed when the
 * database explicitly enables debugMode. Helpers operate on runtime objects
 * and stable IDs; they never alter canonical JSON data.
 */
class DevTools {
  static install() {
    if (DatabaseManager.system?.debugMode !== true) {
      if (globalThis.$dev instanceof DevTools) {
        delete globalThis.$dev;
      }
      return null;
    }

    const tools = new DevTools();
    globalThis.$dev = tools;
    DebugManager.log("DevTools ready. Type $dev.help() for console helpers.");
    return tools;
  }

  get P() {
    return globalThis.$gameParty || null;
  }

  get S() {
    return globalThis.$gameSystem || null;
  }

  A(actorId = 1) {
    return this.actor(actorId);
  }

  E(index = 0) {
    return this.enemy(index);
  }

  actor(actorId = 1) {
    const id = Number(actorId);
    const actor = this.S?.actor?.(id) || this.P?.actorById?.(id) || null;

    if (!actor) {
      console.warn(`$dev: actor ID ${actorId} does not exist.`);
    }

    return actor;
  }

  currentBattle() {
    const scene = globalThis.SceneManager?.currentScene || null;
    return Array.isArray(scene?.enemies) ? scene : null;
  }

  enemy(index = 0) {
    const battle = this.currentBattle();
    const resolvedIndex = Number(index);

    if (!battle) {
      console.warn("$dev: no active battle scene.");
      return null;
    }

    if (!Number.isInteger(resolvedIndex) || resolvedIndex < 0) {
      console.warn(`$dev: invalid enemy index ${index}.`);
      return null;
    }

    const enemy = battle.enemies[resolvedIndex] || null;
    if (!enemy) {
      console.warn(`$dev: enemy index ${index} does not exist in this battle.`);
    }
    return enemy;
  }

  help() {
    const commands = [
      ["$dev.P / $dev.S", "Current party / game system"],
      ["$dev.A(id) / $dev.actor(id)", "Actor runtime object (default actor 1)"],
      ["$dev.E(index) / $dev.enemy(index)", "Enemy runtime object in the active battle"],
      ["$dev.battle(encounterId)", "Start a database encounter (default 1)"],
      ["$dev.recruit(actorId) / $dev.recruitAll()", "Recruit actors for testing"],
      ["$dev.hp(actorId, value) / $dev.hpRate(actorId, rate)", "Set actor HP directly"],
      ["$dev.mp(actorId, value) / $dev.valor(actorId, value)", "Set actor MP / Valor"],
      ["$dev.full(actorId?)", "Restore HP/MP and clear removable statuses"],
      ["$dev.status(actorId, key) / $dev.clearStatus(actorId, key)", "Apply/remove a status by stable key"],
      ["$dev.statusChance(actorId, key, baseChance)", "Inspect effective status chance after target resistance"],
      ["$dev.verbose(enabled)", "Toggle low-level HP/MP/runtime console tracing (default off)"],
      ["$dev.item(itemId, amount) / $dev.runes(amount)", "Give/take inventory or Runes"],
      ["$dev.essence(essenceId, actorId, slot, resonance)", "Equip an Essence with explicit Resonance"],
      ["$dev.essenceLevel(essenceId, level, actorId, slot)", "Equip an Essence at a requested level"],
      ["$dev.level4(essenceId, actorId, slot)", "Equip an Essence at its Level-4 threshold"],
      ["$dev.master(essenceId, actorId, slot)", "Equip an Essence at Mastery-ready Resonance"],
      ["$dev.passive(essenceId, actorId, slot)", "Prepare a Level-4 passive and print a test hint"],
      ["$dev.passives() / $dev.statuses() / $dev.encounters()", "Print useful stable-ID reference tables"],
    ].map(([command, purpose]) => ({ command, purpose }));

    console.table(commands);
    return commands;
  }

  battle(encounterId = 1) {
    const id = Number(encounterId);
    if (!Number.isInteger(id) || id <= 0 || !DatabaseManager.encounter?.(id)) {
      console.warn(`$dev: encounter ID ${encounterId} does not exist.`);
      return false;
    }
    return globalThis.SceneManager?.startBattle?.(id) === true;
  }

  recruit(actorId) {
    const id = Number(actorId);
    if (!this.S?.actor?.(id)) {
      console.warn(`$dev: actor ID ${actorId} does not exist.`);
      return false;
    }
    if (this.S.isActorRecruited?.(id)) {
      return true;
    }
    return this.S.recruitActor?.(id) === true;
  }

  recruitAll() {
    const ids = (DatabaseManager.actors || [])
      .filter((record) => record?.id)
      .map((record) => record.id);
    const recruited = ids.filter((id) => this.recruit(id));
    return recruited;
  }

  hp(actorId = 1, value = 1) {
    const actor = this.actor(actorId);
    if (!actor) return null;
    actor.setHp(Number(value));
    return actor.hp;
  }

  hpRate(actorId = 1, rate = 1) {
    const actor = this.actor(actorId);
    const numeric = Number(rate);
    if (!actor || !Number.isFinite(numeric)) return null;
    actor.setHp(Math.floor(actor.maxHp * Math.max(0, Math.min(1, numeric))));
    return actor.hp;
  }

  mp(actorId = 1, value = 0) {
    const actor = this.actor(actorId);
    const numeric = Number(value);
    if (!actor || !Number.isFinite(numeric)) return null;
    actor.mp = Math.max(0, Math.min(actor.maxMp, numeric));
    return actor.mp;
  }

  valor(actorId = 1, value = null) {
    const actor = this.actor(actorId);
    if (!actor) return null;
    const resolved = value === null ? actor.maxValor : Number(value);
    return actor.setValor(resolved);
  }

  clearStatuses(actorId = 1) {
    const actor = this.actor(actorId);
    if (!actor) return [];
    const keys = Array.isArray(actor.statuses)
      ? actor.statuses.map((status) => status?.key).filter(Boolean)
      : [];
    const removed = [];
    for (const key of keys) {
      if (actor.removeStatus?.(key, { force: true })) {
        removed.push(key);
      }
    }
    actor.updateDerivedStatuses?.();
    return removed;
  }

  full(actorId = null) {
    const actors = actorId === null || actorId === undefined
      ? (this.P?.members?.() || [])
      : [this.actor(actorId)].filter(Boolean);

    for (const actor of actors) {
      this.clearStatuses(actor.actorId);
      actor.recoverAllHp?.();
      actor.recoverAllMp?.();
      actor.setValor?.(0);
    }
    return actors;
  }

  status(actorId = 1, statusKey = "poison") {
    const actor = this.actor(actorId);
    const key = String(statusKey || "").trim();
    if (!actor || !DatabaseManager.statusByKey?.(key)) {
      console.warn(`$dev: status key '${statusKey}' does not exist.`);
      return false;
    }
    return actor.addStatus?.(key) === true;
  }

  clearStatus(actorId = 1, statusKey = "poison") {
    const actor = this.actor(actorId);
    return actor?.removeStatus?.(String(statusKey || "").trim(), { force: true }) === true;
  }

  statusChance(actorId = 1, statusKey = "sleep", baseChance = 1) {
    const actor = this.actor(actorId);
    const key = String(statusKey || "").trim();
    const definition = DatabaseManager.statusByKey?.(key) || null;
    const rawBaseChance = Number(baseChance);

    if (!actor || !definition) {
      console.warn(`$dev: status key '${statusKey}' does not exist.`);
      return null;
    }

    if (!Number.isFinite(rawBaseChance)) {
      console.warn(`$dev: invalid base status chance '${baseChance}'. Use 0..1.`);
      return null;
    }

    const normalizedBaseChance = Math.max(0, Math.min(1, rawBaseChance));
    const rawTargetRate = Number(actor.statusRate?.(key));
    const targetRate = Number.isFinite(rawTargetRate) ? Math.max(0, rawTargetRate) : 1;
    const effectiveChance = Math.max(0, Math.min(1, normalizedBaseChance * targetRate));
    const result = {
      actorId: Number(actorId),
      statusKey: key,
      statusName: definition.name || key,
      family: definition.classification?.family || null,
      baseChance: normalizedBaseChance,
      targetRate,
      effectiveChance,
    };

    console.table([{
      actor: actor.name || `Actor ${actorId}`,
      status: result.statusName,
      family: result.family || "--",
      base: `${Math.round(normalizedBaseChance * 1000) / 10}%`,
      targetRate: `${Math.round(targetRate * 1000) / 10}%`,
      effective: `${Math.round(effectiveChance * 1000) / 10}%`,
    }]);
    return result;
  }

  verbose(enabled = true) {
    if (typeof DebugManager.setVerboseEnabled !== "function") {
      console.warn("$dev: verbose runtime tracing is unavailable.");
      return false;
    }

    const active = DebugManager.setVerboseEnabled(enabled);
    console.log(`$dev verbose runtime tracing: ${active ? "ON" : "OFF"}`);
    return active;
  }

  item(itemId, amount = 1) {
    const id = Number(itemId);
    const quantity = Number(amount);
    if (!DatabaseManager.item?.(id)) {
      console.warn(`$dev: item ID ${itemId} does not exist.`);
      return false;
    }
    return this.P?.gainItem?.(id, quantity) === true;
  }

  runes(amount = 1000) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0 || !this.P) return false;
    if (value > 0) return this.P.gainRunes?.(value) === true;
    return this.P.spendRunes?.(Math.abs(value)) === true;
  }

  essence(essenceId, actorId = 1, slot = 0, resonance = 0) {
    const actor = this.actor(actorId);
    const id = Number(essenceId);
    const slotIndex = Number(slot);
    const amount = Number(resonance);

    if (!actor || !DatabaseManager.essence?.(id)) {
      console.warn(`$dev: Essence ID ${essenceId} does not exist.`);
      return null;
    }
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= actor.essenceSlotCount()) {
      console.warn(`$dev: actor ${actorId} has no Essence slot ${slot}.`);
      return null;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      console.warn(`$dev: invalid Resonance ${resonance}.`);
      return null;
    }

    const existingSlot = actor.equippedEssenceSlot?.(id) ?? -1;
    if (existingSlot >= 0 && existingSlot !== slotIndex) {
      actor.unequipEssenceSlot(existingSlot);
    }

    if (!actor.equipEssenceInSlot(slotIndex, id)) {
      return null;
    }

    const essence = actor.equippedEssenceAt(slotIndex);
    essence?.setResonance?.(amount);
    return essence || null;
  }

  essenceLevel(essenceId, level = 4, actorId = 1, slot = 0) {
    const data = DatabaseManager.essence?.(Number(essenceId));
    const requestedLevel = Number(level);
    const levelData = data?.levels?.find((entry) => entry.level === requestedLevel);

    if (!levelData) {
      console.warn(`$dev: Essence ${essenceId} has no Level ${level}.`);
      return null;
    }

    return this.essence(essenceId, actorId, slot, levelData.resonanceRequired);
  }

  level4(essenceId, actorId = 1, slot = 0) {
    return this.essenceLevel(essenceId, 4, actorId, slot);
  }

  master(essenceId, actorId = 1, slot = 0) {
    const data = DatabaseManager.essence?.(Number(essenceId));
    const threshold = Number(data?.mastery?.resonanceRequired);
    if (!data || !Number.isFinite(threshold) || threshold < 0) {
      console.warn(`$dev: Essence ${essenceId} has no valid Mastery threshold.`);
      return null;
    }
    return this.essence(essenceId, actorId, slot, threshold);
  }

  passive(essenceId, actorId = 1, slot = 0) {
    const essence = this.level4(essenceId, actorId, slot);
    if (!essence) return null;

    const data = essence.data?.() || null;
    const passive = essence.activePassive?.() || null;
    const hint = this.passiveHint(passive);
    const result = {
      actorId: Number(actorId),
      essenceId: Number(essenceId),
      essenceName: data?.name || `Essence ${essenceId}`,
      level: essence.level?.() || 0,
      resonance: essence.resonance,
      passiveType: passive?.type || null,
      hint,
    };

    console.log(`$dev passive ready: ${result.essenceName} on actor ${actorId}.`);
    if (hint) console.log(`Test hint: ${hint}`);
    return result;
  }

  passiveHint(passive) {
    switch (passive?.type) {
      case "essenceAbilityMpCostReduction": return "Compare this Essence's Magick MP cost before/after Level 4.";
      case "essenceCleanseHeal": return "Injure and status an ally, then cleanse that status with this Essence's Magick.";
      case "reviveGrantStatus": return "Defeat an ally, revive them with this Essence's Magick, and inspect the granted status.";
      case "elementDamageBoost": return `Cast ${passive.element || "matching"} Magick and compare damage.`;
      case "elementStatusChance": return `Cast matching Magick repeatedly and watch for '${passive.status}'.`;
      case "elementSelfStatusChance": return `Cast matching Magick repeatedly and watch the caster for '${passive.status}'.`;
      case "statusDamageBoost": return `Inflict '${passive.status}' and observe its periodic damage.`;
      case "statusFamilyResistance": return `Have an enemy attempt a '${passive.statusFamily}' family status on this actor.`;
      case "essenceAbilityStatusChanceBoost": return "Use this Essence's status Magick repeatedly and compare application rate.";
      case "essenceAbilityMpRefundChance": return "Use this Essence's Magick repeatedly and watch for a full MP refund.";
      case "lowHpSelfStatuses": return `Start battle above ${Math.round((passive.hpThreshold || 0) * 100)}% HP, then cross the threshold.`;
      case "incomingStatusNegateChance": return "Let enemies attempt hostile negative statuses on this actor.";
      case "essenceAbilityPartialMpRefundChance": return "Use this Essence's Magick repeatedly and watch for a partial MP refund.";
      case "physicalEvasionBonus": return "Let enemies use physical attacks on this actor and watch for extra misses.";
      case "lowHpPhysicalDamageBoost": return "Compare physical damage above 50%, at/below 50%, and at/below 25% HP.";
      case "successfulEscapePartyRecovery": return "Injure/drain the party, start an escapable encounter, then escape successfully.";
      case "banishChainChance": return "Start a multi-enemy encounter and cast Banish repeatedly to watch for a chain.";
      default: return "Passive is equipped at Level 4 and ready for manual testing.";
    }
  }

  passives() {
    const rows = (DatabaseManager.essences || [])
      .filter((essence) => essence?.id && essence?.passive)
      .map((essence) => ({
        id: essence.id,
        name: essence.name,
        passive: essence.passive.type,
        unlockLevel: essence.passive.unlockLevel,
      }));
    console.table(rows);
    return rows;
  }

  statuses() {
    const rows = (DatabaseManager.statuses || [])
      .filter((status) => status?.id)
      .map((status) => ({ id: status.id, key: status.key, name: status.name }));
    console.table(rows);
    return rows;
  }

  encounters() {
    const rows = (DatabaseManager.encounters || [])
      .filter((encounter) => encounter?.id)
      .map((encounter) => ({
        id: encounter.id,
        name: encounter.name,
        enemies: Array.isArray(encounter.members) ? encounter.members.length : 0,
        canEscape: encounter.canEscape === true,
      }));
    console.table(rows);
    return rows;
  }
}
