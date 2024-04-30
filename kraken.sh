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

echo "[+] all queries look good"

echo "${NL}querying logs..."

function join_by { local IFS="$1"; shift; echo "$*"; }

logs=$(git log --oneline | grep -E "$(join_by "|" "${QUERIES[@]}")")

echo "[+] query complete"

echo "${NL}----------------------------------${NL}"
echo "${logs}"
echo "${NL}----------------------------------${NL}"

echo "Release the Kraken!"
