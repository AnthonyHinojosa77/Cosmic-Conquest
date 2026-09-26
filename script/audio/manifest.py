"""Write client/public/audio/audio.json: which music tracks exist and whether voices do."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parents[2]
music = sorted(p.stem for p in (root / "client/public/audio/music").glob("*.m4a"))
voices = any((root / "audio/voice").rglob("*.mp3")) if (root / "audio/voice").exists() else False
(root / "client/public/audio/audio.json").write_text(json.dumps({"music": music, "voices": voices}) + "\n")
print("audio.json:", {"music": music, "voices": voices})
