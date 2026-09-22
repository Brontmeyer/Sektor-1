"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function loadAssetManager(extraGlobals = {}) {
  const context = vm.createContext({ console, ...extraGlobals });
  vm.runInContext(
    `${read("js/core/UIAssetManager.js")}\nglobalThis.__Manager = UIAssetManager;`,
    context,
  );
  return { Manager: context.__Manager, context };
}

function createDrawContext() {
  const calls = [];
  return {
    calls,
    globalAlpha: 1,
    save() {
      calls.push(["save"]);
    },
    restore() {
      calls.push(["restore"]);
    },
    drawImage(...args) {
      calls.push(["drawImage", ...args]);
    },
  };
}

function readyImage(width = 192, height = 192) {
  return {
    complete: true,
    naturalWidth: width,
    naturalHeight: height,
  };
}

async function testManifestAndNonBrowserFallback() {
  const { Manager } = loadAssetManager();
  const manifest = Manager.manifest();

  assert.equal(manifest.windowSkin, "js/sprites/ui/rmmz/Window.png");
  assert.equal(manifest.iconSet, "js/sprites/ui/rmmz/IconSet.png");
  assert.equal(manifest.buttonSet, "js/sprites/ui/rmmz/ButtonSet.png");
  assert.equal(manifest.battleShadow, "js/sprites/ui/rmmz/Shadow2.png");

  const summary = await Manager.initialize();
  assert.equal(summary.initialized, true);
  assert.deepEqual(Array.from(summary.ready), []);
  assert.deepEqual(Array.from(summary.failed), []);
}

function testWindowSkinNineSliceAndFallback() {
  const { Manager } = loadAssetManager();
  const context = createDrawContext();

  assert.equal(Manager.drawWindowSkin(context, 10, 20, 300, 140), false);

  Manager._images.set("windowSkin", readyImage());
  assert.equal(Manager.drawWindowSkin(context, 10, 20, 300, 140), true);

  const draws = context.calls.filter((call) => call[0] === "drawImage");
  assert.equal(draws.length, 9, "background plus eight frame slices are drawn");
  assert.equal(draws[0][2], 0);
  assert.equal(draws[0][3], 0);
  assert.equal(draws[0][4], 96);
  assert.equal(draws[0][5], 96);
}

function testIconSheetContract() {
  const { Manager } = loadAssetManager();
  const context = createDrawContext();
  Manager._images.set("iconSet", readyImage(512, 640));

  assert.equal(Manager.drawIcon(context, 17, 40, 50, 24), true);
  const call = context.calls.find((entry) => entry[0] === "drawImage");

  assert.equal(call[2], 32, "icon 17 is column 1");
  assert.equal(call[3], 32, "icon 17 is row 1");
  assert.equal(call[4], 32);
  assert.equal(call[5], 32);
  assert.equal(call[6], 40);
  assert.equal(call[7], 50);
  assert.equal(call[8], 24);
  assert.equal(call[9], 24);
  assert.equal(Manager.drawIcon(context, -1, 0, 0), false);
}

function testBattleShadowContract() {
  const { Manager } = loadAssetManager();
  const context = createDrawContext();
  Manager._images.set("battleShadow", readyImage(82, 38));

  assert.equal(
    Manager.drawBattleShadow(context, 200, 300, { scale: 0.5, alpha: 0.4 }),
    true,
  );

  const call = context.calls.find((entry) => entry[0] === "drawImage");
  assert.equal(call[2], 179.5);
  assert.equal(call[3], 290.5);
  assert.equal(call[4], 41);
  assert.equal(call[5], 19);
}

function testBattleRendererUsesAssetShadowWithoutOwningFallbackRules() {
  const shadowCalls = [];
  const context = vm.createContext({
    console,
    Graphics: { width: 1280, height: 720, context: {} },
    UIAssetManager: {
      drawBattleShadow(_context, x, y, options) {
        shadowCalls.push({ x, y, options });
        return true;
      },
    },
  });

  vm.runInContext(
    `${read("js/battle/BattleRenderer.js")}\nglobalThis.__Renderer = BattleRenderer;`,
    context,
  );

  const renderer = new context.__Renderer({});
  assert.equal(renderer.drawAssetBattleShadow({}, 100, 200, 0.8, 0.4), true);
  assert.equal(shadowCalls.length, 1);
  assert.equal(shadowCalls[0].x, 100);
  assert.equal(shadowCalls[0].y, 200);
  assert.equal(shadowCalls[0].options.scale, 0.8);
  assert.equal(shadowCalls[0].options.alpha, 0.4);
}

function testCuratedAssetsExistInRepository() {
  const manifest = {
    windowSkin: "js/sprites/ui/rmmz/Window.png",
    iconSet: "js/sprites/ui/rmmz/IconSet.png",
    buttonSet: "js/sprites/ui/rmmz/ButtonSet.png",
    battleShadow: "js/sprites/ui/rmmz/Shadow2.png",
  };

  for (const relativePath of Object.values(manifest)) {
    assert.equal(
      fs.existsSync(path.join(projectRoot, relativePath)),
      true,
      `${relativePath} must exist`,
    );
  }
}

async function run() {
  await testManifestAndNonBrowserFallback();
  testWindowSkinNineSliceAndFallback();
  testIconSheetContract();
  testBattleShadowContract();
  testBattleRendererUsesAssetShadowWithoutOwningFallbackRules();
  testCuratedAssetsExistInRepository();

  console.log("UI asset skinning foundation regression tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
