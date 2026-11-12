@echo off
setlocal
title TaskSync - Outil de deploiement Vercel
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERREUR] Node.js n'est pas installe.
    echo Installez la version LTS depuis https://nodejs.org puis reessayez.
    echo.
    pause
    exit /b 1
)

echo Installation de l'outil de deploiement Vercel (une seule fois)...
call npm install -g vercel
if errorlevel 1 goto :fail

echo.
echo ==================================================
echo    Outil installe avec succes !
echo    Prochaine etape : initier-base.bat
echo ==================================================
echo.
pause
exit /b 0

:fail
echo.
echo [ERREUR] Verifiez votre connexion internet puis reessayez.
pause
exit /b 1
