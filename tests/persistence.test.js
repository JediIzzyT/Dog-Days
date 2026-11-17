const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const html = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const storageKey = "dog-days-v2";
const dateKey = "2026-11-16";
const plain = value => JSON.parse(JSON.stringify(value));

function game(store = new Map()) {
  const elements = {}, documentHandlers = {}, windowHandlers = {}, warnings = [], writes = [];
  const document = {
    hidden: false,
    addEventListener(type, handler) { documentHandlers[type] = handler; }
  };
  const context = vm.createContext({
    SIZE: 8, PUZZLE_VERSION: 3, storageKey, dateKey, todayKey: dateKey, firstDateKey: "2026-01-01",
    completionCache: new Map(), storageWarning: false, savedPuzzle: null,
    persistedDateKey: null, legacyPuzzlePending: false,
    runningSince: null, undoStack: [], loadingPuzzle: false,
    puzzle: { solution: Array.from({ length: 8 }, (_, row) => row) },
    document,
    window: { addEventListener(type, handler) { windowHandlers[type] = handler; } },
    localStorage: {
      getItem(key) { return store.get(key) ?? null; },
      setItem(key, value) { writes.push(key); store.set(key, value); }
    },
    console: { warn(...args) { warnings.push(args); } },
    $: id => elements[id] ||= { classList: { toggle() {} } },
    cancelTap() {}, render() {}, renderCalendar() {}
  });
  function run(start, end) {
    const from = html.indexOf(start), to = html.indexOf(end, from);
    assert.ok(from !== -1 && to > from);
    vm.runInContext(html.slice(from, to), context);
  }
  run("    function keyForDate(date) {", "    function renderCalendar() {");
  run("    function emptyState() {", "    function buildBoard() {");
  run('    document.addEventListener("visibilitychange"', "    async function loadPuzzle(");
  run("    function lastPuzzleDate() {", "    loadPuzzle(lastPuzzleDate());");
  context.state = context.emptyState();
  return {
    context, elements, document, warnings, documentHandlers, windowHandlers, writes, store,
    restore() {
      context.undoStack = [];
      context.state = context.loadState();
      return plain(context.state);
    },
    get saved() {
      const saved = JSON.parse(store.get(storageKey));
      for (const [key, value] of store) {
        const match = /^dog-days-puzzle-(\d{4}-\d{2}-\d{2})$/.exec(key);
        if (match) saved.puzzles[match[1]] = JSON.parse(value);
      }
      return saved;
    }
  };
}

test("puzzle snapshots are stored per day without rewriting the archive on each save", () => {
  const app = game();
  app.context.state = playedState();
  app.context.save();
  const puzzleKey = `dog-days-puzzle-${dateKey}`;
  assert.deepEqual(JSON.parse(app.store.get(puzzleKey)).marks, [2, 3]);
  assert.deepEqual(JSON.parse(app.store.get(storageKey)).puzzles, {});
  const metadataWrites = app.writes.filter(key => key === storageKey).length;

  app.context.state.marks = [4];
  app.context.save();
  assert.deepEqual(JSON.parse(app.store.get(puzzleKey)).marks, [4]);
  assert.equal(app.writes.filter(key => key === storageKey).length, metadataWrites);
});

function playedState() {
  return {
    dogs: [0], marks: [2, 3], wrong: [1], hearts: 2,
    elapsed: 125, outcome: null
  };
}

test("browser and PWA sessions restore all progress, undo history, and the selected date", () => {
  const store = new Map();
  const browser = game(store);
  browser.context.state = playedState();
  browser.context.undoStack = [{ index: 2, marked: false }, { index: 3, marked: false }];
  browser.context.save();

  const installed = game(store);
  assert.deepEqual(installed.restore(), playedState());
  assert.deepEqual(plain(installed.context.undoStack), plain(browser.context.undoStack));
  assert.equal(installed.context.lastPuzzleDate(), dateKey);
  assert.equal(browser.saved.version, 2);

  installed.context.state.marks.pop();
  installed.context.undoStack.pop();
  installed.context.save();
  browser.windowHandlers.storage({ key: `dog-days-puzzle-${dateKey}` });
  assert.deepEqual(plain(browser.context.state.marks), [2]);
  assert.equal(browser.context.undoStack.length, 1);
});

