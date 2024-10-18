const os = require('os');
const fs = require('fs');

function getIP() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const { address, family, internal } = iface[i];
      if (family === 'IPv4' && !internal) {
        return address;
      }
    }
  }
  return '0.0.0.0'; // fallback to all interfaces
}

const ip = getIP();
console.log('Detected IP:', ip);

if (process.argv[2] === 'frontend') {
  console.log('Frontend will use API URL:', `https://${ip}:3001/api`);
  fs.writeFileSync('.env.local', `REACT_APP_API_URL=https://${ip}:3001/api\n`);
} else if (process.argv[2] === 'backend') {
  console.log('Backend will use IP:', ip);
  fs.writeFileSync('.env', `SERVER_IP=${ip}\nPORT=3001\n`);
}

module.exports = getIP;
