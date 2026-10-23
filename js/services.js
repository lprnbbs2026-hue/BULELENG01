const runningModule = import("./running.js");

runningModule.catch(error => {
    console.error("Modul upload gagal dimuat:", error);
});

window.sendToBackend = (...args) =>
    runningModule.then(module => module.sendToBackend(...args));

window.uploadToGoogleDrive = (...args) =>
    runningModule.then(module => module.uploadToGoogleDrive(...args));

window.getDriveUploadCounter = (...args) =>
    runningModule.then(module => module.getDriveUploadCounter(...args));
