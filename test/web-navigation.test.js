import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { createElement, act, useState } from "react";
// React's input-event feature detection must see a DOM when it initializes.
const initialDom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = initialDom.window;
globalThis.document = initialDom.window.document;
const { render, fireEvent, waitFor, cleanup, within } =
  await import("@testing-library/react");
initialDom.window.close();

// Exercise React navigation without a browser, real Telegram credentials or network.
const target = resolve("node_modules/.cache/farosat-tests/App.mjs");
const bundle = await build({
  entryPoints: ["web/App.tsx", "web/PackageCarousel.tsx"],
  outdir: resolve("node_modules/.cache/farosat-tests"),
  outExtension: { ".js": ".mjs" },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  packages: "external",
  jsx: "automatic",
  loader: { ".css": "empty" },
  plugins: [
    {
      name: "ignore-font-css",
      setup(builder) {
        builder.onResolve({ filter: /^@fontsource/ }, () => ({
          path: "font-css",
          namespace: "empty-css",
        }));
        builder.onLoad({ filter: /.*/, namespace: "empty-css" }, () => ({
          contents: "",
          loader: "js",
        }));
      },
    },
  ],
});
await mkdir(resolve("node_modules/.cache/farosat-tests"), { recursive: true });
await Promise.all(
  bundle.outputFiles.map((file) => writeFile(file.path, file.text)),
);
const { App } = await import(pathToFileURL(target).href);
const { PackageCarousel } = await import(
  pathToFileURL(
    resolve("node_modules/.cache/farosat-tests/PackageCarousel.mjs"),
  ).href
);

const dashboard = {
  stats: {
    uniqueUsers: 2,
    totalPlayers: 2,
    groups: 1,
    privateChats: 1,
    totalGrams: 30,
    paidGrams: 0,
    stars: 0,
    purchases: 0,
    todayPlays: 1,
    todayStars: 0,
    todayGrams: 10,
  },
  activity: [],
  sales: [],
  recent: [],
};
const health = {
  uptime: 120,
  database: "ok",
  inbox: [{ status: "done", count: 2 }],
  outbox: [],
  refunds: [],
  errors: [],
  botUsername: "testbot",
  webAppConfigured: true,
  lastUpdate: "2026-10-02T00:00:00Z",
  lastBackup: null,
};
const roles = {
  owners: ["1"],
  items: [{ user_id: "2", role: "viewer", chat_id: null }],
};

