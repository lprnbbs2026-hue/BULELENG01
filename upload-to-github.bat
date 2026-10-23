@echo off
setlocal EnableExtensions

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "REPO_URL=https://github.com/lprnbbs2026-hue/BULELENG01.git"
set "BRANCH=main"
set "WORK_DIR=%TEMP%\BULELENG01-publish-%RANDOM%-%RANDOM%"
set "EXIT_CODE=0"

where git >nul 2>&1
if errorlevel 1 (
    echo Git belum terpasang atau tidak ditemukan di PATH.
    echo Instal Git for Windows, lalu jalankan file ini kembali.
    set "EXIT_CODE=1"
    goto :finish
)

if not exist "%PROJECT_DIR%\index.html" (
    echo File index.html tidak ditemukan. Pastikan file BAT ini berada di folder utama aplikasi.
    set "EXIT_CODE=1"
    goto :finish
)

if not exist "%PROJECT_DIR%\data\google-apps-script\Code.gs" (
    echo File data\google-apps-script\Code.gs tidak ditemukan.
    echo Upload dibatalkan untuk mencegah pengiriman folder yang salah.
    set "EXIT_CODE=1"
    goto :finish
)

echo.
echo Folder lokal : "%PROJECT_DIR%\"
echo Repository   : %REPO_URL%
echo Branch       : %BRANCH%
echo.
echo File dan folder lokal akan disalin ke salinan terbaru repository.
echo File yang hanya ada di GitHub akan tetap dipertahankan.
echo.
choice /C YN /N /M "Lanjutkan upload ke GitHub? (Y/N): "
if errorlevel 2 (
    echo Upload dibatalkan.
    goto :finish
)

echo.
echo Mengambil versi terbaru dari GitHub...
git clone --single-branch --branch "%BRANCH%" "%REPO_URL%" "%WORK_DIR%"
if errorlevel 1 (
    echo Gagal mengambil repository. Periksa koneksi internet dan akses GitHub.
    echo Jika diminta, selesaikan autentikasi GitHub lalu jalankan ulang file ini.
    set "EXIT_CODE=1"
    goto :finish
)

echo.
echo Menyalin file dan folder proyek...
robocopy "%PROJECT_DIR%" "%WORK_DIR%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:2 /XD ".git"
set "COPY_RESULT=%ERRORLEVEL%"
if %COPY_RESULT% GEQ 8 (
    echo Gagal menyalin file lokal. Folder kerja disimpan di:
    echo "%WORK_DIR%"
    set "EXIT_CODE=1"
    goto :finish
)

pushd "%WORK_DIR%"
if errorlevel 1 (
    echo Tidak dapat membuka folder kerja:
    echo "%WORK_DIR%"
    set "EXIT_CODE=1"
    goto :finish
)

git add -A
if errorlevel 1 (
    popd
    echo Gagal menyiapkan perubahan Git. Folder kerja disimpan di:
    echo "%WORK_DIR%"
    set "EXIT_CODE=1"
    goto :finish
)

git diff --cached --quiet
if not errorlevel 1 (
    popd
    echo Tidak ada perubahan baru untuk di-upload.
    rmdir /S /Q "%WORK_DIR%"
    goto :finish
)

git var GIT_AUTHOR_IDENT >nul 2>&1
if errorlevel 1 (
    popd
    echo Identitas Git belum dikonfigurasi.
    echo Jalankan perintah ini di Command Prompt, lalu jalankan ulang file BAT:
    echo   git config --global user.name "Nama Anda"
    echo   git config --global user.email "email-anda@example.com"
    echo Folder kerja disimpan di: "%WORK_DIR%"
    set "EXIT_CODE=1"
    goto :finish
)

git commit -m "Publish local project files" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
if errorlevel 1 (
    popd
    echo Commit gagal. Folder kerja disimpan di:
    echo "%WORK_DIR%"
    set "EXIT_CODE=1"
    goto :finish
)

echo.
echo Mengirim perubahan ke GitHub...
where gh >nul 2>&1
if not errorlevel 1 (
    gh auth status >nul 2>&1
    if not errorlevel 1 gh auth setup-git >nul 2>&1
)
set "GIT_TERMINAL_PROMPT=0"
set "GCM_INTERACTIVE=Never"
git push origin "%BRANCH%"
if errorlevel 1 (
    popd
    echo Upload gagal. Folder kerja disimpan untuk pemeriksaan:
    echo "%WORK_DIR%"
    echo Jangan hapus folder tersebut sebelum masalah push diperiksa.
    echo.
    echo Autentikasi GitHub belum berhasil. Cara yang disarankan:
    echo 1. Instal GitHub CLI dari https://cli.github.com/
    echo 2. Buka Command Prompt dan jalankan: gh auth login
    echo 3. Pilih GitHub.com, HTTPS, lalu login melalui browser.
    echo 4. Jalankan: gh auth setup-git
    echo 5. Setelah login selesai, jalankan kembali file BAT ini.
    echo.
    echo Alternatif: gunakan GitHub Desktop, login, lalu konfigurasi Git
    echo agar memakai kredensial GitHub yang tersimpan.
    set "EXIT_CODE=1"
    goto :finish
)
popd

rmdir /S /Q "%WORK_DIR%"
echo.
echo ============================================================
echo BERHASIL: Perubahan sudah dikirim ke GitHub.
echo Repository : https://github.com/lprnbbs2026-hue/BULELENG01
echo Branch     : %BRANCH%
echo Website    : https://lprnbbs2026-hue.github.io/BULELENG01/
echo.
echo GitHub Pages mungkin perlu beberapa saat untuk menerbitkan perubahan.
echo Code.gs tetap perlu di-deploy terpisah melalui Google Apps Script.
echo ============================================================
goto :finish

:finish
echo.
if "%EXIT_CODE%"=="0" (
    echo Proses selesai. Tekan tombol apa saja untuk menutup jendela.
) else (
    echo Proses gagal. Pesan di atas menjelaskan penyebabnya.
    echo Tekan tombol apa saja untuk menutup jendela.
)
pause >nul
exit /b %EXIT_CODE%
