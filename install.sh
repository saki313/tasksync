#!/usr/bin/env bash
# TaskSync - Installation (premiere fois)
set -u
cd "$(dirname "$0")"

echo "=================================================="
echo "   TaskSync - Installation (premiere fois)"
echo "=================================================="
echo

if ! command -v node >/dev/null 2>&1; then
    echo "[ERREUR] Node.js n'est pas installe."
    echo
    echo "  1. Ouvrez un terminal et executez ces deux commandes :"
    echo "       curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
    echo "       sudo apt-get install -y nodejs"
    echo "  2. Puis relancez ce script : ./installer.sh"
    echo
    exit 1
fi

NODEV=$(node -v)
MAJOR=${NODEV#v}
MAJOR=${MAJOR%%.*}
echo "Node.js detecte : $NODEV"
if [ "$MAJOR" -lt 20 ] 2>/dev/null; then
    echo
    echo "[ATTENTION] TaskSync necessite Node.js 20 ou plus recent."
    echo "La version installee par defaut sur Ubuntu est trop ancienne."
    echo "Installez Node 22 LTS (commandes dans LISEZMOI.txt) puis relancez."
    echo
    exit 1
fi
echo

echo "[1/4] Installation des dependances (2 a 5 minutes)..."
npm install || { echo; echo "[ERREUR] npm install a echoue. Verifiez votre connexion internet."; exit 1; }
echo

echo "[2/4] Preparation de la base de donnees..."
npx prisma generate || { echo; echo "[ERREUR] prisma generate a echoue."; exit 1; }
npx prisma db push || { echo; echo "[ERREUR] prisma db push a echoue."; exit 1; }
echo

echo "[3/4] Compilation de l'application (1 a 2 minutes)..."
npm run build || { echo; echo "[ERREUR] la compilation a echoue."; exit 1; }
echo

echo "[4/4] Verification finale..."
if [ ! -d .next ] || [ ! -d node_modules ]; then
    echo "[ERREUR] installation incomplete. Relancez ./installer.sh"
    exit 1
fi

echo
echo "=================================================="
echo "   Installation terminee avec succes !"
echo "   Lancez  ./demarrer.sh  pour utiliser TaskSync."
echo "==================================================" 