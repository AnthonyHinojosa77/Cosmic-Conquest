#!/bin/zsh
# Import Suno tracks from the Drive "Retro Futurism/Music" folder into the game.
# Each <name>.mp3 (or .m4a/.wav) there becomes client/public/audio/music/<name>.m4a,
# then audio.json is rewritten. Names: hub office investigate showdown aurelia venus.
#
# Tracks loop in the game, so each one is prepared for that: silence trimmed from both
# ends, a short fade in and a longer fade out (the loop comes back round with a soft
# breath rather than a hard cut), loudness evened so no track blares (-18 LUFS), then
# AAC 128 kbps stereo.
set -e
cd "$(dirname "$0")/../.."
SRC="${MUSIC_SRC:-$HOME/Google Drive/My Drive/Retro Futurism/Music}"
OUT=client/public/audio/music
FADE_IN=0.8
FADE_OUT=3
mkdir -p "$OUT"
for name in hub office investigate showdown aurelia venus; do
  src=""
  for ext in mp3 m4a wav; do
    [ -f "$SRC/$name.$ext" ] && { src="$SRC/$name.$ext"; break; }
  done
  [ -z "$src" ] && continue
  tmp=$(mktemp -t "$name").wav
  # Trim silence at the start, and at the end (by trimming the reversed audio's start)
  ffmpeg -nostdin -loglevel error -y -i "$src" \
    -af "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.1,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.1,areverse" \
    -ar 44100 -ac 2 "$tmp"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$tmp")
  start=$(python3 -c "print(max(0, $dur - $FADE_OUT))")
  ffmpeg -nostdin -loglevel error -y -i "$tmp" \
    -af "afade=t=in:d=$FADE_IN,afade=t=out:st=$start:d=$FADE_OUT,loudnorm=I=-18:TP=-2:LRA=11" \
    -c:a aac -b:a 128k -ar 44100 -ac 2 -movflags +faststart "$OUT/$name.m4a"
  rm -f "$tmp"
  printf 'imported %s (%.0f s)\n' "$name" "$dur"
done
python3 script/audio/manifest.py
