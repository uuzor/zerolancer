#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkgs = {
  config: path.join(root, "packages", "config"),
  shared: path.join(root, "packages", "shared"),
};
const dirs = ["packages/shared", "apps/backend", "apps/oracle", "apps/frontend"];

for (const [name, target] of Object.entries(pkgs)) {
  for (const dir of dirs) {
    const nm = path.join(root, dir, "node_modules");
    const scope = path.join(nm, "@zerolance");
    fs.mkdirSync(scope, { recursive: true });
    const link = path.join(scope, name);
    try {
      const ex = fs.lstatSync(link, { throwIfNoEntry: false });
      if (ex) fs.unlinkSync(link);
      fs.symlinkSync(target, link, "junction");
    } catch {}
  }
}

const buildInfos = [
  "packages/config/tsconfig.tsbuildinfo",
  "packages/shared/tsconfig.tsbuildinfo",
];
for (const f of buildInfos) {
  try { fs.unlinkSync(path.join(root, f)); } catch {}
}
