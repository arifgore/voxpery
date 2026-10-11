#!/bin/sh
# Starts Voxpery through zypak so CEF's sandboxed helper processes run in the Flatpak sandbox.
exec zypak-wrapper /app/lib/voxpery/voxpery-desktop "$@"
