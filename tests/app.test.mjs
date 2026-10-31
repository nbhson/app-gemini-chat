import { test } from "node:test";
import assert from "node:assert/strict";

// Gán API key giả trước khi import app.js (module throw nếu thiếu key).
process.env.GEMINI_API_KEY = "test-key";

const { AVAILABLE_MODELS, DEFAULT_MODEL, resolveModel } = await import("../app.js");

test("AVAILABLE_MODELS không rỗng và mỗi model có id + label", () => {
  assert.ok(Array.isArray(AVAILABLE_MODELS) && AVAILABLE_MODELS.length > 0);
  for (const m of AVAILABLE_MODELS) {
    assert.ok(typeof m.id === "string" && m.id.length > 0);
    assert.ok(typeof m.label === "string" && m.label.length > 0);
  }
});

test("DEFAULT_MODEL là một trong các model cho phép", () => {
  assert.ok(AVAILABLE_MODELS.some((m) => m.id === DEFAULT_MODEL));
});

test("resolveModel: chấp nhận model trong allowlist, từ chối model lạ (fallback DEFAULT_MODEL)", () => {
  assert.equal(resolveModel(AVAILABLE_MODELS[0].id), AVAILABLE_MODELS[0].id);
  assert.equal(resolveModel("gpt-4o"), DEFAULT_MODEL, "model lạ phải fallback về default, không proxy tự do");
  assert.equal(resolveModel(undefined), DEFAULT_MODEL);
  assert.equal(resolveModel("__proto__"), DEFAULT_MODEL);
});