test("saving another date preserves prior puzzles and replaying preserves completions", () => {
  const store = new Map();
  const app = game(store);
  app.context.state = playedState();
  app.context.save();
  app.context.recordCompletion();
  app.context.dateKey = "2026-11-15";
  app.restore();
  app.context.state = app.context.emptyState();
  app.context.save();
  assert.deepEqual(app.saved.puzzles[dateKey].dogs, [0]);
  assert.deepEqual(app.saved.puzzles["2026-11-15"].dogs, []);
  assert.equal(app.saved.completed["2026"][319], "1");
  assert.equal(game(store).context.lastPuzzleDate(), "2026-11-15");

  app.context.dateKey = dateKey;
  app.restore();
  app.context.state = app.context.emptyState();
  app.context.save();
  assert.equal(app.saved.completed["2026"][319], "1");
});

test("legacy puzzle progress resets with notice while completion history migrates without cookies", () => {
  const legacyKey = `dog-days-v1-${dateKey}`;
  const historyKey = "dog-days-completed-2026";
  const store = new Map([
    [legacyKey, JSON.stringify(playedState())],
    [historyKey, `01${"0".repeat(364)}`]
  ]);
  const app = game(store);
  Object.defineProperty(app.document, "cookie", {
    get() { throw new Error("Cookies should not be read"); },
    set() { throw new Error("Cookies should not be written"); }
  });
  assert.deepEqual(app.restore(), plain(app.context.emptyState()));
  assert.match(app.elements.status.textContent, /earlier progress has been reset/);
  assert.deepEqual(plain(app.context.undoStack), []);
  app.context.save();
  assert.equal(app.context.readCompletionYear(2026), `01${"0".repeat(364)}`);
  assert.equal(app.saved.completed["2026"], `01${"0".repeat(364)}`);
  assert.equal(app.warnings.length, 0);
  assert.equal(store.has(legacyKey), true);
  assert.equal(store.has(historyKey), true);

  const migrated = game(new Map([[storageKey, store.get(storageKey)]]));
  assert.deepEqual(migrated.restore(), plain(app.context.emptyState()));
  assert.equal(migrated.context.readCompletionYear(2026), `01${"0".repeat(364)}`);
});

test("a migrated reset takes precedence over old progress", () => {
  const store = new Map([[`dog-days-v1-${dateKey}`, JSON.stringify(playedState())]]);
  const app = game(store);
  app.restore();
  app.context.state = app.context.emptyState();
  app.context.save();
  assert.deepEqual(game(store).restore().dogs, []);
});

test("finished wins and losses retain their outcome and final timer", () => {
  for (const outcome of ["won", "lost"]) {
    const store = new Map(), app = game(store);
    app.context.state = outcome === "won"
      ? { dogs: Array.from({ length: 8 }, (_, row) => row * 9), marks: [], wrong: [], hearts: 3, elapsed: 42, outcome }
      : { dogs: [], marks: [], wrong: [1, 2, 3], hearts: 0, elapsed: 42, outcome };
    const expected = plain(app.context.state);
    app.context.save();
    const restored = game(store).restore();
    assert.deepEqual(restored, expected);
    assert.equal(restored.outcome, outcome);
    assert.equal(restored.elapsed, 42);
  }
});

