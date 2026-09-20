"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));

const actors = readData("Actors.json");
const magick = readData("Magick.json");
const essences = readData("Essences.json");
const statuses = readData("Statuses.json");

function createHarness() {
  const DatabaseManager = {
    actors,
    magick,
    essences,
    statuses,
    actor(id) {
      return actors[id] || null;
    },
    magick(id) {
      return magick[id] || null;
    },
    magickName(id) {
      return magick[id]?.name || `Unknown Magick ${id}`;
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
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillText(...args) {
      drawCalls.push(args);
    },
    measureText(text) {
      return { width: String(text).length * 8 };
    },
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager,
    DebugManager: { log() {} },
    Graphics: { width: 1280, height: 720, context: graphicsContext },
    Input: { isTriggered() { return false; } },
  });
  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Essence.js",
    "js/objects/Game_Actor.js",
    "js/windows/Window_TextLayout.js",
    "js/battle/BattleHudLayout.js",
    "js/battle/BattleRenderer.js",
    "js/windows/Window_ActorNavigator.js",
    "js/windows/Window_Status.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, BattleHudLayout, BattleRenderer, Window_Status };`,
    context,
  );

  const { Game_Actor, BattleHudLayout, BattleRenderer, Window_Status } = context.__classes;
  const actor = new Game_Actor(1);
  context.$gameParty = {
    battleMembers() {
      return [actor];
    },
  };

  return { actor, context, drawCalls, BattleHudLayout, BattleRenderer, Window_Status };
}

function testValorUsesResolvedDamageAndStatusMultipliers() {
  const { actor } = createHarness();

  assert.equal(actor.maxValor, 100);
  assert.equal(actor.valor, 0);
  assert.equal(actor.valorGainMultiplier(), 1);

  actor.receiveDamage(100, { category: "physical" });
  assert.equal(actor.valor, 20);

  actor.recoverAllHp();
  actor.setValor(0);
  actor.addStatus("fury");
  actor.receiveDamage(100, { category: "physical" });
  assert.equal(actor.valor, 40);

  actor.recoverAllHp();
  actor.setValor(0);
  actor.addStatus("sadness");
  const sadnessDamage = actor.receiveDamage(100, { category: "physical" });
  assert.equal(sadnessDamage.damage, 70);
  assert.equal(actor.valor, 7);
}

function testNearDeathAppliesToTheHitThatTriggersIt() {
  const { actor } = createHarness();

  actor.addStatus("fury");
  actor.setHp(130);
  actor.setValor(0);
  assert.equal(actor.hasStatus("nearDeath"), false);

  actor.receiveDamage(20, { category: "physical" });

  assert.equal(actor.hp, 110);
  assert.equal(actor.hasStatus("nearDeath"), true);
  assert.equal(actor.valorGainMultiplier(), 4);
  assert.equal(actor.valor, 16);
}

function testDefeatAndAbsorptionDoNotGenerateValor() {
  const { actor } = createHarness();

  actor.setHp(10);
  actor.setValor(0);
  actor.receiveDamage(100, { category: "physical" });
  assert.equal(actor.isDefeated(), true);
  assert.equal(actor.valor, 0);

  const { actor: shielded } = createHarness();
  shielded.setHp(300);
  shielded.addStatus("shield");
  const absorbed = shielded.receiveDamage(100, {
    category: "magical",
    element: "fire",
  });

  assert.equal(absorbed.absorbed, true);
  assert.equal(absorbed.damage, 0);
  assert.equal(shielded.valor, 0);
}

function testValorCapsAndConsumesOnlyWhenReady() {
  const { actor } = createHarness();

  actor.setValor(95);
  assert.equal(actor.gainValor(10), 5);
  assert.equal(actor.valor, 100);
  assert.equal(actor.isValorReady(), true);
  assert.equal(actor.gainValor(20), 0);
  assert.equal(actor.consumeValor(), true);
  assert.equal(actor.valor, 0);
  assert.equal(actor.isValorReady(), false);
  assert.equal(actor.consumeValor(), false);
}

function testBattleHudExposesValorState() {
  const { actor, context, drawCalls, BattleHudLayout, BattleRenderer } =
    createHarness();
  const scene = {
    commandWindow: null,
    outcome: null,
    pendingEnemyTurn: false,
    battleManager: { currentTurnState: () => "command" },
    partyController: { currentBattler: () => actor },
  };
  scene.hudLayout = new BattleHudLayout(scene);
  const renderer = new BattleRenderer(scene);

  actor.setValor(42.8);
  renderer.drawBattleHud(context.Graphics.context);
  assert.equal(
    drawCalls.some((call) => call[0] === "VALOR 42/100"),
    true,
  );

  drawCalls.length = 0;
  actor.setValor(100);
  renderer.drawBattleHud(context.Graphics.context);
  assert.equal(
    drawCalls.some((call) => call[0] === "VALOR READY"),
    true,
  );
}

function testStatusWindowExposesValorState() {
  const { actor, drawCalls, Window_Status } = createHarness();
  const window = new Window_Status(actor);

  actor.setValor(55.9);
  window.show();
  window.draw();

  assert.equal(
    drawCalls.some((call) => call[0] === "Valor: 55 / 100"),
    true,
  );

  drawCalls.length = 0;
  actor.setValor(100);
  window.draw();
  assert.equal(
    drawCalls.some((call) => call[0] === "Valor: READY"),
    true,
  );
}

function run() {
  testValorUsesResolvedDamageAndStatusMultipliers();
  testNearDeathAppliesToTheHitThatTriggersIt();
  testDefeatAndAbsorptionDoNotGenerateValor();
  testValorCapsAndConsumesOnlyWhenReady();
  testBattleHudExposesValorState();
  testStatusWindowExposesValorState();

  console.log("Valor runtime regression tests passed.");
}

run();
