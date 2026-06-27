#!/usr/bin/env node

const http = require('http');
const WebSocket = require('ws');
const net = require('net');
const dgram = require('dgram');
const url = require('url');
const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// ==================== ENVIRONMENT VARIABLES ====================
const FILE_PATH = process.env.FILE_PATH || '.tmp';
const PORT = process.env.PORT || 3000;
const UUID = process.env.UUID || 'cf01d6d3-1405-4ea1-adb3-d6187d2ccda6';
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || 'railway-hybrid-v2.bluehat358.eu.cc';
const ARGO_AUTH = process.env.ARGO_AUTH || 'eyJhIjoiOGY4MTBhZDM4M2E2NmNmZDU3ZjI2Yzk2NTU4NThiZDkiLCJ0IjoiZDkzYmVkNzUtMWQ5Mi00MTlmLTlkZGUtMTYxZGVlNmM1OGVhIiwicyI6Ik0yWXpNMlZoT1RBdE5USXhaaTAwWmpjMkxUa3dZMlF0TXpNeFl6bGpObU0xT0RZeSJ9';
const ARGO_PORT = process.env.ARGO_PORT || 8001;
const CFIP = process.env.CFIP || 'bug.com';
const CFPORT = process.env.CFPORT || 443;
const NAME = process.env.NAME || 'BLUEHAT358';
const SSH_PORT = process.env.SSH_PORT || 2222;
const SSH_USER = process.env.SSH_USER || 'shiro';
const SSH_PASS = process.env.SSH_PASS || 'BlueHat358_5h1r0';
const SSH_WS_PATH = '/ssh-BlueHat358';

// ==================== GLOBAL CONSTANTS ====================
const horse = Buffer.from("dHJvamFu", 'base64').toString(); 
const flash = Buffer.from("dm1lc3M=", 'base64').toString(); 
const WS_READY_STATE_OPEN = 1;

let argoConfigs = { vless: '', vmess: '', trojan: '', ssh: '' };
let sshInfo = { host: '', port: SSH_PORT, user: SSH_USER, pass: SSH_PASS };
const generateRandomName = () => Math.random().toString(36).substring(2, 8);
const webName = generateRandomName();
const botName = generateRandomName();
const sshName = generateRandomName();
const webPath = path.join(FILE_PATH, webName);
const botPath = path.join(FILE_PATH, botName);
const sshPath = path.join(FILE_PATH, sshName);
const subFilePath = path.join(FILE_PATH, 'sub.txt');
const bootLogPath = path.join(FILE_PATH, 'boot.log');
const sshHostKeyPath = path.join(FILE_PATH, 'dropbear_rsa_host_key');
const sshPasswdPath = path.join(FILE_PATH, 'passwd');

// ==================== BACKGROUND SERVICES (XRAY & ARGO) ====================
if (!fs.existsSync(FILE_PATH)) fs.mkdirSync(FILE_PATH, { recursive: true });

async function generateXrayConfig() {
  const config = {
    log: { access: '/dev/null', error: '/dev/null', loglevel: 'none' },
    inbounds: [
      { port: ARGO_PORT, protocol: 'vless', settings: { clients: [{ id: UUID, flow: 'xtls-rprx-vision' }], decryption: 'none', fallbacks: [{ dest: 3001 }, { path: "/vless-BlueHat358", dest: 3002 }, { path: "/vmess-BlueHat358", dest: 3003 }, { path: "/trojan-BlueHat358", dest: 3004 }] }, streamSettings: { network: 'tcp' } },
      { port: 3001, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: UUID }], decryption: "none" }, streamSettings: { network: "tcp", security: "none" } },
      { port: 3002, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: UUID, level: 0 }], decryption: "none" }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/vless-BlueHat358" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
      { port: 3003, listen: "127.0.0.1", protocol: "vmess", settings: { clients: [{ id: UUID, alterId: 0 }] }, streamSettings: { network: "ws", wsSettings: { path: "/vmess-BlueHat358" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
      { port: 3004, listen: "127.0.0.1", protocol: "trojan", settings: { clients: [{ password: UUID }] }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/trojan-BlueHat358" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
    ],
    dns: { servers: ["https+local://8.8.8.8/dns-query"] },
    outbounds: [{ protocol: "freedom", tag: "direct" }, { protocol: "blackhole", tag: "block" }]
  };
  fs.writeFileSync(path.join(FILE_PATH, 'config.json'), JSON.stringify(config, null, 2));
}

function downloadFile(fileUrl, filePath) {
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    axios({ method: 'get', url: fileUrl, responseType: 'stream' })
      .then(response => {
        response.data.pipe(writer);
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
      }).catch(reject);
  });
}

