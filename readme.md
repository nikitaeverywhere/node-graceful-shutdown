# [node-graceful-shutdown](https://www.npmjs.com/package/node-graceful-shutdown)

[![npm](https://img.shields.io/npm/v/node-graceful-shutdown.svg)](https://www.npmjs.com/package/node-graceful-shutdown)
[![License](https://img.shields.io/github/license/zitros/node-graceful-shutdown.svg)](LICENSE)
[![Build Status](https://travis-ci.org/ZitRos/node-graceful-shutdown.svg?branch=master)](https://travis-ci.org/ZitRos/node-graceful-shutdown)

Gracefully handle your modular NodeJS application's shutdown (termination).

Example
-------

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

// After all handlers are processed without errors, process exits with code 0. Otherwise it exits with code 42759.
```

Features and Guidelines
-----------------------

This library, along existing ones, allow your application to be **modular**. You define a cleanup callback in-place,
in the same module, where initialization happens.

Recommendations:
1. Please do not use this module in libraries (modules, packages). Use for the end application only.
2. Once imported, `onShutdown` is application-wide, so the callbacks and their dependencies will see each other when required from the same `node_modules` folder.
3. Circular dependencies will throw an error immediately once declared.
4. There's also an `onShutdownError` export which takes an error inside handlers handler (added for very-very prudent programmers only).
5. Importing this module deletes existing handlers (`SIGINT`, `SIGTERM`, `SIGQUIT`) if there are any (normally, there should be no other handlers).

Licence
-------

[MIT](LICENSE) © [Nikita Savchenko](https://nikita.tk)
