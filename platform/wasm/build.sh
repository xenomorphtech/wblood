#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

if ! command -v em++ >/dev/null 2>&1; then
    if [[ -f .tools/emsdk/emsdk_env.sh ]]; then
        export EMSDK_QUIET=1
        source .tools/emsdk/emsdk_env.sh
    else
        echo "Emscripten is required. Install emsdk or place it at .tools/emsdk." >&2
        exit 1
    fi
fi

preload=(--preload-file "nblood.pk3@/nblood.pk3")
if find platform/wasm/assets -mindepth 1 -type f ! -name .gitkeep -print -quit | grep -q .; then
    preload+=(--preload-file "platform/wasm/assets@/")
fi

common=(
    PLATFORM=EMSCRIPTEN CC=emcc CXX=em++ L_CC=emcc L_CXX=em++
    CLANG=1 CLANGNAME=emcc CLANGXXNAME=em++
    IMPLICIT_ARCH=wasm32 COMPILERTARGET=wasm32 BITS=32 OPTOPT= LTO=0
    AR=emar RANLIB=emranlib STRIP= EXESUFFIX=.js NOASM=1
    USE_OPENGL=0 NETCODE=0 STARTUP_WINDOW=0 HAVE_GTK2=0 USE_LIBVPX=0
    HAVE_VORBIS=0 HAVE_FLAC=0 HAVE_XMP=0 USE_MIMALLOC=0 PRETTY_OUTPUT=0
    "LIBS=-lm --use-port=sdl2"
    "CUSTOMOPT=--use-port=sdl2 -Wno-unused-command-line-argument"
)

link_flags=(
    -sASYNCIFY -sALLOW_MEMORY_GROWTH=0 -sINITIAL_MEMORY=268435456 -sINVOKE_RUN=0
    -sEXIT_RUNTIME=0 -sEXPORTED_RUNTIME_METHODS=callMain,FS
    -sASSERTIONS=1
    "${preload[@]}"
)

rm -f nblood.js nblood.wasm nblood.data
make -j"${JOBS:-4}" blood "${common[@]}" "blood_game_ldflags=${link_flags[*]}"

mkdir -p platform/wasm/dist
cp nblood.js nblood.wasm platform/wasm/dist/
asset_files=(nblood.js nblood.wasm)
if [[ -f nblood.data ]]; then
    cp nblood.data platform/wasm/dist/
    asset_files+=(nblood.data)
fi
asset_version="$(sha256sum "${asset_files[@]}" | sha256sum | cut -c1-12)"
sed "s/__ASSET_VERSION__/$asset_version/g" platform/wasm/index.html > platform/wasm/dist/index.html

echo "Built platform/wasm/dist/index.html (assets $asset_version)"
