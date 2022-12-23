#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

sed -i .bak \
    -e "s/firefox_//" \
    -e 's/version": 3/version": 2/' \
    -e 's/action":/page_action":/' \
    manifest.json
