// test-kv.js
require('dotenv').config({ path: '.env.local' });
const { kv } = require('@vercel/kv');

async function test() {
    console.log('Testing KV connection...');
    console.log('KV_URL exists:', !!process.env.KV_URL);
    try {
        const res = await kv.set('test-key', 'hello ' + Date.now());
        console.log('Set result:', res);
        const val = await kv.get('test-key');
        console.log('Get result:', val);
        console.log('✅ KV working');
    } catch (err) {
        console.error('❌ KV failed:', err.message);
        if (err.stack) console.error(err.stack);
    }
}

test();
