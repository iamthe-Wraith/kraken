#!/usr/bin/env bash

declare -a QUERIES=()

NL=$'\n'

while :
do
    read -p "${NL}Enter the text to query for: " response
    
    QUERIES+=("$response")

    read -p "${NL}Do you have more queries to enter? (Y/n) " moreTickets

    if [ "$moreTickets" = "n" ] || [ "$moreTickets" = "N" ] || [ "$moreTickets" = "no" ] || [ "$moreTickets" = "No" ] || [ "$moreTickets" = "NO" ] ; then
        break;
    fi
done

echo "${NL}verifying ${#QUERIES[@]} queries..."

for value in "${QUERIES[@]}"
do
    logs=$(git log --oneline | grep -E "$value")

    if [ -z "$logs" ]; then
        echo "${NL}[-] Query not found: ${value} ${NL}"
        exit 1
    fi
done

echo "[+] All queries look good"

echo "${NL}Querying logs..."

function join_by { local IFS="$1"; shift; echo "$*"; }

logs=$(git log --oneline | grep -E "$(join_by "|" "${QUERIES[@]}")")

echo "[+] Query complete"

echo "${NL}----------------------------------${NL}"
echo "${logs}"
echo "${NL}----------------------------------${NL}"

read -p "Would you like to create a release PR for these commits? (Y/n) " release

if [ "$release" = "n" ] || [ "$release" = "N" ] || [ "$release" = "no" ] || [ "$release" = "No" ] || [ "$release" = "NO" ] ; then
    echo "${NL}The Kraken will not be released"
    exit 0
fi

# test that gh is installed on host machine
if ! command -v gh &> /dev/null
then
    echo "${NL}[-] In order to create a PR, you must have gh installed on your machine"
    echo "[-] Please visit https://cli.github.com/ to install gh"
    exit 1
fi

read -p "${NL}What branch do you want to release to? " targetBranch

# confirm the target branch exists
if [ -z "$(git ls-remote --heads origin $targetBranch)" ]; then
    echo "${NL}[-] $targetBranch branch not found"
    exit 1
fi

echo "${NL}Creating release branch..."

# create the new release branch from the target branch
git switch $targetBranch
git pull
git switch -c "Release-$(date +'%m-%d-%Y')"
if [ $? -ne 0 ]; then
    echo "${NL}[-] Release branch creation failed"
    exit 1
fi

git push -u origin "Release-$(date +'%m-%d-%Y')"
if [ $? -ne 0 ]; then
    echo "${NL}[-] Release branch push failed"
    exit 1
fi

echo "[+] Release-$(date +'%m-%d-%Y') branch created"

echo "${NL}Cherry picking commits..."

# cherry pick the commits
for value in "${logs[@]}"
do
    commit=$(echo $value | cut -d ' ' -f 1)
    git cherry-pick $commit

    if [ $? -ne 0 ]; then
        continue=""

        while :
        do
            if [ "$continue" = "continue" ]; then
                git cherry-pick --continue
                break
            fi

            if [ "$continue" = "abort" ]; then
                git cherry-pick --abort
                echo "${NL}[-] Cherry pick aborted"
                exit 1
            fi

            if [ "$continue" = "" ]; then
                echo "${NL}Conflict(s) detected."
            else
                echo "${NL}Invalid entry."
            fi

            echo "Please resolve the conflicts and then enter 'continue' to continue cherry-picking"
            read -p "or 'abort' to cancel the cherry-pick : " continue
        done
    fi
done

git push

echo "[+] Commits cherry picked"

echo "${NL}Creating PR..."

# create the PR
gh pr create --base $targetBranch --head "Release-$(date +'%m-%d-%Y')" --title "Release $(date +'%m-%d-%Y')" --body "Release $(date +'%m-%d-%Y')"
if [ $? -ne 0 ]; then
    echo "${NL}[-] PR creation failed"
    exit 1
fi

echo "[+] PR created"

echo "${NL}Release the Kraken!${NL}"