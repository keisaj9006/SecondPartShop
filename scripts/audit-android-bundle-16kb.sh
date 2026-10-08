#!/usr/bin/env bash
# Derived APK/signing material stays in an isolated temporary directory; never uploaded.
set -euo pipefail
AAB="${1:?App Bundle path required}"
REPORT="${2:?Evidence report path required}"
TASK_DIR="$(mktemp -d /tmp/secondpart-16kb.XXXXXXXX)"
trap 'rm -rf -- "$TASK_DIR"' EXIT
BUNDLETOOL="$TASK_DIR/bundletool.jar"
curl --fail --silent --show-error --location 'https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar' --output "$BUNDLETOOL"
printf '%s  %s\n' 'a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29' "$BUNDLETOOL" | sha256sum --check --status
java -jar "$BUNDLETOOL" validate --bundle="$AAB" > "$TASK_DIR/bundle-validation.txt"
java -jar "$BUNDLETOOL" dump config --bundle="$AAB" > "$TASK_DIR/config.json"
python3 - "$TASK_DIR/config.json" <<'PY'
import json, sys
config = json.load(open(sys.argv[1], encoding='utf-8'))
assert config['optimizations']['uncompressNativeLibraries']['alignment'] == 'PAGE_ALIGNMENT_16K', 'Bundle must request 16 KB alignment'
PY
openssl rand -hex 24 > "$TASK_DIR/password.txt"
keytool -genkeypair -noprompt -alias analysis-only -keyalg RSA -keysize 2048 -validity 2 \
  -keystore "$TASK_DIR/analysis-only.p12" -storetype PKCS12 \
  -storepass:file "$TASK_DIR/password.txt" -keypass:file "$TASK_DIR/password.txt" \
  -dname 'CN=SecondPart Artifact Analysis ONLY,O=SecondPart,C=GB' > /dev/null 2>&1
java -jar "$BUNDLETOOL" build-apks --bundle="$AAB" --output="$TASK_DIR/analysis.apks" --mode=universal \
  --ks="$TASK_DIR/analysis-only.p12" --ks-key-alias=analysis-only \
  --ks-pass="file:$TASK_DIR/password.txt" --key-pass="file:$TASK_DIR/password.txt"
python3 - "$TASK_DIR" <<'PY'
import pathlib, re, sys, zipfile
root = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(root / 'analysis.apks') as archive:
    (root / 'universal.apk').write_bytes(archive.read('universal.apk'))
with zipfile.ZipFile(root / 'universal.apk') as archive:
    for entry in archive.infolist():
        if entry.filename.startswith('lib/') and entry.filename.endswith('.so'):
            assert re.fullmatch(r'lib/(arm64-v8a|armeabi-v7a|x86|x86_64)/[A-Za-z0-9_]+\.so', entry.filename), 'Unsupported native library path'
            assert entry.file_size <= 128 * 1024 * 1024, 'Unexpected native library size'
            target = root / entry.filename
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(entry))
PY
SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:?Android SDK path required}}"
ZIPALIGN="$SDK_ROOT/build-tools/36.0.0/zipalign"
test -x "$ZIPALIGN"
node scripts/verify-android-16kb.mjs "$TASK_DIR/lib" "$TASK_DIR/universal.apk" "$ZIPALIGN" "$REPORT" "$AAB"
