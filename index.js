const handledEvents = ["SIGINT", "SIGTERM", "SIGQUIT"];

const dependencyTree = new Map(); // name => [dependency name, ...]
const handlers = new Map(); // name => [handler, ...]
const shutdownErrorHandlers = [];

let shuttingDown = false;

/**
 * Gracefully terminate application's modules on shutdown.
 * @param {string} [name] - Name of the handler.
 * @param {array} [dependencies] - Which handlers should be processed first.
 * @param {function} handler - Async or sync function which handles shutdown.
 */
module.exports.onShutdown = function (name, dependencies, handler) {
    handler = typeof name === "function" ? name : typeof dependencies === "function" ? dependencies : handler;
    dependencies = name instanceof Array ? name : dependencies instanceof Array ? dependencies : [];
    name = typeof name === "string" ? name : "default";
    dependencies.forEach(dependency => addDependency(name, dependency));
    if (!handlers.has(name)) {
        handlers.set(name, []);
    }
    handlers.get(name).push(handler);
};

/**
 * Optional export to handle shutdown errors.
 * @param {function} callback 
 */
module.exports.onShutdownError = function (callback) {
    shutdownErrorHandlers.push(callback);
};

async function gracefullyHandleShutdown () {
    const leveledHandlers = getLeveledHandlers();
    for (const handlers of leveledHandlers) {
        await Promise.all(handlers.map(handler => handler()));
    }
    exit(0);
}

handledEvents.forEach(event => process.removeAllListeners(event).addListener(event, () => {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    gracefullyHandleShutdown().catch((e) => {
        Promise.all(shutdownErrorHandlers.map(f => f(e)))
            .then(() => exit(42759))
            .catch(() => exit(42758));
    });
}));

// -------- Utility functions -------- \\

function checkDependencyLoop (node, visited = new Set()) {
    if (visited.has(node)) {
        throw new Error(
            `node-graceful-shutdown, circular dependency defined: ${ Array.from(visited).join("->") }->${ node }. Check your code.`
        );
    }
    visited.add(node);
    const dependencies = dependencyTree.get(node) || [];
    for (const dependency of dependencies) {
        checkDependencyLoop(dependency, visited);
    }
}

function addDependency (child, parent) {
    if (!dependencyTree.has(child)) {
        dependencyTree.set(child, []);
    }
    dependencyTree.get(child).push(parent);
    checkDependencyLoop(child);
}

function getDependencyTreeLeaves () {
    return Array.from(handlers.keys()).filter((name) => // Leave only those hander names
        !dependencyTree.has(name) // Which have no dependencies
        || dependencyTree.get(name).reduce((r, dep) => r && !handlers.has(dep), true) // And all their deps w/o handlers
    );
}

function getAllDependents (name) {
    return new Set(Array.from(dependencyTree.entries())
        .filter(([parent, dependencies]) => ~dependencies.indexOf(name) && handlers.has(parent))
        .map(([parent]) => parent));
}

function getLeveledHandlers () {
    const levels = [getDependencyTreeLeaves()];
    while (levels[levels.length - 1].length > 0) {
        const dependents = new Set();
        for (const task of levels[levels.length - 1]) {
            for (const dependent of getAllDependents(task)) {
                dependents.add(dependent);
            }
        }
        levels.push(Array.from(dependents));
    }
    return levels.map(tasks => tasks.reduce((arr, task) => {
        for (const handler of handlers.get(task)) {
            arr.push(handler);
        }
        return arr;
    }, []));
}

/* STUBBED */ function exit (code) {
/* STUBBED */     process.exit(code);
/* STUBBED */ }