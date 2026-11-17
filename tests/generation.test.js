const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const html = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const context = vm.createContext({ setTimeout });
vm.runInContext(html.slice(html.indexOf("    const SIZE ="), html.indexOf("    const $ =")), context);
vm.runInContext(html.slice(html.indexOf("    function seededRandom("), html.indexOf("    function emptyState()")), context);

function checkPuzzle({ regions, solution }) {
  assert.equal(regions.length, 64);
  assert.equal(solution.length, 8);
  assert.equal(new Set(solution).size, 8);
  assert.ok(solution.every((col, row) => Number.isInteger(col) && col >= 0 && col < 8 &&
    (row === 0 || Math.abs(col - solution[row - 1]) > 1)));
  assert.equal(new Set(solution.map((col, row) => regions[row * 8 + col])).size, 8);
  assert.ok(regions.every(region => Number.isInteger(region) && region >= 0 && region < 8));
  let singletons = 0;
  for (let region = 0; region < 8; region++) {
    const tiles = regions.flatMap((value, index) => value === region ? [index] : []);
    assert.ok(tiles.length > 0);
    if (tiles.length === 1) singletons++;
    const visited = new Set([tiles[0]]);
    for (const index of visited) {
      const row = Math.floor(index / 8), col = index % 8;
      const neighbors = [];
      if (row > 0) neighbors.push(index - 8);
      if (row < 7) neighbors.push(index + 8);
      if (col > 0) neighbors.push(index - 1);
      if (col < 7) neighbors.push(index + 1);
      neighbors.filter(next => regions[next] === region).forEach(next => visited.add(next));
    }
    assert.equal(visited.size, tiles.length, `Patch ${region} must be connected`);
  }
  assert.ok(singletons <= 2, `Found ${singletons} single-cell patches`);
}

test("daily puzzles have eight dogs, connected patches, at most two singletons, and one solution", async () => {
  for (let month = 1; month <= 12; month++) {
    for (const day of [1, 15, 28]) {
      const key = `2026-${String(month).padStart(2, "0")}-${day === 1 ? "01" : day}`;
      const puzzle = await context.generatePuzzle(key);
      checkPuzzle(puzzle);
      assert.equal(context.countSolutions(puzzle.regions), 1, key);
    }
  }
});

test("both growth modes fill the board and reject excess single-cell patches", () => {
  for (const paired of [true, false]) {
    const random = context.seededRandom(20261117);
    let accepted = 0;
    for (let attempt = 0; attempt < 200; attempt++) {
      const solution = context.makeSolution(random);
      const regions = context.growRegions(solution, random, paired);
      if (regions) {
        accepted++;
        checkPuzzle({ regions, solution });
      }
    }
    assert.ok(accepted > 0, "Growth must produce usable candidates");
  }
});

test("the same date produces the same puzzle", async () => {
  const first = await context.generatePuzzle("2026-11-17");
  const again = await context.generatePuzzle("2026-11-17");
  assert.deepEqual(again, first);
});
