#!/usr/bin/env node
/**
 * License audit (SPEC §9, PRD §11.2 / §24.3).
 *
 * Fails the build if any installed dependency carries a banned license
 * (GPLv3 / AGPL / CPML / CC-BY-NC) or is a banned package. These are excluded from
 * the dependency tree entirely — a match is a hard failure, not a warning.
 *
 * Runs after `npm install`. Walks every package.json under node_modules and checks
 * its declared `license` / `licenses` field plus the package name.
 *
 * NOTE: this covers the JS/npm dependency tree. Piper TTS (GPL-3.0) is a
 * subprocess-only rule enforced separately (SPEC §9); it is not an npm dependency.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Banned SPDX-ish license patterns (case-insensitive). */
const BANNED_LICENSE_PATTERNS = [
  /\bAGPL\b/i, // Plausible etc.
  /\bGPL-?3(\.0)?\b/i, // Neo4j Community, etc. (LGPL is allowed and excluded below)
  /\bGPLv3\b/i,
  /\bCC-BY-NC\b/i, // NLLB-200, Seamless M4T v2
  /\bCPML\b/i, // XTTS v2
  /Coqui Public Model License/i,
  /\bBSL-?1\.1\b/i, // Terraform >= 1.6
  /Business Source License/i,
];

/** LGPL is NOT banned; make sure the GPL-3 pattern never trips on it. */
const ALLOWED_OVERRIDES = [/\bLGPL/i];

/** Banned package names (substring match, case-insensitive). */
const BANNED_PACKAGES = ['neo4j', 'plausible', 'xtts', 'nllb', 'seamless-m4t', 'seamless_m4t'];

function licenseString(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && typeof pkg.license === 'object' && pkg.license.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) {
    return pkg.licenses.map((l) => (typeof l === 'string' ? l : l.type)).join(' OR ');
  }
  return '';
}

function isBannedLicense(license) {
  if (!license) return false;
  if (ALLOWED_OVERRIDES.some((re) => re.test(license))) return false;
  return BANNED_LICENSE_PATTERNS.some((re) => re.test(license));
}

function isBannedName(name) {
  const lower = (name || '').toLowerCase();
  return BANNED_PACKAGES.some((banned) => lower.includes(banned));
}

/** Recursively collect node_modules package.json files (handles scoped + nested). */
function collectPackageDirs(nodeModulesDir, out) {
  if (!existsSync(nodeModulesDir)) return;
  for (const entry of readdirSync(nodeModulesDir)) {
    if (entry === '.bin' || entry === '.cache') continue;
    const full = join(nodeModulesDir, entry);
    if (!safeIsDir(full)) continue;
    if (entry.startsWith('@')) {
      // scope dir → iterate scoped packages
      for (const sub of readdirSync(full)) {
        const scoped = join(full, sub);
        if (safeIsDir(scoped)) {
          out.push(scoped);
          collectPackageDirs(join(scoped, 'node_modules'), out);
        }
      }
    } else {
      out.push(full);
      collectPackageDirs(join(full, 'node_modules'), out);
    }
  }
}

function safeIsDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function main() {
  const nodeModules = join(ROOT, 'node_modules');
  if (!existsSync(nodeModules)) {
    console.log('license-audit: node_modules not found — run `npm install` first. Skipping.');
    process.exit(0);
  }

  const dirs = [];
  collectPackageDirs(nodeModules, dirs);

  const violations = [];
  let scanned = 0;

  for (const dir of dirs) {
    const pkgPath = join(dir, 'package.json');
    if (!existsSync(pkgPath)) continue;
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    } catch {
      continue;
    }
    scanned += 1;
    const license = licenseString(pkg);
    const id = `${pkg.name ?? dir}@${pkg.version ?? '?'}`;
    if (isBannedLicense(license)) {
      violations.push(`${id} — banned license: ${license}`);
    }
    if (isBannedName(pkg.name)) {
      violations.push(`${id} — banned package name`);
    }
  }

  console.log(`license-audit: scanned ${scanned} packages.`);
  if (violations.length > 0) {
    console.error('\nlicense-audit FAILED — banned dependencies present:');
    for (const v of violations) console.error(`  ✗ ${v}`);
    console.error('\nSee SPEC §9 (PRD §11.2) for approved replacements.');
    process.exit(1);
  }
  console.log('license-audit: OK — no banned licenses or packages found.');
}

main();