function setup(t, pendingHealth = false, Component = App) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://unit.invalid/",
  });
  const keys = [
    "window",
    "document",
    "location",
    "HTMLElement",
    "navigator",
    "fetch",
    "IS_REACT_ACT_ENVIRONMENT",
  ];
  const previous = new Map(
    keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const key of keys.slice(0, 5))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: dom.window[key],
    });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const invoices = [],
    orders = [],
    searches = [];
  dom.window.Telegram = {
    WebApp: {
      ready() {},
      expand() {},
      setHeaderColor() {},
      setBackgroundColor() {},
      setBottomBarColor() {},
      initData: "unit-test-only",
      openInvoice(url) {
        invoices.push(url);
      },
    },
  };
  let releaseHealth;
  const delayedHealth = new Promise((resolve) => {
    releaseHealth = () => resolve(Response.json(health));
  });
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input), "https://unit.invalid"),
      path = url.pathname;
    if (path === "/api/session")
      return Response.json({
        token: "test-token",
        expires: Date.now() + 3600000,
        role: "owner",
        chat_id: null,
        user: { id: 1, first_name: "Ega" },
        preview: false,
        groups: [
          { chat_id: "-100", title: "Sinov guruhi", type: "supergroup" },
          { chat_id: "-200", title: "Ikkinchi guruh", type: "supergroup" },
        ],
        settings: { maxPurchase: 10000, shopEnabled: true, maintenance: false },
        botUsername: "testbot",
        supportUrl: "",
      });
    if (path === "/api/admin/dashboard") return Response.json(dashboard);
    if (path === "/api/admin/health")
      return pendingHealth ? delayedHealth : Response.json(health);
    if (path === "/api/admin/roles") return Response.json(roles);
    if (path === "/api/admin/players") {
      searches.push(url.searchParams.get("q"));
      return Response.json({ items: [], total: 0 });
    }
    if (path === "/api/me/profile")
      return Response.json({
        player: {
          grams: url.searchParams.get("chatId") === "-200" ? 30 : 10,
          earned_grams: 10,
          paid_grams: 0,
          streak: 1,
          best_streak: 1,
          plays: 1,
        },
        level: { min: 0, name: "Bronza", emoji: "🥉" },
        next: { min: 100, name: "Kumush", emoji: "🥈" },
        alreadyPlayed: true,
        nextPlayAt: new Date(Date.now() + 60000).toISOString(),
        history: [],
        orders: [],
      });
    if (path === "/api/me/orders") {
      const body = JSON.parse(options.body);
      orders.push(body);
      return Response.json({
        id: "test-order",
        status: "pending",
        grams: body.grams,
        stars: body.grams,
        invoice_url: "https://t.me/$unit-test-only",
      });
    }
    throw new Error("Unexpected test request: " + path);
  };
  t.after(() => {
    cleanup();
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return {
    view: render(createElement(Component)),
    releaseHealth,
    invoices,
    orders,
    searches,
  };
}

test("admin menus render after changing between dashboard, system and roles", async (t) => {
  const { view } = setup(t);
  await waitFor(() => assert.ok(view.getByText("2 ta guruh profili")));
  fireEvent.click(view.getByRole("button", { name: "Adminlar" }));
  await waitFor(() =>
    assert.ok(view.getByRole("heading", { name: "Boshqaruv jamoasi" })),
  );
  fireEvent.click(view.getByRole("button", { name: "Boshqaruv paneli" }));
  await waitFor(() => assert.ok(view.getByText("2 ta guruh profili")));
  for (let i = 0; i < 2; i++) {
    fireEvent.click(view.getByRole("button", { name: "Tizim holati" }));
    await waitFor(() =>
      assert.ok(view.getByRole("heading", { name: "Ulanishlar" })),
    );
    assert.ok(view.getByText("Sog‘lom"));
    fireEvent.click(view.getByRole("button", { name: "Adminlar" }));
    await waitFor(() =>
      assert.ok(view.getByRole("heading", { name: "Boshqaruv jamoasi" })),
    );
    assert.ok(view.getByText("Telegram ID: 2"));
    fireEvent.click(view.getByRole("button", { name: "Boshqaruv paneli" }));
    await waitFor(() => assert.ok(view.getByText("2 ta guruh profili")));
  }
});

function StoreSelection() {
  const [grams, setGrams] = useState(100);
  return createElement(
    "div",
    null,
    createElement(PackageCarousel, { grams, onChange: setGrams }),
    createElement("input", {
      "aria-label": "Maxsus miqdor",
      value: grams,
      onChange: (e) => setGrams(Number(e.target.value)),
    }),
    createElement(
      "output",
      { "data-testid": "checkout" },
      `${grams} g = ${grams} Stars`,
    ),
  );
}
test("package arrows, dots and keyboard keep the selected amount and Stars equal", (t) => {
  const { view } = setup(t, false, StoreSelection);
  fireEvent.click(view.getByRole("button", { name: "Zakovat: 20 gramm" }));
  assert.equal(view.getByTestId("checkout").textContent, "20 g = 20 Stars");
  assert.equal(
    view
      .getByRole("button", { name: "Zakovat: 20 gramm" })
      .getAttribute("aria-pressed"),
    "true",
  );
  fireEvent.click(view.getByRole("button", { name: "Keyingi paket" }));
  assert.equal(view.getByTestId("checkout").textContent, "50 g = 50 Stars");
  fireEvent.keyDown(view.getByRole("region", { name: "Farosat paketlari" }), {
    key: "ArrowLeft",
  });
  assert.equal(view.getByTestId("checkout").textContent, "20 g = 20 Stars");
  fireEvent.click(view.getByRole("button", { name: "Idrok: 10 gramm" }));
  fireEvent.click(view.getByRole("button", { name: "Oldingi paket" }));
  assert.equal(view.getByTestId("checkout").textContent, "500 g = 500 Stars");
  fireEvent.change(view.getByRole("textbox", { name: "Maxsus miqdor" }), {
    target: { value: "37" },
  });
  assert.equal(view.getByTestId("checkout").textContent, "37 g = 37 Stars");
  assert.ok(view.getByText("Sizning tanlovingiz"));
  assert.equal(view.queryAllByRole("button", { pressed: true }).length, 0);
});

test("a delayed system response cannot replace the open roles page", async (t) => {
  const { view, releaseHealth } = setup(t, true);
  await waitFor(() => assert.ok(view.getByText("2 ta guruh profili")));
  fireEvent.click(view.getByRole("button", { name: "Tizim holati" }));
  fireEvent.click(view.getByRole("button", { name: "Adminlar" }));
  await waitFor(() =>
    assert.ok(view.getByRole("heading", { name: "Boshqaruv jamoasi" })),
  );
  await act(async () => releaseHealth());
  assert.ok(view.getByText("Telegram ID: 2"));
  assert.equal(view.queryByRole("heading", { name: "Ulanishlar" }), null);
});

test("case selection submits exactly the displayed grams, group and Stars invoice", async (t) => {
  const { view, orders, invoices } = setup(t);
  await waitFor(() => assert.ok(view.getByText("2 ta guruh profili")));
  fireEvent.click(view.getByRole("button", { name: "Foydalanuvchi oynasi" }));
  await waitFor(() => assert.ok(view.getByText("Bugungi nasiba olingan.")));
  fireEvent.click(view.getByRole("combobox", { name: "Guruhni tanlang" }));
  fireEvent.click(view.getByRole("option", { name: "Ikkinchi guruh" }));
  await waitFor(() => assert.ok(view.getByText("30")));
  fireEvent.click(view.getAllByRole("button", { name: "Qora bozor" })[0]);
  const catalog = within(
    view.getByRole("region", { name: "Keyslar katalogi" }),
  );
  fireEvent.click(catalog.getByRole("button", { name: "Zakovat: 20 gramm" }));
  assert.equal(
    view.getByRole("spinbutton", { name: "Farosat miqdori" }).value,
    "20",
  );
  const buy = view.getByRole("button", { name: /^Sotib olish/ });
  assert.equal(buy.disabled, true);
  fireEvent.click(view.getByRole("checkbox"));
  assert.equal(buy.disabled, false);
  fireEvent.change(view.getByRole("spinbutton", { name: "Farosat miqdori" }), {
    target: { value: "0" },
  });
  assert.equal(buy.disabled, true);
  fireEvent.click(catalog.getByRole("button", { name: "Zakovat: 20 gramm" }));
  fireEvent.click(buy);
  await waitFor(() => assert.equal(invoices.length, 1));
  assert.deepEqual(orders, [{ chatId: "-200", grams: 20, acceptTerms: true }]);
});

test("group menu supports keyboard selection, dismissal and home shows no case artwork", async (t) => {
  const { view } = setup(t);
  await waitFor(() => assert.ok(view.getByText("2 ta guruh profili")));
  fireEvent.click(view.getByRole("button", { name: "Foydalanuvchi oynasi" }));
  await waitFor(() => assert.ok(view.getByText("Bugungi nasiba olingan.")));
  assert.equal(view.container.querySelectorAll(".case-art").length, 0);
  const picker = view.getByRole("combobox", { name: "Guruhni tanlang" });
  fireEvent.keyDown(picker, { key: "ArrowDown" });
  assert.equal(picker.getAttribute("aria-expanded"), "true");
  fireEvent.keyDown(picker, { key: "ArrowDown" });
  fireEvent.keyDown(picker, { key: "Enter" });
  await waitFor(() => assert.ok(view.getByText("30")));
  assert.ok(picker.textContent.includes("Ikkinchi guruh"));
  assert.equal(picker.getAttribute("aria-expanded"), "false");
  fireEvent.click(picker);
  fireEvent.keyDown(picker, { key: "Escape" });
  assert.equal(view.queryByRole("listbox"), null);
  fireEvent.click(picker);
  fireEvent.pointerDown(document.body);
  assert.equal(view.queryByRole("listbox"), null);
});

test("header search opens the players list with the submitted query", async (t) => {
  const { view, searches } = setup(t);
  await waitFor(() => assert.ok(view.getByText("2 ta guruh profili")));
  fireEvent.change(
    view.getByRole("textbox", { name: "Foydalanuvchini tezkor qidirish" }),
    { target: { value: "Ali" } },
  );
  fireEvent.submit(view.getByRole("search"));
  await waitFor(() => assert.ok(searches.includes("Ali")));
  assert.equal(view.getByRole("textbox", { name: "Qidirish" }).value, "Ali");
});
