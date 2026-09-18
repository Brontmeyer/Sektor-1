"use strict";

class DatabaseValidator {
  static validate(database) {
    const errors = [];

    this.validateSystem(database.system, database.mapInfos, errors);
    this.validateIndexedDatabase("Actors", database.actors, errors);
    this.validateIndexedDatabase("Enemies", database.enemies, errors);
    this.validateIndexedDatabase("Encounters", database.encounters, errors);
    this.validateIndexedDatabase("Items", database.items, errors);
    this.validateIndexedDatabase("Weapons", database.weapons, errors);
    this.validateIndexedDatabase("Armors", database.armors, errors);
    this.validateIndexedDatabase("Skills", database.skills, errors);
    this.validateIndexedDatabase("Statuses", database.statuses, errors);

    this.validateMapInfos(database.mapInfos, errors);
    this.validateEnemies(database.enemies, errors);
    this.validateSkills(database.skills, errors);
    this.validateStatuses(database.statuses, errors);
    this.validateEncounters(database.encounters, database.enemies, errors);

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

  static validateEnemies(enemies, errors) {
    if (!Array.isArray(enemies)) {
      return;
    }

    for (let index = 1; index < enemies.length; index++) {
      const enemy = enemies[index];

      if (!enemy) {
        continue;
      }

      if (!Number.isInteger(enemy.expReward) || enemy.expReward < 0) {
        errors.push(
          `Enemy ${index} expReward must be a non-negative integer.`,
        );
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

      const scopes = Array.isArray(skill.scope) ? skill.scope : [skill.scope];

      if (scopes.length === 0) {
        errors.push(`Skill ${index} must define at least one scope.`);
      } else {
        for (const scope of scopes) {
          if (!validScopes.has(scope)) {
            errors.push(`Skill ${index} has unsupported scope "${scope}".`);
          }
        }
      }

      if (
        typeof skill.type !== "string" ||
        skill.type.trim().length === 0
      ) {
        errors.push(`Skill ${index} must define a non-empty string type.`);
      }

      if (!Number.isFinite(skill.mpCost) || skill.mpCost < 0) {
        errors.push(`Skill ${index} must have a non-negative numeric mpCost.`);
      }

      if (typeof skill.reflectable !== "boolean") {
        errors.push(`Skill ${index} reflectable must be true or false.`);
      }

      if (
        skill.status !== undefined &&
        (typeof skill.status !== "object" ||
          skill.status === null ||
          Array.isArray(skill.status))
      ) {
        errors.push(`Skill ${index} status must be an object when provided.`);
      } else if (skill.status && typeof skill.status === "object") {
        for (const [statusKey, chance] of Object.entries(skill.status)) {
          if (!statusKey) {
            errors.push(`Skill ${index} status keys must be non-empty strings.`);
          }

          if (!Number.isFinite(chance) || chance < 0 || chance > 1) {
            errors.push(
              `Skill ${index} status chance for "${statusKey}" must be between 0 and 1.`,
            );
          }
        }
      }

      if (
        skill.allyStatusChance !== undefined &&
        (!Number.isFinite(skill.allyStatusChance) ||
          skill.allyStatusChance < 0 ||
          skill.allyStatusChance > 1)
      ) {
        errors.push(
          `Skill ${index} allyStatusChance must be between 0 and 1 when provided.`,
        );
      }

      if (
        skill.toggleStatus !== undefined &&
        typeof skill.toggleStatus !== "boolean"
      ) {
        errors.push(`Skill ${index} toggleStatus must be true or false when provided.`);
      }
    }
  }

  static validateEncounters(encounters, enemies, errors) {
    if (!Array.isArray(encounters) || !Array.isArray(enemies)) {
      return;
    }

    for (let index = 1; index < encounters.length; index++) {
      const encounter = encounters[index];

      if (!encounter) {
        continue;
      }

      if (typeof encounter.canEscape !== "boolean") {
        errors.push(`Encounter ${index} canEscape must be a boolean.`);
      }

      if (!Array.isArray(encounter.members) || encounter.members.length === 0) {
        errors.push(`Encounter ${index} must define at least one member.`);
        continue;
      }

      const slots = new Set();

      for (
        let memberIndex = 0;
        memberIndex < encounter.members.length;
        memberIndex++
      ) {
        const member = encounter.members[memberIndex];
        const label = `Encounter ${index} member ${memberIndex + 1}`;

        if (!member || typeof member !== "object" || Array.isArray(member)) {
          errors.push(`${label} must be an object.`);
          continue;
        }

        if (!Number.isInteger(member.enemyId) || !enemies[member.enemyId]) {
          errors.push(`${label} references unknown enemy ID ${member.enemyId}.`);
        }

        if (
          !Number.isInteger(member.slot) ||
          member.slot < 0 ||
          member.slot > 2
        ) {
          errors.push(`${label} slot must be an integer from 0 to 2.`);
        } else if (slots.has(member.slot)) {
          errors.push(`Encounter ${index} uses slot ${member.slot} more than once.`);
        } else {
          slots.add(member.slot);
        }
      }
    }
  }

  static validateStatuses(statuses, errors) {
    if (!Array.isArray(statuses)) {
      return;
    }

    const keys = new Set();

    for (let index = 1; index < statuses.length; index++) {
      const status = statuses[index];

      if (!status) {
        continue;
      }

      if (!status.key || typeof status.key !== "string") {
        errors.push(`Status ${index} must have a key.`);
      } else if (keys.has(status.key)) {
        errors.push(
          `Statuses.json contains duplicate status key "${status.key}".`,
        );
      } else {
        keys.add(status.key);
      }

      if (
        !status.classification ||
        typeof status.classification !== "object" ||
        Array.isArray(status.classification)
      ) {
        errors.push(`Status ${index} must define a classification object.`);
      } else {
        const classification = status.classification;

        if (
          !classification.family ||
          typeof classification.family !== "string"
        ) {
          errors.push(`Status ${index} must define a classification family.`);
        }

        if (typeof classification.negative !== "boolean") {
          errors.push(
            `Status ${index} classification.negative must be a boolean.`,
          );
        }

        if (typeof classification.removable !== "boolean") {
          errors.push(
            `Status ${index} classification.removable must be a boolean.`,
          );
        }

        if (typeof classification.persistsAfterBattle !== "boolean") {
          errors.push(
            `Status ${index} classification.persistsAfterBattle must be a boolean.`,
          );
        }
      }

      if (
        !status.duration ||
        typeof status.duration !== "object" ||
        Array.isArray(status.duration)
      ) {
        errors.push(`Status ${index} must define a duration object.`);
      } else {
        const duration = status.duration;

        const validDurationTypes = new Set([
          "untilRemoved",
          "turns",
          "countdown",
          "derived",
        ]);

        if (!validDurationTypes.has(duration.type)) {
          errors.push(
            `Status ${index} has unsupported duration type "${duration.type}".`,
          );
        }

        if (
          duration.type === "turns" &&
          (!Number.isInteger(duration.turns) || duration.turns <= 0)
        ) {
          errors.push(
            `Status ${index} with duration type "turns" must define a positive integer turns value.`,
          );
        }

        if (
          duration.type === "countdown" &&
          (!Number.isInteger(duration.turns) || duration.turns <= 0)
        ) {
          errors.push(
            `Status ${index} with duration type "countdown" must define a positive integer turns value.`,
          );
        }
      }

      if (
        status.conditions !== undefined &&
        (typeof status.conditions !== "object" ||
          status.conditions === null ||
          Array.isArray(status.conditions))
      ) {
        errors.push(`Status ${index} conditions must be an object.`);
      }

      if (
        status.conditions &&
        typeof status.conditions === "object" &&
        !Array.isArray(status.conditions)
      ) {
        const conditions = status.conditions;

        if (
          conditions.hpPercentAtOrBelow !== undefined &&
          (typeof conditions.hpPercentAtOrBelow !== "number" ||
            conditions.hpPercentAtOrBelow < 0 ||
            conditions.hpPercentAtOrBelow > 1)
        ) {
          errors.push(
            `Status ${index} conditions.hpPercentAtOrBelow must be a number from 0 to 1.`,
          );
        }

        if (
          conditions.hpPercentAbove !== undefined &&
          (typeof conditions.hpPercentAbove !== "number" ||
            conditions.hpPercentAbove < 0 ||
            conditions.hpPercentAbove > 1)
        ) {
          errors.push(
            `Status ${index} conditions.hpPercentAbove must be a number from 0 to 1.`,
          );
        }
      }

      if (
        !status.effects ||
        typeof status.effects !== "object" ||
        Array.isArray(status.effects)
      ) {
        errors.push(`Status ${index} must define an effects object.`);
      } else {
        const effects = status.effects;

        for (const effectKey of ["allowedActions", "blockedSkillTypes"]) {
          const values = effects[effectKey];

          if (values === undefined) {
            continue;
          }

          if (
            !Array.isArray(values) ||
            values.length === 0 ||
            values.some(
              (value) => typeof value !== "string" || value.trim().length === 0,
            )
          ) {
            errors.push(
              `Status ${index} effects.${effectKey} must be a non-empty array of non-empty strings when provided.`,
            );
          }
        }

        if (
          effects.reflectableSkills !== undefined &&
          typeof effects.reflectableSkills !== "boolean"
        ) {
          errors.push(
            `Status ${index} effects.reflectableSkills must be true or false when provided.`,
          );
        }

        if (
          effects.perTarget !== undefined &&
          typeof effects.perTarget !== "boolean"
        ) {
          errors.push(
            `Status ${index} effects.perTarget must be true or false when provided.`,
          );
        }

        if (
          effects.maxReflections !== undefined &&
          (!Number.isInteger(effects.maxReflections) ||
            effects.maxReflections < 1)
        ) {
          errors.push(
            `Status ${index} effects.maxReflections must be a positive integer when provided.`,
          );
        }

        if (
          effects.reflectableSkills === true &&
          effects.perTarget !== true
        ) {
          errors.push(
            `Status ${index} that reflects skills must define effects.perTarget as true.`,
          );
        }

        if (
          effects.reflectableSkills === true &&
          (!Number.isInteger(effects.maxReflections) ||
            effects.maxReflections < 1)
        ) {
          errors.push(
            `Status ${index} that reflects skills must define a positive integer maxReflections.`,
          );
        }
      }
    }
  }
}
