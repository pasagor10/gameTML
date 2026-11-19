// Only public character fields cross the API boundary.
export function rankCharacters(rows, live = [], metric = "level") {
  if (!["level", "dungeon", "gold"].includes(metric)) throw Error("อันดับไม่ถูกต้อง");
  const all = new Map(rows.map(row => [row.id, { ...JSON.parse(row.state), id: row.id, name: row.name }]));
  for (const p of live) all.set(p.id, p);
  const number = n => Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : 0;
  const entries = [...all.values()].map(p => ({
    id: p.id, name: p.name, class: p.class,
    level: number(p.level), exp: number(p.exp),
    dungeon: Math.max(0, number(p.unlocked || 1) - 1), gold: number(p.gold),
  }));
  entries.sort((a,b) => b[metric] - a[metric] || b.level-a.level || b.exp-a.exp || a.id.localeCompare(b.id));
  return entries.map((p,i) => ({ ...p, place: i+1 }));
}
