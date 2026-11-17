const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

function game(marks = []) {
  const html = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const timers = new Map(), handlers = {}, elements = {};
  let nextTimer = 0, saved;
  const cells = Array.from({ length: 100 }, () => {
    const classes = new Set(), symbol = {}, attributes = {};
    return {
      symbol, attributes,
      classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); }
      },
      querySelector() { return symbol; },
      setAttribute(name, value) { attributes[name] = value; }
    };
  });
  const state = { dogs: [], marks: [...marks], wrong: [], hearts: 3, outcome: null };
  const context = vm.createContext({
    state, cells, pendingTap: null, undoStack: [], loadingPuzzle: false,
    SIZE: 10, COLOR_NAMES: ["sage"],
    puzzle: { regions: Array(100).fill(0), solution: Array(10).fill(2) },
    $: id => elements[id] ||= {
      setAttribute() {},
      addEventListener(type, handler) { handlers[id] = handler; }
    },
    elapsed: () => 0, formatTime: () => "0:00",
    save() { saved = JSON.stringify(state); },
    showStatus() {},
    setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout(id) { timers.delete(id); }
  });
  const start = html.indexOf("    function render() {");
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
