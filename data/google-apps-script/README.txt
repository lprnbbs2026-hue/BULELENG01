GOOGLE APPS SCRIPT BARU
========================

1. Gunakan folder Drive khusus aplikasi. ID folder yang saat ini disetel di
   `Code.gs` adalah `1U6C4geioUnHPs6OUK19ukQMpYHr-3j65`.
2. Jika memakai folder lain, salin ID dari URL:
   https://drive.google.com/drive/folders/ID_FOLDER
   lalu ganti nilai `PARENT_FOLDER_ID` di `Code.gs`.
3. Buka script.google.com, buat project baru, lalu salin isi Code.gs.
4. Deploy > New deployment > Web app.
   - Execute as: Me
   - Who has access: Anyone
5. Salin URL /exec hasil deployment ke data/webhook.json.

Struktur folder otomatis:
Folder Drive Baru/
  Tahun/
    Bulan/
      Desa atau Kelurahan/
        Nama Desa/Kelurahan/
          file.zip

Setiap upload mengirim nama Desa/Kelurahan terpilih sebagai `accountId`.
Counter total dan jumlah per tanggal dihitung langsung dari nama file ZIP di
folder Drive, tanpa membuat file counter terpisah. File `_counters.json` lama
boleh dibiarkan; script yang baru tidak membaca atau memperbaruinya.
Saat Desa/Kelurahan dipilih, aplikasi menjalankan action `repairSequence`.
Urutan juga diperbaiki otomatis setelah setiap upload, sehingga file ZIP
yang tanggalnya terbaca selalu memakai awalan `001`, `002`, dan seterusnya
dari tanggal paling awal, lintas bulan dan tahun. Perubahan hanya mengganti
nama file ZIP di Drive; isi file tidak dihapus. Deployment Apps Script harus
diperbarui agar perbaikan otomatis tersedia.

Apps Script melayani action `uploadDrive`, `getCounter`, `listFiles`, dan
`repairSequence`.
`listFiles` mengembalikan nama ZIP dari desa/kelurahan dan bulan yang dipilih
di aplikasi. Deploy ulang script setelah `Code.gs` diperbarui agar action
tersebut tersedia di Web App.

Upload memeriksa ZIP yang sudah ada pada akun dan tanggal laporan yang sama.
Permintaan kedua untuk tanggal penuh yang sama ditolak (tahun termasuk),
termasuk jika dikirim dari perangkat lain. Setelah memperbarui `Code.gs`,
buat versi deployment baru atau perbarui deployment Web App yang aktif agar
pemeriksaan duplikat berlaku pada aplikasi online.

Sebelum aplikasi digunakan, pastikan URL `/exec` pada `data/webhook.json`
benar-benar berasal dari deployment aktif. URL harus menerima POST dan
menjalankan `doPost`; uji dengan permintaan POST berisi `action=syncCheckOnly`
dan pastikan respons JSON menyatakan aksi tidak tersedia. Jika Google
menampilkan halaman 404, URL deployment tidak dapat ditemukan dan upload
belum dapat digunakan.

Pastikan akun pemilik deployment memiliki akses Editor ke folder Drive.
