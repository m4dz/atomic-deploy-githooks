#!/bin/bash

GIT_DIR=`dirname $(cd -- ${0%/*} >/dev/null 2>&1; pwd -P)`
pushd $GIT_DIR >/dev/null

DEPLOY_DIR=`git config --local dirs.deploy`
echo "Deploy branches to ${DEPLOY_DIR:=$(dirname $GIT_DIR)/www}"
mkdir -p $DEPLOY_DIR

while read oldrev newrev ref
do
	echo "Working on branch ${ref}"

	revlist=(`git rev-list $ref main`)
	for rev in ${revlist[@]:1}
	do
		if git merge-base --is-ancestor $rev $ref
		then
			grep -r $rev refs/heads/* >/dev/null && \
			test -d ${DEPLOY_DIR}/${rev} && \
			break
		fi
		unset rev
	done

	REF_NAME=${ref:10}
	REV_NAME=${newrev:0:8}
	WORK_DIR=`mktemp -d`
	PROD_LNK=${DEPLOY_DIR}${REF_NAME}

	git worktree add $WORK_DIR $ref
	pushd $WORK_DIR >/dev/null
	
	BUILD_DIR="/$(git config --local dirs.build)"
	if test -f "./package.json"
	then
		test -f "./package-lock.json" && npm install-clean || npm install
		npm run build --if-present
	fi

	if [[ -n $rev ]]
	then
		echo "Found deploy-base commit ${rev:0:8}"
		rsync_opts="--link-dest ${DEPLOY_DIR}/${rev}"
	fi

	echo "Deploying ${SRC_DIR:=${WORK_DIR}${BUILD_DIR%/}} -> ${DST_DIR:=${DEPLOY_DIR}/${newrev}}"
	rsync -a --no-times --exclude '.git' --checksum ${rsync_opts[@]} ${SRC_DIR}/ ${DST_DIR}/
	
	popd >/dev/null
	git worktree remove $WORK_DIR

	echo "Linking ${REF_NAME} -> ${REV_NAME}"
	mkdir -p ${PROD_LNK%/*}
	ln -sfn ${DST_DIR%/} $PROD_LNK

	port=$(expr 8000 + $RANDOM % 100)
	echo "Restarting app -> http://localhost:${port}"
	pkill -lf $PROD_LNK >/dev/null 2>&1
	(nohup npx -y serve -nSL -p $port "${PROD_LNK}" > /dev/null 2>&1 & disown)
done
