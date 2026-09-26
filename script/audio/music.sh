#!/bin/zsh
# Import Suno tracks from the Drive "Retro Futurism/Music" folder into the game.
# Each <name>.mp3 there becomes client/public/audio/music/<name>.m4a (AAC 96 kbps,
# loudness-evened so no track blares), then audio.json is rewritten.
set -e
cd "$(dirname "$0")/../.."
SRC="${MUSIC_SRC:-$HOME/Google Drive/My Drive/Retro Futurism/Music}"
OUT=client/public/audio/music
mkdir -p "$OUT"
for name in hub office investigate showdown aurelia venus; do
  if [ -f "$SRC/$name.mp3" ]; then
    ffmpeg -loglevel error -y -i "$SRC/$name.mp3" -af loudnorm=I=-18:TP=-2 -c:a aac -b:a 96k -ar 44100 "$OUT/$name.m4a"
    echo "imported $name"
  fi
done
python3 script/audio/manifest.py
