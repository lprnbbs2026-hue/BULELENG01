/*************************************************************
 * KONFIGURASI
 *************************************************************/
const PARENT_FOLDER_ID = '1U6C4geioUnHPs6OUK19ukQMpYHr-3j65';

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
    if (action === 'repairSequence') {
      return jsonOut(handleRepairSequence(e));
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
    let sequenceRepairError = '';
    try {
      renumberAccountReportFiles(accountId);
    } catch (repairError) {
      sequenceRepairError = repairError && repairError.message
        ? repairError.message
        : String(repairError);
      console.error('Upload berhasil, tetapi penomoran belum dapat diperbaiki:', sequenceRepairError);
    }
    const counter = readCounter(accountId);

    return {
      success: true,
      counter: counter,
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      fileName: file.getName(),
      sequenceRepairSuccess: !sequenceRepairError,
      sequenceRepairError: sequenceRepairError
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

function handleRepairSequence(e) {
  const p = (e && e.parameter) || {};
  const accountId = String(p.accountId || '').trim();
  if (!accountId) return { success: false, error: 'accountId wajib diisi' };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return { success: false, error: 'Server sibuk, coba lagi.' };
  }

  try {
    return Object.assign(
      { success: true },
      renumberAccountReportFiles(accountId)
    );
  } finally {
    lock.releaseLock();
  }
}

function renumberAccountReportFiles(accountId) {
  const reportFiles = getAccountReportFiles(accountId);
  reportFiles.sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey) ||
    a.createdTime - b.createdTime ||
    a.fileName.localeCompare(b.fileName) ||
    a.file.getId().localeCompare(b.file.getId())
  );

  let changedCount = 0;
  reportFiles.forEach((report, index) => {
    const sequence = String(index + 1).padStart(3, '0');
    const desiredName = sequence + '_' + report.fileName.replace(/^\d+_/, '');
    if (desiredName !== report.fileName) {
      report.file.setName(desiredName);
      changedCount++;
    }
  });

  return {
    changedCount: changedCount,
    total: reportFiles.length,
    maxSequence: reportFiles.length
  };
}

function readCounter(accountId) {
  if (!accountId) throw new Error('accountId wajib diisi.');

  const reportFiles = getAccountReportFiles(accountId);
  const dailyCounts = {};
  let maxSequence = 0;

  reportFiles.forEach(report => {
    dailyCounts[report.dateKey] = (dailyCounts[report.dateKey] || 0) + 1;
    maxSequence = Math.max(maxSequence, report.sequence);
  });

  return {
    total: reportFiles.length,
    dailyCounts: dailyCounts,
    maxSequence: maxSequence
  };
}

function getAccountReportFiles(accountId) {
  const regionType = /^kelurahan\b/i.test(accountId) ? 'Kelurahan' : 'Desa';
  const safeAccountId = sanitizeFolderName(accountId);
  const yearFolders = DriveApp.getFolderById(PARENT_FOLDER_ID).getFolders();
  const reportFiles = [];

  while (yearFolders.hasNext()) {
    const monthFolders = yearFolders.next().getFolders();
    while (monthFolders.hasNext()) {
      const regionFolders = monthFolders.next().getFoldersByName(regionType);
      while (regionFolders.hasNext()) {
        const accountFolders = regionFolders.next().getFoldersByName(safeAccountId);
        while (accountFolders.hasNext()) {
          const files = accountFolders.next().getFiles();
          while (files.hasNext()) {
            const file = files.next();
            const fileName = file.getName();
            const dateMatch = fileName.match(/_(\d{2})-(\d{2})-(\d{4})\.zip$/i);
            if (!dateMatch) continue;

            const sequenceMatch = fileName.match(/^(\d+)_/);
            reportFiles.push({
              file: file,
              fileName: fileName,
              dateKey: `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`,
              createdTime: file.getDateCreated().getTime(),
              sequence: sequenceMatch ? Number(sequenceMatch[1]) : 0
            });
          }
        }
      }
    }
  }

  return reportFiles;
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
  Logger.log('Setup selesai.');
  Logger.log('Folder induk: %s', root.getName());
  Logger.log('Folder ID: %s', PARENT_FOLDER_ID);
  Logger.log('Counter dihitung langsung dari file ZIP di Drive.');
}

function testSetup() {
  try {
    const root = DriveApp.getFolderById(PARENT_FOLDER_ID);
    Logger.log('Folder induk ditemukan: %s', root.getName());
    Logger.log('Folder ID: %s', PARENT_FOLDER_ID);

    Logger.log('Counter dihitung langsung dari file ZIP di Drive.');
  } catch (err) {
    Logger.log('Error: %s', err && err.message ? err.message : String(err));
  }
}

function testBaca(accountId) {
  if (!accountId) {
    throw new Error('Berikan nama Desa/Kelurahan, misalnya "Kelurahan Banjar Tegal".');
  }

  const counter = readCounter(accountId);
  Logger.log('Counter %s: %s', accountId, JSON.stringify(counter));
}
