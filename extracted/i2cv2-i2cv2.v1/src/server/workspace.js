const { execFile } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const TERRAFORM_BIN = "terraform";

const VALID_AWS_REGION = /^[a-z]{2}-[a-z]+-\d{1,2}$/;

function sanitizeHclString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "$$$$").replace(/%/g, "%%");
}

function validateFilename(name) {
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    throw new Error(`Invalid filename: ${name}`);
  }
  if (!/^[a-zA-Z0-9_.-]+\.(tf|tfvars)$/.test(name)) {
    throw new Error(`Invalid Terraform filename: ${name}`);
  }
  return name;
}

function runTerraform(args, cwd, { timeout = 120_000, signal, env } = {}) {
  return new Promise((resolve, reject) => {
    const execEnv = env ? { ...process.env, ...env } : undefined;
    const proc = execFile(TERRAFORM_BIN, args, { cwd, timeout, maxBuffer: 10 * 1024 * 1024, env: execEnv }, (err, stdout, stderr) => {
      if (err) {
        const combined = `${stdout}\n${stderr}`.trim();
        const error = new Error(`terraform ${args[0]} failed: ${combined}`);
        error.stdout = stdout;
        error.stderr = stderr;
        error.exitCode = err.code;
        return reject(error);
      }
      resolve({ stdout, stderr });
    });

    if (signal) {
      if (signal.aborted) {
        proc.kill("SIGTERM");
        return reject(new Error("Aborted before terraform started"));
      }
      signal.addEventListener("abort", () => {
        proc.kill("SIGTERM");
      }, { once: true });
    }
  });
}

async function createWorkspace({ region, resources, runId }) {
  if (!VALID_AWS_REGION.test(region)) {
    throw new Error(`Invalid AWS region: ${region}`);
  }

  const id = runId || crypto.randomUUID();
  const dir = path.join(os.tmpdir(), `i2c-workspace-${id}`);
  await fs.mkdir(dir, { recursive: true });

  const providerTf = [
    'terraform {',
    '  required_providers {',
    '    aws = {',
    '      source  = "hashicorp/aws"',
    '      version = ">= 5.0.0, < 6.0.0"',
    '    }',
    '  }',
    '}',
    '',
    'provider "aws" {',
    `  region = "${sanitizeHclString(region)}"`,
    '}',
    '',
  ].join("\n");

  const importBlocks = resources.map((r) => [
    "import {",
    `  to = ${r.tfType}.${r.logicalName}`,
    `  id = "${sanitizeHclString(r.importId)}"`,
    "}",
    "",
  ].join("\n")).join("\n");

  await Promise.all([
    fs.writeFile(path.join(dir, "main.tf"), providerTf),
    fs.writeFile(path.join(dir, "imports.tf"), importBlocks),
  ]);

  return { id, dir };
}

async function getTerraformVersion() {
  const result = await runTerraform(["version", "-json"], ".", { timeout: 10_000 });
  const info = JSON.parse(result.stdout);
  return { terraform: info.terraform_version, providers: info.provider_selections || {} };
}

async function initWorkspace(dir, { signal, upgrade, env } = {}) {
  const args = ["init", "-no-color", "-input=false"];
  if (upgrade) args.push("-upgrade");
  return runTerraform(args, dir, { timeout: 180_000, signal, env });
}

async function planGenerateConfig(dir, { signal, env } = {}) {
  const generatedPath = path.join(dir, "generated.tf");
  try {
    await fs.unlink(generatedPath);
  } catch {}
  let result;
  try {
    result = await runTerraform(
      ["plan", "-generate-config-out=generated.tf", "-no-color", "-input=false"],
      dir,
      { timeout: 300_000, signal, env },
    );
  } catch (err) {
    result = { stdout: err.stdout || "", stderr: err.stderr || "" };
  }
  let generated = "";
  try {
    generated = await fs.readFile(generatedPath, "utf8");
  } catch {}
  return { ...result, generated };
}

function isImportOnly(stdout) {
  const match = (stdout || "").match(
    /Plan:\s+(\d+) to import,\s+(\d+) to add,\s+(\d+) to change,\s+(\d+) to destroy/,
  );
  if (!match) return false;
  return Number(match[1]) > 0 && Number(match[2]) === 0 && Number(match[3]) === 0 && Number(match[4]) === 0;
}

function isAcceptablePlan(stdout) {
  if (isImportOnly(stdout)) return true;
  const match = (stdout || "").match(
    /Plan:\s+(\d+) to import,\s+(\d+) to add,\s+(\d+) to change,\s+(\d+) to destroy/,
  );
  if (!match) return false;
  // Accept: imports present, no additions or destructions, only in-place changes
  return Number(match[1]) > 0 && Number(match[2]) === 0 && Number(match[4]) === 0;
}

async function plan(dir, { signal, env } = {}) {
  return runTerraform(["plan", "-no-color", "-input=false", "-detailed-exitcode"], dir, { timeout: 300_000, signal, env }).then(
    (result) => ({ ...result, clean: true }),
    (err) => {
      if (err.exitCode === 1 || err.exitCode === 2) {
        const clean = err.exitCode === 2 && isAcceptablePlan(err.stdout);
        return { stdout: err.stdout || "", stderr: err.stderr || "", clean };
      }
      throw err;
    },
  );
}

async function readWorkspaceFiles(dir) {
  const entries = await fs.readdir(dir);
  const tfFiles = entries.filter((f) => f.endsWith(".tf") || f.endsWith(".tfvars"));
  const files = {};
  for (const name of tfFiles) {
    files[name] = await fs.readFile(path.join(dir, name), "utf8");
  }
  return files;
}

async function writeWorkspaceFiles(dir, files) {
  const writes = Object.entries(files).map(([name, content]) =>
    fs.writeFile(path.join(dir, validateFilename(name)), content),
  );
  await Promise.all(writes);
}

async function destroyWorkspace(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {}
}

module.exports = {
  createWorkspace,
  getTerraformVersion,
  initWorkspace,
  planGenerateConfig,
  plan,
  readWorkspaceFiles,
  writeWorkspaceFiles,
  destroyWorkspace,
  validateFilename,
};
