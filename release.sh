#!/bin/bash

sed -i .bak -e "s/$1_//" manifest.json
zip -r archiveofmyown.zip *.html *.js *.png *.json
git checkout manifest.json
rm manifest.json.bak
