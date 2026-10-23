/*************************************************************
 * KONFIGURASI
 *************************************************************/
const PARENT_FOLDER_ID = '1U6C4geioUnHPs6OUK19ukQMpYHr-3j65';
const COUNTER_FILE = '_counters.json';

/*************************************************************
 * ROUTER
 *************************************************************/
function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || '').trim();

  try {
    if (action === 'getCounter') {
      return jsonOut(handleGetCounter(e));
    }
    if (action === 'listFiles') {
      return jsonOut(handleListFiles(e));
    }
    if (action === 'testDrive') {
      return jsonOut(testDriveConnection());
    }
    return jsonOut({ ok: true, message: 'Webhook aktif' });
  } catch (err) {
    return jsonOut({
      success: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || '').trim();

  try {
    if (action === 'uploadDrive') {
      return jsonOut(handleUpload(e));
    }
    if (action === 'getCounter') {
      return jsonOut(handleGetCounter(e));
    }
    if (action === 'listFiles') {
      return jsonOut(handleListFiles(e));
    }
    return jsonOut({
      success: false,
      error: 'Action tidak dikenali: ' + action
    });
  } catch (err) {
    return jsonOut({
      success: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/*************************************************************
 * HANDLER COUNTER
 *************************************************************/
function handleGetCounter(e) {
  const p = (e && e.parameter) || {};
  const accountId = String(p.accountId || '').trim();

  if (!accountId) {
    return { success: false, error: 'accountId wajib diisi' };
  }

  return {
    success: true,
    counter: readCounter(accountId)
  };
}

/*************************************************************
 * HANDLER UPLOAD GOOGLE DRIVE
 * Struktur: Tahun/Bulan/Jenis Wilayah/Nama Desa/file.zip
 *************************************************************/
function handleUpload(e) {
  const p = (e && e.parameter) || {};
  const accountId = String(p.accountId || '').trim();
  const counterDateKey = String(p.counterDateKey || '').trim();
  const zipFileName = String(p.zipFileName || p.fileName || '').trim();
  const fileData = p.fileData;
  const mimeType = p.mimeType || 'application/zip';
  const regionType = String(p.regionType || 'Desa').trim();
  const year = String(p.year || '').trim();
  const month = String(p.month || '').trim();

  if (!accountId) return { success: false, error: 'accountId kosong' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(counterDateKey)) {
    return { success: false, error: 'counterDateKey tidak valid' };
  }
  if (!zipFileName) return { success: false, error: 'zipFileName kosong' };
  if (!fileData) return { success: false, error: 'fileData kosong' };
  if (!year || !month) {
    return { success: false, error: 'year/month tidak lengkap' };
  }
  if (regionType !== 'Desa' && regionType !== 'Kelurahan') {
    return { success: false, error: 'regionType harus Desa atau Kelurahan' };
  }

  const dateParts = counterDateKey.split('-');
  const dateForName = dateParts.reverse().join('-');
  if (!zipFileName.toLowerCase().endsWith('_' + dateForName.toLowerCase() + '.zip')) {
    return { success: false, error: 'Tanggal laporan tidak sesuai dengan nama file' };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return { success: false, error: 'Server sibuk, coba lagi.' };
  }

  try {
    const root = DriveApp.getFolderById(PARENT_FOLDER_ID);
    const yearFolder = getOrCreateSubfolder(root, year);
    const monthFolder = getOrCreateSubfolder(yearFolder, month);
    const regionFolder = getOrCreateSubfolder(monthFolder, regionType);
    const desaFolder = getOrCreateSubfolder(regionFolder, accountId);

    if (findFileByDateSuffix(desaFolder, dateForName)) {
      return {
        success: false,
        duplicate: true,
        error: 'Laporan tanggal ' + counterDateKey + ' sudah pernah dikirim.'
      };
    }

    const blob = Utilities.newBlob(
      Utilities.base64Decode(fileData),
      mimeType,
      zipFileName
    );
    const file = desaFolder.createFile(blob);
    const counter = bumpCounter(accountId, counterDateKey);

    return {
      success: true,
      counter: counter,
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      fileName: file.getName()
    };
  } finally {
    lock.releaseLock();
  }
}

/*************************************************************
 * HANDLER DAFTAR FILE DRIVE
 * Menerima desaFilter dan monthFilter (YYYY-MM).
 *************************************************************/
function handleListFiles(e) {
  const p = (e && e.parameter) || {};
  const accountId = String(p.desaFilter || '').trim();
  const monthFilter = String(p.monthFilter || '').trim();

  if (!accountId) {
    return {
      success: false,
      error: 'desaFilter wajib diisi'
    };
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthFilter)) {
    return {
      success: false,
      error: 'monthFilter harus berformat YYYY-MM, contoh 2026-10'
    };
  }

  const parts = monthFilter.split('-');
  const year = parts[0];
  const monthNumber = Number(parts[1]);
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthName = monthNames[monthNumber - 1];
  const regionType = /^kelurahan\b/i.test(accountId) ? 'Kelurahan' : 'Desa';
  const safeAccountId = sanitizeFolderName(accountId);

  const root = DriveApp.getFolderById(PARENT_FOLDER_ID);
  const files = [];
  const yearFolders = root.getFoldersByName(year);

  while (yearFolders.hasNext()) {
    const yearFolder = yearFolders.next();
    const monthFolders = yearFolder.getFoldersByName(monthName);

    while (monthFolders.hasNext()) {
      const monthFolder = monthFolders.next();
      const regionFolders = monthFolder.getFoldersByName(regionType);

      while (regionFolders.hasNext()) {
        const regionFolder = regionFolders.next();
        const accountFolders = regionFolder.getFoldersByName(safeAccountId);

        while (accountFolders.hasNext()) {
          const accountFolder = accountFolders.next();
          const driveFiles = accountFolder.getFiles();

          while (driveFiles.hasNext()) {
            const file = driveFiles.next();
            const fileName = file.getName();
            if (!/\.zip$/i.test(fileName)) continue;

            files.push({
              name: fileName,
              desa: accountId,
              bulan: monthName,
              tahun: year,
              month: monthFilter,
              createdTime: file.getDateCreated().toISOString(),
              webViewLink: file.getUrl(),
              fileId: file.getId(),
              isZip: true
            });
          }
        }
      }
    }
  }

  files.sort(function(a, b) {
    return new Date(b.createdTime).getTime() -
      new Date(a.createdTime).getTime();
  });

  return {
    success: true,
    files: files,
    count: files.length,
    filterApplied: {
      desaFilter: accountId,
      monthFilter: monthFilter
    }
  };
}

/*************************************************************
 * COUNTER — TERSIMPAN DI _counters.json PADA FOLDER INDUK
 *************************************************************/
function readCountersFile() {
  const root = DriveApp.getFolderById(PARENT_FOLDER_ID);
  const files = root.getFilesByName(COUNTER_FILE);
  if (!files.hasNext()) return {};

  try {
    return JSON.parse(files.next().getBlob().getDataAsString()) || {};
  } catch (err) {
    throw new Error('File _counters.json tidak valid: ' + err.message);
  }
}

function writeCountersFile(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Data counter tidak valid.');
  }

  const root = DriveApp.getFolderById(PARENT_FOLDER_ID);
  const files = root.getFilesByName(COUNTER_FILE);
  const content = JSON.stringify(data);

  if (files.hasNext()) {
    files.next().setContent(content);
  } else {
    root.createFile(COUNTER_FILE, content, 'application/json');
  }
}

function counterFrom(entry) {
  const dailyCounts = (entry && entry.dailyCounts) || {};
  let total = 0;

  for (const dateKey in dailyCounts) {
    if (Object.prototype.hasOwnProperty.call(dailyCounts, dateKey)) {
      total += Number(dailyCounts[dateKey]) || 0;
    }
  }

  return {
    total: total,
    dailyCounts: dailyCounts
  };
}

function readCounter(accountId) {
  if (!accountId) return counterFrom(null);
  const all = readCountersFile();
  return counterFrom(all[accountId]);
}

function bumpCounter(accountId, dateKey) {
  if (!accountId || !dateKey) {
    throw new Error('accountId dan dateKey wajib diisi.');
  }

  const all = readCountersFile();
  if (!all[accountId]) all[accountId] = {};
  if (!all[accountId].dailyCounts) all[accountId].dailyCounts = {};

  const current = Number(all[accountId].dailyCounts[dateKey]) || 0;
  all[accountId].dailyCounts[dateKey] = current + 1;
  writeCountersFile(all);

  return counterFrom(all[accountId]);
}

/*************************************************************
 * DRIVE HELPERS
 *************************************************************/
function getOrCreateSubfolder(parent, name) {
  if (!parent || typeof parent.getFoldersByName !== 'function') {
    throw new Error('Folder induk tidak valid.');
  }

  const safeName = sanitizeFolderName(name);
  const folders = parent.getFoldersByName(safeName);
  return folders.hasNext()
    ? folders.next()
    : parent.createFolder(safeName);
}

function sanitizeFolderName(value) {
  const sanitized = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_');

  if (!sanitized) {
    throw new Error('Nama folder kosong atau tidak valid.');
  }

  return sanitized;
}

function findFileByDateSuffix(folder, dateForName) {
  if (!folder || typeof folder.getFiles !== 'function') {
    throw new Error('Folder laporan tidak valid.');
  }
  if (!dateForName) {
    throw new Error('Tanggal laporan tidak tersedia.');
  }

  const suffix = '_' + dateForName + '.zip';
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().toLowerCase().endsWith(suffix.toLowerCase())) {
      return file;
    }
  }

  return null;
}

function testDriveConnection() {
  try {
    const folder = DriveApp.getFolderById(PARENT_FOLDER_ID);
    const files = folder.getFiles();
    let fileCount = 0;
    while (files.hasNext()) {
      files.next();
      fileCount++;
    }

    const folders = folder.getFolders();
    let folderCount = 0;
    while (folders.hasNext()) {
      folders.next();
      folderCount++;
    }

    return {
      success: true,
      folderName: folder.getName(),
      fileCount: fileCount,
      folderCount: folderCount,
      url: folder.getUrl()
    };
  } catch (err) {
    return {
      success: false,
      error: err && err.message ? err.message : String(err)
    };
  }
}

/*************************************************************
 * SETUP DAN TES
 *************************************************************/
function setup() {
  const root = DriveApp.getFolderById(PARENT_FOLDER_ID);
  const files = root.getFilesByName(COUNTER_FILE);

  if (!files.hasNext()) {
    root.createFile(COUNTER_FILE, '{}', 'application/json');
  }

  Logger.log('Setup selesai.');
  Logger.log('Folder induk: %s', root.getName());
  Logger.log('Folder ID: %s', PARENT_FOLDER_ID);
  Logger.log('File counter siap: %s', COUNTER_FILE);
}

function testSetup() {
  try {
    const root = DriveApp.getFolderById(PARENT_FOLDER_ID);
    Logger.log('Folder induk ditemukan: %s', root.getName());
    Logger.log('Folder ID: %s', PARENT_FOLDER_ID);

    const files = root.getFilesByName(COUNTER_FILE);
    if (files.hasNext()) {
      Logger.log('File counter ada: %s', files.next().getName());
    } else {
      Logger.log('File counter belum ada. Jalankan setup() dulu.');
    }
  } catch (err) {
    Logger.log('Error: %s', err && err.message ? err.message : String(err));
  }
}

function testBaca() {
  const all = readCountersFile();
  Logger.log('Isi _counters.json:');
  Logger.log(JSON.stringify(all, null, 2));
  Logger.log('Total akun: %s', Object.keys(all).length);
}
