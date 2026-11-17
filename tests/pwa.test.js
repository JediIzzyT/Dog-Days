const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

function worker(scope = "https://example.com/dog-days/") {
  const handlers = {};
  const stores = new Map();
  const network = [];
  let claimed = false;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async addAll(urls) {
          for (const url of urls) entries.set(url, new Response(url));
        },
        async match(key) { return entries.get(key)?.clone(); }
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); }
  };
  vm.runInNewContext(readFileSync(path.join(root, "sw.js"), "utf8"), {
    URL,
    caches,
    self: {
      registration: { scope },
      clients: { async claim() { claimed = true; } },
      addEventListener(type, handler) { handlers[type] = handler; }
    },
    async fetch(request) {
      network.push(request.url);
      throw new Error("Offline");
    }
  });
  return {
    stores, caches, network,
    get claimed() { return claimed; },
    async dispatch(type) {
      let promise;
      handlers[type]({ waitUntil(value) { promise = value; } });
      await promise;
    },
    fetch(url, mode = "navigate", method = "GET") {
      let response;
      handlers.fetch({
        request: { url, mode, method },
        respondWith(value) { response = value; }
      });
      return response;
    }
  };
}

test("install metadata points to correctly sized, local PNG icons", () => {
  const manifest = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.name, "Dog Days");
  assert.equal(manifest.short_name, "Dog Days");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  for (const icon of [...manifest.icons, { src: "./icons/apple-touch-icon.png", sizes: "180x180" }]) {
    const png = readFileSync(path.join(root, icon.src));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});

test("offline reloads work at root and subdirectory URLs, including queries", async () => {
  for (const scope of ["https://example.com/", "https://example.com/dog-days/"]) {
    const app = worker(scope);
    await app.dispatch("install");
    for (const url of [scope, `${scope}?source=homescreen`, `${scope}index.html?day=today`]) {
      assert.equal(await (await app.fetch(url)).text(), `${scope}index.html`);
    }
    assert.deepEqual(app.network, []);
  }
});

test("every install asset is cached for offline use", async () => {
  const app = worker();
  await app.dispatch("install");
  const entries = [...app.stores.values()][0];
  assert.equal(entries.size, 6);
  for (const url of entries.keys()) {
    assert.equal(await (await app.fetch(url, "cors")).text(), url);
  }
  assert.deepEqual(app.network, []);
});

test("unrelated requests and non-GET requests are not intercepted", async () => {
  const app = worker();
  for (const url of [
    "https://elsewhere.example/dog-days/",
    "https://example.com/another-app/",
    "https://example.com/dog-days/missing.html"
  ]) {
    assert.equal(app.fetch(url), undefined);
  }
  assert.equal(app.fetch("https://example.com/dog-days/index.html", "cors", "POST"), undefined);
});

test("activation removes old game caches but preserves unrelated caches", async () => {
  const app = worker();
  await app.dispatch("install");
  const current = [...app.stores.keys()][0];
  await app.caches.open("dog-days-shell:https://example.com/dog-days/:old");
  await app.caches.open("dog-days-shell:https://example.com/another-path/:v1");
  await app.caches.open("another-app");
  await app.dispatch("activate");
  assert.deepEqual([...app.stores.keys()], [current, "dog-days-shell:https://example.com/another-path/:v1", "another-app"]);
  assert.equal(app.claimed, true);
});

test("a failed precache rejects installation without deleting the working cache", async () => {
  const app = worker();
  const previous = "dog-days-shell:https://example.com/dog-days/:old";
  await app.caches.open(previous);
  app.caches.open = async () => ({
    async addAll() { throw new Error("Download failed"); }
  });
  await assert.rejects(app.dispatch("install"), /Download failed/);
  assert.equal(app.stores.has(previous), true);
  assert.equal(app.claimed, false);
});