async function startSSHServer() {
  try {
    const setupScript = `
mkdir -p /run/sshd /tmp/home/${SSH_USER} /etc/ssh 2>/dev/null

# Buat user jika belum ada
if ! id "${SSH_USER}" >/dev/null 2>&1; then
  useradd -m -d /tmp/home/${SSH_USER} -s /bin/bash "${SSH_USER}" 2>/dev/null || \
  adduser -D -h /tmp/home/${SSH_USER} -s /bin/sh "${SSH_USER}" 2>/dev/null || true
fi

# Set password — metode andal di container (openssl hash langsung ke shadow)
HASH=$(openssl passwd -6 "${SSH_PASS}" 2>/dev/null || openssl passwd -1 "${SSH_PASS}" 2>/dev/null)
if [ -n "$HASH" ]; then
  if grep -q "^${SSH_USER}:" /etc/shadow 2>/dev/null; then
    sed -i "s|^${SSH_USER}:[^:]*:|${SSH_USER}:$HASH:|" /etc/shadow
  else
    echo "${SSH_USER}:$HASH:18000:0:99999:7:::" >> /etc/shadow 2>/dev/null || true
  fi
  echo "[SSH] Password set via openssl hash"
else
  echo "${SSH_USER}:${SSH_PASS}" | chpasswd 2>/dev/null || true
  echo "[SSH] Password set via chpasswd fallback"
fi

# Pastikan /etc/passwd ada entri user
if ! grep -q "^${SSH_USER}:" /etc/passwd 2>/dev/null; then
  echo "${SSH_USER}:x:1001:1001::/tmp/home/${SSH_USER}:/bin/sh" >> /etc/passwd
fi

# Generate host keys jika belum ada
if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
  ssh-keygen -A 2>/dev/null || true
fi

# Kill sshd lama
if [ -f /run/sshd.pid ]; then
  kill \$(cat /run/sshd.pid) 2>/dev/null || true
  rm -f /run/sshd.pid
fi
kill \$(cat /tmp/sshd.pid 2>/dev/null) 2>/dev/null || true
sleep 1

cat > /etc/ssh/sshd_config << SSHEOF
Port ${SSH_PORT}
ListenAddress 0.0.0.0
PidFile /tmp/sshd.pid
HostKey /etc/ssh/ssh_host_rsa_key
HostKey /etc/ssh/ssh_host_ecdsa_key
PermitRootLogin yes
PasswordAuthentication yes
PubkeyAuthentication yes
UsePAM no
ChallengeResponseAuthentication no
AuthenticationMethods password
PrintMotd no
AllowTcpForwarding yes
GatewayPorts yes
X11Forwarding no
ClientAliveInterval 120
ClientAliveCountMax 3
MaxStartups 20:30:100
SSHEOF

echo "SSH_SETUP_DONE"
`;

    const result = await exec(setupScript);
    if (result.stdout.includes('SSH_SETUP_DONE')) {
      console.log(`[SSH] Setup berhasil. User: ${SSH_USER} | Pass: ${SSH_PASS} | Port: ${SSH_PORT}`);
    }
    if (result.stdout.includes('openssl hash')) {
      console.log('[SSH] Password method: openssl hash OK');
    } else {
      console.log('[SSH] Password method: chpasswd fallback');
    }

    await new Promise(r => setTimeout(r, 300));
    exec(`/usr/sbin/sshd -D -f /etc/ssh/sshd_config 2>/tmp/sshd.log &`);
    console.log(`[SSH] OpenSSH Server started on port ${SSH_PORT}`);

    setTimeout(async () => {
      try {
        const check = await exec(`ss -tlnp 2>/dev/null | grep :${SSH_PORT} || netstat -tlnp 2>/dev/null | grep :${SSH_PORT} || echo "PORT_NOT_FOUND"`);
        if (check.stdout.includes('PORT_NOT_FOUND') || check.stdout.trim() === '') {
          const log = await exec(`cat /tmp/sshd.log 2>/dev/null || echo "no log"`);
          console.error(`[SSH] WARNING: sshd tidak terdeteksi di port ${SSH_PORT}!`);
          console.error(`[SSH] Log: ${log.stdout.trim()}`);
        } else {
          console.log(`[SSH] OK: sshd confirmed listening on port ${SSH_PORT}`);
        }
      } catch(e) {}
    }, 3000);

  } catch (err) {
    console.error('[SSH] Setup error:', err.message);
    try {
      await exec(`mkdir -p /run/sshd && ssh-keygen -A 2>/dev/null || true`);
      exec(`/usr/sbin/sshd -D -p ${SSH_PORT} 2>/tmp/sshd.log &`);
      console.log('[SSH] Fallback sshd started');
    } catch(e) {
      console.error('[SSH] Semua metode gagal:', e.message);
    }
  }
}

