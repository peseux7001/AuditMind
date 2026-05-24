#!/usr/bin/env sh
set -eu

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
PYTHON="$PROJECT_ROOT/.venv_fileproc/bin/python"

if [ ! -x "$PYTHON" ]; then
  PYTHON="python3"
fi

PATH="$PROJECT_ROOT/.venv_fileproc/bin:$PATH" \
PYTHONPYCACHEPREFIX="$PROJECT_ROOT/.pycache" \
"$PYTHON" -m unittest discover "$PROJECT_ROOT/backend/tests"
