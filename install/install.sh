#!/bin/bash

# Remote call: 
# /bin/bash -c "$(curl -fsSL )"

# set -u

abort() {
  printf "%s\n" "$@" >&2
  exit 1
}

if [ -z "${BASH_VERSION:-}" ]
then
  abort "Bash is required to interpret this script."
fi

if [[ -n "${POSIXLY_CORRECT+1}" ]]
then
  abort 'Bash must not run in POSIX mode. Please unset POSIXLY_CORRECT and try again.'
fi

usage() {
  cat <<EOS
GitOps Workshop Initializer
Usage: install.sh [options] [path]
    -h, --help       Display this message.
EOS
  exit "${1:-0}"
}

POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]
do
  case "$1" in
    -h | --help) usage ;;
    *)
      POSITIONAL_ARGS+=("$1") # save positional arg
      shift # past argument
      ;;
    esac
done

if [[ -z "${POSITIONAL_ARGS}" ]]
then
  set -- "${POSITIONAL_ARGS[@]}" # restore positional parameters
fi

# string formatters
if [[ -t 1 ]]
then
  tty_escape() { printf "\033[%sm" "$1"; }
else
  tty_escape() { :; }
fi
tty_mkbold() { tty_escape "1;$1"; }
tty_underline="$(tty_escape "4;39")"
tty_blue="$(tty_mkbold 34)"
tty_red="$(tty_mkbold 31)"
tty_bold="$(tty_mkbold 39)"
tty_reset="$(tty_escape 0)"

shell_join() {
  local arg
  printf "%s" "$1"
  shift
  for arg in "$@"
  do
    printf " "
    printf "%s" "${arg// /\ }"
  done
}

chomp() {
  printf "%s" "${1/"$'\n'"/}"
}

ohai() {
  printf "${tty_blue}==>${tty_bold} %s${tty_reset}\n" "$(shell_join "$@")"
}

warn() {
  printf "${tty_red}Warning${tty_reset}: %s\n" "$(chomp "$1")" >&2
}

execute() {
  if ! "$@"
  then
    abort "$(printf "Failed during: %s" "$(shell_join "$@")")"
  fi
}

MKDIR=("$(command -v mkdir)" "-p")
RENAME=("$(command -v mv)")
GIT=("$(command -v git)")
if [[ -z "$(command -v git)" ]]
then
  abort "You must install Git before using this script."
fi
if [[ -z "$(command -v node)" ]]
then
  abort "You must install Node before attending this workshop."
fi
NPM=("$(command -v npm)")
BARE_INIT=("${GIT[@]}" "init" "--bare")
CONFIG=("${GIT[@]}" "config" "--local")
CLONE=("${GIT[@]}" "clone")
NPM_CI=("${NPM[@]}" "ci")

PWD=$(pwd)
HOOKS_URL="https://github.com/m4dz/atomic-deploy-githooks.git"
PROJECT_URL="https://github.com/Boyadjie/atelier-devops-site.git"

if [[ -z ${1+x} ]]
then
  GITOPS_BASE="${PWD}"
else
  if [[ "${1}" = /* ]]
  then
    GITOPS_BASE="${1}"
  else
    GITOPS_BASE="${PWD}/$1"
  fi
fi

GITOPS_PREFIX="${GITOPS_BASE}/gitops-workshop"

####################################################################### script

directories=(
  repo project www
)
mkdirs=()
for dir in "${directories[@]}"
do
  if ! [[ -d "${GITOPS_PREFIX}/${dir}" ]]
  then
    mkdirs+=("${GITOPS_PREFIX}/${dir}")
  fi
done

ohai "The following new directories will be created:"
printf "%s\n" "${mkdirs[@]}"

if [[ "${#mkdirs[@]}" -gt 0 ]]
then
  execute "${MKDIR[@]}" "${mkdirs[@]}"
fi

repo="${GITOPS_PREFIX}/repo"

ohai "Initializing the bare repository..."
(
  execute "${BARE_INIT[@]}" "${repo}"
) || exit 1

ohai "Retrieving hooks for the demo..."
(
  execute "${RENAME[@]}" "${repo}/hooks" "${repo}/hooks.orig"
  execute "${CLONE[@]}" "--branch" "tz-workshop-2024" "${HOOKS_URL}" "${repo}/hooks"
  cd "${repo}/hooks" >/dev/null || return
  execute "${NPM_CI[@]}"
) || exit 1

server_root="${GITOPS_PREFIX}/www"

ohai "Set configuration for deployment..."
(
  cd "${repo}" >/dev/null || return
  execute "${CONFIG[@]}" "dirs.deploy" "${server_root}"
  execute "${CONFIG[@]}" "dirs.build" "dist"
  echo "$(
    "${CONFIG[@]}" "--list" | grep "dirs"
  )"
) || exit 1

project="${GITOPS_PREFIX}/project"

ohai "Cloning demo project..."
(
  execute "${CLONE[@]}" "${PROJECT_URL}" "${project}"
  cd "${project}" >/dev/null || return
  execute "${NPM_CI[@]}"
) || exit 1

ohai "Linking repo in project as a deployment target..."
(
  cd "${project}" >/dev/null || return
  execute "${GIT[@]}" "remote" "add" "deploy" "${repo}"
  echo "$(
    "${GIT[@]}" "remote" "show" "deploy"
  )"
) || exit 1
