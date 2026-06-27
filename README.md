<div align="center">
  <h1><span style="color: white;">BlueHat</span><span style="color: #0088FF;">358</span> GATEWAY CORE</h1>
  <p><strong>Advanced Hybrid Web Panel & VPN Tunneling (VLESS, VMESS, TROJAN, SSH)</strong></p>
  <p>Gateway Core berbasis Node.js dengan antarmuka macOS-inspired. Menggabungkan routing Xray-core, Cloudflared (Argo Tunnel), SSH Server, dan Web Dashboard dalam satu environment yang ringan.</p>
</div>

---

## ⚡ Fitur Utama
* **Dashboard:** Antarmuka UI premium (macOS-inspired) dengan label WS / gRPC / SSH.
* **Live Telemetry:** Monitoring System Uptime, CPU, RAM, dan Live Network Traffic Chart.
* **Multi-Protocol:** VLESS, VMESS, TROJAN via **WebSocket** dan **gRPC**.
* **SSH over WebSocket:** SSH tunnel via Cloudflare CDN menggunakan WebSocket bridge.
* **Hybrid Mode:** Mendukung konfigurasi Bug CDN & SNI untuk semua protokol (VLESS, VMESS, TROJAN).
* **Zero Trust Integration:** Terhubung otomatis ke Cloudflare Tunnels.
* **Auto-Fallback:** Distribusi traffic cerdas ke port 8001 (Xray) dan 3000 (Node.js).

---

## 🛠️ Environment Variables

| Variable    | Deskripsi                                              | Default / Wajib     |
| :---------- | :----------------------------------------------------- | :------------------ |
| `PORT`      | Port utama Web Dashboard                               | `3000`              |
| `UUID`      | UUID untuk klien VPN (VLESS/VMESS/Trojan)              | Wajib (UUIDv4)      |
| `ARGO_DOMAIN` | Domain publik Cloudflare Zero Trust                  | Wajib (mode CDN)    |
| `ARGO_AUTH` | Token Cloudflare Tunnel                                | Wajib (mode CDN)    |
| `CFIP`      | Bug IP CDN / SNI untuk bypass provider                 | `saas.sin.fan`      |
| `NAME`      | Nama alias untuk tag konfigurasi                       | `BLUEHAT358`        |
| `SSH_USER`  | Username SSH (default root)                            | `root`              |
| `SSH_PASS`  | Password SSH                                           | `BlueHat358`  |

> **Penting:** Ganti `SSH_PASS` dengan password yang kuat sebelum deploy!

---

## 🚂 Deployment via Railway

### Langkah 1: Hubungkan GitHub ke Railway
1. Fork repositori ini ke akun GitHub kamu.
2. Buka [Railway.app](https://railway.app/) dan login.
3. Klik **New Project** → **Deploy from GitHub repo**.
4. Pilih repositori `argo-hybrid` yang sudah di-fork.

### Langkah 2: Tambahkan Environment Variables
Di tab **Variables**, tambahkan:
* `UUID` — UUIDv4 milikmu
* `ARGO_DOMAIN` — domain Zero Trust kamu
* `ARGO_AUTH` — token tunnel Cloudflare (`ey...`)
* `SSH_PASS` — password SSH yang kuat
* `CFIP` — (opsional) bug IP CDN

### Langkah 3: Akses Web Dashboard
Di tab **Settings** → **Networking** → **Generate Domain**, buka URL tersebut.

---

## 🚀 Panduan Networking Tunnels

### Cloudflare Tunnel Setup
1. Buka **Cloudflare** → **Networks** → **Tunnels**.
2. Buat tunnel baru, salin token ke `ARGO_AUTH`.
3. Di tab **Public Hostname**, tambahkan rute:
   * **Service Type:** `HTTP`
   * **Service URL:** `http://localhost:8001`
4. Aktifkan **WebSockets** di menu **Network**.
5. Matikan **Bot Fight Mode** di **Security > Bots**.
6. Matikan **Browser Integrity Check** di **Security > WAF > Settings**.

> **Untuk gRPC:** Aktifkan **HTTP/2** di Cloudflare dan pastikan **gRPC** toggle ON di Network settings.

---

## 🔐 Cara Pakai SSH via WebSocket

SSH tersedia dalam dua mode:
- **SSH via SNI** — langsung ke Railway host (tanpa Argo). Cocok untuk bug host via HTTP proxy payload (HTTP Injector, HTTP Custom, NapsternetV, dll).
- **SSH via CDN** — melewati Argo/Cloudflare tunnel. Cocok untuk bug CDN.

### Install websocat (client)
```bash
# Linux/macOS
curl -Lo websocat https://github.com/vi/websocat/releases/latest/download/websocat.x86_64-unknown-linux-musl
chmod +x websocat && sudo mv websocat /usr/local/bin/

# macOS via Homebrew
brew install websocat

# Windows: download dari GitHub releases
```

### Mode SNI (langsung ke Railway, tanpa Argo)

Klik tombol **SSH via SNI** di dashboard untuk mendapatkan config lengkap. Output-nya sudah termasuk:

```
# ~/.ssh/config
Host BlueHat358-ssh-sni
  HostName your-railway-domain.up.railway.app
  User root
  ProxyCommand websocat - wss://your-railway-domain.up.railway.app/ssh-BlueHat358
```

Untuk SSH tunnel app (HTTP Injector, HTTP Custom, dll):
```
Server  : your-railway-domain.up.railway.app
Port    : 443
Path    : /ssh-BlueHat358
SSL/TLS : ON

# Payload PATCH (WebSocket Upgrade):
PATCH /ssh-BlueHat358 HTTP/1.1[crlf]Host: your-railway-domain.up.railway.app[crlf]Upgrade: websocket[crlf]Connection: Upgrade[crlf]User-Agent: [ua][crlf][crlf]
```

### Mode CDN (via Argo Tunnel)

Klik tombol **SSH via CDN** di dashboard. Lalu paste config ke `~/.ssh/config`:

```
Host BlueHat358-ssh
  HostName your-argo-domain.com
  User root
  ProxyCommand websocat - wss://your-argo-domain.com/ssh-BlueHat358
```

### Koneksi SSH
```bash
ssh BlueHat358-ssh-sni   # mode SNI
ssh BlueHat358-ssh       # mode CDN
```

---

## 📡 Protokol yang Didukung

| Protokol      | Transport  | Bug SNI | Bug CDN |
| :------------ | :--------- | :-----: | :-----: |
| VLESS         | WebSocket  | ✅      | ✅      |
| TROJAN        | WebSocket  | ✅      | ✅      |
| VMESS         | WebSocket  | ✅      | ✅      |
| VLESS         | gRPC       | ✅      | ✅      |
| TROJAN        | gRPC       | ✅      | ✅      |
| VMESS         | gRPC       | ✅      | ✅      |
| SSH           | WebSocket  | ✅      | ✅      |

---

## ⚠️ Catatan Penting
* **REALITY / XTLS Vision** tidak didukung karena Railway terminate TLS di edge sebelum sampai ke container.
* gRPC memerlukan HTTP/2 aktif di Cloudflare (gratis, aktifkan di Network settings).
* SSH menggunakan bridge WebSocket, bukan raw TCP — butuh `websocat` di sisi client.
