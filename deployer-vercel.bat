@echo off
setlocal
title TaskSync - Deploiement sur Vercel
cd /d "%~dp0"

if not exist "node_modules" (
    echo Lancez d'abord initier-base.bat - il installe tout.
    echo.
    pause
    exit /b 1
)

echo ==================================================
echo    Deploiement de TaskSync sur Vercel
echo =====================
echo Si un navigateur s'ouvre pour la connexion, connectez-vous
echo a votre compte Vercel (email ou GitHub).
echo.
echo Repondez aux questions ainsi :
echo   "Set up and deploy ... ?"          -> Entree (oui)
echo   "Which scope ... ?"                -> Entree (votre compte)
echo   "Link to existing project ?"       -> N puis Entree
echo   "What's your project's name ?"     -> tasksync puis Entree
echo   "In which directory is your code ?"-> Entree
echo   "Want to override the settings ?"  -> N puis Entree
echo.
echo Le deploiement dure 2 a 4 minutes...
echo.
pause

call vercel login
call vercel --prod

echo.
echo ==================================================
echo    Termine !
echo    Si le deploiement a reussi, votre URL est affichee
echo    au-dessus (https://xxxxx.vercel.app).
echo.
echo    PROCHAINE ETAPE OBLIGATOIRE :
echo    ajoutez les variables dans le tableau de bord Vercel
echo    (LISEZMOI-VERCEL.txt, etape 5), puis cliquez sur
echo    "Redeploy".
echo ==================================================
echo.
pause
