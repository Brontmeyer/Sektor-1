"use strict";

class SaveManager {
  static exists(slotId = 1) {
    return localStorage.getItem(this.saveKey(slotId)) !== null;
  }

  static async load(slotId = 1) {
    const saveData = this.read(slotId);

    if (!saveData) {
      console.warn(`No save data exists in slot ${slotId}.`);

      return false;
    }

    // =========================
    // RESTORE ACTOR
    // =========================

    const actorData = saveData.actor;

    $gameActor.actorId = actorData.actorId ?? $gameActor.actorId;
    $gameActor.name = actorData.name ?? $gameActor.name;
    $gameActor.level = actorData.level ?? $gameActor.level;
    $gameActor.exp = actorData.exp ?? $gameActor.exp;

    $gameActor.maxHp = actorData.maxHp ?? $gameActor.maxHp;
    $gameActor.hp = actorData.hp ?? $gameActor.hp;
    $gameActor.maxMp = actorData.maxMp ?? $gameActor.maxMp;
    $gameActor.mp = actorData.mp ?? $gameActor.mp;

    $gameActor.strength = actorData.strength ?? $gameActor.strength;
    $gameActor.vitality = actorData.vitality ?? $gameActor.vitality;
    $gameActor.dexterity = actorData.dexterity ?? $gameActor.dexterity;
    $gameActor.agility = actorData.agility ?? $gameActor.agility;
    $gameActor.magic = actorData.magic ?? $gameActor.magic;
    $gameActor.spirit = actorData.spirit ?? $gameActor.spirit;
    $gameActor.luck = actorData.luck ?? $gameActor.luck;

    $gameActor.attack = actorData.attack ?? $gameActor.attack;
    $gameActor.attackPercent =
      actorData.attackPercent ?? $gameActor.attackPercent;

    $gameActor.defense = actorData.defense ?? $gameActor.defense;
    $gameActor.defensePercent =
      actorData.defensePercent ?? $gameActor.defensePercent;

    $gameActor.magicAttack = actorData.magicAttack ?? $gameActor.magicAttack;
    $gameActor.magicDefense = actorData.magicDefense ?? $gameActor.magicDefense;
    $gameActor.magicDefensePercent =
      actorData.magicDefensePercent ?? $gameActor.magicDefensePercent;

    $gameActor.weaponId = actorData.weaponId ?? $gameActor.weaponId;
    $gameActor.armorId = actorData.armorId ?? $gameActor.armorId;

    $gameActor.skills = Array.isArray(actorData.skills)
      ? [...actorData.skills]
      : $gameActor.skills;

    // =========================
    // RESTORE PARTY
    // =========================

    const partyData = saveData.party;

    if (partyData) {
      $gameParty.items = { ...(partyData.items || {}) };
      $gameParty.weapons = { ...(partyData.weapons || {}) };
      $gameParty.armors = { ...(partyData.armors || {}) };
    }

    // =========================
    // RESTORE SWITCHES
    // =========================

    if (saveData.switches) {
      $gameSwitches.data = {
        ...(saveData.switches.data || {}),
      };
    }

    // =========================
    // RESTORE VARIABLES
    // =========================

    if (saveData.variables) {
      $gameVariables.data = {
        ...(saveData.variables.data || {}),
      };
    }

    // =========================
    // RESTORE SELF SWITCHES
    // =========================

    if (saveData.selfSwitches) {
      $gameSelfSwitches.data = {
        ...(saveData.selfSwitches.data || {}),
      };
    }

    // =========================
    // RESTORE LOCATION
    // =========================

    const location = saveData.location;

    if (location) {
      let scene = SceneManager.currentScene;

      if (!scene?.map || !scene?.player) {
        scene =
          [...SceneManager.sceneStack]
            .reverse()
            .find(
              (stackedScene) => stackedScene?.map && stackedScene?.player,
            ) || null;
      }

      if (scene && scene.map && scene.player) {
        const savedMapId = Number(location.mapId);
        const savedX = Number(location.x);
        const savedY = Number(location.y);

        // =========================
        // SAME MAP
        // =========================

        if (scene.map.id === savedMapId) {
          scene.player.x = savedX;

          scene.player.y = savedY;

          scene.player.velocityX = 0;
          scene.player.velocityY = 0;

          if (scene.camera && typeof scene.camera.follow === "function") {
            scene.camera.follow(scene.player);
          }

          console.log(`Player position restored: (${savedX}, ${savedY})`);

          // =========================
          // DIFFERENT MAP
          // =========================
        } else {
          console.log(`Loading saved map ${savedMapId}...`);

          await scene.performTransfer({
            targetMapId: savedMapId,
            targetX: savedX,
            targetY: savedY,
          });

          scene.player.velocityX = 0;
          scene.player.velocityY = 0;

          console.log(
            `Saved location restored: Map ${savedMapId} (${savedX}, ${savedY})`,
          );
        }
      }
    }
    console.log(`Game loaded from slot ${slotId}.`);
    return true;
  }

  static read(slotId = 1) {
    const json = localStorage.getItem(this.saveKey(slotId));

    if (!json) {
      return null;
    }

    try {
      return JSON.parse(json);
    } catch (error) {
      console.error("Could not read save data:", error);

      return null;
    }
  }

  static save(slotId = 1) {
    let scene = SceneManager.currentScene;

    // If the current scene is the menu,
    // look backward through the scene stack
    // for the active map scene.
    if (!scene?.map || !scene?.player) {
      scene =
        [...SceneManager.sceneStack]
          .reverse()
          .find((stackedScene) => stackedScene?.map && stackedScene?.player) ||
        null;
    }

    // No valid map scene was found.
    if (!scene || !scene.map || !scene.player) {
      console.warn("Cannot save: no active map scene.");

      return false;
    }

    const saveData = {
      version: 1,

      metadata: {
        actorName: $gameActor.name,
        level: $gameActor.level,

        mapId: scene.map.id,
        mapName: scene.map.name || `Map ${scene.map.id}`,
        timestamp: Date.now(),
      },

      actor: {
        actorId: $gameActor.actorId,
        name: $gameActor.name,
        level: $gameActor.level,
        exp: $gameActor.exp,

        hp: $gameActor.hp,
        maxHp: $gameActor.maxHp,

        mp: $gameActor.mp,
        maxMp: $gameActor.maxMp,

        strength: $gameActor.strength,
        vitality: $gameActor.vitality,
        dexterity: $gameActor.dexterity,
        agility: $gameActor.agility,
        magic: $gameActor.magic,
        spirit: $gameActor.spirit,
        luck: $gameActor.luck,

        attack: $gameActor.attack,
        attackPercent: $gameActor.attackPercent,
        defense: $gameActor.defense,
        defensePercent: $gameActor.defensePercent,
        magicAttack: $gameActor.magicAttack,
        magicDefense: $gameActor.magicDefense,
        magicDefensePercent: $gameActor.magicDefensePercent,

        weaponId: $gameActor.weaponId,
        armorId: $gameActor.armorId,

        skills: [...$gameActor.skills],
      },

      party: {
        items: { ...$gameParty.items },
        weapons: { ...$gameParty.weapons },
        armors: { ...$gameParty.armors },
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

    console.log(`Game saved to slot ${slotId}.`);

    return true;
  }

  static saveKey(slotId) {
    return `Sektor1_Save_${slotId}`;
  }
}
