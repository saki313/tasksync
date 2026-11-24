@echo off
setlocal
title TaskSync - Creation de la base de donnees Neon
cd /d "%~dp0"

if not exist "node_modules" (
    echo Installation des dependances - 2 a 5 minutes...
    call npm install
    if errorlevel 1 goto :fail
)
echo.

echo ==================================================
echo    Creation des tables dans votre base Neon
echo ==================================================
echo.
echo 1. Connectez-vous sur  https://neon.tech
echo 2. Ouvrez votre projet, bouton "Connection Details"
echo 3. Copiez la chaine qui commence par  postgresql://
echo 4. Collez-la ci-dessous - clic droit dans cette fenetre
echo.
set /p DBURL="Chaine Neon : "
if not defined DBURL (
    echo Aucune chaine saisie. Operation annulee.
    pause
    exit /b 1
)
if /i not "%DBURL:~0,13%"=="postgresql://" goto :badurl
set "DATABASE_URL=%DBURL%"
echo.
echo Creation des tables...
call npx prisma db push
if errorlevel 1 goto :fail

echo.
echo ==================================================
echo    Base de donnees prete !
echo.
echo    Gardez precieusement la chaine de connexion :
echo    elle servira sur Vercel - variable DATABASE_URL
echo    etape 5 du LISEZMOI-VERCEL.txt
echo.
echo    Prochaine etape : deployer-vercel.bat
echo ==================================================
echo.
pause
exit /b 0

:badurl
echo.
echo [ERREUR] La chaine saisie ne commence pas par postgresql://
echo          Copiez-la depuis Neon - bouton "Connection Details" -
echo          puis relancez initier-base.bat.
pause
exit /b 1

:fail
echo.
echo [ERREUR] Operation interrompue.
echo          - Erreur npm : verifiez votre connexion internet.
echo          - Erreur prisma : verifiez la chaine Neon. Elle doit
echo            commencer par postgresql:// et finir par sslmode=require.
echo          Relancez ensuite initier-base.bat.
pause
exit /b 1
