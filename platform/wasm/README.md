# NBlood WebAssembly

Run `platform/wasm/build.sh`, then serve `platform/wasm/dist` over HTTP. The
default page runs a self-contained video/input probe compiled into the complete
NBlood binary. To run the game, copy legally obtained Blood data files into
`platform/wasm/assets`, rebuild, and open `index.html?game=1`.

The browser target currently uses the classic software renderer. Networking,
desktop startup UI, external codecs, and persistent config storage are disabled.

For the automated browser test:

```sh
cd platform/wasm
npm install
npm test
```
