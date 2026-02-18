// debug-state.js
const handler = require('./api/state').default;

const req = {
    method: 'GET',
    query: { secret: 'Thanhnam0' },
    headers: {}
};

const res = {
    status: (code) => {
        console.log('Status:', code);
        return res;
    },
    json: (data) => {
        console.log('JSON:', JSON.stringify(data, null, 2));
        return res;
    },
    setHeader: (k, v) => {
        console.log('Header:', k, '=', v);
        return res;
    }
};

async function test() {
    try {
        console.log('Running api/state handler...');
        await handler(req, res);
    } catch (err) {
        console.error('Handler crashed:', err);
    }
}

test();
