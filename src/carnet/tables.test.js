import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { TABLES, tableNames, childrenOf, realtimeTables, ownerOf, isPrivate } from "./tables.js";

// Le registre doit dire la même chose que la base : on le confronte à supabase/schema.sql.
const sql = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");
const created = [...sql.matchAll(/create table public\.(\w+)\s*\(([\s\S]*?)\n\);/g)].map(m => ({ name: m[1], body: m[2] }));
const policies = [...sql.matchAll(/create policy "[^"]*" on public\.(\w+) for (\w+) to authenticated([\s\S]*?);/g)]
  .map(m => ({ table: m[1], cmd: m[2], text: m[3] }));
const ownerCheck = owner => new RegExp(`${owner} = \\(select auth\\.jwt\\(\\) ->> 'email'\\)`);

describe("registre des tables ↔ schema.sql", () => {
  it("lists exactly the tables the schema creates", () => {
    expect(tableNames.slice().sort()).toEqual(created.map(t => t.name).sort());
  });

  it("each « on delete cascade » is a dependency in the registry, and the other way round", () => {
    const fromSchema = created.flatMap(t => [...t.body.matchAll(/(\w+) uuid not null references public\.(\w+)\(id\) on delete cascade/g)]
      .map(m => `${m[2]} → ${t.name}.${m[1]}`));
    const fromRegistry = tableNames.flatMap(p => childrenOf(p).map(([child, key]) => `${p} → ${child}.${key}`));
    expect(fromRegistry.sort()).toEqual(fromSchema.sort());
  });

  it("realtime tables are those added to the supabase_realtime publication", () => {
    const published = [...sql.matchAll(/alter publication supabase_realtime add table ([^;]+);/g)]
      .flatMap(m => m[1].split(",").map(s => s.trim().replace("public.", "")));
    expect(realtimeTables.slice().sort()).toEqual(published.sort());
  });

  it("private tables only let each Membre see and write their own rows", () => {
    for (const t of tableNames.filter(isPrivate)) {
      const own = policies.filter(p => p.table === t);
      expect(own.length, t).toBeGreaterThan(0);
      for (const p of own) expect(p.text, `${t} ${p.cmd}`).toMatch(ownerCheck(ownerOf(t)));
    }
  });

  it("shared tables with an owner: everyone reads, only the owner writes", () => {
    for (const t of tableNames.filter(t => ownerOf(t) && !isPrivate(t))) {
      const own = policies.filter(p => p.table === t);
      expect(own.some(p => p.cmd === "select" && !ownerCheck(ownerOf(t)).test(p.text)), `${t} select`).toBe(true);
      for (const p of own.filter(p => p.cmd !== "select")) expect(p.text, `${t} ${p.cmd}`).toMatch(ownerCheck(ownerOf(t)));
    }
  });

  it("describes every table with known keys only", () => {
    const keys = new Set(["kind", "parent", "owner", "private", "realtime", "sort", "author"]);
    for (const [name, t] of Object.entries(TABLES)) for (const k of Object.keys(t)) expect(keys.has(k), `${name}.${k}`).toBe(true);
  });
});
