#!/bin/sh
# Starts Voxpery through zypak so CEF's sandboxed helper processes run in the Flatpak sandbox.

# zypak's default spawn strategy is incompatible with this CEF build: the zygote fails to reach
# the zypak supervisor ("Failed to send spawn request to supervisor: Bad file descriptor") and
# Chromium aborts with "Zygote process exited prematurely", so the app never starts. Forcing the
# mimic strategy makes the zygote spawn helper processes correctly and the window opens.
export ZYPAK_ZYGOTE_STRATEGY_SPAWN=0

exec zypak-wrapper /app/lib/voxpery/voxpery-desktop "$@"
