DEPLOY CLOUDFLARE PAGES
=======================

Upload seluruh isi folder ini ke Cloudflare Pages sebagai static site.

Build command : kosongkan
Build output  : folder ini (root)

Pastikan index.html, manifest.webmanifest, sw.js, assets, dan data berada
di level yang sama seperti pada paket ini.

Setelah online melalui HTTPS, PWA dapat dipasang dari browser/perangkat.
Pengiriman laporan ke Google Drive memerlukan URL Web App baru pada
`data/webhook.json`.

BUKA DARI VS CODE
=================

Tekan `Ctrl+Shift+P`, pilih `Tasks: Run Task`, lalu jalankan:
`Buka DUKOPS BABINSA di browser`.
VS Code akan menjalankan server lokal dan membuka
`http://localhost:8080/`. Jangan membuka `index.html` langsung dengan
`file://`, karena browser memblokir pembacaan JSON dan TXT.
