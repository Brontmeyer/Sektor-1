"use strict";

class DatabaseValidator {
  static validate(database) {
    const errors = [];

    this.validateSystem(database.system, database.mapInfos, errors);

    for (const [name, records] of [
      ["Actors", database.actors],
      ["Enemies", database.enemies],
      ["Encounters", database.encounters],
      ["Items", database.items],
      ["Weapons", database.weapons],
      ["Armors", database.armors],
      ["Accessories", database.accessories],
      ["Magick", database.magickData],
      ["Skills", database.skills],
      ["Essences", database.essences],
      ["Statuses", database.statuses],
    ]) {
      this.validateIndexedDatabase(name, records, errors);
    }

    this.validateMapInfos(database.mapInfos, errors);
    this.validateActors(
      database.actors,
      errors,
      database.magickData,
      database.skills,
    );
    this.validateEnemies(
      database.enemies,
      database.items,
      errors,
      database.magickData,
      database.skills,
    );
    this.validateItems(database.items, errors);
    this.validateWeapons(database.weapons, errors);
    this.validateArmors(database.armors, errors);
    this.validateAccessories(database.accessories, errors);
    this.validateSkills(database.skills, database.statuses, errors);
    this.validateMagick(database.magickData, database.statuses, errors);
    this.validateStatuses(database.statuses, errors);
    this.validateEssences(
      database.essences,
      database.magickData,
      database.statuses,
      errors,
    );
    this.validateEncounters(database.encounters, database.enemies, errors);

    if (errors.length > 0) {
      const details = errors.map((error) => `- ${error}`).join("\n");
      throw new Error(`Database validation failed:\n${details}`);
    }

    DebugManager.log("Database validation passed.");
    return true;
  }

  static isPlainObject(value) {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  static validateFiniteNumber(
    label,
    value,
    errors,
    { min = -Infinity, max = Infinity, integer = false } = {},
  ) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      (integer && !Number.isInteger(value)) ||
      value < min ||
      value > max
    ) {
      const integerText = integer ? " integer" : " number";
      const bounds = [];

      if (min !== -Infinity) {
        bounds.push(`>= ${min}`);
      }

      if (max !== Infinity) {
        bounds.push(`<= ${max}`);
      }

      const boundsText = bounds.length > 0 ? ` (${bounds.join(", ")})` : "";
      errors.push(`${label} must be a finite${integerText}${boundsText}.`);
      return false;
    }

