// ================= GOOGLE APPS SCRIPT - DUKOPS BABINSA UNIFIED v2.0 =================
// Menggabungkan:
//   - Skrip Drive-only lama  : test, listFiles, testDrive
//   - Skrip baru             : uploadDrive + getCounter + counter.json
//
// Struktur folder final : ROOT_FOLDER_ID / accountId / tahun / bulan / file
// Counter per akun      : ROOT_FOLDER_ID / accountId / counter.json
//
// Semua fungsi lama dan baru dipertahankan. Yang disesuaikan hanya
// handleListFiles (mengikuti struktur folder baru) dan doPost/doGet
// sebagai dispatcher terpadu.

const ROOT_FOLDER_ID = "1U6C4geioUnHPs6OUK19ukQMpYHr-3j65"; // ⚠️ VERIFIKASI ID INI
const COUNTER_FILE_NAME = "counter.json";

// ================= DISPATCHER POST =================
function doPost(event) {
  try {
    const params = event && event.parameter ? Object.assign({}, event.parameter) : {};

    // Fallback: dukung klien yang mengirim JSON body (bukan FormData)
    if (event && event.postData && event.postData.contents) {
      try {
        const jsonBody = JSON.parse(event.postData.contents);
        if (jsonBody && typeof jsonBody === "object") {
          Object.assign(params, jsonBody);
        }
      } catch (e) {
        // Bukan JSON (mis. multipart/form-data) — abaikan, sudah tertangkap di event.parameter
      }
    }

    if (params.action === "getCounter") {
      return getAccountCounter(params);
    }

    if (params.action === "uploadDrive") {
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        return uploadReport(params);
      } finally {
        lock.releaseLock();
      }
    }

    if (params.action === "listFiles") {
      return handleListFiles(params);
    }

    return jsonResponse({
      success: false,
      error: "Aksi tidak valid",
      receivedAction: params.action,
      availableActions: ["uploadDrive", "getCounter", "listFiles"]
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: "Terjadi kesalahan server",
      details: error && error.message ? error.message : String(error)
    });
  }
}

// ================= DISPATCHER GET =================
function doGet(event) {
  try {
    const params = event && event.parameter ? event.parameter : {};
    const webAppUrl = ScriptApp.getService().getUrl();

    if (!event) {
      return jsonResponse({
        success: true,
        message: "API DUKOPS BABINSA - UNIFIED v2.0",
        usage: "Gunakan parameter action untuk fungsi tertentu",
        webAppUrl: webAppUrl
      });
    }

    if (params.action === "test") {
      return jsonResponse({
        success: true,
        message: "✅ Script DUKOPS BABINSA berjalan normal",
        time: new Date().toISOString(),
        version: "2.0",
        creator: "Serka I Nyoman Arta",
        features: ["uploadDrive", "getCounter", "listFiles", "testDrive"],
        webAppUrl: webAppUrl
      });
    }

    if (params.action === "listFiles") {
      return handleListFiles(params);
    }

    if (params.action === "testDrive") {
      return jsonResponse(testDriveConnection());
    }

    return jsonResponse({
      success: true,
      message: "📁 DUKOPS BABINSA - UNIFIED API v2.0",
      webAppUrl: webAppUrl,
      endpoints: {
        GET: [
          webAppUrl + "?action=test",
          webAppUrl + "?action=listFiles",
          webAppUrl + "?action=listFiles&desaFilter=NamaDesa",
          webAppUrl + "?action=listFiles&monthFilter=2026-08",
          webAppUrl + "?action=listFiles&readZips=true",
          webAppUrl + "?action=testDrive"
        ],
        POST: [
          "action=uploadDrive",
          "action=getCounter",
          "action=listFiles"
        ]
      },
      exampleUpload: {
        action: "uploadDrive",
        accountId: "Desa Contoh",
        counterDateKey: "2026-10-22",
        fileName: "laporan.zip",
        fileData: "base64_encoded_data",
        mimeType: "application/zip",
        year: "2026",
        month: "Oktober"
      }
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: "Server error",
      details: error.toString()
    });
  }
}

