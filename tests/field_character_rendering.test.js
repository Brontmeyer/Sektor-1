"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function loadGamePlayer({ actor = null, withImage = false } = {}) {
  const filename = path.join(projectRoot, "js/objects/Game_Player.js");
  const source = fs.readFileSync(filename, "utf8");
  const drawCalls = [];
  const fillCalls = [];

  class FakeImage {
    constructor() {
      this.complete = true;
      this.naturalWidth = 256;
      this.naturalHeight = 512;
      this.width = 256;
      this.height = 512;
      this.loadFailed = false;
    }

    set src(value) {
      this._src = value;
      this.onload?.();
    }

    get src() {
      return this._src;
    }
  }

  const context = vm.createContext({
    console,
    Input: {
      isActionPressed() {
        return false;
      },
    },
    CollisionManager: {
      moveX(character, amount) {
        character.x += amount;
      },
      moveY(character, amount) {
        character.y += amount;
      },
    },
    Graphics: {
      context: {
        fillStyle: "",
        fillRect(...args) {
          fillCalls.push(args);
        },
        drawImage(...args) {
          drawCalls.push(args);
        },
      },
    },
    $gameParty: {
      leader() {
        return actor;
      },
    },
  });

  if (withImage) {
    context.Image = FakeImage;
  }

  vm.runInContext(
    `${source}\nglobalThis.__Game_Player = Game_Player;`,
    context,
    { filename },
  );

  return {
    Game_Player: context.__Game_Player,
    drawCalls,
    fillCalls,
  };
}

function mapStub() {
  return {
    playerStart: { x: 100, y: 100 },
    width: 1000,
    height: 1000,
    getCollisionObstacles() {
      return [];
    },
  };
}

function fieldProfile() {
  return {
    sprite: "Tyler_Field.png",
    frameWidth: 64,
    frameHeight: 64,
    scale: 1,
    anchor: { x: 0.5, y: 1 },
    offset: { x: 0, y: 0 },
    sheet: {
      columns: 4,
      rows: 8,
      directions: {
        down: 0,
        downLeft: 1,
        left: 2,
        upLeft: 3,
        up: 4,
        upRight: 5,
        right: 6,
        downRight: 7,
      },
    },
    animation: {
      idleFrame: 0,
      walkFrames: [0, 1, 2, 3],
      fastFrameDuration: 0.1,
      slowFrameDuration: 0.22,
      minimumSpeed: 1,
    },
  };
}

function testEightDirectionQuantization() {
  const { Game_Player } = loadGamePlayer();
  const cases = [
    [[0, 1], "down"],
    [[-1, 1], "downLeft"],
    [[-1, 0], "left"],
    [[-1, -1], "upLeft"],
    [[0, -1], "up"],
    [[1, -1], "upRight"],
    [[1, 0], "right"],
    [[1, 1], "downRight"],
  ];

  for (const [[x, y], expected] of cases) {
    assert.equal(Game_Player.directionForVector(x, y), expected);
  }

  assert.equal(Game_Player.directionForVector(0, 0, "upLeft"), "upLeft");
}

function testVelocityControlsFacingAndCadence() {
  const actor = { fieldVisual: fieldProfile() };
  const { Game_Player } = loadGamePlayer({ actor });
  const player = new Game_Player(mapStub());

  player.velocityX = player.maxSpeed;
  player.velocityY = 0;
  player.updateFieldAnimation(0.1);

  assert.equal(player.fieldDirection, "right");
  assert.equal(player.fieldAnimationIndex, 1);
  assert.equal(player.currentFieldFrame(actor.fieldVisual), 1);
  assert.equal(player.fieldFrameDuration(actor.fieldVisual, player.maxSpeed), 0.1);

  const halfSpeedDuration = player.fieldFrameDuration(
    actor.fieldVisual,
    player.maxSpeed / 2,
  );
  assert.ok(halfSpeedDuration > 0.1 && halfSpeedDuration < 0.22);

  player.velocityX = 0;
  player.velocityY = 0;
  player.updateFieldAnimation(0.25);

  assert.equal(player.fieldDirection, "right");
  assert.equal(player.fieldAnimationIndex, 0);
  assert.equal(player.currentFieldFrame(actor.fieldVisual), 0);
}

function testDiagonalVelocityStaysNormalizedByMovementRuntime() {
  const { Game_Player } = loadGamePlayer();
  const player = new Game_Player(mapStub());

  player.updateVelocity(1, 1, 1);

  assert.ok(Math.abs(Math.hypot(player.velocityX, player.velocityY) - player.maxSpeed) < 0.001);
  assert.ok(Math.abs(player.velocityX - player.velocityY) < 0.001);
}

function testFieldSpriteAnchorsToCollisionFeet() {
  const actor = { fieldVisual: fieldProfile() };
  const { Game_Player, drawCalls, fillCalls } = loadGamePlayer({
    actor,
    withImage: true,
  });
  const player = new Game_Player(mapStub());

  player.fieldDirection = "right";
  player.fieldAnimationIndex = 1;
  player.velocityX = 100;
  player.velocityY = 0;
  player.draw(0, 0);

  assert.equal(drawCalls.length, 1);
  assert.equal(fillCalls.length, 0);

  const [, sourceX, sourceY, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight] =
    drawCalls[0];

  assert.equal(sourceX, 64);
  assert.equal(sourceY, 6 * 64);
  assert.equal(sourceWidth, 64);
  assert.equal(sourceHeight, 64);
  assert.equal(drawX, 84);
  assert.equal(drawY, 68);
  assert.equal(drawWidth, 64);
  assert.equal(drawHeight, 64);
}

function testMissingFieldAssetKeepsWhiteSquareFallback() {
  const actor = { fieldVisual: null };
  const { Game_Player, drawCalls, fillCalls } = loadGamePlayer({ actor });
  const player = new Game_Player(mapStub());

  player.draw(10, 20);

  assert.equal(drawCalls.length, 0);
  assert.deepEqual(fillCalls, [[90, 80, 32, 32]]);
}

function run() {
  testEightDirectionQuantization();
  testVelocityControlsFacingAndCadence();
  testDiagonalVelocityStaysNormalizedByMovementRuntime();
  testFieldSpriteAnchorsToCollisionFeet();
  testMissingFieldAssetKeepsWhiteSquareFallback();

  console.log("Field character rendering regression tests passed.");
}

run();
