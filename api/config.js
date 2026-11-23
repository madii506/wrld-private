const L = require('./_lib');
module.exports = (req, res) => L.send(res, 200, { relay: L.MOVES(), indexer: 'https://dgcj4pjarvo65.cloudfront.net', prover: 'https://d3ky2kt0ntqxt1.cloudfront.net' }, 'public, max-age=60');
