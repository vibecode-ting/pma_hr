import { defineConfig } from 'vite'
import os from 'os'

// Find the first non-loopback LAN IPv4 address (Ethernet or Wi-Fi preferred)
function getLanIp(): string {
  const ifaces = os.networkInterfaces()
  
  const findIp = (pattern: string) => {
    for (const [name, infoList] of Object.entries(ifaces)) {
      if (name.toLowerCase().includes(pattern)) {
        const info = infoList?.find(i => i.family === 'IPv4' && !i.internal)
        if (info) return info.address
      }
    }
    return null
  }

  // 1. Try Ethernet
  let ip = findIp('ethernet')
  if (ip) return ip
  
  // 2. Try Wi-Fi
  ip = findIp('wi-fi') || findIp('wlan')
  if (ip) return ip

  // 3. Fallback to any non-loopback IPv4
  for (const infoList of Object.values(ifaces)) {
    const info = infoList?.find(i => i.family === 'IPv4' && !i.internal)
    if (info) return info.address
  }
  
  return '0.0.0.0'
}

const lanIp = getLanIp()

export default defineConfig({
  base: process.env.BASE_PATH || './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  server: {
    port: 5173,
    host: lanIp,
  },
  preview: {
    port: 4173,
    host: lanIp,
    strictPort: true,
  },
})