async function startBackgroundServices() {
  const arch = os.arch() === 'arm' || os.arch() === 'arm64' || os.arch() === 'aarch64' ? 'arm64' : 'amd64';
  const baseUrl = `https://${arch}.ssss.nyc.mn`;
  
  await generateXrayConfig();
  
  try {
    await Promise.all([
      downloadFile(`${baseUrl}/web`, webPath),
      downloadFile(`${baseUrl}/bot`, botPath)
    ]);
    
    fs.chmodSync(webPath, 0o775);
    fs.chmodSync(botPath, 0o775);

    exec(`nohup ${webPath} -c ${FILE_PATH}/config.json >/dev/null 2>&1 &`);
    console.log('[SYSTEM] Xray Engine Started');

    // Start SSH Server
    await startSSHServer();

    let tunnelArgs = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${bootLogPath} --loglevel info --url http://localhost:${ARGO_PORT}`;
    if (ARGO_AUTH && ARGO_AUTH.match(/^[A-Z0-9a-z=]{120,250}$/)) {
        tunnelArgs = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token ${ARGO_AUTH}`;
    }
    
    exec(`nohup ${botPath} ${tunnelArgs} >/dev/null 2>&1 &`);
    console.log('[SYSTEM] Tunnel Bot Started');
    
    setTimeout(extractDomains, 5000);
  } catch (err) {
    console.error('[SYSTEM] Background service error:', err.message);
  }
}

async function extractDomains() {
  if (ARGO_AUTH && ARGO_DOMAIN) {
    await generateLinks(ARGO_DOMAIN);
    return;
  }
  try {
    const logData = fs.readFileSync(bootLogPath, 'utf-8');
    const match = logData.match(/https?:\/\/([^ ]*trycloudflare\.com)\/?/);
    if (match) {
      console.log('[SYSTEM] Argo Tunnel Extracted:', match[1]);
      await generateLinks(match[1]);
    } else {
      setTimeout(extractDomains, 3000); 
    }
  } catch (e) {
    setTimeout(extractDomains, 3000);
  }
}

async function generateLinks(domain) {
  const vmessObj = { v: '2', ps: `${NAME}-CDN-VMESS`, add: CFIP, port: CFPORT, id: UUID, aid: '0', scy: 'auto', net: 'ws', type: 'none', host: domain, path: '/vmess-BlueHat358', tls: 'tls', sni: domain, alpn: '', fp: 'firefox' };
  
  argoConfigs.vless = `vless://${UUID}@${CFIP}:${CFPORT}?encryption=none&security=tls&sni=${domain}&fp=firefox&type=ws&host=${domain}&path=%2Fvless-BlueHat358#${NAME}-CDN-VLESS`;
  argoConfigs.vmess = `vmess://${Buffer.from(JSON.stringify(vmessObj)).toString('base64')}`;
  argoConfigs.trojan = `trojan://${UUID}@${CFIP}:${CFPORT}?security=tls&sni=${domain}&fp=firefox&type=ws&host=${domain}&path=%2Ftrojan-BlueHat358#${NAME}-CDN-TROJAN`;
  
  // SSH Info — domain Argo sebagai SSH host (via WS bridge path)
  sshInfo.host = domain;
  
  // Generate berbagai payload untuk SSH Injector (HTTP Injector / Neko Injector)
  // Format SSH: host:port@user:pass
  argoConfigs.ssh = {
    account: `${domain}:443@${SSH_USER}:${SSH_PASS}`,
    host: domain,
    port: 443,           // Argo tunnel selalu port 443
    user: SSH_USER,
    pass: SSH_PASS,
    ws_path: SSH_WS_PATH,

    // Payload GET + WebSocket Upgrade (paling umum)
    payload_get_ws: `GET ${SSH_WS_PATH} HTTP/1.1[crlf]Host: [host_port][crlf]Upgrade: websocket[crlf]Connection: Upgrade[crlf]Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==[crlf]Sec-WebSocket-Version: 13[crlf][crlf]`,

    // Payload CONNECT (untuk proxy HTTPS tunnel)
    payload_connect: `CONNECT [host_port] HTTP/1.1[crlf]Host: [host_port][crlf]Proxy-Connection: Keep-Alive[crlf]User-Agent: [ua][crlf][crlf]`,

    // Payload GET biasa (untuk bug HTTP)
    payload_get: `GET / HTTP/1.1[crlf]Host: [host_port][crlf]Upgrade: Websocket[crlf]Connection: Keep-Alive[crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]`,

    // Payload dengan path CDN Cloudflare
    payload_cdn: `GET /cdn-cgi/trace HTTP/1.1[crlf]Host: [host_port][crlf]Upgrade: websocket[crlf]Connection: Upgrade[crlf]User-Agent: [ua][crlf][crlf]`,

    // Payload CONNECT + SNI
    payload_sni: `CONNECT ${domain}:443 HTTP/1.1[crlf]Host: ${domain}[crlf]Upgrade: websocket[crlf]Connection: Keep-Alive[crlf][crlf]`,
  };

  const subTxt = `${argoConfigs.vless}\n${argoConfigs.vmess}\n${argoConfigs.trojan}`;
  fs.writeFileSync(subFilePath, subTxt);
  console.log('[SYSTEM] Argo Subscriptions generated.');
  console.log(`[SSH] Account => ${domain}:443@${SSH_USER}:${SSH_PASS} | WS Path: ${SSH_WS_PATH}`);
}

// ==================== HYBRID GATEWAY SERVER ====================
class HybridServer {
  constructor() {
    this.wss = null;
    this.httpServer = null;
    this.activeUDPConnections = new Map();
    this.stats = { rx: 0, tx: 0 };
    this.lastCpu = null;
  }

  async handleHttpRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    
    // API Statistik (GLOBAL TRAFFIC + CPU + RAM)
    if (parsedUrl.pathname === '/api/stats') {
      let currentRx = this.stats.rx;
      let currentTx = this.stats.tx;

      // Baca Trafik Linux
      try {
        if (fs.existsSync('/proc/net/dev')) {
          const devData = fs.readFileSync('/proc/net/dev', 'utf-8');
          const lines = devData.split('\n');
          let sysRx = 0, sysTx = 0;
          for (let i = 2; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('lo:')) continue; 
            const parts = line.split(/:?\s+/);
            if (parts.length > 9) {
              sysRx += parseInt(parts[1] || 0, 10);
              sysTx += parseInt(parts[9] || 0, 10);
            }
          }
          if (sysRx > 0 || sysTx > 0) { currentRx = sysRx; currentTx = sysTx; }
        }
      } catch (e) {}

      // Kalkulasi CPU
      const cpus = os.cpus();
      let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
      for (let cpu in cpus) {
        user += cpus[cpu].times.user; nice += cpus[cpu].times.nice;
        sys += cpus[cpu].times.sys; idle += cpus[cpu].times.idle;
        irq += cpus[cpu].times.irq;
      }
      const totalCpu = user + nice + sys + idle + irq;
      if (!this.lastCpu) this.lastCpu = { idle, total: totalCpu };
      const idleDelta = idle - this.lastCpu.idle;
      const totalDelta = totalCpu - this.lastCpu.total;
      const cpuUsage = totalDelta === 0 ? 0 : (100 - (100 * idleDelta / totalDelta)).toFixed(1);
      this.lastCpu = { idle, total: totalCpu };

      // Kalkulasi RAM
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const ramUsage = ((totalMem - freeMem) / totalMem * 100).toFixed(1);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        uptime: Math.floor(process.uptime()),
        rx: currentRx,
        tx: currentTx,
        cpu: parseFloat(cpuUsage),
        ram: parseFloat(ramUsage)
      }));
      return;
    }

    // API Config Terpusat
    if (parsedUrl.pathname === '/api/config') {
      const host = req.headers.host;
      const payload = {
        native: {
          vless: `vless://${UUID}@${host}:443?encryption=none&security=tls&sni=${host}&fp=firefox&type=ws&host=${host}&path=%2Fvless-BlueHat358#${NAME}-SNI-VLESS`,
          trojan: `trojan://${UUID}@${host}:443?security=tls&sni=${host}&fp=firefox&type=ws&host=${host}&path=%2Ftrojan-BlueHat358#${NAME}-SNI-TROJAN`
        },
        argo: {
          vless: argoConfigs.vless || 'Menunggu Cloudflare Argo Tunnel aktif...',
          vmess: argoConfigs.vmess || 'Menunggu Cloudflare Argo Tunnel aktif...',
          trojan: argoConfigs.trojan || 'Menunggu Cloudflare Argo Tunnel aktif...'
        },
        ssh: (() => {
          const sshHost = (argoConfigs.ssh && argoConfigs.ssh.host) ? argoConfigs.ssh.host : host;
          const sshPort = 443; // via Argo always 443
          const waiting = 'Menunggu Argo Tunnel aktif...';
          const ready = !!(argoConfigs.ssh && argoConfigs.ssh.host);
          return {
            host: sshHost,
            port: sshPort,
            user: SSH_USER,
            pass: SSH_PASS,
            ws_path: SSH_WS_PATH,
            // Format siap Neko/HTTP Injector: host:port@user:pass
            account: ready ? `${sshHost}:${sshPort}@${SSH_USER}:${SSH_PASS}` : waiting,
            // Payloads
            payload_get_ws:  ready ? (argoConfigs.ssh.payload_get_ws)  : waiting,
            payload_connect: ready ? (argoConfigs.ssh.payload_connect) : waiting,
            payload_get:     ready ? (argoConfigs.ssh.payload_get)     : waiting,
            payload_cdn:     ready ? (argoConfigs.ssh.payload_cdn)     : waiting,
            payload_sni:     ready ? (argoConfigs.ssh.payload_sni)     : waiting,
          };
        })()
      };
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(payload));
    }

    // Dashboard UI Utama
    if (parsedUrl.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>GATEWAY CORE</title>
          <style>
            :root {
              --bg-black: #000000;
              --panel-bg: #0a0a0a;
              --card-bg: #050505;
              --border-color: #1f1f1f;
              --border-hover: #333333;
              --text-main: #ffffff;
              --text-muted: #888888;
              --accent-blue: #0088FF;
              --accent-cyan: #00ffff;
              --accent-purple: #a855f7;
              --accent-pink: #ff0080;
              --status-green: #00df89;
              --status-red: #ff5f56;
            }

            * { box-sizing: border-box; margin: 0; padding: 0; }

            body {
              background-color: var(--bg-black);
              color: var(--text-main);
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 6vh 24px;
            }

            .window-container {
              width: 100%;
              max-width: 680px;
              background-color: var(--panel-bg);
              border: 1px solid var(--border-color);
              border-radius: 12px;
              box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8);
              overflow: hidden;
            }

            .window-header {
              background-color: var(--card-bg);
              border-bottom: 1px solid var(--border-color);
              padding: 14px 20px;
              display: flex;
              align-items: center;
              justify-content: space-between;
            }

            .mac-dots { display: flex; gap: 8px; }
            .dot { width: 12px; height: 12px; border-radius: 50%; opacity: 0.75; }
            .dot.close { background-color: #ff5f56; }
            .dot.minimize { background-color: #ffbd2e; }
            .dot.zoom { background-color: #27c93f; }

            .brand-title { font-size: 0.8rem; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; }
            .brand-media { color: #ffffff; }
            .brand-fairy { color: var(--accent-blue); }

            .status-badge { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 600; color: var(--status-green); }
            .pulse-dot {
              width: 6px; height: 6px; background-color: var(--status-green);
              border-radius: 50%; box-shadow: 0 0 8px var(--status-green);
              animation: ambientPulse 2.5s infinite ease-in-out;
            }

            .window-content { padding: 32px; }

            .uptime-section { text-align: center; padding-bottom: 24px; border-bottom: 1px solid var(--border-color); margin-bottom: 24px; }
            .section-label { font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 2px; margin-bottom: 6px; }
            .uptime-display { font-size: 2.5rem; font-weight: 800; letter-spacing: -1px; font-variant-numeric: tabular-nums; }

            /* 4 Columns Grid */
            .stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; }
            .card { background-color: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; position: relative; overflow: hidden; }
            .card-value { font-size: 1.25rem; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
            .live-speed { font-size: 0.75rem; font-family: monospace; font-weight: 600; margin-top: 6px; }
            .live-speed.down { color: var(--status-green); }
            .live-speed.up { color: var(--accent-blue); }
            .resource-bar { width: 100%; height: 3px; background-color: #222; position: absolute; bottom: 0; left: 0; }
            .resource-fill { height: 100%; background-color: var(--accent-cyan); transition: width 1s ease; }

            /* Live Chart */
            .chart-card { background-color: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin-bottom: 32px; }
            .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
            .legend { display: flex; gap: 12px; font-size: 0.7rem; color: var(--text-muted); font-weight: 600; }
            .legend-item { display: flex; align-items: center; gap: 4px; }
            .legend-color { width: 8px; height: 8px; border-radius: 50%; }
            .c-down { background-color: var(--status-green); box-shadow: 0 0 5px var(--status-green); }
            .c-up { background-color: var(--accent-blue); box-shadow: 0 0 5px var(--accent-blue); }
            .canvas-container { width: 100%; height: 120px; position: relative; }
            canvas { width: 100%; height: 100%; display: block; }

            .generator-section { background-color: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px; }
            .group-title { font-size: 0.75rem; font-weight: 600; color: var(--text-main); margin-bottom: 10px; border-left: 2px solid var(--border-hover); padding-left: 8px; }
            
            .btn-group-native { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
            .btn-group-argo { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
            
            button { background-color: #111; color: #fff; border: 1px solid var(--border-color); padding: 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
            button:hover { background-color: #222; border-color: #444; }
            button:active { transform: scale(0.98); }
            .btn-vless:hover { border-color: var(--accent-blue); color: var(--accent-blue); }
            .btn-vmess:hover { border-color: var(--accent-purple); color: var(--accent-purple); }
            .btn-trojan:hover { border-color: var(--accent-pink); color: var(--accent-pink); }
            .btn-ssh:hover { border-color: var(--status-green); color: var(--status-green); }
            .btn-ssh-socks:hover { border-color: var(--accent-cyan); color: var(--accent-cyan); }

            .ssh-card { background: #000; border: 1px solid var(--border-color); border-radius: 6px; padding: 14px; margin-bottom: 14px; }
            .ssh-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #111; }
            .ssh-row:last-child { border-bottom: none; }
            .ssh-label { font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 1px; }
            .ssh-val { font-family: monospace; font-size: 0.78rem; color: var(--status-green); font-weight: 600; }
            .ssh-val.account { color: var(--accent-cyan); font-size: 0.7rem; word-break: break-all; text-align: right; max-width: 65%; }

            .payload-select { width: 100%; background: #111; color: #fff; border: 1px solid var(--border-color); border-radius: 6px; padding: 9px 12px; font-size: 0.78rem; font-family: monospace; outline: none; margin-bottom: 10px; cursor: pointer; }
            .payload-select:focus { border-color: var(--status-green); }
            .payload-select option { background: #111; }

            .output-wrapper { display: flex; gap: 8px; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 20px; }
            input[type="text"] { flex: 1; background-color: #000; border: 1px solid var(--border-color); color: var(--status-green); padding: 12px 16px; border-radius: 6px; font-family: monospace; font-size: 0.75rem; outline: none; }
            input[type="text"]:focus { border-color: var(--border-hover); color: var(--text-main); }
            .btn-copy { background-color: var(--text-main); color: var(--bg-black); padding: 0 20px; border: none; font-weight: 600; }
            .btn-copy:hover { background-color: #e0e0e0; }

            @media (max-width: 600px) {
              body { padding: 4vh 16px; }
              .stats-grid { grid-template-columns: 1fr 1fr; }
              .output-wrapper { flex-direction: column; }
              .btn-copy { padding: 12px; }
            }

            @keyframes ambientPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
          </style>
        </head>
        <body>
          <div class="window-container">
            <div class="window-header">
              <div class="mac-dots"><div class="dot close"></div><div class="dot minimize"></div><div class="dot zoom"></div></div>
              <div class="brand-title"><span class="brand-media">MEDIA</span><span class="brand-fairy">FAIRY</span></div>
              <div class="status-badge"><div class="pulse-dot"></div>RUNNING</div>
            </div>

            <div class="window-content">
              <div class="uptime-section">
                <div class="section-label">System Uptime</div>
                <div class="uptime-display" id="uptime-field">00:00:00</div>
              </div>
              
              <div class="stats-grid">
                <div class="card">
                  <div class="section-label">CPU</div>
                  <div class="card-value" id="cpu-val">0%</div>
                  <div class="resource-bar"><div class="resource-fill" id="cpu-bar" style="width:0%"></div></div>
                </div>
                <div class="card">
                  <div class="section-label">RAM</div>
                  <div class="card-value" id="ram-val">0%</div>
                  <div class="resource-bar"><div class="resource-fill" id="ram-bar" style="width:0%"></div></div>
                </div>
                <div class="card">
                  <div class="section-label">Download</div>
                  <div class="card-value" id="dl-total">0 B</div>
                  <div class="live-speed down" id="dl-speed">↓ 0 B/s</div>
                </div>
                <div class="card">
                  <div class="section-label">Upload</div>
                  <div class="card-value" id="ul-total">0 B</div>
                  <div class="live-speed up" id="ul-speed">↑ 0 B/s</div>
                </div>
              </div>

              <div class="chart-card">
                <div class="chart-header">
                  <div class="section-label" style="margin:0;">Network Traffic (60s)</div>
                  <div class="legend">
                    <div class="legend-item"><div class="legend-color c-down"></div>RX</div>
                    <div class="legend-item"><div class="legend-color c-up"></div>TX</div>
                  </div>
                </div>
                <div class="canvas-container">
                  <canvas id="trafficChart"></canvas>
                </div>
              </div>

              <div class="generator-section">
                <div class="group-title">⚡ BUG SNI</div>
                <div class="btn-group-native">
                  <button class="btn-vless" onclick="generate('native', 'vless')">VLESS</button>
                  <button class="btn-trojan" onclick="generate('native', 'trojan')">TROJAN</button>
                </div>
                <div class="group-title">🚀 BUG CDN</div>
                <div class="btn-group-argo">
                  <button class="btn-vless" onclick="generate('argo', 'vless')">VLESS</button>
                  <button class="btn-vmess" onclick="generate('argo', 'vmess')">VMESS</button>
                  <button class="btn-trojan" onclick="generate('argo', 'trojan')">TROJAN</button>
                </div>
                <div class="group-title">🔐 SSH TUNNEL — HTTP/Neko Injector</div>

                <!-- Info Card SSH -->
                <div class="ssh-card">
                  <div class="ssh-row">
                    <span class="ssh-label">Host (Argo)</span>
                    <span class="ssh-val" id="ssh-host">Menunggu tunnel...</span>
                  </div>
                  <div class="ssh-row">
                    <span class="ssh-label">Port</span>
                    <span class="ssh-val" id="ssh-port">443</span>
                  </div>
                  <div class="ssh-row">
                    <span class="ssh-label">User</span>
                    <span class="ssh-val" id="ssh-user">-</span>
                  </div>
                  <div class="ssh-row">
                    <span class="ssh-label">Password</span>
                    <span class="ssh-val" id="ssh-pass">-</span>
                  </div>
                  <div class="ssh-row">
                    <span class="ssh-label">WS Path</span>
                    <span class="ssh-val" id="ssh-wspath">-</span>
                  </div>
                  <div class="ssh-row" style="flex-direction:column; align-items:flex-start; gap:4px; padding-top:8px;">
                    <span class="ssh-label">Account (host:port@user:pass)</span>
                    <span class="ssh-val account" id="ssh-account">Menunggu tunnel aktif...</span>
                  </div>
                </div>

                <!-- Payload Selector -->
                <div class="section-label" style="margin-bottom:6px;">Pilih Payload untuk disalin:</div>
                <select class="payload-select" id="payload-select" onchange="onPayloadSelect()">
                  <option value="">-- Pilih Payload --</option>
                  <option value="account">📋 Account String (host:port@user:pass)</option>
                  <option value="payload_get_ws">GET + WebSocket Upgrade (Recommended)</option>
                  <option value="payload_connect">CONNECT Tunnel (HTTPS Bug)</option>
                  <option value="payload_get">GET Biasa (HTTP Bug)</option>
                  <option value="payload_cdn">GET /cdn-cgi/trace (Cloudflare CDN Bug)</option>
                  <option value="payload_sni">CONNECT + SNI Domain</option>
                </select>

                <div class="output-wrapper">
                  <input type="text" id="config-output" readonly placeholder="Pilih konfigurasi atau payload di atas..." />
                  <button class="btn-copy" id="copy-btn" onclick="copyConfig()">Copy</button>
                </div>
              </div>
            </div>
          </div>

          <script>
            function formatBytes(bytes) {
              if (bytes === 0) return '0 B'; const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'], i = Math.floor(Math.log(bytes) / Math.log(k));
              return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }
            function formatTime(ts) {
              const d = Math.floor(ts/86400), h = Math.floor((ts%86400)/3600), m = Math.floor((ts%3600)/60), s = ts%60;
              return (d>0?d+'d ':'') + String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
            }

            // Chart Configuration
            const canvas = document.getElementById('trafficChart');
            const ctx = canvas.getContext('2d');
            const maxPoints = 60;
            let rxHistory = new Array(maxPoints).fill(0);
            let txHistory = new Array(maxPoints).fill(0);
            let lastRx = 0, lastTx = 0, isFirstRender = true;

            function drawChart() {
              const rect = canvas.parentElement.getBoundingClientRect();
              canvas.width = rect.width * window.devicePixelRatio;
              canvas.height = rect.height * window.devicePixelRatio;
              ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
              
              const w = rect.width; const h = rect.height;
              ctx.clearRect(0, 0, w, h);

              // Grid lines
              ctx.strokeStyle = '#1f1f1f'; ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h); ctx.stroke();

              const maxVal = Math.max(...rxHistory, ...txHistory, 1024); // Minimal 1KB scale
              
              function renderLine(data, color, shadowColor) {
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.shadowBlur = 12;
                ctx.shadowColor = shadowColor;
                
                for(let i=0; i<data.length; i++) {
                  const x = (i / (maxPoints - 1)) * w;
                  const y = h - ((data[i] / maxVal) * h * 0.9); // 10% padding top
                  if(i === 0) ctx.moveTo(x, y);
                  else ctx.lineTo(x, y);
                }
                ctx.stroke();
                ctx.shadowBlur = 0; // Reset
              }

              renderLine(rxHistory, '#00df89', 'rgba(0, 223, 137, 0.5)'); // Green RX
              renderLine(txHistory, '#0088FF', 'rgba(0, 136, 255, 0.5)'); // Blue TX
            }

            async function refreshDashboardStats() {
              try {
                const res = await fetch('/api/stats'); const data = await res.json();
                
                document.getElementById('uptime-field').innerText = formatTime(data.uptime);
                
                // Update CPU & RAM
                document.getElementById('cpu-val').innerText = data.cpu + '%';
                document.getElementById('cpu-bar').style.width = data.cpu + '%';
                document.getElementById('cpu-bar').style.backgroundColor = data.cpu > 80 ? 'var(--status-red)' : 'var(--accent-cyan)';
                
                document.getElementById('ram-val').innerText = data.ram + '%';
                document.getElementById('ram-bar').style.width = data.ram + '%';
                document.getElementById('ram-bar').style.backgroundColor = data.ram > 85 ? 'var(--status-red)' : 'var(--accent-purple)';

                // Calculate Speed
                let rxSpeed = 0, txSpeed = 0;
                if (!isFirstRender) {
                  rxSpeed = Math.max(0, data.rx - lastRx);
                  txSpeed = Math.max(0, data.tx - lastTx);
                }
                isFirstRender = false;
                lastRx = data.rx; lastTx = data.tx;

                // Update Text
                document.getElementById('dl-total').innerText = formatBytes(data.rx);
                document.getElementById('ul-total').innerText = formatBytes(data.tx);
                document.getElementById('dl-speed').innerText = '↓ ' + formatBytes(rxSpeed) + '/s';
                document.getElementById('ul-speed').innerText = '↑ ' + formatBytes(txSpeed) + '/s';

                // Update Chart
                rxHistory.push(rxSpeed); rxHistory.shift();
                txHistory.push(txSpeed); txHistory.shift();
                drawChart();

              } catch (e) {}
            }
            
            refreshDashboardStats(); setInterval(refreshDashboardStats, 1000);
            window.addEventListener('resize', drawChart);

            async function generate(network, protocol) {
              const outputEl = document.getElementById('config-output');
              outputEl.value = 'Loading...'; document.getElementById('copy-btn').innerText = 'Copy';
              // Reset payload select
              document.getElementById('payload-select').value = '';
              try {
                const res = await fetch('/api/config'); const data = await res.json();
                outputEl.value = data[network][protocol];
              } catch (e) { outputEl.value = 'Gagal mengambil konfigurasi.'; }
            }

            // Cache data SSH agar tidak fetch ulang setiap klik
            let _sshCache = null;

            async function getSshData() {
              if (_sshCache && _sshCache.host && _sshCache.host !== 'Menunggu tunnel...') return _sshCache;
              try {
                const res = await fetch('/api/config');
                const data = await res.json();
                _sshCache = data.ssh;
                return data.ssh;
              } catch(e) { return null; }
            }

            async function onPayloadSelect() {
              const sel = document.getElementById('payload-select');
              const key = sel.value;
              if (!key) return;
              const outputEl = document.getElementById('config-output');
              outputEl.value = 'Loading...';
              document.getElementById('copy-btn').innerText = 'Copy';
              const ssh = await getSshData();
              if (!ssh) { outputEl.value = 'Gagal fetch data SSH.'; return; }
              const val = ssh[key] || 'Data belum tersedia, tunggu tunnel aktif.';
              outputEl.value = val;
            }

            async function loadSSHInfo() {
              try {
                const ssh = await getSshData();
                if (!ssh) return;
                // Force refresh jika tunnel baru aktif
                if (document.getElementById('ssh-host').innerText !== ssh.host) _sshCache = null;
                document.getElementById('ssh-host').innerText    = ssh.host    || 'Menunggu tunnel...';
                document.getElementById('ssh-port').innerText    = ssh.port    || '443';
                document.getElementById('ssh-user').innerText    = ssh.user    || '-';
                document.getElementById('ssh-pass').innerText    = ssh.pass    || '-';
                document.getElementById('ssh-wspath').innerText  = ssh.ws_path || '-';
                document.getElementById('ssh-account').innerText = ssh.account || 'Menunggu tunnel aktif...';
              } catch (e) {}
            }

            loadSSHInfo();
            setInterval(() => { _sshCache = null; loadSSHInfo(); }, 10000);

            function copyConfig() {
              const el = document.getElementById('config-output');
              if (!el.value || el.value.includes('Loading')) return; 
              el.select(); el.setSelectionRange(0, 99999);
              navigator.clipboard.writeText(el.value).then(() => {
                const btn = document.getElementById('copy-btn'); btn.innerText = 'Copied!';
                setTimeout(() => { if (btn.innerText === 'Copied!') btn.innerText = 'Copy'; }, 2000);
              });
            }
          </script>
        </body>
        </html>
      `);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not Found');
  }

  // ==================== WEBSOCKET HANDLERS ====================
  async handleWebSocketConnection(ws, request) {
    try {
      const pathname = url.parse(request.url, true).pathname;

      // SSH over WebSocket bridge
      if (pathname === SSH_WS_PATH) {
        return this.handleSSHWebSocket(ws);
      }

      if (pathname === '/vless-BlueHat358' || pathname === '/trojan-BlueHat358' || pathname === '/vmess-BlueHat358') {
        return await this.websocketHandler(ws);
      }
      ws.close(1000, "Invalid Path");
    } catch (err) { ws.close(1011); }
  }

  // SSH over WebSocket: bridge WS <-> TCP ke sshd lokal
  handleSSHWebSocket(ws) {
    let pendingBuffer = []; // buffer data sshd sebelum WS ready
    let wsReady = false;

    const sshSocket = net.createConnection({ host: '127.0.0.1', port: parseInt(SSH_PORT) }, () => {
      console.log('[SSH-WS] Client connected, bridging to sshd');
    });

    // Flush pending buffer begitu WS open
    const flushPending = () => {
      wsReady = true;
      if (pendingBuffer.length > 0) {
        console.log(`[SSH-WS] Flushing ${pendingBuffer.length} buffered chunk(s) to WS`);
        for (const chunk of pendingBuffer) {
          try { ws.send(chunk); } catch(e) {}
        }
        pendingBuffer = [];
      }
    };

    // WS open event — pastikan flush saat ready
    if (ws.readyState === WS_READY_STATE_OPEN) {
      flushPending();
    } else {
      ws.once('open', flushPending);
      // Fallback: anggap ready setelah 100ms jika event tidak fired
      setTimeout(() => { if (!wsReady) flushPending(); }, 100);
    }

    // SSH → WS: buffer jika belum ready
    sshSocket.on('data', (chunk) => {
      try {
        this.stats.tx += chunk.length;
        if (wsReady && ws.readyState === WS_READY_STATE_OPEN) {
          ws.send(chunk);
        } else {
          pendingBuffer.push(chunk);
        }
      } catch(e) {}
    });

    // WS → SSH
    ws.on('message', (data) => {
      try {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        this.stats.rx += buf.length;
        if (sshSocket.writable) sshSocket.write(buf);
      } catch(e) {}
    });

    // Cleanup dua arah
    ws.on('close', () => { pendingBuffer = []; try { sshSocket.destroy(); } catch(e) {} });
    ws.on('error', () => { pendingBuffer = []; try { sshSocket.destroy(); } catch(e) {} });
    sshSocket.on('close', () => { try { ws.close(); } catch(e) {} });
    sshSocket.on('error', (err) => {
      console.error('[SSH-WS] sshd connection error:', err.message);
      try { ws.close(1011, 'SSH backend error'); } catch(e) {}
    });
  }

  async websocketHandler(ws) {
    let remoteSocketWrapper = { value: null };
    ws.on('message', async (message) => {
      try {
        const chunk = Buffer.from(message);
        this.stats.rx += chunk.length;
        if (remoteSocketWrapper.value) return remoteSocketWrapper.value.write(chunk);

        const protocol = await this.protocolSniffer(chunk);
        const protocolHeader = protocol === horse ? this.readHorseHeader(chunk) : this.readFlashHeader(chunk); 
        if (protocolHeader.hasError) throw new Error(protocolHeader.message);

        if (protocolHeader.isUDP) return await this.handleUDPOutbound(protocolHeader.addressRemote, protocolHeader.portRemote, chunk.slice(protocolHeader.rawDataIndex), ws, protocolHeader.version);
        this.handleTCPOutBound(remoteSocketWrapper, protocolHeader.addressRemote, protocolHeader.portRemote, protocolHeader.rawClientData, ws, protocolHeader.version);
      } catch (err) { ws.close(1011, err.message); }
    });
    ws.on('close', () => { if (remoteSocketWrapper.value) remoteSocketWrapper.value.end(); this.cleanupUDPConnections(ws); });
    ws.on('error', () => this.cleanupUDPConnections(ws));
  }

  async protocolSniffer(buffer) {
    if (buffer.length >= 62) {
      const hd = buffer.slice(56, 60);
      if (hd[0] === 0x0d && hd[1] === 0x0a && [0x01, 0x03, 0x7f].includes(hd[2]) && [0x01, 0x03, 0x04].includes(hd[3])) return horse;
    }
    return flash; 
  }

  async handleTCPOutBound(remoteSocket, addressRemote, portRemote, rawClientData, webSocket, responseHeader) {
    try {
      const tcpSocket = net.createConnection({ host: addressRemote, port: portRemote }, () => tcpSocket.write(rawClientData));
      remoteSocket.value = tcpSocket;
      tcpSocket.on('close', () => webSocket.close());
      tcpSocket.on('error', () => webSocket.close());
      
      let header = responseHeader;
      tcpSocket.on('data', (chunk) => {
        this.stats.tx += chunk.length;
        if (webSocket.readyState !== WS_READY_STATE_OPEN) return tcpSocket.destroy();
        if (header) { webSocket.send(Buffer.concat([Buffer.from(header), chunk])); header = null; } 
        else webSocket.send(chunk);
      });
    } catch (error) { webSocket.close(); }
  }

  async handleUDPOutbound(targetAddress, targetPort, dataChunk, webSocket, responseHeader) {
    return new Promise((resolve) => {
      try {
        let header = responseHeader;
        const key = `${targetAddress}:${targetPort}:${Date.now()}`;
        const udpSocket = dgram.createSocket('udp4');
        
        this.activeUDPConnections.set(key, { socket: udpSocket, webSocket });
        udpSocket.on('error', () => { try { udpSocket.close(); } catch (_) {} this.activeUDPConnections.delete(key); });
        udpSocket.send(dataChunk, targetPort, targetAddress);
        
        udpSocket.on('message', (message) => {
          this.stats.tx += message.length;
          if (webSocket.readyState === WS_READY_STATE_OPEN) {
            if (header) { webSocket.send(Buffer.concat([Buffer.from(header), message])); header = null; } 
            else webSocket.send(message);
          }
        });
        
        let timeout = setTimeout(() => { try { udpSocket.close(); } catch (_) {} this.activeUDPConnections.delete(key); }, 30000);
        udpSocket.on('message', () => { clearTimeout(timeout); timeout = setTimeout(() => { try { udpSocket.close(); } catch (_) {} this.activeUDPConnections.delete(key); }, 30000); });
      } catch (e) {}
    });
  }

  cleanupUDPConnections(webSocket) {
    for (const [key, conn] of this.activeUDPConnections.entries()) {
      if (conn.webSocket === webSocket) { try { conn.socket.close(); } catch (_) {} this.activeUDPConnections.delete(key); }
    }
  }

  readFlashHeader(buffer) {
    const v = buffer[0], optLen = buffer[17], cmd = buffer[18 + optLen], portIdx = 18 + optLen + 1;
    if (cmd !== 1 && cmd !== 2) return { hasError: true, message: "cmd unsupported" };
    const port = buffer.readUInt16BE(portIdx), addrType = buffer[portIdx + 2];
    let addrLen = 0, addrIdx = portIdx + 3, addr = "";
    
    if (addrType === 1) { addrLen = 4; addr = Array.from(buffer.slice(addrIdx, addrIdx + addrLen)).join("."); }
    else if (addrType === 2) { addrLen = buffer[addrIdx]; addrIdx++; addr = buffer.slice(addrIdx, addrIdx + addrLen).toString(); }
    else if (addrType === 3) { addrLen = 16; addr = Array.from({length: 8}, (_, i) => buffer.readUInt16BE(addrIdx + i*2).toString(16)).join(":"); }
    else return { hasError: true };

    return { hasError: false, addressRemote: addr, portRemote: port, rawDataIndex: addrIdx + addrLen, rawClientData: buffer.slice(addrIdx + addrLen), version: Buffer.from([v, 0]), isUDP: cmd === 2 };
  }

  readHorseHeader(buffer) {
    const data = buffer.slice(58);
    if (data.length < 6 || (data[0] !== 1 && data[0] !== 3)) return { hasError: true };
    const addrType = data[1];
    let addrLen = 0, addrIdx = 2, addr = "";
    
    if (addrType === 1) { addrLen = 4; addr = Array.from(data.slice(addrIdx, addrIdx + addrLen)).join("."); }
    else if (addrType === 3) { addrLen = data[addrIdx]; addrIdx++; addr = data.slice(addrIdx, addrIdx + addrLen).toString(); }
    else if (addrType === 4) { addrLen = 16; addr = Array.from({length: 8}, (_, i) => data.readUInt16BE(addrIdx + i*2).toString(16)).join(":"); }
    else return { hasError: true };

    const portIdx = addrIdx + addrLen;
    return { hasError: false, addressRemote: addr, portRemote: data.readUInt16BE(portIdx), rawDataIndex: portIdx + 4, rawClientData: data.slice(portIdx + 4), version: null, isUDP: data[0] === 3 };
  }

  start(port) {
    this.httpServer = http.createServer((req, res) => this.handleHttpRequest(req, res));
    this.wss = new WebSocket.Server({ server: this.httpServer, perMessageDeflate: false });
    this.wss.on('connection', (ws, req) => this.handleWebSocketConnection(ws, req));
    this.httpServer.listen(port, '0.0.0.0', () => console.log(`[SYSTEM] Hybrid Gateway Active on Port ${port}`));
  }
}

// ==================== BOOT SEQUENCE ====================
(async () => {
  console.log('[SYSTEM] Initializing Hybrid Core...');
  const server = new HybridServer();
  server.start(PORT);
  startBackgroundServices().catch(err => console.error('[SYSTEM] Background service error:', err));
})();
