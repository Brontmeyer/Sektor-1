"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));

function loadScanManager() {
  const context = vm.createContext({ console });
  vm.runInContext(
    `${read("js/battle/BattleScanManager.js")}\nglobalThis.__Manager = BattleScanManager;`,
    context,
  );
  return context.__Manager;
}

function enemy(name, overrides = {}) {
  return {
    name,
    hp: 250,
    maxHp: 250,
    mp: 12,
    maxMp: 12,
    elementRates: {},
    ...overrides,
  };
}

function createScanFixture(enemies) {
  const BattleScanManager = loadScanManager();
  const scene = {
    enemies,
    selectingEnemyTarget: true,
    targetGroup: "enemy",
    selectedEnemyIndex: 0,
    targetManager: {
      getSelectedEnemy() {
        return enemies[scene.selectedEnemyIndex] || null;
      },
    },
  };
  const manager = new BattleScanManager(scene);
  scene.scanManager = manager;
  return { scene, manager };
}

function createDrawContext() {
  const calls = [];
  return {
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    globalAlpha: 1,
    save() {},
    restore() {},
    fillRect(...args) {
      calls.push(["fillRect", this.fillStyle, ...args]);
    },
    strokeRect(...args) {
      calls.push(["strokeRect", this.strokeStyle, ...args]);
    },
    fillText(...args) {
      calls.push(["fillText", this.fillStyle, ...args]);
    },
    measureText(text) {
      return { width: String(text).length * 7 };
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  };
}

function loadPresentation(scene) {
  const context2d = createDrawContext();
  const Graphics = { width: 1600, height: 900, context: context2d };
  const context = vm.createContext({
    console,
    Graphics,
    DatabaseManager: { skills: readData("Skills.json") },
    Input: {
      actionLabel(action) {
        return { help: "H", up: "W / ↑", down: "S / ↓", left: "A / ←", right: "D / →", confirm: "E / Enter", cancel: "Q / Esc", menu: "Esc", scope: "R" }[action] || action;
      },
    },
    $gameParty: { battleMembers: () => [] },
  });
  const source = [
    "js/windows/Window_TextLayout.js",
    "js/battle/BattleHudLayout.js",
    "js/battle/BattleRenderer.js",
  ]
    .map(read)
    .join("\n");
  vm.runInContext(
    `${source}\nglobalThis.__classes = { BattleHudLayout, BattleRenderer };`,
    context,
  );
  scene.hudLayout = new context.__classes.BattleHudLayout(scene);
  return {
    context2d,
    renderer: new context.__classes.BattleRenderer(scene),
  };
}

function testCanonicalScanSkillAndOwnership() {
  const skills = readData("Skills.json");
  const actors = readData("Actors.json");
  const scan = skills[6];

  assert.equal(scan.type, "skill");
  assert.equal(scan.category, "support");
  assert.equal(scan.effect, "scan");
  assert.deepEqual(scan.target, ["enemy"]);
  assert.deepEqual(scan.scope, ["single"]);
  assert.equal(scan.valorArt, undefined);
  assert.equal(actors[1].initialSkillIds.includes(6), true);
}

function testScanKnowledgeIsBattleLocalAndInstanceSpecific() {
  const a = enemy("Slime A");
  const b = enemy("Slime B");
  const { manager } = createScanFixture([a, b]);

  assert.equal(manager.isScanned(a), false);
  assert.equal(manager.scan(a), true);
  assert.equal(manager.isScanned(a), true);
  assert.equal(manager.isScanned(b), false);

  const secondBattle = createScanFixture([a, b]);
  assert.equal(secondBattle.manager.isScanned(a), false);
}

function testScannedProfileUsesLiveHpMpAndElementRates() {
  const target = enemy("Analyzer", {
    hp: 187,
    maxHp: 300,
    mp: 7,
    maxMp: 20,
    elementRates: {
      fire: 1.5,
      ice: 0.5,
      lightning: 0,
      earth: 1,
    },
  });
  const { manager } = createScanFixture([target]);

  const unknown = manager.tacticalProfile(target);
  assert.equal(unknown.scanned, false);
  assert.equal(unknown.hp, null);
  assert.equal(unknown.weak, null);

  manager.scan(target);
  const known = manager.tacticalProfile(target);
  assert.equal(known.scanned, true);
  assert.equal(known.hp, 187);
  assert.equal(known.maxHp, 300);
  assert.equal(known.mp, 7);
  assert.equal(known.maxMp, 20);
  assert.deepEqual(Array.from(known.weak), ["Fire"]);
  assert.deepEqual(Array.from(known.resist), ["Ice"]);
  assert.deepEqual(Array.from(known.immune), ["Lightning"]);

  target.hp = 91;
  target.mp = 2;
  const updated = manager.tacticalProfile(target);
  assert.equal(updated.hp, 91);
  assert.equal(updated.mp, 2);
}

function testHelpOnlyInspectsActivelyTargetedEnemy() {
  const target = enemy("Target");
  const { scene, manager } = createScanFixture([target]);

  assert.equal(manager.currentEnemyTarget(), target);
  scene.targetGroup = "ally";
  assert.equal(manager.currentEnemyTarget(), null);
  scene.targetGroup = "enemy";
  scene.selectingEnemyTarget = false;
  assert.equal(manager.currentEnemyTarget(), null);
}

function testTacticalHelpRendersUnknownThenScannedDetails() {
  const target = enemy("Test Slime", {
    elementRates: { fire: 1.5, ice: 0.5, lightning: 0 },
  });
  const { scene, manager } = createScanFixture([target]);
  manager.setHelpVisible(true);
  const { context2d, renderer } = loadPresentation(scene);

  renderer.drawTacticalHelp(context2d);
  let texts = context2d.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => call[2]);
  assert.equal(texts.some((text) => String(text).includes("Test Slime")), true);
  assert.equal(texts.some((text) => String(text).includes("HP ??/??")), true);
  assert.equal(
    texts.some((text) => String(text).includes("Tactical data unknown")),
    true,
  );
  assert.equal(
    texts.some((text) => String(text).includes(readData("Skills.json")[6].name)),
    true,
    "unknown tactical help should use the current scan-skill display name",
  );

  manager.scan(target);
  context2d.calls.length = 0;
  renderer.drawTacticalHelp(context2d);
  texts = context2d.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => call[2]);
  const resourceDetail = texts.find((text) => String(text).includes("Test Slime"));
  const affinityDetail = texts.find((text) => String(text).includes("Weak Fire"));
  assert.match(resourceDetail, /HP 250\/250/);
  assert.match(resourceDetail, /MP 12\/12/);
  assert.match(affinityDetail, /Weak Fire/);
  assert.match(affinityDetail, /Resist Ice/);
  assert.match(affinityDetail, /Immune Lightning/);
}

