import { createServer } from 'vite';

(async () => {
    try {
        console.log('\n--- STARTING ---');
        // Using default config which has strictPort: true and port: 5173
        const server = await createServer();
        console.log('--- CREATED ---');
        await server.listen();
        console.log('--- LISTENING ---');
        server.printUrls();
        await server.close();
        console.log('--- CLOSED ---');
    } catch (e) {
        console.log('\n--- ERROR ---');
        console.log(e.message); // Print just message first to be clean
        console.log(JSON.stringify(e, null, 2));
    }
})();
