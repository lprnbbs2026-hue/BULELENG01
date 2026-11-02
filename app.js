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

async function sendToBackend(action, data = {}) {
    const allowedActions = ["uploadDrive"];
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

async function uploadToGoogleDrive(zipBlob, zipFileName, desaName, date) {
    const regionType = /^kelurahan\b/i.test(desaName) ? "Kelurahan" : "Desa";
    const month = date.toLocaleDateString("id-ID", { month: "long" });
    const year = String(date.getFullYear());
    const result = await sendToBackend("uploadDrive", {
        fileName: zipFileName,
        zipFileName,
        desaName,
        wilayah: desaName,
        regionType,
        folderName: desaName,
        fileData: await blobToBase64(zipBlob),
        year,
        month,
        folderPath: `${regionType}/${desaName}/${year}/${month}`,
        desa: desaName,
        mimeType: "application/zip"
    });
    return result.success === true;
}

window.sendToBackend = sendToBackend;
window.uploadToGoogleDrive = uploadToGoogleDrive;
