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
  return context.__Manager;
}

function drawContext() {
  const calls = [];
  return {
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    globalAlpha: 1,
    save() {
      calls.push(["save"]);
    },
    restore() {
      calls.push(["restore"]);
    },
    fillRect(...args) {
      calls.push(["fillRect", this.fillStyle, ...args]);
    },
    strokeRect(...args) {
      calls.push(["strokeRect", this.strokeStyle, ...args]);
    },
    drawImage(...args) {
      calls.push(["drawImage", ...args]);
    },
    translate(...args) {
      calls.push(["translate", ...args]);
    },
    rotate(...args) {
      calls.push(["rotate", ...args]);
    },
  };
}

function readyImage(width, height) {
  return {
    complete: true,
    naturalWidth: width,
    naturalHeight: height,
  };
}

function testSemanticManifestKeepsSourceFilenamesCentralized() {
  const Manager = loadAssetManager();
  const manifest = Manager.manifest();

  assert.equal(
    manifest.battlePanel,
    "js/sprites/ui/adventure/panel_grey_blue.png",
  );
  assert.equal(
    manifest.menuPanel,
    "js/sprites/ui/adventure/panel_grey_dark.png",
  );
  assert.equal(
    manifest.accentPanel,
    "js/sprites/ui/adventure/panel_grey_bolts_blue.png",
  );
  assert.equal(
    manifest.selectionPanel,
    "js/sprites/ui/adventure/button_grey.png",
  );
  assert.equal(
    manifest.gaugeFrame,
    "js/sprites/ui/adventure/progress_transparent.png",
  );
}

function testPanelDrawsFallbackThenOptionalNineSlice() {
  const Manager = loadAssetManager();
  const context = drawContext();

  assert.equal(
    Manager.drawPanel(context, "battlePanel", 10, 20, 300, 120),
    false,
  );
  assert.equal(
    context.calls.some((call) => call[0] === "fillRect"),
    true,
  );
  assert.equal(
    context.calls.some((call) => call[0] === "strokeRect"),
    true,
  );

  context.calls.length = 0;
  Manager._images.set("battlePanel", readyImage(64, 64));
  assert.equal(
    Manager.drawPanel(context, "battlePanel", 10, 20, 300, 120),
    true,
  );
  assert.equal(
    context.calls.filter((call) => call[0] === "drawImage").length,
    9,
  );
}

function testSelectionAndGaugeArtRemainOptional() {
  const Manager = loadAssetManager();
  const context = drawContext();

  assert.equal(Manager.drawSelectionPanel(context, 0, 0, 200, 36), false);

  Manager._images.set("selectionPanel", readyImage(48, 24));
  assert.equal(Manager.drawSelectionPanel(context, 0, 0, 200, 36), true);

  context.calls.length = 0;
  assert.equal(
    Manager.drawGauge(context, 50, 100, 10, 20, 160, 7, "#63d471"),
    true,
  );
  assert.equal(
    context.calls.some((call) => call[0] === "fillRect"),
    true,
    "vector gauge remains available even without image framing",
  );

  context.calls.length = 0;
  Manager._images.set("gaugeFrame", readyImage(16, 32));
  Manager.drawGauge(context, 50, 100, 10, 20, 160, 7, "#63d471");
  assert.equal(
    context.calls.some((call) => call[0] === "rotate"),
    true,
    "vertical capsule source is rotated into a horizontal frame",
  );
  assert.equal(
    context.calls.some((call) => call[0] === "drawImage"),
    true,
  );
}

function testPrimaryConsumersRequestSemanticRoles() {
  const battleRenderer = read("js/battle/BattleRenderer.js");
  const battleCommand = read("js/windows/Window_BattleCommand.js");
  const battleSkills = read("js/windows/Window_BattleSkills.js");
  const battleMagick = read("js/windows/Window_BattleMagick.js");
  const battleItem = read("js/windows/Window_BattleItem.js");
  const options = read("js/windows/Window_Options.js");
  const controls = read("js/windows/Window_Controls.js");
  const menu = read("js/windows/Window_MenuCommand.js");

  assert.match(battleRenderer, /"battlePanel"/);
  assert.match(battleRenderer, /UIAssetManager\.drawGauge/);
  assert.match(battleCommand, /"battlePanel"/);
  assert.match(battleCommand, /"accentPanel"/);

  for (const selector of [battleSkills, battleMagick, battleItem]) {
    assert.match(selector, /"battlePanel"/);
    assert.match(selector, /drawSelectionPanel/);
  }

  assert.match(options, /"menuPanel"/);
  assert.match(options, /drawSelectionPanel/);
  assert.match(controls, /"menuPanel"/);
  assert.match(controls, /drawSelectionPanel/);
  assert.match(menu, /"menuPanel"/);
  assert.match(menu, /drawSelectionPanel/);

  for (const source of [
    battleRenderer,
    battleCommand,
    battleSkills,
    battleMagick,
    battleItem,
    options,
    controls,
    menu,
  ]) {
    assert.equal(
      source.includes("panel_grey_blue.png"),
      false,
      "consumers must not know source asset filenames",
    );
  }
}


function testRuntimeConsumersDoNotHardcodeAdventureFilenames() {
  const jsRoot = path.join(projectRoot, "js");
  const stack = [jsRoot];
  const offenders = [];

  while (stack.length > 0) {
    const current = stack.pop();

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".js")) {
        continue;
      }

      const relative = path.relative(projectRoot, absolute).replaceAll("\\", "/");

      if (relative === "js/core/UIAssetManager.js") {
        continue;
      }

      const source = fs.readFileSync(absolute, "utf8");

      if (source.includes("js/sprites/ui/adventure/")) {
        offenders.push(relative);
      }
    }
  }

  assert.deepEqual(offenders, []);
}

function testCuratedAdventureAssetsAndLicenseArePresent() {
  const paths = [
    "js/sprites/ui/adventure/panel_grey_blue.png",
    "js/sprites/ui/adventure/panel_grey_bolts_blue.png",
    "js/sprites/ui/adventure/panel_grey_dark.png",
    "js/sprites/ui/adventure/button_grey.png",
    "js/sprites/ui/adventure/progress_transparent.png",
    "js/sprites/ui/adventure/License.txt",
  ];

  for (const relativePath of paths) {
    assert.equal(fs.existsSync(path.join(projectRoot, relativePath)), true);
  }

  const license = read("js/sprites/ui/adventure/License.txt");
  assert.match(license, /Creative Commons Zero, CC0/);
  assert.match(license, /Kenney/);
}

function run() {
  testSemanticManifestKeepsSourceFilenamesCentralized();
  testPanelDrawsFallbackThenOptionalNineSlice();
  testSelectionAndGaugeArtRemainOptional();
  testPrimaryConsumersRequestSemanticRoles();
  testRuntimeConsumersDoNotHardcodeAdventureFilenames();
  testCuratedAdventureAssetsAndLicenseArePresent();

  console.log("UI style integration regression tests passed.");
}

run();
