import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { createElement, act } from "react";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";

// Exercise React navigation without a browser, real Telegram credentials or network.
const target = resolve("node_modules/.cache/farosat-tests/App.mjs");
const bundle = await build({
  entryPoints: ["web/App.tsx"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  packages: "external",
  jsx: "automatic",
  loader: { ".css": "empty" },
});
await mkdir(resolve("node_modules/.cache/farosat-tests"), { recursive: true });
await writeFile(target, bundle.outputFiles[0].text);
const { App } = await import(pathToFileURL(target).href);

const dashboard = {
  stats: { uniqueUsers: 2, totalPlayers: 2, groups: 1, privateChats: 1,
    totalGrams: 30, paidGrams: 0, stars: 0, purchases: 0, todayPlays: 1,
    todayStars: 0, todayGrams: 10 },
  activity: [], sales: [], recent: [],
};
const health = {
  uptime: 120, database: "ok", inbox: [{ status: "done", count: 2 }],
  outbox: [], refunds: [], errors: [], botUsername: "testbot",
  webAppConfigured: true, lastUpdate: "2026-10-02T00:00:00Z", lastBackup: null,
};
const roles = { owners: ["1"], items: [{ user_id: "2", role: "viewer", chat_id: null }] };

function setup(t, pendingHealth = false) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://unit.invalid/" });
  const keys = ["window", "document", "location", "HTMLElement", "navigator", "fetch", "IS_REACT_ACT_ENVIRONMENT"];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys.slice(0, 5)) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let releaseHealth;
  const delayedHealth = new Promise(resolve => { releaseHealth = () => resolve(Response.json(health)); });
  globalThis.fetch = async input => {
    const path = new URL(String(input), "https://unit.invalid").pathname;
    if (path === "/api/session") return Response.json({
      token: "test-token", expires: Date.now() + 3600000, role: "owner", chat_id: null,
      user: { id: 1, first_name: "Ega" }, preview: false, groups: [], settings: {},
      botUsername: "testbot", supportUrl: "",
    });
    if (path === "/api/admin/dashboard") return Response.json(dashboard);
    if (path === "/api/admin/health") return pendingHealth ? delayedHealth : Response.json(health);
    if (path === "/api/admin/roles") return Response.json(roles);
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
  return { view: render(createElement(App)), releaseHealth };
}

test("admin menus render after changing between dashboard, system and roles", async t => {
  const { view } = setup(t);
  await waitFor(() => assert.ok(view.getByText("2 ta guruh profili")));
  fireEvent.click(view.getByRole("button", { name: "Adminlar" }));
  await waitFor(() => assert.ok(view.getByRole("heading", { name: "Boshqaruv jamoasi" })));
  fireEvent.click(view.getByRole("button", { name: "Umumiy holat" }));
  await waitFor(() => assert.ok(view.getByText("2 ta guruh profili")));
  for (let i = 0; i < 2; i++) {
    fireEvent.click(view.getByRole("button", { name: "Tizim holati" }));
    await waitFor(() => assert.ok(view.getByRole("heading", { name: "Ulanishlar" })));
    assert.ok(view.getByText("Sog‘lom"));
    fireEvent.click(view.getByRole("button", { name: "Adminlar" }));
    await waitFor(() => assert.ok(view.getByRole("heading", { name: "Boshqaruv jamoasi" })));
    assert.ok(view.getByText("Telegram ID: 2"));
    fireEvent.click(view.getByRole("button", { name: "Umumiy holat" }));
    await waitFor(() => assert.ok(view.getByText("2 ta guruh profili")));
  }
});

test("a delayed system response cannot replace the open roles page", async t => {
  const { view, releaseHealth } = setup(t, true);
  await waitFor(() => assert.ok(view.getByText("2 ta guruh profili")));
  fireEvent.click(view.getByRole("button", { name: "Tizim holati" }));
  fireEvent.click(view.getByRole("button", { name: "Adminlar" }));
  await waitFor(() => assert.ok(view.getByRole("heading", { name: "Boshqaruv jamoasi" })));
  await act(async () => releaseHealth());
  assert.ok(view.getByText("Telegram ID: 2"));
  assert.equal(view.queryByRole("heading", { name: "Ulanishlar" }), null);
});
