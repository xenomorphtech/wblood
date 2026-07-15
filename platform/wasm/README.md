# NBlood WebAssembly

Run `platform/wasm/build.sh`, then serve `platform/wasm/dist` over HTTP. Copy
legally obtained Blood data files into `platform/wasm/assets` before building;
the default page launches NBlood with those preloaded files. Open
`index.html?smoke=1` to run the self-contained video/input probe compiled into
the complete NBlood binary.

The browser target currently uses the classic software renderer. Networking,
desktop startup UI, external codecs, and persistent config storage are disabled.

For the automated browser test:

```sh
cd platform/wasm
npm install
npm test
npm run test:game
```

`test:game` requires the Blood data files in `platform/wasm/assets`. It drives
Chrome through the main, episode, and difficulty menus into a running level and
writes the captured stages to `platform/wasm/artifacts/chrome-game-flow`.
