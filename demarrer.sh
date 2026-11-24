#!/usr/bin/env bash
cd "$(dirname "$0")"

if [ ! -d node_modules ] || [ ! -d .next ]; then
  echo "L'application n'est pas encore installee."
  echo "Lancez d'abord :  ./install.sh"
  exit 1
fi

export PORT="${PORT:-3000}"

echo "=================================================="
echo "   TaskSync demarre sur http://localhost:$PORT"
echo
echo "   Laissez ce terminal OUVERT pendant l'utilisation."
echo "   Pour quitter : fermez-le ou appuyez sur Ctrl+C."
echo "=================================================="
echo

# Ouvre le navigateur des que le serveur repond
(
  for i in $(seq 1 90); do
    if command -v curl >/dev/null 2>&1; then
      curl -s --max-time 2 -o /dev/null "http://localhost:$PORT" && break
    else
      sleep 8 && break
    fi
    sleep 1
  done
  command -v xdg-open >/dev/null 2>&1 && xdg-open "http://localhost:$PORT" >/dev/null 2>&1
) &

exec npm start