test("a stale window cannot overwrite newer progress before receiving a storage event", () => {
  const store = new Map();
  const first = game(store);
  first.context.save();
  const stale = game(store);
  stale.restore();
  first.context.state = playedState();
  first.context.save();
  stale.context.state.marks = [9];
  stale.context.save();
  assert.deepEqual(stale.saved.puzzles[dateKey].marks, [2, 3]);
  assert.deepEqual(plain(stale.context.state.marks), [2, 3]);
  assert.match(stale.elements["storage-status"].textContent, /another window/);
});

test("hidden pages save immediately and returning pages refresh changed progress", () => {
  const store = new Map();
  const app = game(store);
  app.context.state = playedState();
  app.document.hidden = true;
  app.documentHandlers.visibilitychange();
  assert.deepEqual(app.saved.puzzles[dateKey].marks, [2, 3]);
  const other = game(store);
  other.restore();
  other.context.state.marks = [4];
  other.context.undoStack = [];
  other.context.save();
  app.document.hidden = false;
  app.documentHandlers.visibilitychange();
  assert.deepEqual(plain(app.context.state.marks), [4]);
  app.context.pauseTimer();

  other.context.state.marks = [5];
  other.context.save();
  app.windowHandlers.pageshow();
  assert.deepEqual(plain(app.context.state.marks), [5]);
});

test("invalid saved state or undo history is rejected with a visible warning", () => {
  for (const change of [
    { dogs: [1] }, { marks: [1] }, { marks: [64] }, { hearts: 3 }, { elapsed: -1 },
    { undoStack: [{ index: 64, marked: false }] },
    { undoStack: [{ index: 0, marked: false }] }
  ]) {
    const store = new Map([[storageKey, JSON.stringify({
      version: 2, completed: {}, puzzles: { [dateKey]: { ...playedState(), puzzleVersion: 3, ...change } }
    })]]);
    const app = game(store);
    assert.deepEqual(app.restore().dogs, []);
    assert.match(app.elements["storage-status"].textContent, /couldn't be restored/);
    assert.ok(app.warnings.length);
  }
});

test("old ten-by-ten progress never restores onto the new puzzle and completions survive", () => {
  const store = new Map([[storageKey, JSON.stringify({
    version: 2, completed: { 2026: "1".repeat(366) },
    puzzles: { [dateKey]: playedState() }, lastDate: dateKey
  })]]);
  const app = game(store);
  assert.deepEqual(app.restore(), plain(app.context.emptyState()));
  assert.match(app.elements.status.textContent, /earlier progress has been reset/);
  app.context.save();
  assert.equal(app.saved.puzzles[dateKey].puzzleVersion, 3);
  assert.equal(app.saved.completed[2026], "1".repeat(366));
  const restored = game(store);
  assert.deepEqual(restored.restore(), plain(app.context.emptyState()));
  assert.equal(restored.elements.status, undefined);
});

test("unreadable or unwritable storage reports failure without overwriting existing data", () => {
  const store = new Map([[storageKey, "{invalid"]]);
  const app = game(store);
  app.context.save();
  assert.equal(store.get(storageKey), "{invalid");
  assert.match(app.elements["storage-status"].textContent, /couldn't be saved/);

  const blocked = game();
  blocked.context.localStorage.getItem = () => { throw new Error("Blocked"); };
  blocked.restore();
  assert.match(blocked.elements["storage-status"].textContent, /couldn't be restored/);
  const full = game();
  full.context.localStorage.setItem = () => { throw new Error("Quota exceeded"); };
  full.context.save();
  assert.match(full.elements["storage-status"].textContent, /couldn't be saved/);
  assert.equal(full.context.storageWarning, true);
  assert.equal(full.elements["storage-status"].hidden, false);
});

test("invalid or future last-selected dates fall back to today", () => {
  for (const lastDate of ["2026-02-31", "2027-01-01", "2025-12-31", null]) {
    const app = game(new Map([[storageKey, JSON.stringify({
      version: 2, completed: {}, puzzles: {}, lastDate
    })]]));
    assert.equal(app.context.lastPuzzleDate(), dateKey);
  }
});