// ================= UPLOAD DRIVE (dari skrip baru) =================
function uploadReport(params) {
  const accountId = requireValue(params.accountId, "accountId");
  const counterDateKey = requireReportDateKey(params.counterDateKey);

  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const accountFolder = getOrCreateFolderPath(rootFolder, [sanitizeFolderName(accountId)]);

  const fileName = requireValue(params.fileName, "fileName");
  const fileData = requireValue(params.fileData, "fileData");
  const dateMatch = fileName.match(/_(\d{2})-(\d{2})-(\d{4})\.zip$/i);
  if (!dateMatch ||
      `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` !== counterDateKey) {
    throw new Error("Tanggal laporan tidak sesuai dengan nama file");
  }
  const [reportYear, reportMonth] = counterDateKey.split("-");
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  if (String(params.year) !== reportYear ||
      params.month !== monthNames[Number(reportMonth) - 1]) {
    throw new Error("Folder laporan tidak sesuai dengan tanggal");
  }
  const folderPath = buildFolderPath(params);
  const targetFolder = getOrCreateFolderPath(accountFolder, folderPath);
  if (hasZipForReportDate(targetFolder, dateMatch[3], dateMatch[2], dateMatch[1])) {
    return jsonResponse({
      success: false,
      duplicate: true,
      error: "Laporan untuk desa/kelurahan ini pada tanggal tersebut sudah pernah dikirim."
    });
  }

  const counter = readOrInitializeCounter(accountFolder);
  const blob = Utilities.newBlob(
    Utilities.base64Decode(fileData),
    params.mimeType || "application/zip",
    fileName
  );
  const file = targetFolder.createFile(blob);

  counter.total++;
  counter.dailyCounts[counterDateKey] = (counter.dailyCounts[counterDateKey] || 0) + 1;
  saveCounter(accountFolder, counter);

  return jsonResponse({
    success: true,
    fileId: file.getId(),
    fileName: file.getName(),
    folderPath: [accountId].concat(folderPath).join("/"),
    counter: counter
  });
}

function requireReportDateKey(value) {
  const dateKey = requireValue(value, "counterDateKey");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("Tanggal laporan tidak valid");
  }
  const parsedDate = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateKey) {
    throw new Error("Tanggal laporan tidak valid");
  }
  return dateKey;
}

function hasZipForReportDate(folder, year, month, day) {
  const dateSuffix = `_${day}-${month}-${year}.zip`.toLowerCase();
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getMimeType() === "application/zip" &&
        file.getName().toLowerCase().endsWith(dateSuffix)) {
      return true;
    }
  }
  return false;
}

// ================= COUNTER (dari skrip baru) =================
function getAccountCounter(params) {
  const accountId = requireValue(params.accountId, "accountId");
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const accountFolder = getOrCreateFolderPath(rootFolder, [sanitizeFolderName(accountId)]);
    const counter = readOrInitializeCounter(accountFolder);
    return jsonResponse({ success: true, counter: counter });
  } finally {
    lock.releaseLock();
  }
}

function readOrInitializeCounter(accountFolder) {
  const counterFiles = accountFolder.getFilesByName(COUNTER_FILE_NAME);
  if (counterFiles.hasNext()) {
    const counter = JSON.parse(counterFiles.next().getBlob().getDataAsString());
    if (!counter || !Number.isInteger(counter.total) || counter.total < 0 ||
        !counter.dailyCounts || typeof counter.dailyCounts !== "object") {
      throw new Error("File counter.json di Google Drive tidak valid");
    }
    return counter;
  }
  const counter = { total: 0, dailyCounts: {} };
  countZipFiles(accountFolder, counter);
  saveCounter(accountFolder, counter);
  return counter;
}

function countZipFiles(folder, counter) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getMimeType() !== "application/zip") continue;
    const dateKey = Utilities.formatDate(
      file.getDateCreated(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );
    counter.total++;
    counter.dailyCounts[dateKey] = (counter.dailyCounts[dateKey] || 0) + 1;
  }
  const folders = folder.getFolders();
  while (folders.hasNext()) {
    countZipFiles(folders.next(), counter);
  }
}

function saveCounter(accountFolder, counter) {
  const content = JSON.stringify(counter);
  const counterFiles = accountFolder.getFilesByName(COUNTER_FILE_NAME);
  if (counterFiles.hasNext()) {
    counterFiles.next().setContent(content);
  } else {
    accountFolder.createFile(COUNTER_FILE_NAME, content, MimeType.PLAIN_TEXT);
  }
}

