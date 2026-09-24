"use strict";

class SaveManager {
  static currentVersion() {
    return 11;
  }

  static clearError() {
    this.lastError = "";
  }

  static errorMessage() {
    return this.lastError || "Unknown save error.";
  }

  static fail(message, error = null) {
    this.lastError = message;

    if (error) {
      console.error(message, error);
    } else {
      console.error(message);
    }

    return false;
  }

  static exists(slotId = 1) {
    return localStorage.getItem(this.saveKey(slotId)) !== null;
  }

  static read(slotId = 1) {
    this.clearError();

    const json = localStorage.getItem(this.saveKey(slotId));

    if (!json) {
      return null;
    }

    try {
      return JSON.parse(json);
    } catch (error) {
      this.fail("Could not read save data.", error);
      return null;
    }
  }

  static isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  static migrateSaveData(saveData) {
    if (!this.isPlainObject(saveData)) {
      return null;
    }

    const rawVersion = Number(saveData.version);
    const inferredVersion = Number.isInteger(rawVersion)
      ? rawVersion
      : saveData.actor
        ? 1
        : null;

    const upgradeToCurrent = (data, { includeStarterSkills = false } = {}) => ({
      ...data,
      version: this.currentVersion(),
      actors: Array.isArray(data.actors)
        ? data.actors.map((actor) => {
            const source = this.isPlainObject(actor) ? actor : {};
            const magickIds = Array.isArray(source.magickIds)
              ? source.magickIds
              : Array.isArray(source.skills)
                ? source.skills
                : [];
            const savedSkillIds = Array.isArray(source.skillIds)
              ? source.skillIds
              : [];
            const actorDefinition =
              DatabaseManager.actor?.(Number(source.actorId)) || null;
            const starterSkillIds = Array.isArray(actorDefinition?.initialSkillIds)
              ? actorDefinition.initialSkillIds
              : [];
            const skillIds = includeStarterSkills
              ? [...new Set([...savedSkillIds, ...starterSkillIds])]
              : savedSkillIds;
            const legacyEssences = Array.isArray(source.essences)
              ? source.essences
              : [];
            const essenceProgress = Array.isArray(source.essenceProgress)
              ? source.essenceProgress
              : legacyEssences;
            const rawEquippedEssenceIds = Array.isArray(source.equippedEssenceIds)
              ? source.equippedEssenceIds
              : legacyEssences.map((state) => state?.essenceId ?? null);
            const configuredSlots = Number(
              DatabaseManager.actor?.(Number(source.actorId))?.essenceSlots,
            );
            const equippedEssenceIds =
              Number.isInteger(configuredSlots) && configuredSlots > 0
                ? rawEquippedEssenceIds.slice(0, configuredSlots)
                : rawEquippedEssenceIds;
            const {
              skills: _legacySkills,
              essences: _legacyEssences,
              ...rest
            } = source;

            const accessoryId = Number(source.accessoryId);
            const valor = Number(source.valor);

            return {
              ...rest,
              accessoryId:
                Number.isInteger(accessoryId) && accessoryId > 0 ? accessoryId : 0,
              valor: Number.isFinite(valor) && valor >= 0 ? valor : 0,
              magickIds,
              skillIds,
              essenceProgress,
              equippedEssenceIds,
            };
          })
        : [],
      party: {
        ...(this.isPlainObject(data.party) ? data.party : {}),
        accessories: this.isPlainObject(data.party?.accessories)
          ? data.party.accessories
          : {},
        gil: Number.isInteger(Number(data.party?.gil))
          ? Math.max(0, Number(data.party.gil))
          : 0,
        battleRows: this.isPlainObject(data.party?.battleRows)
          ? data.party.battleRows
          : {},
        battleFormationActorIds: Array.isArray(
          data.party?.battleFormationActorIds,
        )
          ? data.party.battleFormationActorIds
          : Array.isArray(data.party?.battleActorIds)
            ? data.party.battleActorIds
            : [],
      },
    });

    if (inferredVersion === this.currentVersion()) {
      return upgradeToCurrent(saveData);
    }

    if ([10, 9].includes(inferredVersion)) {
      // v9+ already owns explicit Skill state, including deliberately forgotten
      // starter Arts. v10 adds row state; v11 adds visual formation ordering.
      // Preserve existing state exactly and default a missing formation order to
      // the saved active-party order.
      return upgradeToCurrent(saveData);
    }

    if ([8, 7, 6, 5, 4, 3, 2].includes(inferredVersion)) {
      return upgradeToCurrent(saveData, { includeStarterSkills: true });
    }

    if (inferredVersion === 1) {
      const legacyActor = this.isPlainObject(saveData.actor)
        ? { ...saveData.actor, essences: [] }
        : null;

      return upgradeToCurrent(
        {
          ...saveData,
          actors: legacyActor ? [legacyActor] : [],
        },
        { includeStarterSkills: true },
      );
    }

    return null;
  }

