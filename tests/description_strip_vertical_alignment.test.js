"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function testWrappedTextCanBeCenteredVerticallyWithoutChangingLeftAlignment() {
  const calls = [];
  const context = vm.createContext({});
  vm.runInContext(
    `${read("js/windows/Window_TextLayout.js")}\nglobalThis.__Layout = Window_TextLayout;`,
    context,
  );

  const drawingContext = {
    measureText(text) { return { width: String(text).length * 8 }; },
    fillText(text, x, y) { calls.push({ text, x, y }); },
  };

  context.__Layout.drawWrappedTextCentered(
    drawingContext,
    "One line",
    18,
    50,
    300,
    18,
    2,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].x, 18);
  assert.equal(calls[0].y, 50);

  calls.length = 0;
  context.__Layout.drawWrappedTextCentered(
    drawingContext,
    "This sentence wraps into two lines",
    18,
    50,
    140,
    18,
    2,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].x, 18);
  assert.equal(calls[1].x, 18);
  assert.equal((calls[0].y + calls[1].y) / 2, 50);
}

function testCharacterDescriptionStripsUseTheCenteredTextHelper() {
  const filenames = [
    "Window_Magick.js",
    "Window_Skills.js",
    "Window_Essence.js",
    "Window_Equipment.js",
    "Window_Valor.js",
    "Window_Inventory.js",
  ];

  for (const filename of filenames) {
    const source = read(`js/windows/${filename}`);
    assert.match(
      source,
      /Window_TextLayout\.drawWrappedTextCentered/,
      `${filename} should vertically center its middle description strip`,
    );
  }
}

function testArrangeAndKeyItemEmptyStatesUseTheSameHeadingGap() {
  const source = read("js/windows/Window_Inventory.js");
  const arrange = source.slice(
    source.indexOf("drawArrangePage(context, columns)"),
    source.indexOf("drawKeyItemsPage(context, columns)"),
  );
  const keyItems = source.slice(
    source.indexOf("drawKeyItemsPage(context, columns)"),
    source.indexOf("drawContent(context)"),
  );

  assert.match(arrange, /columns\.rightBodyY \+ 46/);
  assert.match(keyItems, /columns\.rightBodyY \+ 46/);
  assert.doesNotMatch(keyItems, /columns\.rightBodyY \+ 52/);
}

function run() {
  testWrappedTextCanBeCenteredVerticallyWithoutChangingLeftAlignment();
  testCharacterDescriptionStripsUseTheCenteredTextHelper();
  testArrangeAndKeyItemEmptyStatesUseTheSameHeadingGap();
  console.log("Description strip vertical alignment regression tests passed.");
}

run();
