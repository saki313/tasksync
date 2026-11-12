#!/usr/bin/env bash
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "L'application n'est pas encore installee."
  echo "Lancez d'abord :  ./install.sh"
  exit 1
fi

echo "=================================================="
echo "   TaskSync - Mode developpement"
echo "   (rechargement automatique si vous modifiez"
echo "    le code dans le dossier src)"
echo "=================================================="
echo

export PORT="${PORT:-3000}"
npm run dev