// ================= LIST FILES (disesuaikan ke struktur account/year/month) =================
// Logika filter & bentuk output IDENTIK dengan skrip lama.
// Yang berubah hanya arah traversal folder (account → year → month).
function handleListFiles(params) {
  try {
    const paramsSafe = params || {};
    const folderInduk = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const files = [];

    const desaFilter = paramsSafe.desaFilter || "";
    const monthFilter = paramsSafe.monthFilter || "";
    const readZips = paramsSafe.readZips === "true";

    let filterYear = "";
    let filterMonth = "";
    if (monthFilter) {
      const parts = monthFilter.split("-");
      filterYear = parts[0];
      if (parts[1]) filterMonth = convertMonthNumberToName(parseInt(parts[1]));
    }

    const accountFolders = folderInduk.getFolders();
    while (accountFolders.hasNext()) {
      const accountFolder = accountFolders.next();
      const accountId = accountFolder.getName();
      if (desaFilter && accountId !== desaFilter) continue;

      const yearFolders = accountFolder.getFolders();
      while (yearFolders.hasNext()) {
        const yearFolder = yearFolders.next();
        const tahun = yearFolder.getName();
        if (filterYear && tahun !== filterYear) continue;

        const monthFolders = yearFolder.getFolders();
        while (monthFolders.hasNext()) {
          const monthFolder = monthFolders.next();
          const bulan = monthFolder.getName();
          if (filterMonth && bulan !== filterMonth) continue;

          const monthFiles = monthFolder.getFiles();
          while (monthFiles.hasNext()) {
            const file = monthFiles.next();
            if (file.getName() === COUNTER_FILE_NAME) continue;

            const isZip = file.getMimeType() === "application/zip";
            let zipContents = "";
            if (readZips && isZip) {
              try { zipContents = readZipContents(file); }
              catch (e) { zipContents = "Error membaca ZIP"; }
            }

            files.push({
              name: file.getName(),
              desa: accountId,
              bulan: bulan,
              tahun: tahun,
              size: file.getSize(),
              createdTime: file.getDateCreated().toISOString(),
              webViewLink: file.getUrl(),
              fileId: file.getId(),
              isZip: isZip,
              zipContents: zipContents,
              month: `${tahun}-${convertMonthNameToNumber(bulan)}`
            });
          }
        }
      }
    }

    files.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
    const uniqueDesas = [...new Set(files.map(f => f.desa))];

    return jsonResponse({
      success: true,
      files: files,
      count: files.length,
      statistics: {
        totalFiles: files.length,
        totalDesa: uniqueDesas.length,
        desaList: uniqueDesas,
        filterApplied: {
          desaFilter: desaFilter || "Semua",
          monthFilter: monthFilter || "Semua",
          readZips: readZips
        }
      },
      message: `📊 Ditemukan ${files.length} file dari ${uniqueDesas.length} desa`
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: "Gagal mengambil daftar file",
      details: error.toString()
    });
  }
}

// ================= FUNGSI BANTUAN (skrip lama — dipertahankan utuh) =================
function buatFolder(parent, namaFolder) {
  try {
    if (!parent || !namaFolder) throw new Error("Parent folder atau nama folder tidak valid");
    const folders = parent.getFoldersByName(namaFolder);
    if (folders.hasNext()) return folders.next();
    return parent.createFolder(namaFolder);
  } catch (error) {
    console.error("Error buatFolder:", error);
    throw error;
  }
}

function convertMonthNumberToName(monthNumber) {
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  if (monthNumber >= 1 && monthNumber <= 12) return monthNames[monthNumber - 1];
  return "";
}

function convertMonthNameToNumber(monthName) {
  const monthMap = {
    "Januari": "01", "Februari": "02", "Maret": "03", "April": "04",
    "Mei": "05", "Juni": "06", "Juli": "07", "Agustus": "08",
    "September": "09", "Oktober": "10", "November": "11", "Desember": "12"
  };
  return monthMap[monthName] || "00";
}

function readZipContents(file) {
  try {
    const blob = file.getBlob();
    const zipEntries = Utilities.unzip(blob);
    return zipEntries.map(entry => entry.getName()).join(", ");
  } catch (error) {
    return "Tidak dapat membaca isi ZIP";
  }
}

function response(code, data) {
  try {
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Gagal membuat response",
      details: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function testDriveConnection() {
  try {
    const folder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const files = folder.getFiles();
    let count = 0;
    while (files.hasNext()) { files.next(); count++; }
    const folders = folder.getFolders();
    let accountFolderCount = 0;
    while (folders.hasNext()) { folders.next(); accountFolderCount++; }
    return {
      success: true,
      folderName: folder.getName(),
      fileCount: count,
      accountFolderCount: accountFolderCount,
      url: folder.getUrl()
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ================= FUNGSI BANTUAN (skrip baru — dipertahankan utuh) =================
function buildFolderPath(params) {
  const year = requireValue(params.year, "year");
  const month = requireValue(params.month, "month");
  return [year, month].map(sanitizeFolderName);
}

function getOrCreateFolderPath(rootFolder, folderPath) {
  return folderPath.reduce(function(parent, folderName) {
    const folders = parent.getFoldersByName(folderName);
    return folders.hasNext() ? folders.next() : parent.createFolder(folderName);
  }, rootFolder);
}

function sanitizeFolderName(value) {
  const sanitized = String(value)
    .replace(/[\\/:*?"<>|#%{}~&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!sanitized) throw new Error("Nama folder tidak valid");
  return sanitized;
}

function requireValue(value, fieldName) {
  if (!value || !String(value).trim()) {
    throw new Error("Field wajib tidak ada: " + fieldName);
  }
  return String(value).trim();
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================= INSTALLATION CHECK =================
function onOpen() {
  try {
    console.log("Script DUKOPS BABINSA - UNIFIED v2.0 loaded");
    console.log("Root Folder ID:", ROOT_FOLDER_ID);
    console.log("Web App URL:", ScriptApp.getService().getUrl());
  } catch (error) {
    console.error("Error onOpen:", error);
  }
}