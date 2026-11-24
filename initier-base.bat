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
echo 3. Copiez la chaine POOLEE (avec -pooler) puis la chaine DIRECTE
echo 4. Collez-les ci-dessous - clic droit dans cette fenetre
echo.
set /p DBURL="Chaine Neon poolée (-pooler) : "
set /p DBURL_UNPOOLED="Chaine Neon directe (sans -pooler) : "
if not defined DBURL goto :nourl
if not defined DBURL_UNPOOLED goto :nourl
if /i not "%DBURL:~0,13%"=="postgresql://" goto :badurl
if /i not "%DBURL_UNPOOLED:~0,13%"=="postgresql://" goto :badurl
set "DATABASE_URL=%DBURL%"
set "DATABASE_URL_UNPOOLED=%DBURL_UNPOOLED%"
echo.
echo Creation des tables...
call npx prisma db push
if errorlevel 1 goto :fail

echo.
echo ==================================================
echo    Base de donnees prete !
echo.
echo    Gardez precieusement les deux chaines de connexion :
echo    elles servent sur Vercel - DATABASE_URL et
echo    DATABASE_URL_UNPOOLED (voir LISEZMOI-VERCEL.txt)
echo.
echo    Prochaine etape : deployer-vercel.bat
echo ==================================================
echo.
pause
exit /b 0

:nourl
echo.
echo [ERREUR] Les deux chaines Neon sont obligatoires.
echo          Operation annulee.
pause
exit /b 1

:badurl
echo.
echo [ERREUR] Une chaine ne commence pas par postgresql://
echo          Copiez les deux chaines depuis Neon - bouton
echo          "Connection Details" - puis relancez initier-base.bat.
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
