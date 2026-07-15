#ifdef __EMSCRIPTEN__

#include "baselayer.h"
#include "sdl_inc.h"

#include <emscripten.h>
#include <stdint.h>
#include <stdlib.h>

extern "C" EMSCRIPTEN_KEEPALIVE void wasmInjectKey(int scanCode, int pressed)
{
    if ((unsigned)scanCode < NUMKEYS)
        keySetState(scanCode, pressed != 0);
}

int wasmSmokeMain(void)
{
    constexpr int width = 640;
    constexpr int height = 400;

    if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_EVENTS) != 0)
        return 10;

    SDL_Window *window = SDL_CreateWindow("NBlood WebAssembly",
        SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, width, height,
        SDL_WINDOW_SHOWN);
    if (window == nullptr)
        return 11;

    SDL_Renderer *renderer = SDL_CreateRenderer(window, -1, 0);
    if (renderer == nullptr)
        return 12;

    SDL_Texture *texture = SDL_CreateTexture(renderer, SDL_PIXELFORMAT_ABGR8888,
        SDL_TEXTUREACCESS_STREAMING, width, height);
    if (texture == nullptr)
        return 13;

    auto *pixels = static_cast<uint32_t *>(malloc(width * height * sizeof(uint32_t)));
    if (pixels == nullptr)
        return 14;

    int boxX = 72;
    int inputCount = 0;
    bool alternateColor = false;
    bool running = true;

    for (int frame = 0; running; ++frame)
    {
        SDL_Event event;
        while (SDL_PollEvent(&event))
        {
            if (event.type == SDL_QUIT)
                running = false;
            else if (event.type == SDL_KEYDOWN)
            {
                switch (event.key.keysym.sym)
                {
                    case SDLK_LEFT:  boxX -= 24; inputCount++; break;
                    case SDLK_RIGHT: boxX += 24; inputCount++; break;
                    case SDLK_SPACE: alternateColor = !alternateColor; inputCount++; break;
                    case SDLK_ESCAPE: running = false; break;
                    default: break;
                }
            }
        }

        if (boxX < 0) boxX = 0;
        if (boxX > width - 96) boxX = width - 96;

        for (int y = 0; y < height; ++y)
        {
            for (int x = 0; x < width; ++x)
            {
                uint8_t shade = static_cast<uint8_t>(12 + (x * 18 / width) + (y * 10 / height));
                pixels[y * width + x] = 0xff000000u | (uint32_t(shade) << 16)
                    | (uint32_t(shade / 3) << 8) | uint32_t(shade / 3);
            }
        }

        // A stable, high-contrast marker whose position and color are driven by input.
        uint32_t const marker = alternateColor ? 0xff40d8ffu : 0xff3030d8u;
        for (int y = 146; y < 242; ++y)
            for (int x = boxX; x < boxX + 96; ++x)
                pixels[y * width + x] = marker;

        // White bars make it obvious that this is the NBlood WASM platform probe.
        for (int bar = 0; bar < 6; ++bar)
            for (int y = 42; y < 58; ++y)
                for (int x = 52 + bar * 54; x < 82 + bar * 54; ++x)
                    pixels[y * width + x] = 0xffeeeeeeu;

        SDL_UpdateTexture(texture, nullptr, pixels, width * sizeof(uint32_t));
        SDL_RenderClear(renderer);
        SDL_RenderCopy(renderer, texture, nullptr, nullptr);
        SDL_RenderPresent(renderer);

        EM_ASM({
            Module.wasmSmokeState = {};
            Module.wasmSmokeState.frame = $0;
            Module.wasmSmokeState.x = $1;
            Module.wasmSmokeState.color = $2;
            Module.wasmSmokeState.inputs = $3;
            document.documentElement.dataset.wasmReady = 'true';
            document.getElementById('status').textContent =
                'Running — frame ' + $0 + ', x ' + $1 + ', inputs ' + $3;
        }, frame, boxX, alternateColor ? 1 : 0, inputCount);

        emscripten_sleep(16);
    }

    free(pixels);
    SDL_DestroyTexture(texture);
    SDL_DestroyRenderer(renderer);
    SDL_DestroyWindow(window);
    SDL_Quit();
    return 0;
}

#endif
