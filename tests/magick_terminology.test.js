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

function testCanonicalFilesAndScriptsUseMagickNames() {
  assert.equal(exists("data/Magick.json"), true);
  assert.equal(exists("data/Skills.json"), false);
  assert.equal(exists("js/windows/Window_Magick.js"), true);
  assert.equal(exists("js/windows/Window_BattleMagick.js"), true);
  assert.equal(exists("js/windows/Window_Magic.js"), false);
  assert.equal(exists("js/windows/Window_BattleMagic.js"), false);
  assert.equal(exists("tests/magick_status_integration.test.js"), true);
  assert.equal(exists("tests/magick_runtime_completion.test.js"), true);
  assert.equal(exists("tests/skill_status_integration.test.js"), false);
  assert.equal(exists("tests/skill_runtime_completion.test.js"), false);

  const index = read("index.html");
  assert.match(index, /Window_BattleMagick\.js/);
  assert.match(index, /Window_Magick\.js/);
  assert.doesNotMatch(index, /Window_BattleMagic\.js|Window_Magic\.js/);
}

function testCanonicalDataUsesMagickVocabulary() {
  const magick = readJson("data/Magick.json");
  const actors = readJson("data/Actors.json");
  const essences = readJson("data/Essences.json");
  const statuses = readJson("data/Statuses.json");

  const magickEntries = magick.filter(Boolean);
  assert.equal(magickEntries.length, 54);
  assert.equal(magickEntries.every((entry) => entry.type === "magick"), true);

  for (const actor of actors.filter(Boolean)) {
    assert.equal(Array.isArray(actor.initialMagickIds), true);
    assert.equal(Object.hasOwn(actor, "initialSkills"), false);
  }

  for (const essence of essences.filter(Boolean)) {
    for (const ability of essence.abilities || []) {
      assert.equal(Number.isInteger(ability.magickId), true);
      assert.equal(Object.hasOwn(ability, "skillId"), false);
    }
  }

  for (const status of statuses.filter(Boolean)) {
    const effects = status.effects || {};
    assert.equal(Object.hasOwn(effects, "blockedSkillTypes"), false);
    assert.equal(Object.hasOwn(effects, "reflectableSkills"), false);
    assert.equal(Object.hasOwn(effects, "absorbElementalMagic"), false);
  }
}

function testCurrentRuntimeHasNoLegacySkillAbilityApi() {
  const forbidden = [
    /\bSkills\.json\b/,
    /\bskillId\b/,
    /\binitialSkills\b/,
    /\blearnSkill\b/,
    /\bforgetSkill\b/,
    /\bknowsSkill\b/,
    /\bknownSkills\b/,
    /\bcanUseSkill\b/,
    /\buseSkill\b/,
    /\bblockedSkillTypes\b/,
    /\breflectableSkills\b/,
    /\bpendingMagicSkill\b/,
    /\bmagicWindow\b/,
    /\bmagicCast\b/,
    /\bmagicEffect\b/,
    /\bmagicRecover\b/,
    /\bmagicWait\b/,
    /\bexecuteMagic\b/,
    /\bperformMagicEffect\b/,
    /\bmagicDamage\b/,
    /\bmagicHealing\b/,
  ];

  const runtimeFiles = walkFiles("js", (relative) => relative.endsWith(".js"));

  for (const relative of runtimeFiles) {
    const source = read(relative);

    // SaveManager intentionally reads the legacy `skills` field so v1-v3 saves
    // can still migrate through the current save schema. No current API may use that name.
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${relative} contains ${pattern}`);
    }
  }

  const databaseManager = read("js/core/DatabaseManager.js");
  assert.match(databaseManager, /static magick\(id\)/);
  assert.match(databaseManager, /static magickName\(id\)/);
  assert.doesNotMatch(databaseManager, /static skill\(|static skillName\(/);

  const actor = read("js/objects/Game_Actor.js");
  assert.match(actor, /learnMagick\(/);
  assert.match(actor, /canUseMagick\(/);
  assert.match(actor, /useMagick\(/);
  assert.match(actor, /this\.magickIds/);

  const commandWindow = read("js/windows/Window_BattleCommand.js");
  assert.match(commandWindow, /"Magick"/);
  assert.doesNotMatch(commandWindow, /"Magic"/);
}

function testLegacySaveBridgeIsExplicitAndIsolated() {
  const saveManager = read("js/core/SaveManager.js");
  assert.match(saveManager, /Array\.isArray\(source\.skills\)/);
  assert.match(saveManager, /skills:\s*_legacySkills[\s\S]*\.\.\.rest/);
  assert.match(saveManager, /magickIds/);
  assert.match(saveManager, /static currentVersion\(\)/);
}

function testDocumentationDoesNotReferenceLegacyAbilityIdentifiers() {
  const docs = ["README.md", "TODO.md", "CHANGELOG.md", ...walkFiles("docs", (relative) => relative.endsWith(".md"))];
  const forbidden = [
    /Skills\.json/,
    /\bskillId\b/,
    /\binitialSkills\b/,
    /\blearnSkill\b/,
    /\bforgetSkill\b/,
    /\bknowsSkill\b/,
    /\bknownSkills\b/,
    /\bcanUseSkill\b/,
    /\buseSkill\b/,
    /Window_BattleMagic\b/,
    /Window_Magic\b/,
    /\bblockedSkillTypes\b/,
    /\breflectableSkills\b/,
    /\bpendingMagicSkill\b/,
    /\bmagicWindow\b/,
    /\bmagicCast\b/,
    /\bmagicEffect\b/,
    /\bmagicRecover\b/,
    /\bmagicWait\b/,
    /\bexecuteMagic\b/,
    /\bperformMagicEffect\b/,
    /\bmagicDamage\b/,
    /\bmagicHealing\b/,
  ];

  for (const relative of docs) {
    const source = read(relative);
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${relative} contains ${pattern}`);
    }
  }

  const readme = read("README.md");
  assert.match(readme, /# ✨ Magick/);
  assert.match(readme, /# 🥋 Skills \(Future Non-Magick Techniques\)/);
  assert.match(readme, /data\/Magick\.json/);
}

function run() {
  testCanonicalFilesAndScriptsUseMagickNames();
  testCanonicalDataUsesMagickVocabulary();
  testCurrentRuntimeHasNoLegacySkillAbilityApi();
  testLegacySaveBridgeIsExplicitAndIsolated();
  testDocumentationDoesNotReferenceLegacyAbilityIdentifiers();

  console.log("Magick terminology regression tests passed.");
}

run();
