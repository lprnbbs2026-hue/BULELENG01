# DUKOPS BABINSA

## Struktur proyek

```text
index.html                  Halaman utama dan UI
assets/
  css/style.css             Gaya aplikasi aktif
  images/
    header/header.png       Gambar header
    icons/                  Ikon PWA dan favicon
    logo/                   Logo dan lisensi
config/app-config.json      Identitas aplikasi dan unit
data/
  desa/                     Daftar desa dan koordinat
  google-apps-script/       Backend Google Apps Script
  webhook.json              URL backend
tools/serve-local.ps1       Server pengembangan lokal
style.css                   Entry point gaya lama (kompatibilitas)
css/base.css                Gaya untuk entry point gaya lama
sw.js                       Service worker PWA
manifest.webmanifest        Manifest PWA
```

Semua identitas aplikasi dikelola dari `config/app-config.json`. Ubah
`appName` untuk nama aplikasi, `shortName` untuk nama singkat PWA, dan
`headerUnit` untuk nama Koramil/unit.

Jalankan tugas VS Code **Buka DUKOPS BABINSA di browser** untuk membuka server
lokal, atau unggah root proyek ke Cloudflare Pages sebagai situs statis tanpa
build command.

## Instal di perangkat

Situs dapat dipasang sebagai PWA dari tombol **Instal Aplikasi** atau menu
browser, lalu dibuka mandiri seperti aplikasi. Untuk instalasi di perangkat
lain gunakan situs yang sudah dipublikasikan melalui HTTPS; alamat localhost
hanya berlaku pada perangkat yang menjalankan server. PWA terbuka seperti
aplikasi, tetapi bukan file APK Android.