  static validateSaveData(saveData) {
    const errors = [];

    if (!this.isPlainObject(saveData)) {
      return ["Save data must be an object."];
    }

    if (saveData.version !== this.currentVersion()) {
      errors.push(
        `Unsupported save version ${saveData.version}; expected ${this.currentVersion()}.`,
      );
    }

    if (!Array.isArray(saveData.actors) || saveData.actors.length === 0) {
      errors.push("Save data must contain at least one actor state.");
    } else {
      const seenActorIds = new Set();

      for (const actorData of saveData.actors) {
        if (!this.isPlainObject(actorData)) {
          errors.push("Every saved actor state must be an object.");
          continue;
        }

        const actorId = Number(actorData.actorId);

        if (!Number.isInteger(actorId) || actorId <= 0) {
          errors.push("Saved actor IDs must be positive integers.");
          continue;
        }

        if (seenActorIds.has(actorId)) {
          errors.push(`Actor ${actorId} appears more than once in save data.`);
        }

        seenActorIds.add(actorId);

        if (!$gameParty?.actorById?.(actorId)) {
          errors.push(`Saved actor ${actorId} does not exist in the current party roster.`);
        }

        const numericFields = [
          "level",
          "exp",
          "hp",
          "maxHp",
          "mp",
          "maxMp",
          "strength",
          "vitality",
          "dexterity",
          "agility",
          "magic",
          "spirit",
          "luck",
          "attack",
          "attackPercent",
          "defense",
          "defensePercent",
          "magicAttack",
          "magicDefense",
          "magicDefensePercent",
        ];

        for (const field of numericFields) {
          if (
            actorData[field] !== undefined &&
            !Number.isFinite(Number(actorData[field]))
          ) {
            errors.push(`Actor ${actorId} field ${field} must be numeric.`);
          }
        }

        for (const [field, lookup, label] of [
          ["weaponId", (id) => DatabaseManager.weapon?.(id), "Weapon"],
          ["armorId", (id) => DatabaseManager.armor?.(id), "Armor"],
          ["accessoryId", (id) => DatabaseManager.accessory?.(id), "Accessory"],
        ]) {
          const equipmentId = Number(actorData[field] ?? 0);

          if (!Number.isInteger(equipmentId) || equipmentId < 0) {
            errors.push(
              `Actor ${actorId} field ${field} must be a non-negative integer.`,
            );
            continue;
          }

          if (equipmentId > 0 && !lookup(equipmentId)) {
            errors.push(`Actor ${actorId} equips unknown ${label} ${equipmentId}.`);
          }
        }

        if (actorData.magickIds !== undefined && !Array.isArray(actorData.magickIds)) {
          errors.push(`Actor ${actorId} magickIds must be an array.`);
        }

        if (actorData.skillIds !== undefined && !Array.isArray(actorData.skillIds)) {
          errors.push(`Actor ${actorId} skillIds must be an array.`);
        } else if (Array.isArray(actorData.skillIds)) {
          const seenSkillIds = new Set();

          for (const rawSkillId of actorData.skillIds) {
            const skillId = Number(rawSkillId);

            if (
              !Number.isInteger(skillId) ||
              skillId <= 0 ||
              !DatabaseManager.skill?.(skillId)
            ) {
              errors.push(`Actor ${actorId} references unknown Skill ${rawSkillId}.`);
              continue;
            }

            if (seenSkillIds.has(skillId)) {
              errors.push(`Actor ${actorId} stores Skill ${skillId} more than once.`);
            }

            seenSkillIds.add(skillId);
          }
        }

        if (
          actorData.statuses !== undefined &&
          !Array.isArray(actorData.statuses)
        ) {
          errors.push(`Actor ${actorId} statuses must be an array.`);
        }

        const runtimeActor = $gameParty?.actorById?.(actorId) || null;
        const valor = Number(actorData.valor ?? 0);
        const maxValor = Number(runtimeActor?.maxValor);

        if (
          !Number.isFinite(valor) ||
          valor < 0 ||
          (Number.isFinite(maxValor) && maxValor > 0 && valor > maxValor)
        ) {
          errors.push(
            `Actor ${actorId} valor must be between 0 and ${Number.isFinite(maxValor) && maxValor > 0 ? maxValor : "its configured maximum"}.`,
          );
        }

        const progressIds = new Set();

        if (
          actorData.essenceProgress !== undefined &&
          !Array.isArray(actorData.essenceProgress)
        ) {
          errors.push(`Actor ${actorId} essenceProgress must be an array.`);
        } else if (Array.isArray(actorData.essenceProgress)) {
          for (const essenceState of actorData.essenceProgress) {
            if (!this.isPlainObject(essenceState)) {
              errors.push(`Actor ${actorId} Essence progress state must be an object.`);
              continue;
            }

            const essenceId = Number(essenceState.essenceId);
            const resonance = Number(essenceState.resonance);
            const essenceData = DatabaseManager.essence?.(essenceId) || null;

            if (!Number.isInteger(essenceId) || essenceId <= 0 || !essenceData) {
              errors.push(`Actor ${actorId} references unknown Essence ${essenceState.essenceId}.`);
              continue;
            }

            if (progressIds.has(essenceId)) {
              errors.push(`Actor ${actorId} stores Essence ${essenceId} progress more than once.`);
            }
            progressIds.add(essenceId);

            const cap = Number(essenceData.mastery?.resonanceRequired);
            const maximum = Number.isFinite(cap) && cap >= 0 ? cap : 1500;

            if (!Number.isFinite(resonance) || resonance < 0 || resonance > maximum) {
              errors.push(
                `Actor ${actorId} Essence ${essenceId} resonance must be between 0 and ${maximum}.`,
              );
            }
          }
        }

        if (
          actorData.equippedEssenceIds !== undefined &&
          !Array.isArray(actorData.equippedEssenceIds)
        ) {
          errors.push(`Actor ${actorId} equippedEssenceIds must be an array.`);
        } else if (Array.isArray(actorData.equippedEssenceIds)) {
          const slotCount = runtimeActor?.essenceSlotCount?.() ?? 0;

          if (
            Number.isInteger(slotCount) &&
            slotCount > 0 &&
            actorData.equippedEssenceIds.length > slotCount
          ) {
            errors.push(
              `Actor ${actorId} equippedEssenceIds exceeds its ${slotCount} Essence slots.`,
            );
          }

          const equippedIds = new Set();

          for (const rawEssenceId of actorData.equippedEssenceIds) {
            if (rawEssenceId === null || rawEssenceId === undefined || rawEssenceId === 0) {
              continue;
            }

            const essenceId = Number(rawEssenceId);

            if (
              !Number.isInteger(essenceId) ||
              essenceId <= 0 ||
              !DatabaseManager.essence?.(essenceId)
            ) {
              errors.push(`Actor ${actorId} equips unknown Essence ${rawEssenceId}.`);
              continue;
            }

            if (equippedIds.has(essenceId)) {
              errors.push(`Actor ${actorId} equips Essence ${essenceId} more than once.`);
            }
            equippedIds.add(essenceId);

            if (!progressIds.has(essenceId)) {
              errors.push(
                `Actor ${actorId} equips Essence ${essenceId} without saved progression state.`,
              );
            }
          }
        }
      }
    }

    if (!this.isPlainObject(saveData.party)) {
      errors.push("Save data must contain a party object.");
    } else {
      for (const key of ["items", "weapons", "armors", "accessories"]) {
        if (
          saveData.party[key] !== undefined &&
          !this.isPlainObject(saveData.party[key])
        ) {
          errors.push(`Party ${key} must be an object.`);
        }
      }

      if (
        saveData.party.battleActorIds !== undefined &&
        !Array.isArray(saveData.party.battleActorIds)
      ) {
        errors.push("Party battleActorIds must be an array.");
      }

      if (
        saveData.party.battleFormationActorIds !== undefined &&
        !Array.isArray(saveData.party.battleFormationActorIds)
      ) {
        errors.push("Party battleFormationActorIds must be an array.");
      }

      if (
        saveData.party.battleRows !== undefined &&
        !this.isPlainObject(saveData.party.battleRows)
      ) {
        errors.push("Party battleRows must be an object.");
      } else if (this.isPlainObject(saveData.party.battleRows)) {
        for (const [rawActorId, rawRow] of Object.entries(saveData.party.battleRows)) {
          const actorId = Number(rawActorId);
          const row = String(rawRow || "").toLowerCase();

          if (!Number.isInteger(actorId) || actorId <= 0 || !$gameParty?.actorById?.(actorId)) {
            errors.push(`Party battleRows references unknown actor ${rawActorId}.`);
            continue;
          }

          if (!["front", "back"].includes(row)) {
            errors.push(`Party battleRows actor ${actorId} must be front or back.`);
          }
        }
      }

      const gil = Number(saveData.party.gil);
      if (!Number.isInteger(gil) || gil < 0) {
        errors.push("Party gil must be a non-negative integer.");
      }
    }

    if (!this.isPlainObject(saveData.location)) {
      errors.push("Save data must contain a location object.");
    } else {
      const mapId = Number(saveData.location.mapId);
      const x = Number(saveData.location.x);
      const y = Number(saveData.location.y);

      if (!Number.isInteger(mapId) || mapId <= 0) {
        errors.push("Saved location mapId must be a positive integer.");
      } else if (
        Array.isArray(DatabaseManager.mapInfos) &&
        !DatabaseManager.mapInfos.some((mapInfo) => mapInfo?.id === mapId)
      ) {
        errors.push(`Saved location references unknown map ${mapId}.`);
      }

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        errors.push("Saved location coordinates must be finite numbers.");
      }
    }

