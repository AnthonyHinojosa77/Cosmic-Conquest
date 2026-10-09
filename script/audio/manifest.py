"""Write client/public/audio/audio.json: which music tracks exist and whether voices do."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parents[2]
music = sorted(p.stem for p in (root / "client/public/audio/music").glob("*.m4a"))
voices = any((root / "audio/voice").rglob("*.mp3")) if (root / "audio/voice").exists() else False
# newline="\n" keeps the file identical when the import runs on Windows
with open(root / "client/public/audio/audio.json", "w", newline="\n") as f:
    f.write(json.dumps({"music": music, "voices": voices}) + "\n")
print("audio.json:", {"music": music, "voices": voices})
