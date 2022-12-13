import pkg from "./";

pkg.onShutdown(async function () {
  /*  */
});
pkg.onShutdown(async function () {
  return 1;
});

console.log("ts-node: all good.");
