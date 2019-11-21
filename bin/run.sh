#!/bin/bash
_awsx_prompt $@

# try to export env vars set by awsx
chmod +x ~/.awsx/exports.sh >/dev/null 2>&1
source ~/.awsx/exports.sh >/dev/null 2>&1
