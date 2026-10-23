@echo off
setlocal EnableExtensions

set "PROJECT_DIR=%~dp0"
set "REPO_URL=https://github.com/lprnbbs2026-hue/BULELENG01.git"
set "BRANCH=main"
set "WORK_DIR=%TEMP%\BULELENG01-publish-%RANDOM%-%RANDOM%"

where git >nul 2>&1
if errorlevel 1 (
    echo Git belum terpasang atau tidak ditemukan di PATH.
    echo Instal Git for Windows, lalu jalankan file ini kembali.
    pause
    exit /b 1
)

if not exist "%PROJECT_DIR%index.html" (
    echo File index.html tidak ditemukan. Pastikan file BAT ini berada di folder utama aplikasi.
    pause
    exit /b 1
)

if not exist "%PROJECT_DIR%data\google-apps-script\Code.gs" (
    echo File data\google-apps-script\Code.gs tidak ditemukan.
    echo Upload dibatalkan untuk mencegah pengiriman folder yang salah.
    pause
    exit /b 1
)

echo.
echo Folder lokal : "%PROJECT_DIR%"
echo Repository   : %REPO_URL%
echo Branch       : %BRANCH%
echo.
echo File dan folder lokal akan disalin ke salinan terbaru repository.
echo File yang hanya ada di GitHub akan tetap dipertahankan.
echo.
choice /C YN /N /M "Lanjutkan upload ke GitHub? (Y/N): "
if errorlevel 2 (
    echo Upload dibatalkan.
    exit /b 0
)

echo.
echo Mengambil versi terbaru dari GitHub...
git clone --single-branch --branch "%BRANCH%" "%REPO_URL%" "%WORK_DIR%"
if errorlevel 1 (
    echo Gagal mengambil repository. Periksa koneksi internet dan akses GitHub.
    echo Jika diminta, selesaikan autentikasi GitHub lalu jalankan ulang file ini.
    exit /b 1
)

echo.
echo Menyalin file dan folder proyek...
robocopy "%PROJECT_DIR%" "%WORK_DIR%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:2 /XD "%PROJECT_DIR%.git"
set "COPY_RESULT=%ERRORLEVEL%"
if %COPY_RESULT% GEQ 8 (
    echo Gagal menyalin file lokal. Folder kerja disimpan di:
    echo "%WORK_DIR%"
    exit /b 1
)

pushd "%WORK_DIR%"
if errorlevel 1 (
    echo Tidak dapat membuka folder kerja:
    echo "%WORK_DIR%"
    exit /b 1
)

git add -A
if errorlevel 1 (
    popd
    echo Gagal menyiapkan perubahan Git. Folder kerja disimpan di:
    echo "%WORK_DIR%"
    exit /b 1
)

git diff --cached --quiet
if not errorlevel 1 (
    popd
    echo Tidak ada perubahan baru untuk di-upload.
    rmdir /S /Q "%WORK_DIR%"
    pause
    exit /b 0
)

git var GIT_AUTHOR_IDENT >nul 2>&1
if errorlevel 1 (
    popd
    echo Identitas Git belum dikonfigurasi.
    echo Jalankan perintah ini di Command Prompt, lalu jalankan ulang file BAT:
    echo   git config --global user.name "Nama Anda"
    echo   git config --global user.email "email-anda@example.com"
    echo Folder kerja disimpan di: "%WORK_DIR%"
    pause
    exit /b 1
)

git commit -m "Publish local project files" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
if errorlevel 1 (
    popd
    echo Commit gagal. Folder kerja disimpan di:
    echo "%WORK_DIR%"
    pause
    exit /b 1
)

echo.
echo Mengirim perubahan ke GitHub...
git push origin "%BRANCH%"
if errorlevel 1 (
    popd
    echo Upload gagal. Folder kerja disimpan untuk pemeriksaan:
    echo "%WORK_DIR%"
    echo Jangan hapus folder tersebut sebelum masalah push diperiksa.
    pause
    exit /b 1
)
popd

rmdir /S /Q "%WORK_DIR%"
echo.
echo Upload berhasil.
echo GitHub Pages biasanya memperbarui website beberapa saat setelah push.
echo Catatan: Code.gs juga harus di-deploy terpisah melalui Google Apps Script.
pause
exit /b 0