    return true;
  }

  static validateKnownKeys(label, object, allowedKeys, errors) {
    if (!this.isPlainObject(object)) {
      return;
    }

    const allowed = new Set(allowedKeys);

    for (const key of Object.keys(object)) {
      if (!allowed.has(key)) {
        errors.push(`${label} contains unsupported property "${key}".`);
      }
    }
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

  // =================================
  // Map / Event Validation
  // =================================

  static validateMapData(mapData, database, expectedMapId = null) {
    const errors = [];

    this.validateMap(mapData, database, expectedMapId, errors);

    if (errors.length > 0) {
      const details = errors.map((error) => `- ${error}`).join("\n");
      throw new Error(`Map validation failed:\n${details}`);
    }

    DebugManager.log(
      `Map validation passed${expectedMapId === null ? "." : ` for map ${expectedMapId}.`}`,
    );
    return true;
  }

  static validateMap(mapData, database, expectedMapId, errors) {
    if (!this.isPlainObject(mapData)) {
      errors.push("Map data must contain an object.");
      return;
    }

    this.validateKnownKeys(
      "Map",
      mapData,
      [
        "id",
        "name",
        "width",
        "height",
        "playerStart",
        "obstacles",
        "transfers",
        "events",
      ],
      errors,
    );

    if (!Number.isInteger(mapData.id) || mapData.id <= 0) {
      errors.push("Map id must be a positive integer.");
    } else if (expectedMapId !== null && mapData.id !== expectedMapId) {
      errors.push(
        `Map id ${mapData.id} does not match requested map id ${expectedMapId}.`,
      );
    }

    if (typeof mapData.name !== "string" || mapData.name.trim() === "") {
      errors.push("Map name must be a non-empty string.");
    }

    const widthValid = this.validateFiniteNumber(
      "Map width",
      mapData.width,
      errors,
      { min: 1 },
    );
    const heightValid = this.validateFiniteNumber(
      "Map height",
      mapData.height,
      errors,
      { min: 1 },
    );

    if (!this.isPlainObject(mapData.playerStart)) {
      errors.push("Map playerStart must be an object.");
    } else {
      this.validateKnownKeys(
        "Map playerStart",
        mapData.playerStart,
        ["x", "y"],
        errors,
      );
      this.validateMapPoint(
        "Map playerStart",
        mapData.playerStart,
        mapData.width,
        mapData.height,
        widthValid && heightValid,
        errors,
      );
    }

    this.validateMapRectangles(
      "Map obstacle",
      mapData.obstacles,
      mapData.width,
      mapData.height,
      widthValid && heightValid,
      errors,
    );

    if (mapData.transfers !== undefined && !Array.isArray(mapData.transfers)) {
      errors.push("Map transfers must be an array when provided.");
    } else if (Array.isArray(mapData.transfers)) {
      for (let index = 0; index < mapData.transfers.length; index++) {
        const transfer = mapData.transfers[index];
        const label = `Map transfer ${index + 1}`;

        if (!this.isPlainObject(transfer)) {
          errors.push(`${label} must be an object.`);
          continue;
        }

        this.validateKnownKeys(
          label,
          transfer,
          ["x", "y", "width", "height", "targetMapId", "targetX", "targetY"],
          errors,
        );
        this.validateMapRectangle(
          label,
          transfer,
          mapData.width,
          mapData.height,
          widthValid && heightValid,
          errors,
        );

        if (!Number.isInteger(transfer.targetMapId) || transfer.targetMapId <= 0) {
          errors.push(`${label} targetMapId must be a positive integer.`);
        } else if (
          Array.isArray(database?.mapInfos) &&
          !database.mapInfos.some((mapInfo) => mapInfo?.id === transfer.targetMapId)
        ) {
          errors.push(
            `${label} references unknown target map ID ${transfer.targetMapId}.`,
          );
        }

        for (const key of ["targetX", "targetY"]) {
          this.validateFiniteNumber(`${label} ${key}`, transfer[key], errors, {
            min: 0,
          });
        }
      }
    }

    if (mapData.events !== undefined && !Array.isArray(mapData.events)) {
      errors.push("Map events must be an array when provided.");
    } else if (Array.isArray(mapData.events)) {
      const eventIds = new Set();

      for (let index = 0; index < mapData.events.length; index++) {
        const event = mapData.events[index];
        const label = `Map event ${index + 1}`;

        this.validateMapEvent(
          event,
          label,
          mapData.width,
          mapData.height,
          widthValid && heightValid,
          database,
          errors,
        );

        if (Number.isInteger(event?.id)) {
          if (eventIds.has(event.id)) {
            errors.push(`Map contains duplicate event id ${event.id}.`);
          }
          eventIds.add(event.id);
        }
      }
    }
  }

  static validateMapPoint(label, point, mapWidth, mapHeight, boundsValid, errors) {
    const xValid = this.validateFiniteNumber(`${label}.x`, point.x, errors, {
      min: 0,
    });
    const yValid = this.validateFiniteNumber(`${label}.y`, point.y, errors, {
      min: 0,
    });

    if (boundsValid && xValid && point.x >= mapWidth) {
      errors.push(`${label}.x must be inside the map width.`);
    }

    if (boundsValid && yValid && point.y >= mapHeight) {
      errors.push(`${label}.y must be inside the map height.`);
    }
  }

  static validateMapRectangles(label, rectangles, mapWidth, mapHeight, boundsValid, errors) {
    if (rectangles === undefined) {
      return;
    }

    if (!Array.isArray(rectangles)) {
      errors.push(`${label}s must be an array when provided.`);
      return;
    }

    for (let index = 0; index < rectangles.length; index++) {
      const rectangle = rectangles[index];
      const rectangleLabel = `${label} ${index + 1}`;

      if (!this.isPlainObject(rectangle)) {
        errors.push(`${rectangleLabel} must be an object.`);
        continue;
      }

      this.validateKnownKeys(
        rectangleLabel,
        rectangle,
        ["x", "y", "width", "height"],
        errors,
      );
      this.validateMapRectangle(
        rectangleLabel,
        rectangle,
        mapWidth,
        mapHeight,
        boundsValid,
        errors,
      );
    }
  }

  static validateMapRectangle(label, rectangle, mapWidth, mapHeight, boundsValid, errors) {
    const xValid = this.validateFiniteNumber(`${label}.x`, rectangle.x, errors, {
      min: 0,
    });
    const yValid = this.validateFiniteNumber(`${label}.y`, rectangle.y, errors, {
      min: 0,
    });
    const widthValid = this.validateFiniteNumber(
      `${label}.width`,
      rectangle.width,
      errors,
      { min: Number.MIN_VALUE },
    );
    const heightValid = this.validateFiniteNumber(
      `${label}.height`,
      rectangle.height,
      errors,
      { min: Number.MIN_VALUE },
    );

    if (
      boundsValid &&
      xValid &&
      widthValid &&
      rectangle.x + rectangle.width > mapWidth
    ) {
      errors.push(`${label} extends beyond the map width.`);
    }

    if (
      boundsValid &&
      yValid &&
      heightValid &&
      rectangle.y + rectangle.height > mapHeight
    ) {
      errors.push(`${label} extends beyond the map height.`);
    }
  }

  static validateMapEvent(event, label, mapWidth, mapHeight, boundsValid, database, errors) {
    if (!this.isPlainObject(event)) {
      errors.push(`${label} must be an object.`);
      return;
    }

    this.validateKnownKeys(
      label,
      event,
      ["id", "name", "x", "y", "width", "height", "solid", "pages", "commands"],
      errors,
    );

    if (!Number.isInteger(event.id) || event.id <= 0) {
      errors.push(`${label} id must be a positive integer.`);
    }

    if (event.name !== undefined && typeof event.name !== "string") {
      errors.push(`${label} name must be a string when provided.`);
    }

    const runtimeRectangle = {
      x: event.x ?? 0,
      y: event.y ?? 0,
      width: event.width ?? 32,
      height: event.height ?? 32,
    };
    this.validateMapRectangle(
      label,
      runtimeRectangle,
      mapWidth,
      mapHeight,
      boundsValid,
      errors,
    );

    if (event.solid !== undefined && typeof event.solid !== "boolean") {
      errors.push(`${label} solid must be true or false when provided.`);
    }

    if (event.pages !== undefined && event.commands !== undefined) {
      errors.push(`${label} cannot define both pages and legacy commands.`);
    }

    if (event.pages !== undefined) {
      if (!Array.isArray(event.pages)) {
        errors.push(`${label} pages must be an array when provided.`);
      } else {
        for (let pageIndex = 0; pageIndex < event.pages.length; pageIndex++) {
          this.validateEventPage(
            event.pages[pageIndex],
            `${label} page ${pageIndex + 1}`,
            database,
            errors,
          );
        }
      }
    } else if (event.commands !== undefined) {
      this.validateEventCommands(
        event.commands,
        `${label} legacy commands`,
        database,
        errors,
      );
    }
  }

  static validateEventPage(page, label, database, errors) {
    if (!this.isPlainObject(page)) {
      errors.push(`${label} must be an object.`);
      return;
    }

    this.validateKnownKeys(label, page, ["conditions", "commands"], errors);
    this.validateEventConditions(page.conditions ?? {}, `${label} conditions`, errors);
    this.validateEventCommands(page.commands ?? [], `${label} commands`, database, errors);
  }

  static validateEventConditions(conditions, label, errors) {
    if (!this.isPlainObject(conditions)) {
      errors.push(`${label} must be an object.`);
      return;
    }

    this.validateKnownKeys(
      label,
      conditions,
      ["switches", "selfSwitches", "variables"],
      errors,
    );

    for (const key of ["switches", "selfSwitches", "variables"]) {
      if (conditions[key] !== undefined && !Array.isArray(conditions[key])) {
        errors.push(`${label}.${key} must be an array when provided.`);
      }
    }

    if (Array.isArray(conditions.switches)) {
      for (let index = 0; index < conditions.switches.length; index++) {
        const condition = conditions.switches[index];
        const conditionLabel = `${label}.switches[${index}]`;

        if (!this.isPlainObject(condition)) {
          errors.push(`${conditionLabel} must be an object.`);
          continue;
        }

        this.validateKnownKeys(conditionLabel, condition, ["id", "value"], errors);
        this.validateEventIdentifier(`${conditionLabel}.id`, condition.id, errors);
        if (typeof condition.value !== "boolean") {
          errors.push(`${conditionLabel}.value must be true or false.`);
        }
      }
    }

    if (Array.isArray(conditions.selfSwitches)) {
      for (let index = 0; index < conditions.selfSwitches.length; index++) {
        const condition = conditions.selfSwitches[index];
        const conditionLabel = `${label}.selfSwitches[${index}]`;

        if (!this.isPlainObject(condition)) {
          errors.push(`${conditionLabel} must be an object.`);
          continue;
        }

        this.validateKnownKeys(conditionLabel, condition, ["letter", "value"], errors);
        if (typeof condition.letter !== "string" || condition.letter.trim() === "") {
          errors.push(`${conditionLabel}.letter must be a non-empty string.`);
        }
        if (typeof condition.value !== "boolean") {
          errors.push(`${conditionLabel}.value must be true or false.`);
        }
      }
    }

    if (Array.isArray(conditions.variables)) {
      const validOperators = new Set(["==", "!=", ">", ">=", "<", "<="]);

      for (let index = 0; index < conditions.variables.length; index++) {
        const condition = conditions.variables[index];
        const conditionLabel = `${label}.variables[${index}]`;

        if (!this.isPlainObject(condition)) {
          errors.push(`${conditionLabel} must be an object.`);
          continue;
        }

        this.validateKnownKeys(
          conditionLabel,
          condition,
          ["id", "value", "operator"],
          errors,
        );
        this.validateEventIdentifier(`${conditionLabel}.id`, condition.id, errors);
        if (
          condition.operator !== undefined &&
          !validOperators.has(condition.operator)
        ) {
          errors.push(
            `${conditionLabel}.operator has unsupported value "${condition.operator}".`,
          );
        }
      }
    }
  }

  static validateEventIdentifier(label, value, errors) {
    const validString = typeof value === "string" && value.trim() !== "";
    const validInteger = Number.isInteger(value) && value >= 0;

    if (!validString && !validInteger) {
      errors.push(`${label} must be a non-empty string or non-negative integer.`);
      return false;
    }

    return true;
  }

  static validateEventCommands(commands, label, database, errors, depth = 0) {
    if (!Array.isArray(commands)) {
      errors.push(`${label} must be an array.`);
      return;
    }

    if (depth > 32) {
      errors.push(`${label} exceeds the maximum nested command depth.`);
      return;
    }

    for (let index = 0; index < commands.length; index++) {
      this.validateEventCommand(
        commands[index],
        `${label}[${index}]`,
        database,
        errors,
        depth,
      );
    }
  }

  static validateEventCommand(command, label, database, errors, depth) {
    if (!this.isPlainObject(command)) {
      errors.push(`${label} must be an object.`);
      return;
    }

    if (typeof command.code !== "string" || command.code.trim() === "") {
      errors.push(`${label}.code must be a non-empty string.`);
      return;
    }

    const commandKeys = {
      text: ["code", "text", "speaker"],
      choice: ["code", "speaker", "prompt", "choices"],
      ifSwitch: ["code", "id", "value", "trueCommands", "falseCommands"],
      setSwitch: ["code", "id", "value"],
      setSelfSwitch: ["code", "letter", "value"],
      setVariable: ["code", "id", "value"],
      addVariable: ["code", "id", "value"],
      gainItem: ["code", "itemId", "amount"],
      gainItemMessage: ["code", "itemId", "amount", "source"],
      gainArmor: ["code", "armorId", "amount"],
      gainArmorMessage: ["code", "armorId", "amount", "source"],
      gainWeapon: ["code", "weaponId", "amount"],
      gainWeaponMessage: ["code", "weaponId", "amount", "source"],
      gainAccessory: ["code", "accessoryId", "amount"],
      gainAccessoryMessage: ["code", "accessoryId", "amount", "source"],
      gainExp: ["code", "amount"],
      gainExpMessage: ["code", "amount"],
      shop: ["code", "name", "goods"],
      battle: ["code", "encounterId"],
    };

    const allowedKeys = commandKeys[command.code];
    if (!allowedKeys) {
      errors.push(`${label} has unsupported command code "${command.code}".`);
      return;
    }

    this.validateKnownKeys(label, command, allowedKeys, errors);

    const validateOptionalString = (key) => {
      if (command[key] !== undefined && typeof command[key] !== "string") {
        errors.push(`${label}.${key} must be a string when provided.`);
      }
    };

    const validatePositiveAmount = (key = "amount") => {
      if (command[key] === undefined) {
        return;
      }

      this.validateFiniteNumber(`${label}.${key}`, command[key], errors, {
        min: Number.MIN_VALUE,
      });
    };

    switch (command.code) {
      case "text":
        if (typeof command.text !== "string") {
          errors.push(`${label}.text must be a string.`);
        }
        validateOptionalString("speaker");
        break;

      case "choice":
        validateOptionalString("speaker");
        validateOptionalString("prompt");
        if (!Array.isArray(command.choices) || command.choices.length === 0) {
          errors.push(`${label}.choices must be a non-empty array.`);
          break;
        }
        for (let index = 0; index < command.choices.length; index++) {
          const choice = command.choices[index];
          const choiceLabel = `${label}.choices[${index}]`;
          if (!this.isPlainObject(choice)) {
            errors.push(`${choiceLabel} must be an object.`);
            continue;
          }
          this.validateKnownKeys(choiceLabel, choice, ["text", "commands"], errors);
          if (typeof choice.text !== "string") {
            errors.push(`${choiceLabel}.text must be a string.`);
          }
          this.validateEventCommands(
            choice.commands ?? [],
            `${choiceLabel}.commands`,
            database,
            errors,
            depth + 1,
          );
        }
        break;

      case "ifSwitch":
        this.validateEventIdentifier(`${label}.id`, command.id, errors);
        if (typeof command.value !== "boolean") {
          errors.push(`${label}.value must be true or false.`);
        }
        for (const key of ["trueCommands", "falseCommands"]) {
          if (command[key] !== undefined) {
            this.validateEventCommands(
              command[key],
              `${label}.${key}`,
              database,
              errors,
              depth + 1,
            );
          }
        }
        break;

      case "setSwitch":
        this.validateEventIdentifier(`${label}.id`, command.id, errors);
        if (typeof command.value !== "boolean") {
          errors.push(`${label}.value must be true or false.`);
        }
        break;

      case "setSelfSwitch":
        if (typeof command.letter !== "string" || command.letter.trim() === "") {
          errors.push(`${label}.letter must be a non-empty string.`);
        }
        if (typeof command.value !== "boolean") {
          errors.push(`${label}.value must be true or false.`);
        }
        break;

      case "setVariable":
        this.validateEventIdentifier(`${label}.id`, command.id, errors);
        break;

      case "addVariable":
        this.validateEventIdentifier(`${label}.id`, command.id, errors);
        this.validateFiniteNumber(`${label}.value`, command.value, errors);
        break;

      case "gainItem":
      case "gainItemMessage":
        this.validateDatabaseReference(
          `${label}.itemId`,
          command.itemId,
          database?.items,
          "item",
          errors,
        );
        validatePositiveAmount();
        validateOptionalString("source");
        break;

      case "gainArmor":
      case "gainArmorMessage":
        this.validateDatabaseReference(
          `${label}.armorId`,
          command.armorId,
          database?.armors,
          "armor",
          errors,
        );
        validatePositiveAmount();
        validateOptionalString("source");
        break;

      case "gainWeapon":
      case "gainWeaponMessage":
        this.validateDatabaseReference(
          `${label}.weaponId`,
          command.weaponId,
          database?.weapons,
          "weapon",
          errors,
        );
        validatePositiveAmount();
        validateOptionalString("source");
        break;

      case "gainAccessory":
      case "gainAccessoryMessage":
        this.validateDatabaseReference(
          `${label}.accessoryId`,
          command.accessoryId,
          database?.accessories,
          "accessory",
          errors,
        );
        validatePositiveAmount();
        validateOptionalString("source");
        break;

      case "gainExp":
      case "gainExpMessage":
        this.validateFiniteNumber(`${label}.amount`, command.amount, errors, {
          min: Number.MIN_VALUE,
        });
        break;

      case "shop": {
        validateOptionalString("name");

        if (!Array.isArray(command.goods) || command.goods.length === 0) {
          errors.push(`${label}.goods must be a non-empty array.`);
          break;
        }

        const seenGoods = new Set();
        const collections = {
          item: database?.items,
          weapon: database?.weapons,
          armor: database?.armors,
          accessory: database?.accessories,
        };

        for (let index = 0; index < command.goods.length; index++) {
          const good = command.goods[index];
          const goodLabel = `${label}.goods[${index}]`;

          if (!this.isPlainObject(good)) {
            errors.push(`${goodLabel} must be an object.`);
            continue;
          }

          this.validateKnownKeys(goodLabel, good, ["type", "id"], errors);

          if (!Object.hasOwn(collections, good.type)) {
            errors.push(
              `${goodLabel}.type must be item, weapon, armor, or accessory.`,
            );
            continue;
          }

          if (
            !this.validateDatabaseReference(
              `${goodLabel}.id`,
              good.id,
              collections[good.type],
              good.type,
              errors,
            )
          ) {
            continue;
          }

          const key = `${good.type}:${good.id}`;

          if (seenGoods.has(key)) {
            errors.push(`${goodLabel} duplicates shop good ${key}.`);
          }

          seenGoods.add(key);
        }
        break;
      }

      case "battle":
        this.validateDatabaseReference(
          `${label}.encounterId`,
          command.encounterId,
          database?.encounters,
          "encounter",
          errors,
        );
        break;
    }
  }

  static validateDatabaseReference(label, id, records, recordName, errors) {
    if (!Number.isInteger(id) || id <= 0) {
      errors.push(`${label} must be a positive integer.`);
      return false;
    }

    if (Array.isArray(records) && !records[id]) {
      errors.push(`${label} references unknown ${recordName} ID ${id}.`);
      return false;
    }

    return true;
  }

  static validateBattleSprite(record, label, spriteKey, errors) {
    if (
      record[spriteKey] !== undefined &&
      record[spriteKey] !== null &&
      (typeof record[spriteKey] !== "string" || record[spriteKey].trim() === "")
    ) {
      errors.push(`${label} ${spriteKey} must be a non-empty string when provided.`);
    }

    for (const key of ["battleSpriteWidth", "battleSpriteHeight"]) {
      if (record[key] !== undefined) {
        this.validateFiniteNumber(`${label} ${key}`, record[key], errors, {
          min: 1,
        });
      }
    }

    for (const key of ["battleSpriteFrames", "battleSpriteRows"]) {
      if (record[key] !== undefined) {
        this.validateFiniteNumber(`${label} ${key}`, record[key], errors, {
          min: 1,
          integer: true,
        });
      }
    }
  }

  static validateBattlerStats(record, label, errors) {
    this.validateFiniteNumber(`${label} level`, record.level, errors, {
      min: 1,
      integer: true,
    });
    this.validateFiniteNumber(`${label} maxHp`, record.maxHp, errors, { min: 1 });
    this.validateFiniteNumber(`${label} maxMp`, record.maxMp, errors, { min: 0 });

    for (const key of [
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
    ]) {
      this.validateFiniteNumber(`${label} ${key}`, record[key], errors, { min: 0 });
    }
  }

  static validateActors(actors, errors, magick = null, skills = null) {
    if (!Array.isArray(actors)) {
      return;
    }

    const growthKeys = [
      "maxHp",
      "maxMp",
      "strength",
      "vitality",
      "dexterity",
      "agility",
      "magic",
      "spirit",
      "luck",
      "attack",
      "defense",
      "magicAttack",
      "magicDefense",
    ];

    for (let index = 1; index < actors.length; index++) {
      const actor = actors[index];

      if (!actor) {
        continue;
      }

      const label = `Actor ${index}`;
      this.validateBattlerStats(actor, label, errors);
      this.validateBattleSprite(actor, label, "sideBattleSprite", errors);
      this.validateFiniteNumber(`${label} exp`, actor.exp, errors, { min: 0 });
      this.validateFiniteNumber(`${label} maxValor`, actor.maxValor, errors, {
        min: 1,
        integer: true,
      });
      this.validateFiniteNumber(
        `${label} essenceSlots`,
        actor.essenceSlots,
        errors,
        { min: 1, integer: true },
      );

      if (!Array.isArray(actor.initialMagickIds)) {
        errors.push(`${label} initialMagickIds must be an array.`);
      } else {
        const seenMagickIds = new Set();

        for (const magickId of actor.initialMagickIds) {
          if (!Number.isInteger(magickId) || magickId <= 0) {
            errors.push(`${label} initialMagickIds entries must be positive integers.`);
            continue;
          }

          if (seenMagickIds.has(magickId)) {
            errors.push(`${label} initialMagickIds must not contain duplicate magick ID ${magickId}.`);
          }

          seenMagickIds.add(magickId);

          if (Array.isArray(magick) && !magick[magickId]) {
            errors.push(`${label} initialMagickIds references unknown magick ID ${magickId}.`);
          }
        }
      }

      if (!Array.isArray(actor.initialSkillIds)) {
        errors.push(`${label} initialSkillIds must be an array.`);
      } else {
        const seenSkillIds = new Set();

        for (const skillId of actor.initialSkillIds) {
          if (!Number.isInteger(skillId) || skillId <= 0) {
            errors.push(`${label} initialSkillIds entries must be positive integers.`);
            continue;
          }

          if (seenSkillIds.has(skillId)) {
            errors.push(`${label} initialSkillIds must not contain duplicate skill ID ${skillId}.`);
          }

          seenSkillIds.add(skillId);

          if (Array.isArray(skills) && !skills[skillId]) {
            errors.push(`${label} initialSkillIds references unknown skill ID ${skillId}.`);
          }
        }
      }

      if (!this.isPlainObject(actor.growth)) {
        errors.push(`${label} growth must be an object.`);
        continue;
      }

      this.validateKnownKeys(`${label} growth`, actor.growth, growthKeys, errors);

      for (const key of growthKeys) {
        this.validateFiniteNumber(`${label} growth.${key}`, actor.growth[key], errors, {
          min: 0,
        });
      }
    }
  }

  static validateEnemyActions(
    actions,
    label,
    errors,
    magickDatabase = null,
    skillsDatabase = null,
  ) {
    const validActionTypes = new Set(["attack", "magick", "skill"]);
    const validTargetStrategies = new Set([
      "first",
      "random",
      "lowestHp",
      "lowestHpRate",
    ]);
    const validTargetGroups = new Set(["ally", "enemy", "self"]);
    const validConditions = new Set([
      "always",
      "selfHpBelow",
      "selfHpAbove",
      "allyHpBelow",
      "allyDefeated",
    ]);

    actions.forEach((action, actionIndex) => {
      const actionLabel = `${label}[${actionIndex}]`;

      if (!this.isPlainObject(action)) {
        errors.push(`${actionLabel} must be an object.`);
        return;
      }

      this.validateKnownKeys(
        actionLabel,
        action,
        [
          "type",
          "magickId",
          "skillId",
          "weight",
          "targetGroup",
          "targetStrategy",
          "scope",
          "condition",
        ],
        errors,
      );

      if (!validActionTypes.has(action.type)) {
        errors.push(`${actionLabel} has unsupported type "${action.type}".`);
      }

      this.validateFiniteNumber(`${actionLabel}.weight`, action.weight, errors, {
        min: Number.MIN_VALUE,
      });

      if (
        action.targetStrategy !== undefined &&
        !validTargetStrategies.has(action.targetStrategy)
      ) {
        errors.push(
          `${actionLabel}.targetStrategy has unsupported value "${action.targetStrategy}".`,
        );
      }

      if (["magick", "skill"].includes(action.type)) {
        const isMagick = action.type === "magick";
        const idKey = isMagick ? "magickId" : "skillId";
        const database = isMagick ? magickDatabase : skillsDatabase;
        const id = action[idKey];
        const idValid = Number.isInteger(id) && id > 0;
        const ability = idValid && Array.isArray(database) ? database[id] : null;
        const labelName = isMagick ? "Magick" : "Skill";

        if (!idValid) {
          errors.push(`${actionLabel}.${idKey} must be a positive integer.`);
        } else if (Array.isArray(database) && !ability) {
          errors.push(`${actionLabel}.${idKey} must reference valid ${labelName}.`);
        }

        if (!isMagick && ability?.valorArt === true) {
          errors.push(
            `${actionLabel}.skillId cannot reference a Valor Art for an enemy action.`,
          );
        }

        if (action.targetGroup !== undefined) {
          if (!validTargetGroups.has(action.targetGroup)) {
            errors.push(
              `${actionLabel}.targetGroup has unsupported value "${action.targetGroup}".`,
            );
          } else if (
            ability &&
            (!Array.isArray(ability.target) ||
              !ability.target.includes(action.targetGroup))
          ) {
            errors.push(
              `${actionLabel}.targetGroup must be allowed by ${ability.name}.`,
            );
          }
        }

        if (
          action.scope !== undefined &&
          ability &&
          (!Array.isArray(ability.scope) || !ability.scope.includes(action.scope))
        ) {
          errors.push(`${actionLabel}.scope must be allowed by ${ability.name}.`);
        }

        const unrelatedIdKey = isMagick ? "skillId" : "magickId";
        if (action[unrelatedIdKey] !== undefined) {
          const unrelatedLabel = isMagick ? "Skill" : "Magick";
          errors.push(
            `${actionLabel}.${unrelatedIdKey} is only valid for ${unrelatedLabel} actions.`,
          );
        }
      } else {
        if (action.magickId !== undefined) {
          errors.push(`${actionLabel}.magickId is only valid for Magick actions.`);
        }

        if (action.skillId !== undefined) {
          errors.push(`${actionLabel}.skillId is only valid for Skill actions.`);
        }

        if (action.targetGroup !== undefined) {
          errors.push(
            `${actionLabel}.targetGroup is only valid for Magick or Skill actions.`,
          );
        }

        if (action.scope !== undefined) {
          errors.push(
            `${actionLabel}.scope is only valid for Magick or Skill actions.`,
          );
        }
      }

      if (action.condition !== undefined && action.condition !== null) {
        if (!this.isPlainObject(action.condition)) {
          errors.push(`${actionLabel}.condition must be an object.`);
        } else {
          this.validateKnownKeys(
            `${actionLabel}.condition`,
            action.condition,
            ["type", "value"],
            errors,
          );

          if (!validConditions.has(action.condition.type)) {
            errors.push(
              `${actionLabel}.condition has unsupported type "${action.condition.type}".`,
            );
          }

          if (
            ["selfHpBelow", "selfHpAbove", "allyHpBelow"].includes(
              action.condition.type,
            )
          ) {
            this.validateFiniteNumber(
              `${actionLabel}.condition.value`,
              action.condition.value,
              errors,
              { min: 0, max: 1 },
            );
          } else if (action.condition.value !== undefined) {
            errors.push(
              `${actionLabel}.condition.value is not used by ${action.condition.type}.`,
            );
          }
        }
      }
    });
  }

  static validateEnemies(
    enemies,
    items,
    errors = null,
    magickDatabase = null,
    skillsDatabase = null,
  ) {
    // Keep the direct helper backward-compatible with older tests/tools that
    // passed only (enemies, errors). Full database validation supplies Items
    // so drop-table references can be checked as well.
    if (!Array.isArray(errors)) {
      errors = items;
      items = null;
    }

    if (!Array.isArray(enemies)) {
      return;
    }

    for (let index = 1; index < enemies.length; index++) {
      const enemy = enemies[index];

      if (!enemy) {
        continue;
      }

      const label = `Enemy ${index}`;
      this.validateBattlerStats(enemy, label, errors);
      this.validateBattleSprite(enemy, label, "battleSprite", errors);

      if (!Number.isInteger(enemy.expReward) || enemy.expReward < 0) {
        errors.push(`${label} expReward must be a non-negative integer.`);
      }

      if (!Number.isInteger(enemy.gilReward) || enemy.gilReward < 0) {
        errors.push(`${label} gilReward must be a non-negative integer.`);
      }

      if (
        !Number.isInteger(enemy.resonanceReward) ||
        enemy.resonanceReward < 0
      ) {
        errors.push(`${label} resonanceReward must be a non-negative integer.`);
      }

      if (!Array.isArray(enemy.dropTable)) {
        errors.push(`${label} dropTable must be an array.`);
      } else {
        enemy.dropTable.forEach((drop, dropIndex) => {
          const dropLabel = `${label} dropTable[${dropIndex}]`;

          if (!this.isPlainObject(drop)) {
            errors.push(`${dropLabel} must be an object.`);
            return;
          }

          this.validateKnownKeys(
            dropLabel,
            drop,
            new Set(["itemId", "quantity", "chance"]),
            errors,
          );

          if (
            !Number.isInteger(drop.itemId) ||
            drop.itemId <= 0 ||
            (Array.isArray(items) && !items[drop.itemId])
          ) {
            errors.push(`${dropLabel} itemId must reference a valid item.`);
          }

          if (!Number.isInteger(drop.quantity) || drop.quantity <= 0) {
            errors.push(`${dropLabel} quantity must be a positive integer.`);
          }

          this.validateFiniteNumber(`${dropLabel} chance`, drop.chance, errors, {
            min: 0,
            max: 1,
          });
        });
      }

      if (enemy.actions !== undefined && enemy.phases !== undefined) {
        errors.push(`${label} must define either actions or phases, not both.`);
      }

      if (enemy.actions !== undefined) {
        if (!Array.isArray(enemy.actions)) {
          errors.push(`${label} actions must be an array when provided.`);
        } else {
          this.validateEnemyActions(
            enemy.actions,
            `${label} actions`,
            errors,
            magickDatabase,
            skillsDatabase,
          );
        }
      }

      if (enemy.phases !== undefined) {
        if (!Array.isArray(enemy.phases) || enemy.phases.length === 0) {
          errors.push(`${label} phases must be a non-empty array when provided.`);
        } else {
          const seenPhaseIds = new Set();
          let previousThreshold = null;

          enemy.phases.forEach((phase, phaseIndex) => {
            const phaseLabel = `${label} phases[${phaseIndex}]`;

            if (!this.isPlainObject(phase)) {
              errors.push(`${phaseLabel} must be an object.`);
              return;
            }

            this.validateKnownKeys(
              phaseLabel,
              phase,
              ["id", "name", "hpRateAtOrBelow", "enterMessage", "actions"],
              errors,
            );

            if (typeof phase.id !== "string" || phase.id.trim() === "") {
              errors.push(`${phaseLabel}.id must be a non-empty string.`);
            } else if (seenPhaseIds.has(phase.id)) {
              errors.push(`${phaseLabel}.id must be unique within the enemy.`);
            } else {
              seenPhaseIds.add(phase.id);
            }

            if (typeof phase.name !== "string" || phase.name.trim() === "") {
              errors.push(`${phaseLabel}.name must be a non-empty string.`);
            }

            const thresholdValid = this.validateFiniteNumber(
              `${phaseLabel}.hpRateAtOrBelow`,
              phase.hpRateAtOrBelow,
              errors,
              { min: Number.MIN_VALUE, max: 1 },
            );

            if (thresholdValid) {
              if (phaseIndex === 0 && phase.hpRateAtOrBelow !== 1) {
                errors.push(`${phaseLabel}.hpRateAtOrBelow must be 1 for the opening phase.`);
              }

              if (
                previousThreshold !== null &&
                phase.hpRateAtOrBelow >= previousThreshold
              ) {
                errors.push(
                  `${phaseLabel}.hpRateAtOrBelow must be lower than the previous phase threshold.`,
                );
              }

              previousThreshold = phase.hpRateAtOrBelow;
            }

            if (
              phase.enterMessage !== undefined &&
              (typeof phase.enterMessage !== "string" ||
                phase.enterMessage.trim() === "")
            ) {
              errors.push(`${phaseLabel}.enterMessage must be a non-empty string when provided.`);
            }

            if (!Array.isArray(phase.actions) || phase.actions.length === 0) {
              errors.push(`${phaseLabel}.actions must be a non-empty array.`);
            } else {
              this.validateEnemyActions(
                phase.actions,
                `${phaseLabel}.actions`,
                errors,
                magickDatabase,
                skillsDatabase,
              );
            }
          });
        }
      }

      if (
        enemy.elementRates !== undefined &&
        !this.isPlainObject(enemy.elementRates)
      ) {
        errors.push(`${label} elementRates must be an object when provided.`);
      } else if (this.isPlainObject(enemy.elementRates)) {
        for (const [element, rate] of Object.entries(enemy.elementRates)) {
          if (typeof element !== "string" || element.trim() === "") {
            errors.push(`${label} elementRates keys must be non-empty strings.`);
          }

          this.validateFiniteNumber(
            `${label} elementRates.${element}`,
            rate,
            errors,
            { min: 0 },
          );
        }
      }
    }
  }

  static validateItems(items, errors) {
    if (!Array.isArray(items)) {
      return;
    }

    const validEffectTypes = new Set(["healHp"]);

    for (let index = 1; index < items.length; index++) {
      const item = items[index];

      if (!item) {
        continue;
      }

      const label = `Item ${index}`;

      if (item.type !== "item") {
        errors.push(`${label} type must be "item".`);
      }

      if (typeof item.consumable !== "boolean") {
        errors.push(`${label} consumable must be true or false.`);
      }

      this.validateFiniteNumber(`${label} price`, item.price, errors, {
        min: 0,
        integer: true,
      });

      if (!this.isPlainObject(item.effect)) {
        errors.push(`${label} effect must be an object.`);
        continue;
      }

      this.validateKnownKeys(`${label} effect`, item.effect, ["type", "value"], errors);

      if (!validEffectTypes.has(item.effect.type)) {
        errors.push(`${label} has unsupported effect type "${item.effect.type}".`);
      }

      if (item.effect.type === "healHp") {
        this.validateFiniteNumber(`${label} effect.value`, item.effect.value, errors, {
          min: Number.MIN_VALUE,
        });
      }
    }
  }

  static validateWeapons(weapons, errors) {
    if (!Array.isArray(weapons)) {
      return;
    }

    for (let index = 1; index < weapons.length; index++) {
      const weapon = weapons[index];

      if (!weapon) {
        continue;
      }

      const label = `Weapon ${index}`;

      for (const key of [
        "price",
        "attack",
        "attackPercent",
        "magicAttack",
        "criticalBonus",
      ]) {
        this.validateFiniteNumber(`${label} ${key}`, weapon[key], errors, {
          min: 0,
          integer: key === "price",
        });
      }
    }
  }

  static validateArmors(armors, errors) {
    if (!Array.isArray(armors)) {
      return;
    }

    for (let index = 1; index < armors.length; index++) {
      const armor = armors[index];

      if (!armor) {
        continue;
      }

      const label = `Armor ${index}`;
      this.validateFiniteNumber(`${label} price`, armor.price, errors, {
        min: 0,
        integer: true,
      });
      this.validateFiniteNumber(`${label} defense`, armor.defense, errors, { min: 0 });
    }
  }

  static validateAccessories(accessories, errors) {
    if (!Array.isArray(accessories)) {
      return;
    }

    const bonusKeys = [
      "attack",
      "defense",
      "magicAttack",
      "magicDefense",
      "criticalBonus",
    ];

    for (let index = 1; index < accessories.length; index++) {
      const accessory = accessories[index];

      if (!accessory) {
        continue;
      }

      const label = `Accessory ${index}`;
      this.validateKnownKeys(
        label,
        accessory,
        ["_comment", "id", "name", "description", "price", "bonuses"],
        errors,
      );
      this.validateFiniteNumber(`${label} price`, accessory.price, errors, {
        min: 0,
        integer: true,
      });

      if (!this.isPlainObject(accessory.bonuses)) {
        errors.push(`${label} bonuses must be an object.`);
        continue;
      }

      this.validateKnownKeys(
        `${label} bonuses`,
        accessory.bonuses,
        bonusKeys,
        errors,
      );

      for (const key of bonusKeys) {
        if (accessory.bonuses[key] === undefined) {
          continue;
        }

        this.validateFiniteNumber(
          `${label} bonuses.${key}`,
          accessory.bonuses[key],
          errors,
          { min: 0 },
        );
      }
    }
  }

  static validateSkills(skills, statuses, errors = null) {
    // Backward-compatible helper shape used by focused tests that pass only
    // (skills, errors). Full validation supplies Statuses.json as well.
    if (!Array.isArray(errors)) {
      errors = statuses;
      statuses = [];
    }

    if (!Array.isArray(skills)) {
      return;
    }

    const validTargets = new Set(["self", "ally", "enemy"]);
    const validScopes = new Set(["single", "all"]);
    const validCategories = new Set(["physical", "support", "control"]);
    const validEffects = new Set(["damage", "heal", "inflictStatus"]);
    const statusKeys = new Set(
      Array.isArray(statuses)
        ? statuses.filter(Boolean).map((status) => status.key)
        : [],
    );

    for (let index = 1; index < skills.length; index++) {
      const skill = skills[index];

      if (!skill) {
        continue;
      }

      const label = `Skill ${index}`;

      this.validateKnownKeys(
        label,
        skill,
        [
          "_comment",
          "id",
          "name",
          "description",
          "type",
          "category",
          "effect",
          "powerMultiplier",
          "healPercent",
          "status",
          "valorArt",
          "target",
          "scope",
        ],
        errors,
      );

      if (skill.type !== "skill") {
        errors.push(`${label} type must be "skill".`);
      }

      if (!validCategories.has(skill.category)) {
        errors.push(`${label} has unsupported category "${skill.category}".`);
      }

      if (!validEffects.has(skill.effect)) {
        errors.push(`${label} has unsupported effect "${skill.effect}".`);
      }

      if (skill.effect === "damage") {
        this.validateFiniteNumber(
          `${label} powerMultiplier`,
          skill.powerMultiplier,
          errors,
          { min: Number.MIN_VALUE },
        );
      } else if (skill.powerMultiplier !== undefined) {
        errors.push(`${label} powerMultiplier is only supported by damage Skills.`);
      }

      if (skill.effect === "heal") {
        this.validateFiniteNumber(
          `${label} healPercent`,
          skill.healPercent,
          errors,
          { min: Number.MIN_VALUE, max: 1 },
        );
      } else if (skill.healPercent !== undefined) {
        errors.push(`${label} healPercent is only supported by heal Skills.`);
      }

      if (skill.status !== undefined) {
        if (!["damage", "inflictStatus"].includes(skill.effect)) {
          errors.push(
            `${label} status metadata is only supported by damage or inflictStatus Skills.`,
          );
        }

        if (!this.isPlainObject(skill.status) || Object.keys(skill.status).length === 0) {
          errors.push(`${label} status must be a non-empty object when provided.`);
        } else {
          for (const [statusKey, chance] of Object.entries(skill.status)) {
            if (statusKeys.size > 0 && !statusKeys.has(statusKey)) {
              errors.push(`${label} status references unknown status key "${statusKey}".`);
            }

            this.validateFiniteNumber(
              `${label} status.${statusKey}`,
              chance,
              errors,
              { min: 0, max: 1 },
            );
          }
        }
      } else if (skill.effect === "inflictStatus") {
        errors.push(`${label} inflictStatus effect requires status metadata.`);
      }

      if (skill.valorArt !== undefined && typeof skill.valorArt !== "boolean") {
        errors.push(`${label} valorArt must be a boolean when provided.`);
      }

      if (!Array.isArray(skill.target) || skill.target.length === 0) {
        errors.push(`${label} target must be a non-empty array.`);
      } else {
        for (const target of skill.target) {
          if (!validTargets.has(target)) {
            errors.push(`${label} target has unsupported value "${target}".`);
          }
        }
      }

      if (!Array.isArray(skill.scope) || skill.scope.length === 0) {
        errors.push(`${label} scope must be a non-empty array.`);
      } else {
        for (const scope of skill.scope) {
          if (!validScopes.has(scope)) {
            errors.push(`${label} scope has unsupported value "${scope}".`);
          }
        }
      }

      if (
        skill.description !== undefined &&
        typeof skill.description !== "string"
      ) {
        errors.push(`${label} description must be a string when provided.`);
      }
    }
  }

  static validateMagick(magickDatabase, statuses, errors) {
    if (!Array.isArray(magickDatabase)) {
      return;
    }

    // Backward-compatible call shape used by focused tests that pass
    // only (magickDatabase, errors).
    if (errors === undefined && Array.isArray(statuses)) {
      errors = statuses;
      statuses = [];
    }

    const validTargets = new Set(["self", "ally", "enemy"]);
    const validScopes = new Set(["single", "all"]);
    const validTypes = new Set(["magick"]);
    const validCategories = new Set(["attack", "restore", "indirect", "advanced"]);
    const validElements = new Set([
      "none",
      "restorative",
      "fire",
      "ice",
      "lightning",
      "earth",
      "poison",
      "gravity",
      "wind",
    ]);
    const validEffects = new Set([
      "damage",
      "heal",
      "inflictStatus",
      "removeStatus",
      "revive",
      "escape",
      "banish",
    ]);
    const statusKeys = new Set(
      Array.isArray(statuses)
        ? statuses.filter(Boolean).map((status) => status.key)
        : [],
    );
    const legacyStatusPlaceholders = new Set(["resist", "deathforce"]);

    for (let index = 1; index < magickDatabase.length; index++) {
      const magick = magickDatabase[index];

      if (!magick) {
        continue;
      }

      if (!Array.isArray(magick.target) || magick.target.length === 0) {
        errors.push(`Magick ${index} must define at least one target type.`);
      } else {
        for (const target of magick.target) {
          if (!validTargets.has(target)) {
            errors.push(`Magick ${index} has unsupported target "${target}".`);
          }
        }
      }

      const scopes = Array.isArray(magick.scope) ? magick.scope : [magick.scope];

      if (scopes.length === 0 || scopes.includes(undefined)) {
        errors.push(`Magick ${index} must define at least one scope.`);
      } else {
        for (const scope of scopes) {
          if (!validScopes.has(scope)) {
            errors.push(`Magick ${index} has unsupported scope "${scope}".`);
          }
        }
      }

      if (typeof magick.type !== "string" || magick.type.trim().length === 0) {
        errors.push(`Magick ${index} must define a non-empty string type.`);
      } else if (!validTypes.has(magick.type)) {
        errors.push(`Magick ${index} has unsupported type "${magick.type}".`);
      }

      if (!validCategories.has(magick.category)) {
        errors.push(`Magick ${index} has unsupported category "${magick.category}".`);
      }

      if (!validElements.has(magick.element)) {
        errors.push(`Magick ${index} has unsupported element "${magick.element}".`);
      }

      if (!validEffects.has(magick.effect)) {
        errors.push(`Magick ${index} has unsupported effect "${magick.effect}".`);
      }

      if (magick.power !== undefined) {
        this.validateFiniteNumber(`Magick ${index} power`, magick.power, errors, { min: 0 });
      }

      if (magick.scopePower !== undefined) {
        if (!this.isPlainObject(magick.scopePower)) {
          errors.push(`Magick ${index} scopePower must be an object when provided.`);
        } else {
          this.validateKnownKeys(
            `Magick ${index} scopePower`,
            magick.scopePower,
            [...validScopes],
            errors,
          );

          for (const [scope, multiplier] of Object.entries(magick.scopePower)) {
            this.validateFiniteNumber(
              `Magick ${index} scopePower.${scope}`,
              multiplier,
              errors,
              { min: 0 },
            );
          }
        }
      }

      if (magick.gravityPercent !== undefined) {
        this.validateFiniteNumber(
          `Magick ${index} gravityPercent`,
          magick.gravityPercent,
          errors,
          { min: Number.MIN_VALUE, max: 1 },
        );
      }

      if (magick.healPercent !== undefined) {
        this.validateFiniteNumber(
          `Magick ${index} healPercent`,
          magick.healPercent,
          errors,
          { min: Number.MIN_VALUE, max: 1 },
        );
      }

      if (magick.hits !== undefined) {
        this.validateFiniteNumber(`Magick ${index} hits`, magick.hits, errors, {
          min: 1,
          integer: true,
        });
      }

      if (
        magick.randomTargetPerHit !== undefined &&
        typeof magick.randomTargetPerHit !== "boolean"
      ) {
        errors.push(`Magick ${index} randomTargetPerHit must be true or false when provided.`);
      }

      if (
        magick.randomTargetPerHit === true &&
        (!Number.isInteger(magick.hits) || magick.hits < 2)
      ) {
        errors.push(`Magick ${index} randomTargetPerHit requires hits >= 2.`);
      }

      if (
        magick.effect === "revive" &&
        (!Number.isFinite(magick.revivePercent) ||
          magick.revivePercent <= 0 ||
          magick.revivePercent > 1)
      ) {
        errors.push(`Magick ${index} revivePercent must be greater than 0 and at most 1.`);
      }

      if (!Number.isFinite(magick.mpCost) || magick.mpCost < 0) {
        errors.push(`Magick ${index} must have a non-negative numeric mpCost.`);
      }

      if (typeof magick.reflectable !== "boolean") {
        errors.push(`Magick ${index} reflectable must be true or false.`);
      }

      if (
        magick.status !== undefined &&
        !this.isPlainObject(magick.status)
      ) {
        errors.push(`Magick ${index} status must be an object when provided.`);
      } else if (this.isPlainObject(magick.status)) {
        for (const [statusKey, chance] of Object.entries(magick.status)) {
          if (!statusKey) {
            errors.push(`Magick ${index} status keys must be non-empty strings.`);
          } else if (
            statusKeys.size > 0 &&
            !statusKeys.has(statusKey) &&
            !legacyStatusPlaceholders.has(statusKey)
          ) {
            errors.push(`Magick ${index} references unknown status key "${statusKey}".`);
          }

          if (!Number.isFinite(chance) || chance < 0 || chance > 1) {
            errors.push(
              `Magick ${index} status chance for "${statusKey}" must be between 0 and 1.`,
            );
          }
        }
      }

      if (
        magick.allyStatusChance !== undefined &&
        (!Number.isFinite(magick.allyStatusChance) ||
          magick.allyStatusChance < 0 ||
          magick.allyStatusChance > 1)
      ) {
        errors.push(`Magick ${index} allyStatusChance must be between 0 and 1 when provided.`);
      }

      if (
        magick.toggleStatus !== undefined &&
        typeof magick.toggleStatus !== "boolean"
      ) {
        errors.push(`Magick ${index} toggleStatus must be true or false when provided.`);
      }
    }
  }

  static validateEssences(essences, magickDatabase, statuses, errors) {
    if (!Array.isArray(essences)) {
      return;
    }

    const statusKeys = new Set(
      Array.isArray(statuses)
        ? statuses.filter(Boolean).map((status) => status.key)
        : [],
    );
    const statusFamilies = new Set(
      Array.isArray(statuses)
        ? statuses
            .filter(Boolean)
            .map((status) => status.classification?.family)
            .filter(Boolean)
        : [],
    );
    const validPassiveTypes = new Set([
      "banishChainChance",
      "elementDamageBoost",
      "elementSelfStatusChance",
      "elementStatusChance",
      "essenceAbilityMpCostReduction",
      "essenceAbilityMpRefundChance",
      "essenceAbilityPartialMpRefundChance",
      "essenceAbilityStatusChanceBoost",
      "essenceCleanseHeal",
      "incomingStatusNegateChance",
      "lowHpPhysicalDamageBoost",
      "lowHpSelfStatuses",
      "physicalEvasionBonus",
      "reviveGrantStatus",
      "statusDamageBoost",
      "statusFamilyResistance",
      "successfulEscapePartyRecovery",
    ]);

    for (let index = 1; index < essences.length; index++) {
      const essence = essences[index];

      if (!essence) {
        continue;
      }

      const label = `Essence ${index}`;

      if (typeof essence.type !== "string" || essence.type.trim() === "") {
        errors.push(`${label} type must be a non-empty string.`);
      }

      if (typeof essence.element !== "string" || essence.element.trim() === "") {
        errors.push(`${label} element must be a non-empty string.`);
      }

      this.validateFiniteNumber(`${label} maxLevel`, essence.maxLevel, errors, {
        min: 1,
        integer: true,
      });

      if (!Array.isArray(essence.levels) || essence.levels.length === 0) {
        errors.push(`${label} levels must be a non-empty array.`);
      } else {
        let previousLevel = 0;
        let previousResonance = -1;

        for (let levelIndex = 0; levelIndex < essence.levels.length; levelIndex++) {
          const levelData = essence.levels[levelIndex];
          const levelLabel = `${label} level entry ${levelIndex + 1}`;

          if (!this.isPlainObject(levelData)) {
            errors.push(`${levelLabel} must be an object.`);
            continue;
          }

          this.validateKnownKeys(levelLabel, levelData, ["level", "resonanceRequired"], errors);
          const levelValid = this.validateFiniteNumber(
            `${levelLabel}.level`,
            levelData.level,
            errors,
            { min: 1, integer: true },
          );
          const resonanceValid = this.validateFiniteNumber(
            `${levelLabel}.resonanceRequired`,
            levelData.resonanceRequired,
            errors,
            { min: 0 },
          );

          if (levelValid && levelData.level <= previousLevel) {
            errors.push(`${label} levels must be strictly increasing by level.`);
          }

          if (resonanceValid && levelData.resonanceRequired <= previousResonance) {
            errors.push(`${label} resonance requirements must be strictly increasing.`);
          }

          if (
            levelValid &&
            Number.isInteger(essence.maxLevel) &&
            levelData.level > essence.maxLevel
          ) {
            errors.push(`${levelLabel}.level cannot exceed maxLevel ${essence.maxLevel}.`);
          }

          if (levelValid) {
            previousLevel = levelData.level;
          }

          if (resonanceValid) {
            previousResonance = levelData.resonanceRequired;
          }
        }

        const first = essence.levels[0];
        if (first?.level !== 1 || first?.resonanceRequired !== 0) {
          errors.push(`${label} levels must begin at level 1 with 0 Resonance.`);
        }
      }

      if (!Array.isArray(essence.abilities) || essence.abilities.length === 0) {
        errors.push(`${label} abilities must be a non-empty array.`);
      } else {
        const magickIds = new Set();

        for (let abilityIndex = 0; abilityIndex < essence.abilities.length; abilityIndex++) {
          const ability = essence.abilities[abilityIndex];
          const abilityLabel = `${label} ability ${abilityIndex + 1}`;

          if (!this.isPlainObject(ability)) {
            errors.push(`${abilityLabel} must be an object.`);
            continue;
          }

          this.validateKnownKeys(abilityLabel, ability, ["magickId", "unlockLevel"], errors);

          if (
            !Number.isInteger(ability.magickId) ||
            !Array.isArray(magickDatabase) ||
            !magickDatabase[ability.magickId]
          ) {
            errors.push(`${abilityLabel} references unknown magick ID ${ability.magickId}.`);
          } else if (magickIds.has(ability.magickId)) {
            errors.push(`${label} lists magick ID ${ability.magickId} more than once.`);
          } else {
            magickIds.add(ability.magickId);
          }

          if (
            !Number.isInteger(ability.unlockLevel) ||
            ability.unlockLevel < 1 ||
            (Number.isInteger(essence.maxLevel) && ability.unlockLevel > essence.maxLevel)
          ) {
            errors.push(`${abilityLabel} unlockLevel must be within the Essence level range.`);
          }
        }
      }

      if (!this.isPlainObject(essence.passive)) {
        errors.push(`${label} passive must be an object.`);
      } else {
        this.validateEssencePassive(
          essence.passive,
          label,
          essence.maxLevel,
          statusKeys,
          statusFamilies,
          validPassiveTypes,
          errors,
        );
      }

      if (!this.isPlainObject(essence.mastery)) {
        errors.push(`${label} mastery must be an object.`);
      } else {
        this.validateKnownKeys(
          `${label} mastery`,
          essence.mastery,
          ["resonanceRequired", "questRequired", "questId", "evolutionEligible"],
          errors,
        );
        this.validateFiniteNumber(
          `${label} mastery.resonanceRequired`,
          essence.mastery.resonanceRequired,
          errors,
          { min: 0 },
        );

        if (typeof essence.mastery.questRequired !== "boolean") {
          errors.push(`${label} mastery.questRequired must be true or false.`);
        }

        if (
          essence.mastery.questId !== null &&
          essence.mastery.questId !== undefined &&
          !Number.isInteger(essence.mastery.questId)
        ) {
          errors.push(`${label} mastery.questId must be an integer or null.`);
        }

        if (typeof essence.mastery.evolutionEligible !== "boolean") {
          errors.push(`${label} mastery.evolutionEligible must be true or false.`);
        }

        const lastLevel = Array.isArray(essence.levels)
          ? essence.levels[essence.levels.length - 1]
          : null;
        if (
          Number.isFinite(essence.mastery.resonanceRequired) &&
          Number.isFinite(lastLevel?.resonanceRequired) &&
          essence.mastery.resonanceRequired <= lastLevel.resonanceRequired
        ) {
          errors.push(`${label} mastery Resonance must exceed the final normal level threshold.`);
        }
      }
    }
  }

  static validateEssencePassive(
    passive,
    label,
    maxLevel,
    statusKeys,
    statusFamilies,
    validPassiveTypes,
    errors,
  ) {
    if (!validPassiveTypes.has(passive.type)) {
      errors.push(`${label} passive has unsupported type "${passive.type}".`);
      return;
    }

    if (
      !Number.isInteger(passive.unlockLevel) ||
      passive.unlockLevel < 1 ||
      (Number.isInteger(maxLevel) && passive.unlockLevel > maxLevel)
    ) {
      errors.push(`${label} passive.unlockLevel must be within the Essence level range.`);
    }

    const chance = (key) =>
      this.validateFiniteNumber(`${label} passive.${key}`, passive[key], errors, {
        min: 0,
        max: 1,
      });
    const positiveFraction = (key) =>
      this.validateFiniteNumber(`${label} passive.${key}`, passive[key], errors, {
        min: 0,
        max: 1,
      });
    const status = (key = "status") => {
      if (typeof passive[key] !== "string" || !statusKeys.has(passive[key])) {
        errors.push(`${label} passive.${key} must reference a canonical status key.`);
      }
    };
    const element = (key) => {
      if (typeof passive[key] !== "string" || passive[key].trim() === "") {
        errors.push(`${label} passive.${key} must be a non-empty string.`);
      }
    };

    switch (passive.type) {
      case "essenceAbilityMpCostReduction":
      case "essenceAbilityStatusChanceBoost":
      case "physicalEvasionBonus":
        positiveFraction("value");
        break;
      case "essenceCleanseHeal":
        positiveFraction("healPercent");
        break;
      case "reviveGrantStatus":
        status();
        break;
      case "elementDamageBoost":
        element("element");
        positiveFraction("value");
        break;
      case "elementStatusChance":
      case "elementSelfStatusChance":
        element("triggerElement");
        status();
        chance("chance");
        break;
      case "statusDamageBoost":
        status();
        positiveFraction("value");
        break;
      case "statusFamilyResistance":
        if (
          typeof passive.statusFamily !== "string" ||
          !statusFamilies.has(passive.statusFamily)
        ) {
          errors.push(`${label} passive.statusFamily must reference a canonical status family.`);
        }
        positiveFraction("value");
        break;
      case "essenceAbilityMpRefundChance":
      case "incomingStatusNegateChance":
        chance("chance");
        break;
      case "lowHpSelfStatuses":
        positiveFraction("hpThreshold");
        if (
          !Array.isArray(passive.statuses) ||
          passive.statuses.length === 0 ||
          passive.statuses.some((key) => !statusKeys.has(key))
        ) {
          errors.push(`${label} passive.statuses must contain canonical status keys.`);
        }
        if (typeof passive.oncePerBattle !== "boolean") {
          errors.push(`${label} passive.oncePerBattle must be true or false.`);
        }
        break;
      case "essenceAbilityPartialMpRefundChance":
        chance("chance");
        positiveFraction("refundPercent");
        break;
      case "lowHpPhysicalDamageBoost":
        if (!Array.isArray(passive.thresholds) || passive.thresholds.length === 0) {
          errors.push(`${label} passive.thresholds must be a non-empty array.`);
        } else {
          let previousThreshold = 1;
          for (let index = 0; index < passive.thresholds.length; index++) {
            const threshold = passive.thresholds[index];
            const thresholdLabel = `${label} passive threshold ${index + 1}`;
            if (!this.isPlainObject(threshold)) {
              errors.push(`${thresholdLabel} must be an object.`);
              continue;
            }
            this.validateKnownKeys(thresholdLabel, threshold, ["hpThreshold", "value"], errors);
            const validThreshold = this.validateFiniteNumber(
              `${thresholdLabel}.hpThreshold`,
              threshold.hpThreshold,
              errors,
              { min: 0, max: 1 },
            );
            this.validateFiniteNumber(`${thresholdLabel}.value`, threshold.value, errors, {
              min: 0,
              max: 1,
            });
            if (validThreshold && threshold.hpThreshold >= previousThreshold) {
              errors.push(`${label} passive thresholds must descend by HP threshold.`);
            }
            if (validThreshold) {
              previousThreshold = threshold.hpThreshold;
            }
          }
        }
        break;
      case "successfulEscapePartyRecovery":
        positiveFraction("hpPercent");
        positiveFraction("mpPercent");
        break;
      case "banishChainChance":
        chance("chance");
        this.validateFiniteNumber(`${label} passive.maxChains`, passive.maxChains, errors, {
          min: 1,
          integer: true,
        });
        break;
      default:
        break;
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

      const formation = encounter.formation || "normal";
      const validFormations = new Set(["normal", "backAttack", "pincer"]);

      if (!validFormations.has(formation)) {
        errors.push(
          `Encounter ${index} formation must be normal, backAttack, or pincer.`,
        );
      }

      if (!Array.isArray(encounter.members) || encounter.members.length === 0) {
        errors.push(`Encounter ${index} must define at least one member.`);
        continue;
      }

      if (encounter.members.length > 5) {
        errors.push(`Encounter ${index} may define at most 5 enemy members.`);
      }

      const slots = new Set();

      for (let memberIndex = 0; memberIndex < encounter.members.length; memberIndex++) {
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
          member.slot > 4
        ) {
          errors.push(`${label} slot must be an integer from 0 to 4.`);
        }

        if (formation === "pincer") {
          if (!["left", "right"].includes(member.side)) {
            errors.push(
              `${label} side must be left or right for a pincer formation.`,
            );
          } else if (
            Number.isInteger(member.slot) &&
            member.slot >= 0 &&
            member.slot <= 4
          ) {
            const slotKey = `${member.side}:${member.slot}`;

            if (slots.has(slotKey)) {
              errors.push(
                `Encounter ${index} uses ${member.side} slot ${member.slot} more than once.`,
              );
            } else {
              slots.add(slotKey);
            }
          }
        } else {
          if (member.side !== undefined) {
            errors.push(`${label} side is only valid for a pincer formation.`);
          }

          if (
            Number.isInteger(member.slot) &&
            member.slot >= 0 &&
            member.slot <= 4
          ) {
            if (slots.has(member.slot)) {
              errors.push(`Encounter ${index} uses slot ${member.slot} more than once.`);
            } else {
              slots.add(member.slot);
            }
          }
        }
      }
    }
  }

  static validateStatuses(statuses, errors) {
    if (!Array.isArray(statuses)) {
      return;
    }

    const keys = new Set(
      statuses.filter(Boolean).map((status) => status.key).filter(Boolean),
    );
    const validDurationTypes = new Set([
      "untilRemoved",
      "turns",
      "countdown",
      "derived",
    ]);
    const validConditionKeys = ["hpPercentAtOrBelow", "hpPercentAbove"];
    const validEffectKeys = [
      "absorbElementalMagick",
      "allowedActions",
      "blockedActionTypes",
      "canAct",
      "canBeRevived",
      "canKill",
      "countsAsDefeated",
      "forcePhysicalAttack",
      "forceRandomTarget",
      "haltsTurnProgression",
      "hpDamagePercent",
      "hpHealPercent",
      "valorGainMultiplier",
      "magicalDamageTakenMultiplier",
      "maxReflections",
      "onExpire",
      "perTarget",
      "physicalAccuracyMultiplier",
      "physicalDamageMultiplier",
      "physicalDamageTakenMultiplier",
      "playerControl",
      "reflectableMagick",
      "removeOnPhysicalDamage",
      "setsHpToZero",
      "trigger",
      "turnSpeedMultiplier",
    ];
    const booleanEffectKeys = [
      "absorbElementalMagick",
      "canAct",
      "canBeRevived",
      "canKill",
      "countsAsDefeated",
      "forcePhysicalAttack",
      "forceRandomTarget",
      "haltsTurnProgression",
      "perTarget",
      "playerControl",
      "reflectableMagick",
      "removeOnPhysicalDamage",
      "setsHpToZero",
    ];
    const multiplierEffectKeys = [
      "valorGainMultiplier",
      "magicalDamageTakenMultiplier",
      "physicalAccuracyMultiplier",
      "physicalDamageMultiplier",
      "physicalDamageTakenMultiplier",
    ];

    const seenKeys = new Set();

    for (let index = 1; index < statuses.length; index++) {
      const status = statuses[index];

      if (!status) {
        continue;
      }

      if (!status.key || typeof status.key !== "string") {
        errors.push(`Status ${index} must have a key.`);
      } else if (seenKeys.has(status.key)) {
        errors.push(`Statuses.json contains duplicate status key "${status.key}".`);
      } else {
        seenKeys.add(status.key);
      }

      if (!this.isPlainObject(status.classification)) {
        errors.push(`Status ${index} must define a classification object.`);
      } else {
        const classification = status.classification;
        this.validateKnownKeys(
          `Status ${index} classification`,
          classification,
          ["family", "negative", "removable", "persistsAfterBattle"],
          errors,
        );

        if (!classification.family || typeof classification.family !== "string") {
          errors.push(`Status ${index} must define a classification family.`);
        }

        for (const key of ["negative", "removable", "persistsAfterBattle"]) {
          if (typeof classification[key] !== "boolean") {
            errors.push(`Status ${index} classification.${key} must be a boolean.`);
          }
        }
      }

      if (!this.isPlainObject(status.duration)) {
        errors.push(`Status ${index} must define a duration object.`);
      } else {
        const duration = status.duration;
        this.validateKnownKeys(
          `Status ${index} duration`,
          duration,
          ["type", "turns"],
          errors,
        );

        if (!validDurationTypes.has(duration.type)) {
          errors.push(`Status ${index} has unsupported duration type "${duration.type}".`);
        }

        if (["turns", "countdown"].includes(duration.type)) {
          this.validateFiniteNumber(
            `Status ${index} duration.turns`,
            duration.turns,
            errors,
            { min: 1, integer: true },
          );
        } else if (duration.turns !== undefined) {
          errors.push(`Status ${index} duration.turns is only valid for turns/countdown durations.`);
        }
      }

      if (status.conditions !== undefined && !this.isPlainObject(status.conditions)) {
        errors.push(`Status ${index} conditions must be an object.`);
      } else if (this.isPlainObject(status.conditions)) {
        const conditions = status.conditions;
        this.validateKnownKeys(
          `Status ${index} conditions`,
          conditions,
          validConditionKeys,
          errors,
        );

        for (const key of validConditionKeys) {
          if (conditions[key] !== undefined) {
            this.validateFiniteNumber(
              `Status ${index} conditions.${key}`,
              conditions[key],
              errors,
              { min: 0, max: 1 },
            );
          }
        }
      }

      if (!this.isPlainObject(status.effects)) {
        errors.push(`Status ${index} must define an effects object.`);
        continue;
      }

      const effects = status.effects;
      this.validateKnownKeys(`Status ${index} effects`, effects, validEffectKeys, errors);

      for (const effectKey of booleanEffectKeys) {
        if (
          effects[effectKey] !== undefined &&
          typeof effects[effectKey] !== "boolean"
        ) {
          errors.push(`Status ${index} effects.${effectKey} must be true or false when provided.`);
        }
      }

      if (effects.canBeRevived === true && effects.countsAsDefeated !== true) {
        errors.push(`Status ${index} with effects.canBeRevived must also set effects.countsAsDefeated to true.`);
      }

      if (
        effects.haltsTurnProgression === true &&
        !["turns", "countdown"].includes(status.duration?.type)
      ) {
        errors.push(
          `Status ${index} with effects.haltsTurnProgression must use a finite turns/countdown duration.`,
        );
      }

      if (effects.turnSpeedMultiplier !== undefined) {
        this.validateFiniteNumber(
          `Status ${index} effects.turnSpeedMultiplier`,
          effects.turnSpeedMultiplier,
          errors,
          { min: Number.MIN_VALUE },
        );
      }

      for (const effectKey of multiplierEffectKeys) {
        if (effects[effectKey] !== undefined) {
          this.validateFiniteNumber(
            `Status ${index} effects.${effectKey}`,
            effects[effectKey],
            errors,
            { min: 0 },
          );
        }
      }

      for (const effectKey of ["hpDamagePercent", "hpHealPercent"]) {
        if (effects[effectKey] !== undefined) {
          this.validateFiniteNumber(
            `Status ${index} effects.${effectKey}`,
            effects[effectKey],
            errors,
            { min: Number.MIN_VALUE, max: 1 },
          );
        }
      }

      if (
        effects.trigger !== undefined &&
        !["turnStart"].includes(effects.trigger)
      ) {
        errors.push(`Status ${index} effects.trigger has unsupported value "${effects.trigger}".`);
      }

      for (const effectKey of ["allowedActions", "blockedActionTypes"]) {
        const values = effects[effectKey];
        if (values === undefined) {
          continue;
        }

        if (
          !Array.isArray(values) ||
          values.length === 0 ||
          values.some((value) => typeof value !== "string" || value.trim().length === 0)
        ) {
          errors.push(`Status ${index} effects.${effectKey} must be a non-empty array of non-empty strings when provided.`);
        }
      }

      if (effects.maxReflections !== undefined) {
        this.validateFiniteNumber(
          `Status ${index} effects.maxReflections`,
          effects.maxReflections,
          errors,
          { min: 1, integer: true },
        );
      }

      if (effects.reflectableMagick === true && effects.perTarget !== true) {
        errors.push(`Status ${index} that reflects magick must define effects.perTarget as true.`);
      }

      if (
        effects.reflectableMagick === true &&
        (!Number.isInteger(effects.maxReflections) || effects.maxReflections < 1)
      ) {
        errors.push(`Status ${index} that reflects magick must define a positive integer maxReflections.`);
      }

      if (effects.onExpire !== undefined) {
        if (!this.isPlainObject(effects.onExpire)) {
          errors.push(`Status ${index} effects.onExpire must be an object when provided.`);
        } else {
          this.validateKnownKeys(
            `Status ${index} effects.onExpire`,
            effects.onExpire,
            ["applyStatus"],
            errors,
          );
          if (
            typeof effects.onExpire.applyStatus !== "string" ||
            !keys.has(effects.onExpire.applyStatus)
          ) {
            errors.push(`Status ${index} effects.onExpire.applyStatus must reference a canonical status key.`);
          }
        }
      }
    }
  }
}
