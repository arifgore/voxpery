#!/bin/sh
# Collects everything the Flatpak manifest builds from into one directory.
# Usage: prepare-build-dir.sh <release .deb> <version> <release date YYYY-MM-DD> <output dir>
set -eu

deb="$1"
version="$2"
release_date="$3"
out="$4"
here="$(cd "$(dirname "$0")" && pwd)"

case "$version" in
  *[!0-9A-Za-z.+-]*|'') echo "invalid version: $version" >&2; exit 1 ;;
esac
case "$release_date" in
  [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;;
  *) echo "invalid release date: $release_date" >&2; exit 1 ;;
esac

mkdir -p "$out"
cp "$here/com.voxpery.Voxpery.yml" "$here/com.voxpery.Voxpery.desktop" "$here/voxpery-desktop.sh" "$out/"
cp "$here/../../icons/icon.png" "$out/icon.png"
cp "$deb" "$out/voxpery.deb"
sed -e "s/@VERSION@/$version/" -e "s/@DATE@/$release_date/" \
  "$here/com.voxpery.Voxpery.metainfo.xml" > "$out/com.voxpery.Voxpery.metainfo.xml"
