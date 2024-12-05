#!/usr/bin/env node
import { clean, triggerRestart, findMergeBases } from './solutions'

const { exec, spawn } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const readline = require("readline");

const Git = require("nodegit");
const Rsync = require("rsync");
const { rimraf } = require("rimraf");

const repoPath = path.resolve(".");

async function buildWorktree({ repo: bareRepo, rev, ref, revName }) {}

async function setupDeployDir({ repo, rsync, ref, rev }) {
  const deployRoot = await _mkDeployDir(arguments[0]);
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

  /* -- Complete the function from here -- */

  if (baseCommit) {
    console.log(
        `Found deploy-base commit ${baseCommit.tostrS().substring(0, 8)}`,
    );
  }
}

async function deployWorktree({ repo, worktree, rsync, rev, refName, revName }) {
  const repoConfig = await repo.config();

  const deployRoot = await setupDeployDir(arguments[0]);
  /* -- Complete the function from here -- */
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line) => {
  (async () => {
    const [oldRev, newRev, ref] = line.split(" ");
    // init variables here...

    console.log(`Working on branch ${ref}`);

    /* -- Main script -- */
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
