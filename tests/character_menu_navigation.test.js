"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));

function createHarness() {
  const actors = readData("Actors.json");
  const weapons = readData("Weapons.json");
  const armors = readData("Armors.json");
  const accessories = readData("Accessories.json");
  const magick = readData("Magick.json");
  const skills = readData("Skills.json");
  const essences = readData("Essences.json");
  const statuses = readData("Statuses.json");

  const DatabaseManager = {
    actors,
    weapons,
    armors,
    accessories,
    magick,
    skills,
    essences,
    statuses,
    actor(id) {
      return actors[id] || null;
    },
    weapon(id) {
      return weapons[id] || null;
    },
    armor(id) {
      return armors[id] || null;
    },
    accessory(id) {
      return accessories[id] || null;
    },
    magick(id) {
      return magick[id] || null;
    },
    magickName(id) {
      return magick[id]?.name || `Unknown Magick ${id}`;
    },
    skill(id) {
      return skills[id] || null;
    },
    skillName(id) {
      return skills[id]?.name || `Unknown Skill ${id}`;
    },
    essence(id) {
      return essences[id] || null;
    },
    essenceName(id) {
      return essences[id]?.name || `Unknown Essence ${id}`;
    },
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
  };

  const drawCalls = [];
  const graphicsContext = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    globalAlpha: 1,
    save() {},
    restore() {},
    fillRect(...args) { drawCalls.push(["fillRect", ...args]); },
    strokeRect(...args) { drawCalls.push(["strokeRect", ...args]); },
    fillText(...args) { drawCalls.push(["fillText", ...args]); },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    measureText(text) { return { width: String(text).length * 8 }; },
  };
  const triggered = new Set();
  const Input = {
    isTriggered(key) {
      return triggered.has(key);
    },
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager,
    DebugManager: { log() {} },
    Graphics: { width: 1280, height: 720, context: graphicsContext },
    Input,
  });

  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Essence.js",
    "js/objects/Game_Actor.js",
    "js/objects/Game_Party.js",
    "js/windows/Window_ListViewport.js",
    "js/windows/Window_ActorNavigator.js",
    "js/windows/Window_EquipSelect.js",
    "js/windows/Window_Equipment.js",
    "js/windows/Window_Essence.js",
    "js/windows/Window_Magick.js",
    "js/windows/Window_Skills.js",
    "js/windows/Window_Status.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Game_Party, Window_ActorNavigator, Window_Equipment, Window_Essence, Window_Magick, Window_Skills, Window_Status };`,
    context,
  );

  const {
    Game_Actor,
    Game_Party,
    Window_ActorNavigator,
    Window_Equipment,
    Window_Essence,
    Window_Magick,
    Window_Skills,
    Window_Status,
  } = context.__classes;
  const partyActors = [1, 2, 3, 4].map((actorId) => new Game_Actor(actorId));
  const party = new Game_Party(partyActors);
  context.$gameParty = party;

  return {
    context,
    party,
    partyActors,
    drawCalls,
    triggered,
    Window_ActorNavigator,
    Window_Equipment,
    Window_Essence,
    Window_Magick,
    Window_Skills,
    Window_Status,
  };
}

function trigger(window, triggered, key) {
  triggered.clear();
  triggered.add(key);
  window.update();
  triggered.clear();
}

function actorHeaderWasDrawn(drawCalls, actorName) {
  return drawCalls.some(
    (call) =>
      call[0] === "fillText" &&
      call[1] === `◀  ${actorName}  ▶`,
  );
}

function testSharedNavigatorWrapsPartyMembers() {
  const { party, partyActors, Window_ActorNavigator } = createHarness();
  const navigator = new Window_ActorNavigator(party);

  assert.equal(navigator.actor(), partyActors[0]);
  assert.equal(navigator.changeActor(-1), true);
  assert.equal(navigator.actor(), partyActors[3]);
  assert.equal(navigator.changeActor(1), true);
  assert.equal(navigator.actor(), partyActors[0]);

  const fallback = new Window_ActorNavigator(partyActors[1]);
  assert.equal(fallback.actor(), partyActors[1]);
  assert.equal(fallback.changeActor(1), false);
  assert.equal(fallback.actor(), partyActors[1]);
}

