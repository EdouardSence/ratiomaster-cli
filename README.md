# RatioMaster CLI 🚀

Une version en ligne de commande (CLI) moderne, rapide et multiplateforme basée sur la logique de **RatioMaster.NET** (BitTorrent ratio spoofer & tracker announce simulator).

Permet de simuler la vitesse d'upload et de download auprès des trackers BitTorrent (HTTP/HTTPS) sans télécharger/uploader réellement les fichiers, afin de maintenir ou booster son ratio sur les trackers privés.

---

## ⚡ Caractéristiques

- 🖥️ **Interface Dashboard TUI** : Affichage temps réel dans le terminal (vitesses instantanées, volume transféré, ratio calculé, décompte avant prochain announce, seeders/leechers, logs en direct).
- ⚙️ **Émulation exacte de clients BitTorrent** :
  - `qBittorrent` (5.0.0, 4.6.3, 4.5.2)
  - `Transmission` (4.0.5, 3.00)
  - `uTorrent` (3.5.5, 3.3.2)
  - `Deluge` (2.1.1)
  - `BiglyBT` (3.4.0)
- 📊 **Modes de simulation** :
  - **Seeding** (100% complété) ou **Leeching** (progression du téléchargement simulé).
  - Vitesse fixe ou plages de vitesse min-max aléatoires (ex: `500-1500` KB/s).
- 🛑 **Conditions d'arrêt automatique** :
  - Sur ratio cible (ex: `--stop-ratio 2.0`).
  - Sur volume d'upload total (ex: `--stop-uploaded 5GB`).
  - Sur durée écoulée (ex: `--stop-time 3600`).
- 🔄 **Arrêt propre & Graceful Shutdown** : Envoi de l'événement `stopped` au tracker lors de la fermeture (Ctrl+C) afin que toutes les données soient enregistrées par le tracker.
- 🤖 **Mode Headless / Automation** : Option `--headless` pour l'intégration dans des scripts Bash, conteneurs Docker ou tâches Cron.

---

## 📦 Installation & Démarrage

### Exécution directe
```bash
cd ratiomaster-cli
npm start -- /chemin/vers/fichier.torrent
```

### Installation globale ou via symlink
```bash
npm link
ratiomaster --help
```

---

## 🛠 Exemples d'utilisation

### 1. Démarrer une simulation standard (qBittorrent 4.6.3, upload 500-1500 KB/s)
```bash
ratiomaster ~/Downloads/mon_fichier.torrent
```

### 2. Spécifier un client et des vitesses précises
```bash
ratiomaster ~/Downloads/mon_fichier.torrent -c Transmission-4.0.5 -u 1200 -d 0
```

### 3. Arrêter automatiquement à un ratio de 2.0 ou après 5GB d'upload
```bash
ratiomaster ~/Downloads/mon_fichier.torrent --stop-ratio 2.0
ratiomaster ~/Downloads/mon_fichier.torrent --stop-uploaded 5GB
```

### 4. Lister tous les profils de clients BitTorrent supportés
```bash
ratiomaster --list-clients
```

### 5. Mode Headless pour serveurs / scripts sans TUI
```bash
ratiomaster ~/Downloads/mon_fichier.torrent --headless --stop-uploaded 10GB
```

---

## 📋 Options CLI complets

```
Arguments:
  torrent                        Chemin vers le fichier .torrent

Options:
  -c, --client <name>            Profil client BitTorrent à émuler (default: "qBittorrent-4.6.3")
  -u, --upload <speed>           Vitesse d'upload en KB/s (ex: "1000" ou plage "500-1500") (default: "500-1500")
  -d, --download <speed>         Vitesse de download en KB/s (default: "0")
  -p, --port <number>            Port écoute peer signalé au tracker
  -r, --stop-ratio <ratio>       S'arrêter une fois le ratio cible atteint (ex: 2.0)
  -s, --stop-uploaded <size>     S'arrêter une fois la taille d'upload atteinte (ex: "5GB" ou "500MB")
  -t, --stop-time <seconds>      S'arrêter après une durée en secondes
  -i, --interval <seconds>       Outrepasser l'intervalle d'annonce du tracker
  -m, --mode <seeding|leeching>  Mode initial (default: "seeding")
  -a, --announce-url <url>       Outrepasser l'URL d'announce du torrent
  --list-clients                 Lister les profils de clients et quitter
  --headless                     Exécution sans interface plein écran TUI
```

---

## 🧪 Tests

```bash
npm test
```

## 📜 Licence

MIT
