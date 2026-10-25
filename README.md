# RatioMaster CLI 🚀

> **A modern, fast, and cross-platform command-line BitTorrent ratio spoofer & tracker announce simulator based on the logic of RatioMaster.NET.**

[🇬🇧 English](#-english) • [🇫🇷 Français](#-français)

---

## 🇬🇧 English

Simulates upload and download traffic to BitTorrent HTTP/HTTPS trackers without downloading or uploading actual files, allowing you to maintain or boost your ratio on private trackers.

### ⚡ Features

- 🖥️ **TUI Terminal Dashboard**: Real-time interactive dashboard displaying current speeds, total uploaded/downloaded, calculated ratio, countdown to next announce, seeders/leechers count, and live log stream.
- 🌐 **Web GUI**: Built-in web dashboard (`--gui`) accessible at `http://localhost:3000`.
- ⚙️ **Accurate BitTorrent Client Emulation**:
  - `qBittorrent` (5.3.0, 5.2.3, 5.0.0, 4.6.3, 4.5.2)
  - `Transmission` (4.0.5, 3.00, 2.92)
  - `uTorrent` (3.5.5, 3.3.2, 2.0.1, 1.8.5)
  - `Deluge` (2.1.1, 1.2.0)
  - `BiglyBT` (3.4.0), `Vuze` (4.2.0.8), and more
- 📊 **Simulation Modes**:
  - **Seeding** (100% completed) or **Leeching** (simulated download progression).
  - Fixed speeds or dynamic random ranges (e.g., `15MB-30MB` or `500-1500` KB/s).
- 🛑 **Automatic Stop Conditions**:
  - On target ratio (e.g., `--stop-ratio 2.0`).
  - On total uploaded volume (e.g., `--stop-uploaded 10GB`).
  - On total downloaded volume (e.g., `--stop-downloaded 2GB`).
  - On elapsed duration (e.g., `--stop-time 3600`).
- 🔄 **Graceful Shutdown**: Automatically sends `event=stopped` to the tracker on exit (`Ctrl+C` or limit reached) so all transferred data is recorded.
- 🛡️ **Smart Anti-Ban (Zero-Leecher Protection)**: Automatically pauses upload simulation to 0 B/s (or stops simulation) when 0 leechers are detected in the swarm, preventing impossible upload reports on strict private trackers. Automatically resumes when leechers join.
- 🤖 **Headless Mode**: `--headless` flag for headless servers, Docker containers, cron jobs, and background scripts.

---

### 📦 Installation & Getting Started

#### Direct execution
```bash
cd ratiomaster-cli
npm start -- /path/to/file.torrent
```

#### Global link / CLI binary
```bash
npm link
ratiomaster --help
```

---

### 🛠 Usage Examples

#### 1. Standard simulation (qBittorrent 4.6.3, 500-1500 KB/s upload)
```bash
ratiomaster ~/Downloads/movie.torrent
```

#### 2. Emulate qBittorrent 5.3.0 with custom port and 15-30 MB/s speed
```bash
ratiomaster ~/Downloads/movie.torrent -c qBittorrent-5.3.0 -p 31153 -u 15MB-30MB --stop-uploaded 10GB
```

#### 3. Emulate Transmission with fixed upload and download
```bash
ratiomaster ~/Downloads/movie.torrent -c Transmission-4.0.5 -u 1200 -d 50
```

#### 4. Automatic stop on target ratio or upload size
```bash
ratiomaster ~/Downloads/movie.torrent --stop-ratio 2.0
ratiomaster ~/Downloads/movie.torrent --stop-uploaded 5GB
```

#### 5. List all supported BitTorrent client presets
```bash
ratiomaster --list-clients
```

#### 6. Headless mode (no TUI, plain text logs)
```bash
ratiomaster ~/Downloads/movie.torrent --headless --stop-uploaded 10GB
```

#### 7. Web GUI Dashboard
```bash
npm run gui
# Access http://localhost:3000 in your browser
```

---

### 📋 CLI Options Reference

```text
Arguments:
  torrent                        Path to one or multiple .torrent files

Options:
  -c, --client <name>            BitTorrent client profile to emulate (default: "qBittorrent-4.6.3")
  -u, --upload <speed>           Upload speed (e.g. "1200", "15MB-30MB", or "500-1500") (default: "500-1500")
  -d, --download <speed>         Download speed (default: "0")
  -p, --port <number>            Peer listening port reported to tracker
  -r, --stop-ratio <ratio>       Stop simulation once target ratio is reached (e.g. 2.0)
  -s, --stop-uploaded <size>     Stop simulation once target upload size is reached (e.g. "10GB" or "500MB")
  --stop-downloaded <size>       Stop simulation once target download size is reached (e.g. "2GB")
  -t, --stop-time <seconds>      Stop simulation after elapsed time in seconds
  -i, --interval <seconds>       Override tracker announce interval in seconds
  -m, --mode <seeding|leeching>  Initial mode: seeding (100% done) or leeching (0% done) (default: "seeding")
  -a, --announce-url <url>       Override announce URL from torrent file
  --custom-peer-id <id>          Custom 20-character Peer-ID to report to tracker
  --custom-user-agent <agent>    Custom HTTP User-Agent string
  --scrape                       Fetch tracker scrape statistics before announcing
  --no-zero-leech                Disable zero-leecher safety protection
  --zero-leech-action <action>   Action when 0 leechers are detected: "pause" (default) or "stop"
  --gui                          Launch the Web GUI interface in browser
  --gui-port <port>              Port for Web GUI server (default: 3000)
  --list-clients                 List all supported client presets and exit
  --headless                     Run without TUI full-screen interface (plain logging output)
```

---

## 🇫🇷 Français

Permet de simuler la vitesse d'upload et de download auprès des trackers BitTorrent (HTTP/HTTPS) sans télécharger/uploader réellement les fichiers, afin de maintenir ou booster son ratio sur les trackers privés.

### ⚡ Caractéristiques

- 🖥️ **Interface Dashboard TUI** : Affichage temps réel dans le terminal (vitesses instantanées, volume transféré, ratio calculé, décompte avant prochain announce, seeders/leechers, logs en direct).
- 🌐 **Interface Web (GUI)** : Tableau de bord web intégré (`--gui`) accessible sur `http://localhost:3000`.
- ⚙️ **Émulation exacte de clients BitTorrent** :
  - `qBittorrent` (5.3.0, 5.2.3, 5.0.0, 4.6.3, 4.5.2)
  - `Transmission` (4.0.5, 3.00, 2.92)
  - `uTorrent` (3.5.5, 3.3.2, 2.0.1, 1.8.5)
  - `Deluge` (2.1.1, 1.2.0)
  - `BiglyBT` (3.4.0), `Vuze` (4.2.0.8), etc.
- 📊 **Modes de simulation** :
  - **Seeding** (100% complété) ou **Leeching** (progression du téléchargement simulé).
  - Vitesse fixe ou plages de vitesse min-max aléatoires (ex: `15MB-30MB` ou `500-1500` KB/s).
- 🛑 **Conditions d'arrêt automatique** :
  - Sur ratio cible (ex: `--stop-ratio 2.0`).
  - Sur volume d'upload total (ex: `--stop-uploaded 10GB`).
  - Sur volume de download total (ex: `--stop-downloaded 2GB`).
  - Sur durée écoulée (ex: `--stop-time 3600`).
- 🔄 **Arrêt propre & Graceful Shutdown** : Envoi automatique de l'événement `stopped` au tracker lors de la fermeture (Ctrl+C ou objectif atteint) afin que toutes les données soient enregistrées par le tracker.
- 🛡️ **Protection Anti-Ban Intelligente (Zéro Leecher)** : Met automatiquement la vitesse d'upload simulée à 0 B/s (ou stoppe la simulation) si le swarm n'a aucun leecher, évitant de se faire repérer par les anti-triches de trackers privés. Reprend automatiquement dès qu'un leecher arrive.
- 🤖 **Mode Headless / Automation** : Option `--headless` pour l'intégration dans des scripts Bash, conteneurs Docker ou tâches Cron.

---

### 📦 Installation & Démarrage

#### Exécution directe
```bash
cd ratiomaster-cli
npm start -- /chemin/vers/fichier.torrent
```

#### Installation globale ou via symlink
```bash
npm link
ratiomaster --help
```

---

### 🛠 Exemples d'utilisation

#### 1. Simulation standard (qBittorrent 4.6.3, upload 500-1500 KB/s)
```bash
ratiomaster ~/Downloads/mon_fichier.torrent
```

#### 2. Émuler qBittorrent 5.3.0 avec port personnalisé et upload 15-30 Mo/s
```bash
ratiomaster ~/Downloads/mon_fichier.torrent -c qBittorrent-5.3.0 -p 31153 -u 15MB-30MB --stop-uploaded 10GB
```

#### 3. Arrêter automatiquement à un ratio de 2.0 ou après 5GB d'upload
```bash
ratiomaster ~/Downloads/mon_fichier.torrent --stop-ratio 2.0
ratiomaster ~/Downloads/mon_fichier.torrent --stop-uploaded 5GB
```

#### 4. Lister tous les profils de clients BitTorrent supportés
```bash
ratiomaster --list-clients
```

#### 5. Mode Headless pour serveurs / scripts sans TUI
```bash
ratiomaster ~/Downloads/mon_fichier.torrent --headless --stop-uploaded 10GB
```

#### 6. Lancer l'interface Web GUI
```bash
npm run gui
# Ouvrir http://localhost:3000 dans votre navigateur
```

---

## 🧪 Tests

```bash
npm test
```

## 📜 Licence

MIT
