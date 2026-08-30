import { expect, test } from "bun:test";

// Smoke test for the harness itself, not Custodian's own app (none exists yet,
// see CLAUDE.md). Uses Bun.WebView — Bun's built-in browser-automation primitive
// (experimental as of Bun 1.3.x). On macOS it drives WKWebView; on Linux/Windows
// it drives an installed Chrome-family browser over CDP.

test("a real page loads and has the expected title", async () => {
  await using view = new Bun.WebView();
  await view.navigate("https://example.com/");
  const title = await view.evaluate("document.title");
  expect(title).toBe("Example Domain");
});

test("a real page renders to a real screenshot", async () => {
  await using view = new Bun.WebView();
  await view.navigate("https://example.com/");
  const shot = await view.screenshot();
  expect(shot.type).toBe("image/png");
  expect(shot.size).toBeGreaterThan(1000);
});