    return errors;
  }

  static prepareSaveData(saveData) {
    const migrated = this.migrateSaveData(saveData);

    if (!migrated) {
      this.fail("Save data uses an unsupported or unrecognized version.");
      return null;
    }

    const errors = this.validateSaveData(migrated);

    if (errors.length > 0) {
      this.fail(`Save validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
      return null;
    }

    return migrated;
  }

  static serializeActor(actor) {
    return {
      actorId: actor.actorId,
      name: actor.name,
      level: actor.level,
      exp: actor.exp,

      hp: actor.hp,
      maxHp: actor.maxHp,
      mp: actor.mp,
      maxMp: actor.maxMp,

      strength: actor.strength,
      vitality: actor.vitality,
      dexterity: actor.dexterity,
      agility: actor.agility,
      magic: actor.magic,
      spirit: actor.spirit,
      luck: actor.luck,

      attack: actor.attack,
      attackPercent: actor.attackPercent,
      defense: actor.defense,
      defensePercent: actor.defensePercent,
      magicAttack: actor.magicAttack,
      magicDefense: actor.magicDefense,
      magicDefensePercent: actor.magicDefensePercent,

      weaponId: actor.weaponId,
      armorId: actor.armorId,
      accessoryId: actor.accessoryId,
      valor: actor.valor,
      magickIds: [...actor.magickIds],
      skillIds: [...actor.skillIds],
      statuses:
        typeof actor.persistentStatusState === "function"
          ? actor.persistentStatusState()
          : [],
      essenceProgress:
        typeof actor.essenceProgressStates === "function"
          ? actor.essenceProgressStates()
          : [],
      equippedEssenceIds:
        typeof actor.equippedEssenceIds === "function"
          ? actor.equippedEssenceIds()
          : [],
    };
  }

  static restoreActor(actor, actorData) {
    const finite = (value, fallback) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    };

    const integer = (value, fallback, minimum = Number.MIN_SAFE_INTEGER) => {
      const number = Number(value);
      return Number.isInteger(number) && number >= minimum ? number : fallback;
    };

    if (typeof actorData.name === "string" && actorData.name.trim().length > 0) {
      actor.name = actorData.name;
    }

    actor.level = integer(actorData.level, actor.level, 1);
    actor.exp = Math.max(0, finite(actorData.exp, actor.exp));

    actor.maxHp = Math.max(1, finite(actorData.maxHp, actor.maxHp));
    actor.maxMp = Math.max(0, finite(actorData.maxMp, actor.maxMp));

    const statFields = [
      "strength",
      "vitality",
      "dexterity",
      "agility",
      "magic",
      "spirit",
      "luck",
      "attack",
      "attackPercent",
      "defense",
      "defensePercent",
      "magicAttack",
      "magicDefense",
      "magicDefensePercent",
    ];

    for (const field of statFields) {
      actor[field] = finite(actorData[field], actor[field]);
    }

    const weaponId = integer(actorData.weaponId, actor.weaponId, 0);
    const armorId = integer(actorData.armorId, actor.armorId, 0);
    const accessoryId = integer(actorData.accessoryId, actor.accessoryId, 0);

    actor.weaponId =
      weaponId === 0 || DatabaseManager.weapon(weaponId) ? weaponId : 0;
    actor.armorId =
      armorId === 0 || DatabaseManager.armor(armorId) ? armorId : 0;
    actor.accessoryId =
      accessoryId === 0 || DatabaseManager.accessory?.(accessoryId)
        ? accessoryId
        : 0;

    if (Array.isArray(actorData.magickIds)) {
      actor.magickIds = [
        ...new Set(
          actorData.magickIds
            .map((magickId) => Number(magickId))
            .filter(
              (magickId) =>
                Number.isInteger(magickId) &&
                magickId > 0 &&
                DatabaseManager.magick(magickId),
            ),
        ),
      ];
    }

    if (Array.isArray(actorData.skillIds)) {
      actor.skillIds = [
        ...new Set(
          actorData.skillIds
            .map((skillId) => Number(skillId))
            .filter(
              (skillId) =>
                Number.isInteger(skillId) &&
                skillId > 0 &&
                DatabaseManager.skill?.(skillId),
            ),
        ),
      ];
    }

    const savedHp = finite(actorData.hp, actor.hp);
    actor.setHp(Math.max(0, Math.min(actor.maxHp, savedHp)));

    const savedMp = finite(actorData.mp, actor.mp);
    actor.mp = Math.max(0, Math.min(actor.maxMp, savedMp));

    if (typeof actor.setValor === "function") {
      actor.setValor(finite(actorData.valor, 0));
    }

    if (typeof actor.restorePersistentStatusState === "function") {
      actor.restorePersistentStatusState(actorData.statuses || []);
    }

    if (typeof actor.restoreEssenceLoadout === "function") {
      actor.restoreEssenceLoadout(
        actorData.essenceProgress || [],
        actorData.equippedEssenceIds || [],
      );
    }
  }

  static normalizeInventory(source, lookup) {
    const normalized = {};

    if (!this.isPlainObject(source)) {
      return normalized;
    }

    for (const [rawId, rawAmount] of Object.entries(source)) {
      const id = Number(rawId);
      const amount = Number(rawAmount);

      if (
        !Number.isInteger(id) ||
        id <= 0 ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !lookup(id)
      ) {
        continue;
      }

      normalized[id] = Math.floor(amount);
    }

    return normalized;
  }

  static restoreParty(partyData) {
    $gameParty.items = this.normalizeInventory(
      partyData.items,
      (id) => DatabaseManager.item(id),
    );
    $gameParty.weapons = this.normalizeInventory(
      partyData.weapons,
      (id) => DatabaseManager.weapon(id),
    );
    $gameParty.armors = this.normalizeInventory(
      partyData.armors,
      (id) => DatabaseManager.armor(id),
    );
    $gameParty.accessories = this.normalizeInventory(
      partyData.accessories,
      (id) => DatabaseManager.accessory?.(id),
    );

    if (typeof $gameParty.setGil === "function") {
      $gameParty.setGil(Number(partyData.gil) || 0);
    }

    if (Array.isArray(partyData.battleActorIds)) {
      $gameParty.setBattleActorIds(partyData.battleActorIds);
    }

    if (
      typeof $gameParty.setBattleFormationActorIds === "function" &&
      Array.isArray(partyData.battleFormationActorIds)
    ) {
      $gameParty.setBattleFormationActorIds(
        partyData.battleFormationActorIds,
      );
    }

    if (typeof $gameParty.setBattleRows === "function") {
      $gameParty.setBattleRows(partyData.battleRows || {});
    }
  }

  static restoreObjectData(target, source) {
    if (!target || !this.isPlainObject(source)) {
      return;
    }

    target.data = { ...source };
  }

  static async restoreLocation(location) {
    let scene = SceneManager.currentScene;

    if (!scene?.map || !scene?.player) {
      scene =
        [...SceneManager.sceneStack]
          .reverse()
          .find((stackedScene) => stackedScene?.map && stackedScene?.player) ||
        null;
    }

    if (!scene?.map || !scene?.player) {
      throw new Error("No active map scene is available for load restoration.");
    }

    const savedMapId = Number(location.mapId);
    const savedX = Number(location.x);
    const savedY = Number(location.y);

    if (scene.map.id === savedMapId) {
      scene.player.x = savedX;
      scene.player.y = savedY;
      scene.player.velocityX = 0;
      scene.player.velocityY = 0;

      if (scene.camera && typeof scene.camera.follow === "function") {
        scene.camera.follow(scene.player);
      }

      DebugManager.log(`Player position restored: (${savedX}, ${savedY})`);
      return;
    }

    DebugManager.log(`Loading saved map ${savedMapId}...`);

    await scene.performTransfer({
      targetMapId: savedMapId,
      targetX: savedX,
      targetY: savedY,
    });

    scene.player.velocityX = 0;
    scene.player.velocityY = 0;

    DebugManager.log(
      `Saved location restored: Map ${savedMapId} (${savedX}, ${savedY})`,
    );
  }

  static async load(slotId = 1) {
    this.clearError();

    try {
      const rawSaveData = this.read(slotId);

      if (!rawSaveData) {
        if (!this.lastError) {
          this.lastError = `No usable save data exists in slot ${slotId}.`;
        }

        console.warn(this.lastError);
        return false;
      }

      const saveData = this.prepareSaveData(rawSaveData);

      if (!saveData) {
        return false;
      }

      for (const actorData of saveData.actors) {
        const actor = $gameParty.actorById(Number(actorData.actorId));

        if (!actor) {
          return this.fail(`Cannot restore unknown actor ${actorData.actorId}.`);
        }

        this.restoreActor(actor, actorData);
      }

      this.restoreParty(saveData.party);
      $gameParty?.reconcileEquipmentOwnership?.();
      globalThis.$gameSystem?.setPlayTimeSeconds?.(saveData.metadata?.playTimeSeconds ?? 0);

      if (saveData.switches) {
        this.restoreObjectData($gameSwitches, saveData.switches.data || {});
      }

      if (saveData.variables) {
        this.restoreObjectData($gameVariables, saveData.variables.data || {});
      }

      if (saveData.selfSwitches) {
        this.restoreObjectData(
          $gameSelfSwitches,
          saveData.selfSwitches.data || {},
        );
      }

      await this.restoreLocation(saveData.location);

      DebugManager.log(`Game loaded from slot ${slotId}.`);
      return true;
    } catch (error) {
      return this.fail(`Could not load save slot ${slotId}.`, error);
    }
  }

  static activeMapScene() {
    let scene = SceneManager.currentScene;

    if (!scene?.map || !scene?.player) {
      scene =
        [...SceneManager.sceneStack]
          .reverse()
          .find((stackedScene) => stackedScene?.map && stackedScene?.player) ||
        null;
    }

    return scene?.map && scene?.player ? scene : null;
  }

  static save(slotId = 1) {
    this.clearError();

    try {
      const scene = this.activeMapScene();

      if (!scene) {
        console.warn("Cannot save: no active map scene.");
        this.lastError = "No active map scene is available for saving.";
        return false;
      }

      const leader = $gameParty.leader();
      const actors = $gameParty.members();

      if (!leader || actors.length === 0) {
        return this.fail("Cannot save: the party has no actors.");
      }

      const saveData = {
        version: this.currentVersion(),

        metadata: {
          actorName: leader.name,
          level: leader.level,
          mapId: scene.map.id,
          mapName: scene.map.name || `Map ${scene.map.id}`,
          timestamp: Date.now(),
          playTimeSeconds: globalThis.$gameSystem?.playTimeSeconds?.() ?? 0,
        },

        actors: actors.map((actor) => this.serializeActor(actor)),

        party: {
          items: { ...$gameParty.items },
          weapons: { ...$gameParty.weapons },
          armors: { ...$gameParty.armors },
          accessories: { ...$gameParty.accessories },
          gil: typeof $gameParty.gil === "function" ? $gameParty.gil() : 0,
          battleActorIds: $gameParty.battleActorIds(),
          battleFormationActorIds:
            typeof $gameParty.battleFormationActorIds === "function"
              ? $gameParty.battleFormationActorIds()
              : $gameParty.battleActorIds(),
          battleRows:
            typeof $gameParty.battleRows === "function"
              ? $gameParty.battleRows()
              : {},
        },

        switches: {
          data: { ...$gameSwitches.data },
        },

        variables: {
          data: { ...$gameVariables.data },
        },

        selfSwitches: {
          data: { ...$gameSelfSwitches.data },
        },

        location: {
          mapId: scene.map.id,
          x: scene.player.x,
          y: scene.player.y,
        },
      };

      const json = JSON.stringify(saveData);
      localStorage.setItem(this.saveKey(slotId), json);

      DebugManager.log(`Game saved to slot ${slotId}.`);
      return true;
    } catch (error) {
      return this.fail(`Could not save slot ${slotId}.`, error);
    }
  }

  static saveKey(slotId) {
    return `Sektor1_Save_${slotId}`;
  }
}
