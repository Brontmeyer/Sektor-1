"use strict";

/**
 * Fail-fast validation for the JSON database loaded at startup.
 *
 * The goal is to catch malformed IDs, missing records, invalid battle
 * settings, and unsupported skill targeting before they turn into harder
 * runtime bugs elsewhere in the engine.
 */
class DatabaseValidator {
  static validate(database) {
    const errors = [];

    this.validateSystem(database.system, database.mapInfos, errors);
    this.validateIndexedDatabase("Actors", database.actors, errors);
    this.validateIndexedDatabase("Enemies", database.enemies, errors);
    this.validateIndexedDatabase("Items", database.items, errors);
    this.validateIndexedDatabase("Weapons", database.weapons, errors);
    this.validateIndexedDatabase("Armors", database.armors, errors);
    this.validateIndexedDatabase("Skills", database.skills, errors);
    this.validateMapInfos(database.mapInfos, errors);
    this.validateSkills(database.skills, errors);

    if (errors.length > 0) {
      const details = errors.map((error) => `- ${error}`).join("\n");
      throw new Error(`Database validation failed:\n${details}`);
    }

    DebugManager.log("Database validation passed.");
    return true;
  }

  static validateSystem(system, mapInfos, errors) {
    if (!system || typeof system !== "object") {
      errors.push("System.json must contain an object.");
      return;
    }

    if (!Number.isInteger(system.startMapId)) {
      errors.push("System.startMapId must be an integer.");
    }

    if (!["side", "front"].includes(system.battleView)) {
      errors.push('System.battleView must be either "side" or "front".');
    }

    if (
      system.debugMode !== undefined &&
      typeof system.debugMode !== "boolean"
    ) {
      errors.push("System.debugMode must be true or false when provided.");
    }

    if (
      Number.isInteger(system.startMapId) &&
      Array.isArray(mapInfos) &&
      !mapInfos.some((mapInfo) => mapInfo?.id === system.startMapId)
    ) {
      errors.push(
        `System.startMapId ${system.startMapId} is not present in MapInfos.json.`,
      );
    }
  }

  static validateIndexedDatabase(name, records, errors) {
    if (!Array.isArray(records)) {
      errors.push(`${name}.json must contain an array.`);
      return;
    }

    for (let index = 1; index < records.length; index++) {
      const record = records[index];

      if (!record) {
        continue;
      }

      if (record.id !== index) {
        errors.push(
          `${name}.json record at index ${index} must have id ${index}.`,
        );
      }

      if (!record.name || typeof record.name !== "string") {
        errors.push(`${name}.json record ${index} must have a name.`);
      }
    }
  }

  static validateMapInfos(mapInfos, errors) {
    if (!Array.isArray(mapInfos)) {
      errors.push("MapInfos.json must contain an array.");
      return;
    }

    const ids = new Set();

    for (const mapInfo of mapInfos) {
      if (!mapInfo || !Number.isInteger(mapInfo.id)) {
        errors.push("Every MapInfos.json entry must have an integer id.");
        continue;
      }

      if (ids.has(mapInfo.id)) {
        errors.push(`MapInfos.json contains duplicate map id ${mapInfo.id}.`);
      }

      ids.add(mapInfo.id);

      if (!mapInfo.name || typeof mapInfo.name !== "string") {
        errors.push(`Map ${mapInfo.id} must have a name.`);
      }

      if (!mapInfo.file || typeof mapInfo.file !== "string") {
        errors.push(`Map ${mapInfo.id} must have a file name.`);
      }
    }
  }

  static validateSkills(skills, errors) {
    if (!Array.isArray(skills)) {
      return;
    }

    const validTargets = new Set(["self", "ally", "enemy"]);
    const validScopes = new Set(["single", "all"]);

    for (let index = 1; index < skills.length; index++) {
      const skill = skills[index];

      if (!skill) {
        continue;
      }

      if (!Array.isArray(skill.target) || skill.target.length === 0) {
        errors.push(`Skill ${index} must define at least one target type.`);
      } else {
        for (const target of skill.target) {
          if (!validTargets.has(target)) {
            errors.push(`Skill ${index} has unsupported target "${target}".`);
          }
        }
      }

      if (!validScopes.has(skill.scope)) {
        errors.push(`Skill ${index} has unsupported scope "${skill.scope}".`);
      }

      if (!Number.isFinite(skill.mpCost) || skill.mpCost < 0) {
        errors.push(`Skill ${index} must have a non-negative numeric mpCost.`);
      }
    }
  }
}
