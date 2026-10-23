#!/usr/bin/env bash
# Installs Blender (as the bpy Python module, Python 3.11) at /opt/blender-py and a `blender` command on PATH.
# Works without a display or GPU; Cycles renders on the CPU. Re-run in a fresh container: ~1 min, ~900 MB.
#   bash scripts/setup-blender.sh            then: blender --version
#   blender -b -P scripts/build-fleet.py -- public/models/fleet war-rig
set -euo pipefail
PREFIX=${BLENDER_PREFIX:-/opt/blender-py}
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -x "$PREFIX/bin/python" ] || ! "$PREFIX/bin/python" -c "import bpy" 2>/dev/null; then
  command -v uv >/dev/null || pip install --quiet --break-system-packages uv
  uv venv -q -p 3.11 "$PREFIX"
  uv pip install -q -p "$PREFIX/bin/python" bpy numpy
fi
install -m 0644 "$HERE/blender-cli.py" "$PREFIX/blender-cli.py"
cat > /usr/local/bin/blender <<SH
#!/usr/bin/env bash
exec "$PREFIX/bin/python" "$PREFIX/blender-cli.py" "\$@"
SH
chmod +x /usr/local/bin/blender
blender --version
