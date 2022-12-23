#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

sed -i .bak -e "s/chrome_//" manifest.json
