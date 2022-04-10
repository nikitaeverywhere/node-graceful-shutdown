# [node-graceful-shutdown](https://www.npmjs.com/package/node-graceful-shutdown)

[![npm](https://img.shields.io/npm/v/node-graceful-shutdown.svg)](https://www.npmjs.com/package/node-graceful-shutdown)
[![License](https://img.shields.io/github/license/zitros/node-graceful-shutdown.svg)](LICENSE)
[![Build Status](https://img.shields.io/github/workflow/status/zitros/node-graceful-shutdown/Node.js%20package)](https://github.com/ZitRos/node-graceful-shutdown/actions/workflows/build-and-push.yaml)

Gracefully handle your modular NodeJS application's shutdown (termination), using dependencies.

Process signals captured: `SIGINT`, `SIGTERM`, `SIGQUIT`.

## Example

It doesn't matter in which order and where you define these graceful handlers, `node-graceful-shutdown` will
handle them appropriately and exit the process once all of them are processed.

```javascript
import { onShutdown } from "node-graceful-shutdown";

// module1.js
onShutdown("http-server", async function () {
  // Stop your http server here.
});

// module2.js
onShutdown("message-bus", ["http-server"], async function () {
  // Close your RabbitMQ connection here ONLY AFTER http server's onShutdown completed.
});

// moduleX.js
onShutdown("database", ["http-server", "message-bus"], async function () {
  // Shut down your database here, ONLY AFTER http-server and message-bus are completed.
});

// After all handlers are processed without errors, process exits with code 0.
// Otherwise it exits with exit code 42759, or exit code 42758 if there are any errors in assigned shutdown handlers.

// If some of specified dependencies are not defined (like when "http-server" is missing in the above example),
// node-graceful-shutdown will run the current handler without waiting for the undefined dependency.
```

Or, if you have all your modules as exports and they all shutdown one after another,
this will work at its best in your application's `main.js`:

```javascript
import { onShutdown } from "node-graceful-shutdown";
import {
  startModule1,
  startModule2,
  stopModule1,
  stopModule2 /*, ...*/,
} from "./src";

export const startMyApp = async () => {
  await startModule1();
  await startModule2();
};

export const stopMyApp = async () => {
  // Stop modules one after another.
  await stopModule1();
  await stopModule2();
  // ...
};

// Handle application's shutdown.
onShutdown(stopMyApp);
```

## Features and Guidelines

This library, along existing ones, allow your application to be **modular**. You define a cleanup callback in-place,
in the same module, where initialization happens. In addition, it allows specifying the order

Recommendations:

1. Please, **do not use this module in libraries** (packages). It is intended for end applications only (see why in `5.`).
2. Once imported, `onShutdown` is application-wide (in terms of a single process), so the callbacks and their dependencies will see each other when imported from multiple files.
3. Circular shutdown handler dependencies will throw an error immediately once declared.
4. There's also an `onShutdownError` export which takes an error as an argument when any of assigned shutdown handlers throw an error (added for very-very prudent programmers only).
5. Importing this module **deletes** existing handlers (`SIGINT`, `SIGTERM`, `SIGQUIT`) if there are any. This is intended as other custom handlers can exit the process at any time.
6. You may also consider defining constants in your application, instead of string arguments (names).

## Licence

[MIT](LICENSE) © [Nikita Savchenko](https://nikita.tk/developer)
