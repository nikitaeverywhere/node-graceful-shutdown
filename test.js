import assert from "assert";
import { readFileSync, writeFileSync } from "fs";

const tests = [
    ["Handles simple single shutdown", async () => {

        const pkg = await testModule();
        const callTable = {};

        pkg.onShutdown(async function () { callTable[0] = true; });
    
        process.emit("SIGINT");
        await delay();
    
        assert.strictEqual(callTable[0], true);
        assert.strictEqual(pkg.exitCode, 0);

    }],
    ["Handles dependent shutdown actions", async () => {

        const pkg = await testModule();
        const callTable = {};

        pkg.onShutdown("a", ["b"], async function () {
            if (!callTable["b"]) assert.fail("Must call b first");
            callTable["a"] = true;
        });
        pkg.onShutdown("b", async function () {
            callTable["b"] = true;
        });
    
        assert.strictEqual(pkg.exitCode, -1);

        process.emit("SIGINT");
        await delay();

        assert.strictEqual(callTable["a"], true);
        assert.strictEqual(callTable["b"], true);
        assert.strictEqual(pkg.exitCode, 0);

    }],
    ["Handles triangle dependencies", async () => {

        const pkg = await testModule();
        const callTable = {};

        pkg.onShutdown("a", ["b"], async function () {
            if (!callTable["b"]) assert.fail("Must call b first");
            callTable["a"] = true;
        });
        pkg.onShutdown("c", ["b"], async function () {
            if (!callTable["b"]) assert.fail("Must call b first");
            await delay(200);
            callTable["c"] = true;
        });
        pkg.onShutdown("b", async function () {
            if (callTable["a"]) assert.fail("Must call a after b");
            if (callTable["c"]) assert.fail("Must call c after b");
            callTable["b"] = true;
        });

        process.emit("SIGINT");
        await delay(500);

        assert.strictEqual(callTable["a"], true);
        assert.strictEqual(callTable["b"], true);
        assert.strictEqual(callTable["c"], true);
        assert.strictEqual(pkg.exitCode, 0);

    }],
    ["Handles example case", async () => {

        const pkg = await testModule();
        const callTable = {};

        pkg.onShutdown("database", ["http-server", "message-bus"], async function () {
            if (!callTable["message-bus"]) assert.fail("Must call database after message-bus");
            if (!callTable["http-server"]) assert.fail("Must call database after http-server");
            await delay(100);
            callTable["database"] = true;
        });
        pkg.onShutdown("message-bus", ["http-server"], async function () {
            if (!callTable["http-server"]) assert.fail("Must call http-server before message-bus");
            if (callTable["database"]) assert.fail("Must call database after message-bus");
            await delay(200);
            callTable["message-bus"] = true;
        });
        pkg.onShutdown("http-server", async function () {
            if (callTable["message-bus"]) assert.fail("Must call message-bus after http-server");
            if (callTable["database"]) assert.fail("Must call database after http-server");
            callTable["http-server"] = true;
        });

        process.emit("SIGINT");
        await delay(500);

        assert.strictEqual(pkg.exitCode, 0);
        assert.strictEqual(callTable["database"], true, "database");
        assert.strictEqual(callTable["http-server"], true, "http-server");
        assert.strictEqual(callTable["message-bus"], true, "message-bus");

    }],
    ["Handles nonexistent dependency", async () => {

        const pkg = await testModule();
        const callTable = {};

        pkg.onShutdown("a", ["b"], async function () { callTable["a"] = true; });
        pkg.onShutdown("c", ["a"], async function () { callTable["c"] = true; });
        pkg.onShutdown("d", ["x"], async function () { callTable["d"] = true; });
    
        process.emit("SIGINT");
        await delay();
    
        assert.strictEqual(callTable["d"], true);
        assert.strictEqual(callTable["a"], true);
        assert.strictEqual(callTable["c"], true);
        assert.strictEqual(pkg.exitCode, 0);

    }],
    ["Handles duplicated callback", async () => {

        const pkg = await testModule();
        const callTable = {};

        pkg.onShutdown("a", ["b"], async function () {
            if (!callTable["b"]) assert.fail("Must call b first");
            callTable["a1"] = true;
        });
        pkg.onShutdown("a", [], async function () {
            callTable["a2"] = true;
        });
        pkg.onShutdown("b", async function () { callTable["b"] = true; });
    
        process.emit("SIGINT");
        await delay();
    
        assert.strictEqual(callTable["a1"], true);
        assert.strictEqual(callTable["a2"], true);
        assert.strictEqual(callTable["b"], true);
        assert.strictEqual(pkg.exitCode, 0);

    }],
    ["Handles complex callbacks with missed dependencies", async () => {

        const pkg = await testModule();
        const callTable = {};

        pkg.onShutdown("a", ["b", "f"], async function () {
            if (!callTable["b"]) assert.fail("Must call b first");
            await delay(200);
            callTable["a"] = true;
        });
        pkg.onShutdown("c", ["d", "f"], async function () {
            callTable["c"] = true;
        });
        pkg.onShutdown("b", async function () {
            await delay(150);
            callTable["b"] = true;
        });
        pkg.onShutdown("e", ["c", "b"], async function () {
            if (!callTable["c"]) assert.fail("Must call c first");
            if (!callTable["b"]) assert.fail("Must call b first");
            callTable["e"] = true;
        });

        process.emit("SIGTERM");
        await delay(200);
        assert.strictEqual(!!callTable["a"], false);
        await delay(200);

        ["a", "b", "c", "e"].forEach(letter => assert.strictEqual(callTable[letter], true, `Letter ${ letter }`));

    }],
    ["Handles errors as exit code 42759", async () => {

        const pkg = await testModule();
        const callTable = {};

        pkg.onShutdown("a", ["b"], async function () {
            throw new Error("Test");
        });
        pkg.onShutdown("b", async function () {
            callTable["b"] = true;
        });
        pkg.onShutdownError(() => { callTable["e"] = true; });

        process.emit("SIGINT");
        await delay();

        assert.strictEqual(callTable["b"], true);
        assert.strictEqual(callTable["e"], true);
        assert.strictEqual(pkg.exitCode, 42759);

    }],
    ["Detects circular dependencies", async () => {

        const pkg = await testModule();
        const callTable = {};

        pkg.onShutdown("a", ["b"], async function () {
            callTable["a"] = true;
        });
        pkg.onShutdown("b", ["c"], async function () {
            callTable["b"] = true;
        });
        try {
            pkg.onShutdown("c", ["a"], async function () {
                callTable["c"] = true;
            });
            assert.fail("Circular dependency added");
        } catch (e) {
            assert.ok(true);
        }

    }],
    ["Shuts down only once", async () => {

        const pkg = await testModule();
        const callTable = { "a": 0 };

        pkg.onShutdown("a", async function () {
            callTable["a"]++;
        });
        
        process.emit("SIGINT");
        process.emit("SIGINT");
        process.emit("SIGTERM");
        await delay();

        assert.strictEqual(callTable["a"], 1);

    }],
    // Keep this test at the end.
    ["Removes other shutdown handlers", async () => {

        process.addListener('SIGINT', () => {
            console.log('\n\nSIGINT is handled by the custom code, but is expected to be handled by the library.\n');
            process.exit(101);
        });

        const pkg = await testModule();
        const callTable = { "a": 0 };

        pkg.onShutdown("a", async function () {
            callTable["a"] = 1;
        });
        
        process.emit("SIGINT");
        await delay();

        assert.strictEqual(callTable["a"], 1);

    }]
];

// ---------- Test utils ---------- \\

const stubCode = `export let exitCode = -1;
function exit (code) {
    exitCode = code;
}`;

async function delay (ms = 200) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let testCase = 0;
async function testModule () {
    const moduleCode = readFileSync("index.js").toString().replace(/function exit[^\}]+\}/, stubCode);
    const moduleName = `index-test-${ testCase++ }.js`;
    writeFileSync(moduleName, moduleCode);
    return await import(`./${ moduleName }`);
}

async function test () {
    for (const [info, t] of tests) {
        process.stdout.write(`- ${ info }\n`);
        await t();
        console.log(" ✔");
    }
}

test().then(() => {
    console.log("\nIt works indeed!");
}).catch((e) => {
    console.log("\n\nTEST FAILED");
    console.error(e);
    process.exit(1);
});