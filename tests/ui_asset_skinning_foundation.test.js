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
    imageSmoothingEnabled: true,
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

  assert.equal(manifest.iconSet, "js/sprites/ui/icons/IconSet.png");
  assert.equal(manifest.battleShadow, "js/sprites/ui/battle/Shadow2.png");
  assert.equal("windowSkin" in manifest, false);
  assert.equal("buttonSet" in manifest, false);

  const summary = await Manager.initialize();
  assert.equal(summary.initialized, true);
  assert.deepEqual(Array.from(summary.ready), []);
  assert.deepEqual(Array.from(summary.failed), []);
}

function testIconSheetContract() {
  const { Manager } = loadAssetManager();
  const context = createDrawContext();
  Manager._images.set("iconSet", readyImage(192, 2052));

  assert.deepEqual(
    JSON.parse(JSON.stringify(Manager.iconGeometry())),
    { cellSize: 12, columns: 16, rows: 171, capacity: 2736 },
  );
  assert.equal(Manager.iconIndex(1, 1), 17);
  assert.equal(Manager.iconIndex(16, 0), null);

  assert.equal(Manager.drawIcon(context, 17, 40, 50, 24), true);
  const call = context.calls.find((entry) => entry[0] === "drawImage");

  assert.equal(call[2], 12, "icon 17 is column 1");
  assert.equal(call[3], 12, "icon 17 is row 1");
  assert.equal(call[4], 12);
  assert.equal(call[5], 12);
  assert.equal(call[6], 40);
  assert.equal(call[7], 50);
  assert.equal(call[8], 24);
  assert.equal(call[9], 24);
  assert.equal(context.imageSmoothingEnabled, true);
  assert.equal(Manager.drawIcon(context, -1, 0, 0), false);
  assert.equal(Manager.drawIcon(context, 2736, 0, 0), false);
}

function testLargeIconAtlasAndDeadUiAssets() {
  const iconPath = path.join(projectRoot, "js/sprites/ui/icons/IconSet.png");
  const png = fs.readFileSync(iconPath);

  assert.equal(png.toString("ascii", 1, 4), "PNG");
  assert.equal(png.readUInt32BE(16), 192);
  assert.equal(png.readUInt32BE(20), 2052);

  for (const relativePath of [
    "js/sprites/ui/buttons/ButtonSet.png",
    "js/sprites/ui/panels/Window.png",
    "js/sprites/ui/panels/panel_grey_dark.png",
    "js/sprites/ui/adventure",
    "js/sprites/ui/rmmz",
  ]) {
    assert.equal(
      fs.existsSync(path.join(projectRoot, relativePath)),
      false,
      `${relativePath} should stay removed while it has no runtime consumer`,
    );
  }
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
    iconSet: "js/sprites/ui/icons/IconSet.png",
    battleShadow: "js/sprites/ui/battle/Shadow2.png",
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
  testIconSheetContract();
  testLargeIconAtlasAndDeadUiAssets();
  testBattleShadowContract();
  testBattleRendererUsesAssetShadowWithoutOwningFallbackRules();
  testCuratedAssetsExistInRepository();

  console.log("UI asset skinning foundation regression tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
