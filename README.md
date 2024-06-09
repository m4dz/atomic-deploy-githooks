# Git Hooks for Atomic Deployment Automation

## Install

1. Clone this repository:
   ```sh
   git clone https://github.com/m4dz/atomic-deploy-githooks.git /usr/src/atomic-deploy-githooks
   ```

2. Create a Git *bare* repository:
   ```sh
   git init --bare my-repo
   ```

3. Delete existing git hooks:
   ```sh
   cd my-repo
   rm -rf hooks
   ```

4. Checkout deploy scripts in bare repo:
   ```sh
   cd /usr/src/atomic-deploy-githooks
   git worktree add /path/to/my-repo/hooks -f main
   ````

5. Initialize the project:
   ```sh
   cd /path/to/my-repo/hooks
   npm ci
   cd ..
   git config dirs.deploy /path/to/production/www-root
   ```

## In your local project

1. Add the bare repo as a Git remote :
   ```sh
   cd /my/awesome/project
   git remote add deploy www@my-container:/path/to/my-repo
   ```

2. Each time you want to deploy a branch, push it to the `deploy` remote:
   ```sh
   git push deploy my/new-branch
   ```

## More

See the talk about atomic deployment as Git hooks at https://m4dz.net/t/atomic-deployment-for-js/
