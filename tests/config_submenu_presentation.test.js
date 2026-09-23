"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function testConfigFamilySharesOneHeaderAndContentGeometry() {
  const context = vm.createContext({ Graphics: { width: 1280, height: 720 } });
  vm.runInContext(
    `${read("js/windows/ConfigMenuLayout.js")}\nglobalThis.__Layout = ConfigMenuLayout;`,
    context,
  );

  const layout = context.__Layout.calculate();
  assert.equal(layout.descriptionBounds.y, layout.titleBounds.y);
  assert.equal(layout.descriptionBounds.height, layout.titleBounds.height);
  assert.equal(layout.contentBounds.x, layout.x);
  assert.equal(layout.contentBounds.width, layout.width);
  assert.equal(layout.contentBounds.y > layout.descriptionBounds.y, true);
}

function testConfigControlsAndWindowColorUseTheSharedFamilyLanguage() {
  const options = read("js/windows/Window_Options.js");
  const controls = read("js/windows/Window_Controls.js");
  const colors = read("js/windows/Window_WindowColor.js");
  const controlsScene = read("js/scenes/Scene_Controls.js");
  const colorScene = read("js/scenes/Scene_WindowColor.js");
  const index = read("index.html");

  for (const source of [options, controls, colors]) {
    assert.match(source, /ConfigMenuLayout\.calculate\(\)/);
    assert.match(source, /ConfigMenuLayout\.drawHeader/);
  }

  assert.match(controls, /title: "CONTROLS"/);
  assert.match(controls, /subtitle: "INPUT"/);
  assert.match(colors, /title: "WINDOW COLOR"/);
  assert.match(colors, /subtitle: "APPEARANCE"/);
  assert.match(colors, /ConfigMenuLayout\.split\(this\.contentBounds, 0\.5, 8\)/);

  assert.match(controlsScene, /fillStyle = "#0b0e13"/);
  assert.match(colorScene, /fillStyle = "#0b0e13"/);
  assert.doesNotMatch(controlsScene, /createLinearGradient|fillText\("CONTROLS"/);
  assert.doesNotMatch(colorScene, /fillText\("WINDOW COLOR"/);

  const layoutIndex = index.indexOf("ConfigMenuLayout.js");
  assert.equal(layoutIndex >= 0, true);
  assert.equal(layoutIndex < index.indexOf("Window_Options.js"), true);
  assert.equal(layoutIndex < index.indexOf("Window_Controls.js"), true);
  assert.equal(layoutIndex < index.indexOf("Window_WindowColor.js"), true);
}

function testSpecializedEditorInstructionsLiveInTheHeaderInsteadOfFooters() {
  const controls = read("js/windows/Window_Controls.js");
  const colors = read("js/windows/Window_WindowColor.js");

  assert.match(controls, /currentDescription\(\)/);
  assert.match(colors, /currentDescription\(\)/);
  assert.doesNotMatch(controls, /drawFooter|footerY|actionLabel/);
  assert.doesNotMatch(colors, /drawFooter|footerY|actionLabel/);
}

function run() {
  testConfigFamilySharesOneHeaderAndContentGeometry();
  testConfigControlsAndWindowColorUseTheSharedFamilyLanguage();
  testSpecializedEditorInstructionsLiveInTheHeaderInsteadOfFooters();
  console.log("Config submenu presentation regression tests passed.");
}

run();
