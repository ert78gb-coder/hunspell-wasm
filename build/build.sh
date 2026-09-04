#!/usr/bin/env sh
# build/build.sh — the whole build
set -eu
EMSDK_IMAGE="emscripten/emsdk:6.0.9@sha256:96617f27fe16421588241def73908fd348a7f9d260440ed0d00b36dcf7a063cc"

git submodule update --init vendor/hunspell

mkdir -p dist
# emsdk's entrypoint execs the command without a shell, so glob expansion
# needs sh -c. Clang will not accept -std=c++14 on wrapper.c, so the engine
# is compiled as C++14 (Hunspell's required standard) and the shim as C,
# then one link step with the flags this package pins.
docker run --rm -v "$PWD":/work -w /work "$EMSDK_IMAGE" \
  sh -c '
    set -eu
    objdir=/tmp/hunspell-wasm-o
    rm -rf "$objdir"
    mkdir -p "$objdir"
    emcc -O2 -std=c++14 -DHUNSPELL_STATIC \
      -I vendor/hunspell/src/hunspell \
      vendor/hunspell/src/hunspell/*.cxx \
      -c
    mv -- *.o "$objdir"/
    emcc -O2 -DHUNSPELL_STATIC \
      -I vendor/hunspell/src/hunspell \
      -c build/wrapper.c -o "$objdir/wrapper.o"
    emcc -O2 -sDEFAULT_TO_CXX=1 "$objdir"/*.o \
      -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=node \
      -sALLOW_MEMORY_GROWTH=1 -sFILESYSTEM=1 -sDISABLE_EXCEPTION_CATCHING=1 -sASSERTIONS=0 \
      -sEXPORTED_FUNCTIONS=_hs_create,_hs_destroy,_hs_spell,_hs_analyze,_hs_stem,_hs_suggest,_hs_generate,_hs_free,_malloc,_free \
      -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,UTF8ToString,stringToUTF8,lengthBytesUTF8,FS \
      -o dist/hunspell.js
  '

sha256sum dist/hunspell.wasm