function testSkillRuntimeMarksEnemyScanned() {
  const context = vm.createContext({ console });
  vm.runInContext(
    `${read("js/battle/BattleManager.js")}\nglobalThis.__Manager = BattleManager;`,
    context,
  );
  const target = enemy("Scannable");
  const messages = [];
  const popups = [];
  const scanManager = {
    scanned: new Set(),
    isScanned(enemyTarget) {
      return this.scanned.has(enemyTarget);
    },
    scan(enemyTarget) {
      this.scanned.add(enemyTarget);
      return true;
    },
  };
  const scene = {
    enemies: [target],
    scanManager,
    addBattlePopup(enemyTarget, text, type) {
      popups.push({ enemyTarget, text, type });
    },
    addBattleMessage(message) {
      messages.push(message);
    },
  };
  const manager = Object.create(context.__Manager.prototype);
  manager.scene = scene;
  const caster = { name: "Tyler" };
  const skill = { name: "Scan", effect: "scan" };

  assert.equal(manager.performSkillTarget(caster, skill, target), true);
  assert.equal(scanManager.isScanned(target), true);
  assert.equal(popups.at(-1).text, "SCANNED");
  assert.match(messages.at(-1), /tactical data is revealed/);
}

function testHKeyTogglesHelpWithoutSpendingBattleInput() {
  const context = vm.createContext({
    console,
    Scene_Base: class {},
    Input: {
      isTriggered(key) {
        return key === "KeyH";
      },
      isActionTriggered(action) {
        return action === "help";
      },
    },
    BattleManager: { OUTCOME_VICTORY: "victory" },
  });
  vm.runInContext(
    `${read("js/scenes/Scene_Battle.js")}\nglobalThis.__Scene = Scene_Battle;`,
    context,
  );
  let toggles = 0;
  let commandUpdates = 0;
  const fake = {
    outcome: null,
    updateBattleTime() {},
    updateBattlerStates() {},
    updateActionPhase() {},
    updateBattlerVisuals() {},
    updateBattleAnimations() {},
    updateBattleEffect() {},
    updateBattlePopups() {},
    updateBattleBanner() {},
    updatePendingEnemyTurn() {},
    scanManager: {
      toggleHelp() {
        toggles++;
      },
    },
    commandWindow: {
      update() {
        commandUpdates++;
      },
    },
    battleInputLocked: false,
  };

  context.__Scene.prototype.update.call(fake, 1 / 60);
  assert.equal(toggles, 1);
  assert.equal(commandUpdates, 0);
}

