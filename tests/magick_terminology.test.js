"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const exists = (relativePath) => fs.existsSync(path.join(projectRoot, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(read(relativePath));

function walkFiles(relativeDir, predicate = () => true) {
  const root = path.join(projectRoot, relativeDir);
  const results = [];

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    const relative = path.relative(projectRoot, absolute).replaceAll("\\", "/");

    if (entry.isDirectory()) {
      results.push(...walkFiles(relative, predicate));
    } else if (predicate(relative)) {
      results.push(relative);
    }
  }

  return results;
}

function testMagickAndSkillsHaveSeparateCanonicalNamespaces() {
  assert.equal(exists("data/Magick.json"), true);
  assert.equal(exists("data/Skills.json"), true);
  assert.equal(exists("js/windows/Window_Magick.js"), true);
  assert.equal(exists("js/windows/Window_BattleMagick.js"), true);
  assert.equal(exists("js/windows/Window_Skills.js"), true);
  assert.equal(exists("js/windows/Window_BattleSkills.js"), true);
  assert.equal(exists("js/windows/Window_Magic.js"), false);
  assert.equal(exists("js/windows/Window_BattleMagic.js"), false);

  const index = read("index.html");
  assert.match(index, /Window_BattleMagick\.js/);
  assert.match(index, /Window_Magick\.js/);
  assert.match(index, /Window_BattleSkills\.js/);
  assert.match(index, /Window_Skills\.js/);
  assert.doesNotMatch(index, /Window_BattleMagic\.js|Window_Magic\.js/);
}

function testCanonicalDataKeepsMagickAndSkillsDistinct() {
  const magick = readJson("data/Magick.json");
  const skills = readJson("data/Skills.json");
  const actors = readJson("data/Actors.json");
  const essences = readJson("data/Essences.json");

  const magickEntries = magick.filter(Boolean);
  assert.equal(magickEntries.length, 54);
  assert.equal(magickEntries.every((entry) => entry.type === "magick"), true);

  assert.equal(Array.isArray(skills), true);
  assert.equal(skills[0], null);
  assert.equal(skills.filter(Boolean).every((entry) => entry.type === "skill"), true);

  for (const actor of actors.filter(Boolean)) {
    assert.equal(Array.isArray(actor.initialMagickIds), true);
    assert.equal(Array.isArray(actor.initialSkillIds), true);
    assert.equal(Object.hasOwn(actor, "initialSkills"), false);
  }

  for (const essence of essences.filter(Boolean)) {
    for (const ability of essence.abilities || []) {
      assert.equal(Number.isInteger(ability.magickId), true);
      assert.equal(Object.hasOwn(ability, "skillId"), false);
    }
  }
}

function testRuntimeExposesSeparateMagickAndSkillApis() {
  const databaseManager = read("js/core/DatabaseManager.js");
  const actor = read("js/objects/Game_Actor.js");
  const battler = read("js/objects/Game_Battler.js");
  const commandWindow = read("js/windows/Window_BattleCommand.js");

  assert.match(databaseManager, /static magick\(id\)/);
  assert.match(databaseManager, /static magickName\(id\)/);
  assert.match(databaseManager, /static skill\(id\)/);
  assert.match(databaseManager, /static skillName\(id\)/);

  assert.match(actor, /learnMagick\(/);
  assert.match(actor, /this\.magickIds/);
  assert.match(actor, /learnSkill\(/);
  assert.match(actor, /this\.skillIds/);
  assert.match(battler, /canUseMagick\(/);
  assert.match(battler, /useMagick\(/);
  assert.match(battler, /canUseSkill\(/);

  assert.match(commandWindow, /"Magick"/);
  assert.match(commandWindow, /"Skills"/);
  assert.doesNotMatch(commandWindow, /"Magic"/);
}

function testLegacySkillsSaveBridgeStillMeansOldMagickOnly() {
  const saveManager = read("js/core/SaveManager.js");

  assert.match(saveManager, /Array\.isArray\(source\.skills\)/);
  assert.match(saveManager, /skills:\s*_legacySkills[\s\S]*\.\.\.rest/);
  assert.match(saveManager, /const skillIds = Array\.isArray\(source\.skillIds\)/);
  assert.match(saveManager, /magickIds,/);
  assert.match(saveManager, /skillIds,/);

  const currentRuntimeFiles = walkFiles("js", (relative) => relative.endsWith(".js"));
  for (const relative of currentRuntimeFiles) {
    if (relative === "js/core/SaveManager.js") {
      continue;
    }
    assert.doesNotMatch(
      read(relative),
      /\binitialSkills\b|\bpendingMagicSkill\b|\bmagicWindow\b|\bexecuteMagic\b|\bperformMagicEffect\b/,
      `${relative} contains a retired legacy ability identifier`,
    );
  }
}

function testDocumentationStatesTheBoundary() {
  const readme = read("README.md");
  const roadmap = read("docs/roadmap.md");
  const designBible = read("docs/design_bible.md");

  assert.match(readme, /# ✨ Magick/);
  assert.match(readme, /# 🥋 Skills/);
  assert.match(readme, /data\/Magick\.json/);
  assert.match(readme, /data\/Skills\.json/);
  assert.match(roadmap, /non-Magick/i);
  assert.match(designBible, /non-Magick/i);
}

function run() {
  testMagickAndSkillsHaveSeparateCanonicalNamespaces();
  testCanonicalDataKeepsMagickAndSkillsDistinct();
  testRuntimeExposesSeparateMagickAndSkillApis();
  testLegacySkillsSaveBridgeStillMeansOldMagickOnly();
  testDocumentationStatesTheBoundary();

  console.log("Magick / Skills terminology boundary regression tests passed.");
}

run();
