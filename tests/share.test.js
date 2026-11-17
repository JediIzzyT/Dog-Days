const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

async function shareResult(href, clipboard, dogs = 8) {
  const html = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const start = html.indexOf('    $("share").addEventListener("click",');
  const end = html.indexOf('    document.addEventListener("visibilitychange",', start);
  assert.ok(start !== -1 && end !== -1, "share handler must exist");

  let handler;
  const elements = {
    share: { addEventListener(type, callback) { handler = callback; } },
    "share-status": {},
    "share-text": { focus() {}, select() {} }
  };
  vm.runInNewContext(html.slice(start, end), {
    $: id => elements[id],
    URL,
    location: { href },
    navigator: { clipboard },
    dateKey: "2026-11-16",
    SIZE: 8,
    state: { outcome: dogs === 8 ? "won" : "lost", dogs: Array(dogs), hearts: 3, elapsed: 42 },
    formatTime: () => "0:42",
    console: { info() {} }
  });
  await handler();
  return elements;
}

test("copied results include the game page without query or fragment", async () => {
  let copied;
  await shareResult("https://example.com/dog-days/index.html?source=home#game", {
    async writeText(text) { copied = text; }
  });
  assert.match(copied, /All dogs home!/);
  assert.equal(copied.split("\n")[2], "\ud83d\udc36".repeat(8));
  assert.ok(copied.endsWith("\nhttps://example.com/dog-days/index.html"));
});

test("unfinished results share exactly eight dog and empty symbols", async () => {
  let copied;
  await shareResult("https://example.com/dog-days/", {
    async writeText(text) { copied = text; }
  }, 3);
  assert.equal(copied.split("\n")[2], "\ud83d\udc36".repeat(3) + "\u25ab\ufe0f".repeat(5));
});

test("manual-copy fallback also includes the page link", async () => {
  const elements = await shareResult("https://example.com/dog-days/", undefined);
  assert.equal(elements["share-text"].hidden, false);
  assert.ok(elements["share-text"].value.endsWith("\nhttps://example.com/dog-days/"));
});
