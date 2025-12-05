try {
    console.log("Loading src/app...");
    const app = require('./src/app');
    console.log("App loaded successfully.");
} catch (e) {
    console.error("FULL ERROR:");
    console.error(e.message);
    console.error("CODE:", e.code);
    console.error("STACK:", e.stack);
}
