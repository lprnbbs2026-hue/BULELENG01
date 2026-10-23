PANDUAN FOLDER DATA DUKOPS BABINSA
==================================

Folder `data` berisi data wilayah, konfigurasi webhook, dan panduan backend.

STRUKTUR FOLDER
---------------

data/
  README.txt
  webhook.json
  desa/
    desa dan kelurahan.json
    Desa Petandakan.txt
    Kelurahan Liligundi.txt
  google-apps-script/
    Code.gs
    README.txt


1. MENAMBAH DESA ATAU KELURAHAN
--------------------------------

Tambahkan nama file `.txt` ke `data/desa/desa dan kelurahan.json` sebagai
elemen array JSON.
Nama file harus memakai awalan:

  Desa NamaWilayah.txt
  Kelurahan NamaWilayah.txt

Contoh:

  Desa Petandakan.txt
  Kelurahan Liligundi.txt

Buat file tersebut di folder `data/desa`. Isi koordinat satu per baris,
misalnya:

  8°10'24"S, 115°07'33"E
  8°10'25"S, 115°07'34"E

Baris kosong dan baris yang diawali `#` diabaikan. Setiap koordinat harus
memiliki tanda koma. Nama yang tampil di aplikasi dibuat otomatis dari nama file. Data saat ini
berisi 12 desa dan 17 kelurahan untuk Koramil 1609-01/Buleleng.

Untuk penggunaan normal melalui HTTP/HTTPS, aplikasi membaca daftar wilayah dari
`desa dan kelurahan.json`, kemudian membaca koordinat dari file TXT wilayah yang
sesuai di folder ini. Browser tidak mengizinkan pembacaan file TXT lokal saat
aplikasi dibuka langsung dengan `file://`, jadi gunakan server HTTP/HTTPS.


2. MENGUBAH IDENTITAS HEADER
----------------------------

Edit `config/app-config.json`:

  {
    "appName": "DUKOPS BABINSA",
    "shortName": "DUKOPS",
    "description": "Sistem pelaporan kegiatan Babinsa.",
    "headerUnit": "KORAMIL 1609-01/BULELENG",
    "headerAddress": ""
  }

File tersebut mengatur identitas aplikasi, judul, satuan, dan alamat pada
header aplikasi.


3. MENGATUR UPLOAD GOOGLE DRIVE
------------------------------

URL Web App Google Apps Script satu Koramil disimpan di
`data/webhook.json`. Jangan gunakan URL webhook lama. Buat folder Drive
dan project Apps Script baru, lalu ikuti panduan di:

  data/google-apps-script/README.txt

Upload akan membuat struktur:

  Folder Drive Baru/
    ID Akun (Desa/Kelurahan)/
      Tahun/
        Bulan/
          file.zip

Nama ZIP menggunakan wilayah dan tanggal laporan yang dipilih.


5. SETELAH MENGUBAH FILE DATA
------------------------------

Jangan membuka `index.html` dengan alamat `file://`. Browser memblokir
pembacaan konfigurasi JSON dan koordinat TXT pada mode tersebut. Jalankan
aplikasi melalui server HTTP/HTTPS, misalnya Cloudflare Pages atau server
lokal, lalu buka alamat `http://localhost/...`.

Pastikan file sudah diunggah ke server pada lokasi yang sama. Aplikasi akan
mengambil konfigurasi dan daftar wilayah terbaru secara otomatis. Jika PWA
masih menampilkan data lama, tutup aplikasi lalu muat ulang atau hapus
cache situs dari browser.

Jangan menghapus file konfigurasi yang dibutuhkan aplikasi:

  - `data/webhook.json`
  - `data/desa/desa dan kelurahan.json`
  - `config/app-config.json`

IKON APLIKASI
-------------

Ikon PWA dan favicon menggunakan file lokal di folder
`assets/images/icons`. Ganti file PNG/ICO di folder tersebut tanpa mengubah
skrip. Manifest juga memiliki URL Wikimedia sebagai alternatif:

  https://upload.wikimedia.org/wikipedia/commons/2/25/Lambang_Kodam_Udayana.svg
