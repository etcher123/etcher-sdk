#!/bin/bash
# vim: et sts=4 sw=4

# Build examples from the Etcher SDK, and pack them with 'pkg'.
# This script is expected to run on various environments and platforms
# (eg. Docker, Linux, Windows, Mac).
#
# Usage: $0 [EXAMPLE...]

set -e
set -u
set -x

DEFAULT_EXAMPLES="etcher-sdk-cli"    # file-to-file multi-destination scanner
EXAMPLES=${@:-$DEFAULT_EXAMPLES}


# Helpers

log() {
    [ -t 1 ] && tput bold || :
    echo "⏵⏵⏵ $@"
    [ -t 1 ] && tput sgr0 || :
}

pkg_arch() {

    # See <https://github.com/zeit/pkg#targets>
    # TODO Check if nodejs is 32-bit or 64-bit, somehow

    local arch=x64

    echo "$arch"
}

pkg_platform() {

    # See <https://github.com/zeit/pkg#targets>

    local platform=linux

    if [[ "${AGENT_NAME:-}" = "Azure Pipelines"* ]]; then
        case "$AGENT_OS" in
            (Linux)      platform=linux ;;
            (Darwin)     platform=macos ;;
            (Windows_NT) platform=win   ;;
        esac
    fi

    echo "$platform"
}


# Build

export npm_config_cache=$(pwd)/node_cache

log "Install dependency tree  --  [ ⏵ npm install ]"
npm install

log "Build project  --  [ ⏵ npm run build ]"
npm run build


# Package

export PKG_CACHE_PATH=$(pwd)/pkg_cache

log "Package examples: $EXAMPLES  --  [ ⏵ pkg ... ]"
for example in $EXAMPLES; do
    pkg -t node12-$(pkg_platform)-$(pkg_arch) build/examples/${example}.js
done


# Export

log "Export everything needed in one directory"

rm -fr export
mkdir export

for example in $EXAMPLES; do
    if [ "$(pkg_platform)" = "win" ]; then
        binary=${example}.exe
    else
        binary=${example}
    fi
    cp "${binary}" export
done

node_files=$(find node_modules -name '*.node' | grep -v 'obj.target')
for f in $node_files; do
    mkdir -p export/$(dirname $f)
    cp $f export/$(dirname $f)
done

if [ "$(pkg_platform)" = "win" ]; then
    lzma_dll=node_modules/lzma-native/deps/bin_x86-64/liblzma.dll
    cp $lzma_dll export/node_modules/lzma-native/binding-*/
fi
