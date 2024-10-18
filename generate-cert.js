const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

const attrs = [
  { name: 'commonName', value: 'localhost' },
  { name: 'countryName', value: 'US' },
  { name: 'stateOrProvinceName', value: 'California' },
  { name: 'localityName', value: 'San Francisco' },
  { name: 'organizationName', value: 'MyOrganization' },
  { name: 'organizationalUnitName', value: 'MyUnit' }
];

const pems = selfsigned.generate(attrs, {
  algorithm: 'sha256',
  days: 365,
  keySize: 2048,
  extensions: [
    {
      name: 'subjectAltName',
      altNames: [
        {
          type: 2, // DNS
          value: 'localhost'
        },
        {
          type: 7, // IP
          ip: '127.0.0.1'
        }
      ]
    }
  ]
});

fs.writeFileSync(path.join(__dirname, 'cert.pem'), pems.cert);
fs.writeFileSync(path.join(__dirname, 'key.pem'), pems.private);

console.log('Self-signed certificate generated successfully.');
