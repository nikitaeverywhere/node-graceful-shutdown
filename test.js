import assert from "assert";
import { readFileSync, writeFileSync } from "fs";

const tests = [
    ["Handles simple single shutdown", async () => {

        const pkg = await testModule();
        const callTable = {};

        pkg.onShutdown(async function () { callTable[0] = true; });
    
        process.emit("SIGINT");
        await delay();
    
        assert.equal(callTable[0], true);
        assert.equal(pkg.exitCode, 0);

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
    
        assert.equal(pkg.exitCode, -1);

        process.emit("SIGINT");
        await delay();

        assert.equal(callTable["a"], true);
        assert.equal(callTable["b"], true);
        assert.equal(pkg.exitCode, 0);

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

        assert.equal(callTable["a"], true);
        assert.equal(callTable["b"], true);
        assert.equal(callTable["c"], true);
        assert.equal(pkg.exitCode, 0);

    }],
    ["Handles nonexistent dependency", async () => {

        const pkg = await testModule();
        const callTable = {};

        pkg.onShutdown("a", ["b"], async function () { callTable["a"] = true; });
        pkg.onShutdown("c", ["a"], async function () { callTable["c"] = true; });
        pkg.onShutdown("d", ["x"], async function () { callTable["d"] = true; });
    
        process.emit("SIGINT");
        await delay();
    
        assert.equal(callTable["d"], true);
        assert.equal(callTable["a"], true);
        assert.equal(callTable["c"], true);
        assert.equal(pkg.exitCode, 0);

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
    
        assert.equal(callTable["a1"], true);
        assert.equal(callTable["a2"], true);
        assert.equal(callTable["b"], true);
        assert.equal(pkg.exitCode, 0);

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
        assert.equal(!!callTable["a"], false);
        await delay(200);

        ["a", "b", "c", "e"].forEach(letter => assert.equal(callTable[letter], true, `Letter ${ letter }`));

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

        assert.equal(callTable["b"], true);
        assert.equal(callTable["e"], true);
        assert.equal(pkg.exitCode, 42759);

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
        process.stdout.write(`- ${ info }`);
        await t();
        console.log(" ✔");
    }
}

test().then(() => {
    console.log("It works indeed!");
}).catch((e) => {
    console.log("\n\nTEST FAILED");
    console.error(e);
    process.exit(1);
});