function testHelpGeometrySitsAboveHudAndHintsAdvertiseToggle() {
  const target = enemy("Target");
  const { scene, manager } = createScanFixture([target]);
  const { renderer } = loadPresentation(scene);
  const hud = scene.hudLayout.hudBounds();
  const help = scene.hudLayout.tacticalHelpBounds();

  assert.equal(help.y + help.height < hud.y, true);
  assert.equal(renderer.shouldDrawContextPanel(), true);
  assert.equal(scene.hudLayout.hintY() < help.y, true);
  assert.doesNotMatch(renderer.battleHint(), /H: Help/);

  manager.setHelpVisible(true);
  assert.equal(renderer.shouldDrawContextPanel(), true);
  assert.equal(scene.hudLayout.hintY() < help.y, true);
}

function testScanSchemaIsNarrowAndValidated() {
  const context = vm.createContext({ console });
  vm.runInContext(
    `${read("js/core/DatabaseValidator.js")}\nglobalThis.__Validator = DatabaseValidator;`,
    context,
  );
  const statuses = readData("Statuses.json");
  const valid = [
    null,
    {
      id: 1,
      name: "Scan",
      description: "Analyze one enemy.",
      type: "skill",
      category: "support",
      effect: "scan",
      target: ["enemy"],
      scope: ["single"],
    },
  ];
  const validErrors = [];
  context.__Validator.validateSkills(valid, statuses, validErrors);
  assert.deepEqual(Array.from(validErrors), []);

  valid[1].scope = ["all"];
  const invalidErrors = [];
  context.__Validator.validateSkills(valid, statuses, invalidErrors);
  assert.equal(
    invalidErrors.some((error) => error.includes("scan effect must use single scope")),
    true,
  );
}

function testScanManagerLoadsBeforeBattleRendererAndScene() {
  const source = read("index.html");
  const scanIndex = source.indexOf("BattleScanManager.js");
  const rendererIndex = source.indexOf("BattleRenderer.js");
  const sceneIndex = source.indexOf("Scene_Battle.js");

  assert.equal(scanIndex >= 0, true);
  assert.equal(scanIndex < rendererIndex, true);
  assert.equal(scanIndex < sceneIndex, true);
}

function run() {
  testCanonicalScanSkillAndOwnership();
  testScanKnowledgeIsBattleLocalAndInstanceSpecific();
  testScannedProfileUsesLiveHpMpAndElementRates();
  testHelpOnlyInspectsActivelyTargetedEnemy();
  testTacticalHelpRendersUnknownThenScannedDetails();
  testSkillRuntimeMarksEnemyScanned();
  testHKeyTogglesHelpWithoutSpendingBattleInput();
  testHelpGeometrySitsAboveHudAndHintsAdvertiseToggle();
  testScanSchemaIsNarrowAndValidated();
  testScanManagerLoadsBeforeBattleRendererAndScene();

  console.log("Scan and tactical help regression tests passed.");
}

run();
