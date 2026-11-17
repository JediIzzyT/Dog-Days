const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

function game(marks = []) {
  const html = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const timers = new Map(), handlers = {}, elements = {};
  let nextTimer = 0, saved;
  const cells = Array.from({ length: 64 }, () => {
    const classes = new Set(), symbol = {}, attributes = {};
    let updates = 0;
    return {
      symbol, attributes, get updates() { return updates; },
      classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        toggle(name, enabled) { updates++; enabled ? classes.add(name) : classes.delete(name); }
      },
      querySelector() { return symbol; },
      setAttribute(name, value) { attributes[name] = value; }
    };
  });
  const state = { dogs: [], marks: [...marks], wrong: [], hearts: 3, outcome: null };
  const context = vm.createContext({
    state, cells, pendingTap: null, undoStack: [], loadingPuzzle: false, displayedHearts: -1,
    SIZE: 8, COLOR_NAMES: ["sage"],
    puzzle: { regions: Array(64).fill(0), solution: Array(8).fill(2) },
    $: id => elements[id] ||= {
      setAttribute() {},
      addEventListener(type, handler) { handlers[id] = handler; }
    },
    elapsed: () => 0, formatTime: () => "0:00",
    save() { saved = JSON.stringify(state); },
    showStatus(text) { elements.status = text; },
    finish(outcome) { state.outcome = outcome; },
    showResult() {},
    setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout(id) { timers.delete(id); }
  });
  const start = html.indexOf("    function render(indices) {");
  const end = html.indexOf("    function finish(outcome) {", start);
  assert.ok(start !== -1 && end !== -1);
  vm.runInContext(html.slice(start, end), context);
  const undoStart = html.indexOf('    $("undo").addEventListener("click",');
  const undoEnd = html.indexOf('    $("restart").addEventListener', undoStart);
  vm.runInContext(html.slice(undoStart, undoEnd), context);
  return {
    context, cells, state, elements,
    tap(index) { context.handleTap(index); },
    expire() {
      for (const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    },
    undo() { handlers.undo(); },
    get saved() { return JSON.parse(saved); }
  };
}

test("render updates only the cells whose state changed", () => {
  const app = game();
  app.context.render([7]);
  assert.equal(app.cells[7].updates, 3);
  assert.equal(app.cells.filter(cell => cell.updates > 0).length, 1);
});

test("a single tap renders and saves its mark before the double-tap window expires", () => {
  const app = game();
  app.tap(0);
  assert.deepEqual(app.state.marks, [0]);
  assert.equal(app.cells[0].symbol.textContent, "\u00d7");
  assert.match(app.cells[0].attributes["aria-label"], /marked empty$/);
  assert.deepEqual(app.saved.marks, [0]);
  assert.equal(app.elements.undo.disabled, false);
  app.expire();
  assert.deepEqual(app.state.marks, [0]);
});

test("tapping a marked tile clears it immediately and undo restores it", () => {
  const app = game([0]);
  app.tap(0);
  assert.equal(app.state.marks.length, 0);
  assert.equal(app.cells[0].symbol.textContent, "");
  app.undo();
  assert.deepEqual([...app.state.marks], [0]);
  app.expire();
  assert.deepEqual([...app.state.marks], [0]);
});

test("double-tapping places a dog without leaving a mark or an undo entry", () => {
  for (const marks of [[], [2]]) {
    const app = game(marks);
    app.tap(2);
    app.tap(2);
    app.expire();
    assert.deepEqual(app.state.dogs, [2]);
    assert.equal(app.state.marks.length, 0);
    assert.equal(app.context.undoStack.length, 0);
    assert.equal(app.state.hearts, 3);
    assert.equal(app.cells[2].symbol.textContent, "\ud83d\udc36");
  }
});

test("an incorrect double-tap costs one heart and cannot be undone as a mark", () => {
  const app = game();
  app.tap(0);
  app.tap(0);
  app.expire();
  app.undo();
  assert.equal(app.state.hearts, 2);
  assert.deepEqual(app.state.wrong, [0]);
  assert.equal(app.state.marks.length, 0);
});

test("rapid taps on different tiles mark each immediately and undo independently", () => {
  const app = game();
  app.tap(0);
  app.tap(1);
  assert.deepEqual(app.state.marks, [0, 1]);
  app.undo();
  assert.deepEqual([...app.state.marks], [0]);
  app.undo();
  app.expire();
  assert.equal(app.state.marks.length, 0);
});

test("a tap after the double-tap window toggles instead of placing a dog", () => {
  const app = game();
  app.tap(2);
  app.expire();
  app.tap(2);
  assert.equal(app.state.marks.length, 0);
  assert.equal(app.state.dogs.length, 0);
  assert.equal(app.state.hearts, 3);
});

test("keyboard marking clears the tap candidate without replaying the first mark", () => {
  const app = game();
  app.tap(0);
  app.context.handleKey({ key: " ", preventDefault() {} }, 1);
  assert.deepEqual(app.state.marks, [0, 1]);
  app.expire();
  assert.deepEqual(app.state.marks, [0, 1]);
  app.context.handleKey({ key: "Enter", preventDefault() {} }, 2);
  assert.deepEqual(app.state.dogs, [2]);
});

test("the seventh dog prompts for one more and the eighth wins", () => {
  const app = game();
  for (let row = 0; row < 7; row++) app.context.placeDog(row * 8 + 2);
  assert.equal(app.state.outcome, null);
  assert.equal(app.elements.status, "One more dog. You've got this.");
  app.context.placeDog(58);
  assert.equal(app.state.dogs.length, 8);
  assert.equal(app.state.outcome, "won");
});

test("result labels change without replacing the replay button's icon", () => {
  const html = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const elements = {};
  const state = { outcome: "won", dogs: Array(8).fill(0), elapsed: 0, hearts: 3 };
  const context = vm.createContext({
    state, SIZE: 8, formatTime: () => "0:00",
    $: id => elements[id] ||= {}
  });
  const start = html.indexOf("    function showResult(focus) {");
  const end = html.indexOf("    function resetGame() {", start);
  assert.ok(start !== -1 && end !== -1);
  vm.runInContext(html.slice(start, end), context);
  context.showResult(false);
  assert.equal(elements["play-again-label"].textContent, "Play this puzzle again");
  assert.equal(elements["play-again"], undefined);
  state.outcome = "lost";
  context.showResult(false);
  assert.equal(elements["play-again-label"].textContent, "Give it another go");
  assert.equal(elements["play-again"], undefined);
});

test("arrow keys stop at the edges of the eight-by-eight board", () => {
  const app = game();
  let focused;
  app.cells.forEach((cell, index) => { cell.focus = () => { focused = index; }; });
  for (const [key, index, expected] of [
    ["ArrowRight", 7, 7], ["ArrowDown", 63, 63],
    ["ArrowLeft", 0, 0], ["ArrowUp", 0, 0],
    ["ArrowDown", 0, 8], ["ArrowUp", 63, 55]
  ]) {
    app.context.handleKey({ key, preventDefault() {} }, index);
    assert.equal(focused, expected);
  }
});
