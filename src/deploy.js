#!/usr/bin/env node

const { exec, spawn } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const readline = require("readline");

const Git = require("nodegit");
const Rsync = require("rsync");
const { rimraf } = require("rimraf");

const repoPath = path.resolve(".");

async function _run(cmd) {
  const child = exec(cmd, (err) => {
    if (err) console.error(err);
  });
  child.stderr.pipe(process.stderr);
  child.stdout.pipe(process.stdout);
  await new Promise((resolve) => child.on("close", resolve));
}

async function _build(workingDir) {
  try {
    await fs.access(path.resolve(workingDir, "package.json"));
    const npm = `npm --prefix ${workingDir}`;
    try {
      fs.access(path.resolve(workingDir, "package-lock.json"));
      await _run(`${npm} install-clean`);
    } catch {
      await _run(`${npm} install`);
    }
    await _run(`${npm} run build --if-present`);
  } catch {
    /* No package.json found, abort build */
  }
}

async function buildWorktree({ repo: bareRepo, rev, ref, revName }) {
  const workingDir = path.join(os.tmpdir(), `git.${revName}`);
  const worktree = await Git.Worktree.add(bareRepo, rev, workingDir);
  const repo = await Git.Repository.open(workingDir);
  await repo.checkoutBranch(ref);
  await _build(workingDir);
  return worktree;
}

async function findMergeBases({ repo, ref }) {
  const refCommit = await repo.getBranchCommit(ref);
  const refs = (await repo.getReferences()).filter((ref) => {
    try {
      Git.Oid.fromString(ref.name().replace(/^refs\/heads\//, ""));
    } catch {
      return true;
    }
  });

  return await Promise.all(
    refs.map(async (tip) => {
      const tipCommit = await repo.getReferenceCommit(tip);
      const baseOid = await Git.Merge.base(
        repo,
        tipCommit.id(),
        refCommit.id(),
      );
      return baseOid;
    }),
  );
}

async function _mkDeployDir({ repo }) {
  const repoConfig = await repo.config();

  let deployDir;
  try {
    deployDir = (await repoConfig.getEntry("dirs.deploy")).value();
  } catch {
    deployDir = path.resolve(repoPath, "../www");
  }
  await fs.mkdir(deployDir, { recursive: true });

  console.log(`Deploy branches to ${deployDir}`);
  return deployDir;
}

async function setupDeployDir({ repo, rsync, ref, rev }) {
  const deployRoot = await _mkDeployDir(arguments[0]);
  const deployDir = path.resolve(deployRoot, rev);

  const refCommit = await repo.getBranchCommit(ref);
  const bases = await findMergeBases(arguments[0]);
  const revisions = refCommit.history();

  const baseCommit = await new Promise((resolve) => {
    revisions.on("commit", async (commit) => {
      const isBase = bases.find((baseOid) => baseOid.equal(commit.id()));

      if (!isBase) return;
      try {
        await fs.access(path.resolve(deployRoot, commit.id().tostrS()));
        resolve(commit.id());
      } catch {
        /* Deploy base doesn't exist for this commit, continue... */
      }
    });

    revisions.on("end", () => resolve(false));
    revisions.start();
  });

  if (baseCommit) {
    console.log(
      `Found deploy-base commit ${baseCommit.tostrS().substring(0, 8)}`,
    );
    rsync.set("link-dest", path.resolve(deployRoot, baseCommit.tostrS()));
  }

  rsync.destination(deployDir + path.sep);
  return deployRoot;
}

async function deployWorktree({
  repo,
  worktree,
  rsync,
  rev,
  refName,
  revName,
}) {
  const repoConfig = await repo.config();

  const deployRoot = await setupDeployDir(arguments[0]);
  const appPath = path.resolve(deployRoot, refName);

  let buildDir;
  try {
    buildDir = path.resolve(
      worktree.path(),
      (await repoConfig.getEntry("dirs.build")).value(),
    );
  } catch {
    buildDir = path.resolve(worktree.path());
  }

  rsync
    .set("archive")
    .set("no-times")
    .set("checksum")
    .exclude([".git"])
    .source(buildDir + path.sep);

  try {
    await new Promise((resolve, reject) =>
      rsync.execute((err, code) => (err ? reject(err) : resolve(code))),
    );
  } catch (err) {
    console.log(err);
    return false;
  }

  console.log(`Linking ${refName} -> ${revName}`);
  try {
    await fs.unlink(appPath);
  } catch {
    /* No previous version to unlink, continue... */
  }
  await fs.mkdir(path.dirname(appPath), { recursive: true });
  await fs.symlink(path.resolve(deployRoot, rev), appPath);
  return appPath;
}

async function clean({ worktree }) {
  await rimraf(worktree.path());
  worktree.prune();
}

async function triggerRestart({ appPath }) {
  const port = Math.floor(Math.random() * 1000) + 8000;
  const ip = await new Promise((resolve) => {
    const nets = os.networkInterfaces();
    for (const inet in nets) {
      for (const net of nets[inet]) {
        if (["IPv4", 4].includes(net.family) && !net.internal) {
          resolve(net.address);
        }
      }
    }
  });

  const psList = (await import("ps-list")).default;
  const pids = await psList();
  pids
    .filter((process) => process.cmd.includes(appPath))
    .map(({ pid }) => process.kill(pid));

  console.log(`Restarting app -> http://${ip}:${port}`);
  const server = spawn(
    "npx",
    ["-y", "serve", "-nSL", "-l", `tcp://${ip}:${port}`, appPath],
    { detached: true, stdio: "ignore" },
  );
  server.unref();
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line) => {
  (async () => {
    const [oldRev, newRev, ref] = line.split(" ");
    const repo = await Git.Repository.openBare(repoPath);
    const rsync = new Rsync();
    const props = {
      repo,
      rsync,
      ref,
      rev: newRev,
      refName: ref.substring(11),
      revName: newRev.substring(0, 8),
    };

    console.log(`Working on branch ${ref}`);

    let worktree, appPath;
    try {
      worktree = await buildWorktree(props);
      appPath = await deployWorktree({ ...props, worktree });

      if (appPath) {
        await triggerRestart({ ...props, appPath });
      }
    } finally {
      await clean({ ...props, worktree });
    }
  })();
});
