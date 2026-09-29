#!/bin/zsh
# Give every voice line the "1950s broadcast" sound (owner's call, 2026-09-29): bass rolled
# off to match Aurora's designed voice, top end softened like a period speaker, light
# broadcast compression, and loudness evened across the cast. Reads the raw ElevenLabs
# output in audio/voice-raw/ and writes audio/voice/, which the server serves. Aurora's
# broadcast already has the character, so it is copied untouched. Needs ffmpeg.
#
#   script/audio/vintage.sh          render lines whose output is missing or older than the raw file
#   FORCE=1 script/audio/vintage.sh  re-render everything (after changing CHAIN)
set -e
cd "$(dirname "$0")/../.."
CHAIN="highpass=f=320,highpass=f=320,lowpass=f=5000,equalizer=f=2200:t=q:w=1.2:g=2,acompressor=threshold=-20dB:ratio=3:attack=8:release=150:makeup=3,loudnorm=I=-18:TP=-2,alimiter=limit=0.95"
find audio/voice-raw -name '*.mp3' | sort | while read -r src; do
  out="audio/voice/${src#audio/voice-raw/}"
  if [ -f "$out" ] && [ "$out" -nt "$src" ] && [ -z "${FORCE:-}" ]; then continue; fi
  mkdir -p "$(dirname "$out")"
  if [[ "$src" == audio/voice-raw/aurora/* ]]; then
    cp "$src" "$out"
  else
    ffmpeg -nostdin -loglevel error -y -i "$src" -af "$CHAIN" -ar 22050 -ac 1 -b:a 32k "$out"
  fi
  echo "rendered $out"
done
python3 script/audio/manifest.py
