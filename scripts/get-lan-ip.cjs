const os = require('os');
const ifaces = os.networkInterfaces();

function getLanIp() {
  const findIp = (pattern) => {
    for (const [name, infoList] of Object.entries(ifaces)) {
      if (name.toLowerCase().includes(pattern)) {
        const info = infoList.find((i) => i.family === 'IPv4' && !i.internal);
        if (info) return info.address;
      }
    }
    return null;
  };

  let ip = findIp('ethernet');
  if (ip) return ip;

  ip = findIp('wi-fi') || findIp('wlan');
  if (ip) return ip;

  for (const infoList of Object.values(ifaces)) {
    const info = infoList?.find((i) => i.family === 'IPv4' && !i.internal);
    if (info) return info.address;
  }

  return '127.0.0.1';
}

console.log(getLanIp());
