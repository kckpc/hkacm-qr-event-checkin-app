const os = require('os');
const fs = require('fs');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  let preferredIP = null;

  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const { address, family, internal } = iface[i];
      if (family === 'IPv4' && !internal) {
        if (address.startsWith('192.168.')) {
          return address; // Immediately return if we find a 192.168.x.x address
        } else if (!preferredIP && !address.startsWith('172.')) {
          preferredIP = address; // Store the first non-172.x.x.x address as a fallback
        }
      }
    }
  }

  return preferredIP || '127.0.0.1'; // Return the preferred IP, or localhost as a last resort
}

const ip = getLocalIP();
console.log('Detected IP:', ip);

if (process.argv[2] === 'frontend') {
  console.log('Frontend will use API URL:', `https://${ip}:3001/api`);
  fs.writeFileSync('.env.local', `REACT_APP_API_URL=https://${ip}:3001/api\n`);
} else if (process.argv[2] === 'backend') {
  console.log('Backend will use IP:', ip);
  fs.writeFileSync('.env', `SERVER_IP=${ip}\nPORT=3001\n`);
}

module.exports = getLocalIP;
