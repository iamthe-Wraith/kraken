#!/usr/bin/env bash

more_queries=true
query=""

while $more_queries
do
    echo ""
    question=""
    
    if [[ "$query" = "" ]] ; then
        question="Enter ticket id: (example: DEV-1234) "
    else
        question="Enter another ticket id: "
    fi

    read -p "$question" response
    

    if [[ "$query" = "" ]] ; then
        query="$response"
    else
        query="$query|$response"
    fi

    echo ""
    read -p "Do you have more tickets to enter? (Y/n) " moreTickets

    if [ "$moreTickets" = "n" ] || [ "$moreTickets" = "no" ] || [ "$moreTickets" = "No" ] ; then
        more_queries=false
    fi

    if ! $more_queries ; then
        break;
    fi
done

echo ""
echo "----------------------------------"
echo ""

git log --oneline | grep -E "$query"

echo ""
echo "----------------------------------"
echo ""