function testCharacterMenusShareLeftRightActorNavigation() {
  const {
    party,
    partyActors,
    drawCalls,
    triggered,
    Window_Equipment,
    Window_Essence,
    Window_Magick,
    Window_Skills,
    Window_Status,
  } = createHarness();

  const cases = [
    {
      name: "Magick",
      window: new Window_Magick(party),
      actor: (window) => window.actor,
      beforeSwitch(window) {
        window.index = 1;
      },
      afterSwitch(window) {
        assert.equal(window.index, 0);
      },
    },
    {
      name: "Skills",
      window: new Window_Skills(party),
      actor: (window) => window.actor,
      beforeSwitch(window) {
        window.index = 1;
      },
      afterSwitch(window) {
        assert.equal(window.index, 0);
      },
    },
    {
      name: "Status",
      window: new Window_Status(party),
      actor: (window) => window.actor,
    },
    {
      name: "Equipment",
      window: new Window_Equipment(party),
      actor: (window) => window.actor,
      beforeSwitch(window) {
        window.index = 2;
      },
      afterSwitch(window) {
        assert.equal(window.index, 0);
        assert.equal(window.selectWindow.actor, partyActors[1]);
      },
    },
    {
      name: "Essences",
      window: new Window_Essence(party),
      actor: (window) => window.actor(),
      beforeSwitch(window) {
        window.slotIndex = 2;
      },
      afterSwitch(window) {
        assert.equal(window.slotIndex, 0);
      },
    },
  ];

  for (const testCase of cases) {
    const { window } = testCase;
    window.show();
    assert.equal(testCase.actor(window), partyActors[0], `${testCase.name} starts on leader`);

    testCase.beforeSwitch?.(window);
    trigger(window, triggered, "ArrowRight");
    assert.equal(testCase.actor(window), partyActors[1], `${testCase.name} moves right`);
    testCase.afterSwitch?.(window);

    drawCalls.length = 0;
    window.draw();
    assert.equal(
      actorHeaderWasDrawn(drawCalls, "Sarah"),
      true,
      `${testCase.name} draws the shared actor arrows`,
    );

    trigger(window, triggered, "KeyA");
    assert.equal(testCase.actor(window), partyActors[0], `${testCase.name} supports A/left`);
  }
}

function testSceneMenuPassesPartyContextToAllCharacterMenus() {
  const sceneMenuSource = fs.readFileSync(
    path.join(projectRoot, "js/scenes/Scene_Menu.js"),
    "utf8",
  );
  const indexSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");

  for (const constructorName of [
    "Window_Magick",
    "Window_Skills",
    "Window_Status",
    "Window_Equipment",
    "Window_Essence",
  ]) {
    assert.equal(
      sceneMenuSource.includes(`new ${constructorName}($gameParty)`),
      true,
      `${constructorName} should receive party context`,
    );
  }

  const helperIndex = indexSource.indexOf("Window_ActorNavigator.js");
  assert.equal(helperIndex >= 0, true);

  for (const windowFile of [
    "Window_Equipment.js",
    "Window_Essence.js",
    "Window_Magick.js",
    "Window_Skills.js",
    "Window_Status.js",
  ]) {
    assert.equal(
      helperIndex < indexSource.indexOf(windowFile),
      true,
      `actor navigator must load before ${windowFile}`,
    );
  }
}

function run() {
  testSharedNavigatorWrapsPartyMembers();
  testCharacterMenusShareLeftRightActorNavigation();
  testSceneMenuPassesPartyContextToAllCharacterMenus();

  console.log("Character menu navigation regression tests passed.");
}

run();
