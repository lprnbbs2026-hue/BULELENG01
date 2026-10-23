const WEBHOOK_CONFIG_URL = "data/webhook.json";
let googleAppsScriptWebhook = "";

async function getGoogleAppsScriptWebhook() {
    if (googleAppsScriptWebhook) return googleAppsScriptWebhook;
    const response = await fetch(WEBHOOK_CONFIG_URL, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Gagal memuat konfigurasi webhook (HTTP ${response.status})`);
    }
    const config = await response.json();
    if (typeof config.webhookUrl !== "string" ||
        !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(config.webhookUrl)) {
        throw new Error("URL webhook belum dikonfigurasi");
    }
    googleAppsScriptWebhook = config.webhookUrl;
    return googleAppsScriptWebhook;
}

export async function sendToBackend(action, data = {}) {
    const allowedActions = ["uploadDrive", "getCounter"];
    if (!allowedActions.includes(action)) {
        throw new Error(`Action "${action}" tidak tersedia`);
    }

    const formData = new FormData();
    formData.append("action", action);
    Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== null) {
            formData.append(key, String(data[key]));
        }
    });

    const response = await fetch(await getGoogleAppsScriptWebhook(), {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Backend gagal (HTTP ${response.status})`);
    }

    return response.json();
}

export async function getDriveUploadCounter(accountId) {
    if (typeof accountId !== "string" || !accountId.trim()) {
        throw new Error("ID akun Desa/Kelurahan tidak tersedia");
    }
    const result = await sendToBackend("getCounter", { accountId: accountId.trim() });
    if (result.success !== true || !result.counter) {
        throw new Error(result.error || "Gagal mengambil counter Google Drive");
    }
    return result.counter;
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result;
            if (typeof result !== "string") {
                reject(new Error("Gagal membaca file laporan"));
                return;
            }
            resolve(result.split(",")[1]);
        };
        reader.onerror = () => reject(new Error("Gagal membaca file laporan"));
        reader.readAsDataURL(blob);
    });
}

export async function uploadToGoogleDrive(zipBlob, zipFileName, desaName, date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new Error("Tanggal upload tidak valid");
    }
    if (typeof desaName !== "string" || !desaName.trim()) {
        throw new Error("ID akun Desa/Kelurahan tidak tersedia");
    }

    const accountId = desaName.trim();
    const regionType = /^kelurahan\b/i.test(accountId) ? "Kelurahan" : "Desa";
    const month = date.toLocaleDateString("id-ID", { month: "long" });
    const year = String(date.getFullYear());
    const now = new Date();
    const dateParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(now);
    const dateValues = Object.fromEntries(dateParts
        .filter(part => part.type !== "literal")
        .map(part => [part.type, part.value]));
    const counterDateKey = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
    const result = await sendToBackend("uploadDrive", {
        accountId,
        counterDateKey,
        fileName: zipFileName,
        zipFileName,
        desaName: accountId,
        wilayah: accountId,
        regionType,
        folderName: accountId,
        fileData: await blobToBase64(zipBlob),
        year,
        month,
        folderPath: `${regionType}/${accountId}/${year}/${month}`,
        desa: accountId,
        mimeType: "application/zip"
    });
    if (result.success !== true) {
        throw new Error(result.error || "Upload ke Google Drive gagal");
    }
    return { success: true, counter: result.counter };
}
