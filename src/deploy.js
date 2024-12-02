#!/usr/bin/env node
import { clean, triggerRestart } from './solutions'

const { exec, spawn } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const readline = require("readline");

const Git = require("nodegit");
const Rsync = require("rsync");
const { rimraf } = require("rimraf");

const repoPath = path.resolve(".");

async function _run(cmd) {}

async function _build(workingDir) {}

async function buildWorktree({ repo: bareRepo, rev, ref, revName }) {}

async function _mkDeployDir({ repo }) {}

async function setupDeployDir({ repo, rsync, ref, rev }) {}

async function deployWorktree({ repo, worktree, rsync, rev, refName, revName }) {}

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
