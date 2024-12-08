---
author: Emeric & Mads
date: dd MMM YYYY
---

# Atomic Deployment pour DevOps à barbe blanche 🎅

*Atelier TZ*

---

# tl;dr

- **Atomic deployment** - Make updates available only when they are complete and totally in place.
- **Immutable deployment** - Guarantee the integrity of previous deploys by insulating them from future actions.

-> https://www.netlify.com/blog/2021/02/23/terminology-explained-atomic-and-immutable-deploys/

---

# The ~~Hipster~~ **DevOps** Way

- Atomic/Immutable Deployment
- Any Hosting Provider
- Easy DX `git push origin`

---

# Convention-over-Configuration

```sh
$ git config --local --list
core.repositoryformatversion=0
core.filemode=true
core.bare=true
core.ignorecase=true
core.precomposeunicode=true
```

---

# UNIX Hardlinks

> A hard link to a file points to the inode of the file instead of pointing to the file itself.
> This way the hard link gets all the attributes of the original file and points to the same data block
> as the original file.

-> https://linuxhandbook.com/hard-link/

---

# Go !

```sh
curl -fsSL https://m4dz.net/gitops/install | bash -s -
```

---

# Step 0 - Readline

```js
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line) => {
  (async () => {
    const [oldRev, newRev, ref] = line.split(" ");
  })()
})
```

---

# Step 1 - Init

1. Ouvrir un bare repo
   ```js
   Git.Repository.openBare(path);
   ```

2. Initialiser Rsync
   ```js
   new Rsync()
   ```

3. Props
   ```js
   {
     repo,
     rsync,
     ref,
     rev: newRev,
     refName: ref.substring(11),
     revName: newRev.substring(0, 8),
   };
   ```

---

# Step 2 - `buildWorktree({...})`

## Fonctions utiles
```js
Git.Worktree.add()     // -> instancier un nouveau worktree
Git.Repository.open()  // -> ouvrir un worktree / répertoire de travail
repo.checkoutBranch()  // -> :)

os.tmpdir()            // -> retourne le chemin vers le répertoire temporaire
```

## ToDo
1. Créer un chemin vers un répertoire temporaire
2. Ouvrir un Worktree temporaire
3. Checkout le projet dans le worktree
4. Lancer le build `npm` :
   ```js
   _build(workingDir)
   ```

---

# Interlude - Git Find Common Ancestor

`git merge-base A (B C) M`

```
       o---o---o---o---C
      /                 \
     /   o---o---o---o---B(M)
    /   /
---o---X---o---o---o---A
```

1. Find all branches tips
2. Get merge base commits
2. Iterate over history revisions list from current branch tip
3. If a commit is a merge base 🎉

---

# Step 3 - `deployWorktree({...}):setupDeployDir()`

## Fonctions utiles
```js
rsync.set("link-dest", ...)  // -> Indique le répertoire source des hard-links
rsync.destination()          // -> Indique le répertoire de destination
```

## ToDo
1. Identifier le répertoire cible du déploiement (www / rev)
2. Setup Rsync :
  - si baseCommit : activer les hard-links
  - définir le répertoire cible de déploiement

---

# Step 4 - `deployWorktree({...})`

## Fonctions utiles
```js
repo.config().getEntry('dirs.build')  // -> Récupère une clef de config Git
rsync.set()                           // -> Rsync options
rsync.exclude()                       // -> :)
rsync.source()                        // -> :D
rsync.execute()                       // -> \o/
fs.symlink()                          // -> Créer un lien symbolique
```
  
## ToDo
1. Récupérer le chemin vers le répertoire de l'app buildée
2. Récupérer le chemin vers le root_server web
3. Setup modes Rsync : `archive`, `no-times`, `checksum`, exclude `.git ; et le répertoire source
4. Lier symboliquement le root_server à la cible de déploiement

---

# Step 5 - Exit

1. Clean
2. Relancer les serveurs Web (un par branche pushed)

---

# (You ship it ; you) Run it!

```sh
$ (project) git commit -m "Test Deploy" --allow-empty
$ (project) git push deploy [branch_name]
```

---

# Tips

- Keep It Simple 'n Stupid
- Use `git config` a lot
- Abstract API calls
- Expand your build system

---

# Merci 🙏
