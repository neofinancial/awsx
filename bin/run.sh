#!/bin/bash
_awsx_prompt $@

# TODO: this needs refinement because it will export on add-profile and other innapropriate commands
# export env vars set by awsx
export AWS_PROFILE="$(cat ~/.awsx/export-profile)" || true
export AWS_ACCESS_KEY_ID="$(cat ~/.awsx/export-access-key)" || true
export AWS_SECRET_ACCESS_KEY="$(cat ~/.awsx/export-secret-key)" || true
export AWS_SESSION_TOKEN="$(cat ~/.awsx/export-session-token)" || true
