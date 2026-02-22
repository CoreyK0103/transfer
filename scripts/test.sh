#!/bin/bash

res=$(curl -X POST $1 \
  -H "Content-Type: application/json" \
  -d '{
    "filename":"test.txt",
    "contentType":"text/plain",
    "recipientEmail":"coreyjknight@outlook.com"
  }')

uploadUrl=$(jq -r '.uploadUrl' <<< "$res")

curl -T test.txt "$uploadUrl"
