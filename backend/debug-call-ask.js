const http = require('http');
const data = JSON.stringify({ disease: 'lung cancer', query: 'latest treatment', location: 'Toronto, Canada' });
const options = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/ask',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    try {
      const parsed = JSON.parse(body);
      console.log(JSON.stringify(parsed, null, 2).slice(0, 5000));
    } catch (err) {
      console.error('PARSE ERROR', err.message);
      console.log(body);
    }
  });
});

req.on('error', err => {
  console.error('REQUEST ERROR', err.message);
});
req.write(data);
req.end();
