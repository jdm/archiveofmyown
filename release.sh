#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

. ${1}.sh
zip -r archiveofmyown-${1}.zip *.html *.js *.png *.json
git checkout manifest.json
rm manifest.json.bak
