import test from "node:test";
import assert from "node:assert/strict";
import { rankCharacters } from "../server/ranking.js";

const row = (id, name, s) => ({ id, name, state: JSON.stringify(s) });

test("ranks by metric, prefers live state, and exposes only public fields", () => {
  const rows = [
    row("a", "Ann", { class: "archer", level: 10, exp: 5, unlocked: 4, gold: 900, password: "x" }),
    row("b", "Bo", { class: "mage", level: 12, exp: 1, unlocked: 2, gold: 100 }),
  ];
  const live = [{ id: "a", name: "Ann", class: "archer", level: 15, exp: 0, unlocked: 6, gold: 50, socket: {} }];
  const byLevel = rankCharacters(rows, live, "level");
  assert.deepEqual(byLevel.map(p => [p.id, p.place, p.level]), [["a", 1, 15], ["b", 2, 12]]);
  assert.deepEqual(Object.keys(byLevel[0]).sort(), ["class", "dungeon", "exp", "gold", "id", "level", "name", "place"]);
  assert.equal(rankCharacters(rows, live, "dungeon")[0].dungeon, 5);
  assert.equal(rankCharacters(rows, live, "gold")[0].id, "b");
  assert.throws(() => rankCharacters(rows, [], "hp"));
});
