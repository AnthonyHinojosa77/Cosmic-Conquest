// Make the character voice lines with ElevenLabs.
//
//   npx tsx script/audio/voices.ts --list      show the account's voices
//   npx tsx script/audio/voices.ts --dry-run   show what would be made and the character cost
//   npx tsx script/audio/voices.ts             make any lines that don't exist yet
//
// The API key is read from the macOS Keychain (item "elevenlabs-api-key"), never from a
// file in the repo. Lines already on disk are skipped, so re-running costs nothing extra.
// Output: audio/voice/<scope>/<a>/<b|line>.mp3, served by server/voice.ts behind the same
// rules as the text they speak.
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { BOUNTIES } from "@shared/game";
import { BOUNTY_SOLUTIONS, CLUES } from "../../server/bounties";
import { aureliaFor } from "../../server/aurelia";

// Voice per character, by ElevenLabs voice name (see --list). Change and re-run to recast;
// delete the old files first so they're made again.
const CAST = {
  narrator: "Brian",
  aurora: "Charlotte",
  cookie: "Callum",
  quill: "Liam",
  vance: "Chris",
} as const;
type Role = keyof typeof CAST;

const OUT = path.resolve(process.cwd(), "audio", "voice");
const API = "https://api.elevenlabs.io/v1";

interface Line {
  file: string;
  role: Role;
  text: string;
}

// The spoken part of a taunt: just what's inside the quotes.
function quoted(text: string): string {
  const m = text.match(/"([^"]+)"/);
  return m ? m[1] : text;
}

function lines(): Line[] {
  const out: Line[] = [
    {
      file: "aurora/broadcast/line.mp3",
      role: "aurora",
      text: "This is Aurora Sterling. Everything I built, I built for the bold. My fortune waits among the stars. Whoever finds it inherits tomorrow.",
    },
  ];
  const culprit: Record<string, Role> = { "heart-of-luna": "cookie", "red-sands": "quill", "venus-fog": "vance" };
  for (const b of BOUNTIES.filter((b) => b.available)) {
    if (b.briefing) out.push({ file: `briefing/${b.id}/line.mp3`, role: "narrator", text: b.briefing });
    for (const [id, clue] of Object.entries(CLUES[b.id] ?? {})) {
      out.push({ file: `clue/${b.id}/${id}.mp3`, role: "narrator", text: clue.text });
    }
    const sol = BOUNTY_SOLUTIONS[b.id];
    if (sol) {
      out.push({ file: `taunt/${b.id}/line.mp3`, role: culprit[b.id] ?? "narrator", text: quoted(sol.showdown.taunt) });
      out.push({ file: `outro/${b.id}/line.mp3`, role: "narrator", text: sol.outro });
    }
  }
  // Aurelia: only the lines that are the same for every hunter (the rest name the player).
  const MARK = "HUNTERNAME";
  for (const loc of aureliaFor(MARK, [])) {
    for (const spot of loc.spots) {
      if (spot.text.includes(MARK) || /first case file|Recovered by/.test(spot.text)) continue;
      out.push({ file: `aurelia/${loc.id}/${spot.id}.mp3`, role: "narrator", text: spot.text });
    }
  }
  return out;
}

function apiKey(): string {
  try {
    return execFileSync("security", ["find-generic-password", "-s", "elevenlabs-api-key", "-w"], { encoding: "utf8" }).trim();
  } catch {
    throw new Error('No ElevenLabs key in the Keychain (item "elevenlabs-api-key").');
  }
}

async function voices(key: string): Promise<{ voice_id: string; name: string; labels?: Record<string, string> }[]> {
  const res = await fetch(`${API}/voices`, { headers: { "xi-api-key": key } });
  if (!res.ok) throw new Error(`voices: ${res.status} ${await res.text()}`);
  return (await res.json()).voices;
}

async function main() {
  const args = process.argv.slice(2);
  const todo = lines().filter((l) => !fs.existsSync(path.join(OUT, l.file)));
  const chars = todo.reduce((n, l) => n + l.text.length, 0);

  if (args.includes("--dry-run")) {
    for (const l of todo) console.log(`${l.role.padEnd(8)} ${l.file}  (${l.text.length})`);
    console.log(`\n${todo.length} lines to make, ${chars} characters.`);
    return;
  }

  const key = apiKey();
  const all = await voices(key);
  if (args.includes("--list")) {
    for (const v of all) console.log(`${v.name.padEnd(28)} ${Object.values(v.labels ?? {}).join(", ")}`);
    return;
  }

  const idFor = {} as Record<Role, string>;
  for (const [role, name] of Object.entries(CAST) as [Role, string][]) {
    const v = all.find((v) => v.name.toLowerCase().startsWith(name.toLowerCase()));
    if (!v) throw new Error(`No voice named "${name}" for ${role}; run --list and update CAST.`);
    idFor[role] = v.voice_id;
  }

  console.log(`Making ${todo.length} lines (${chars} characters)…`);
  for (const l of todo) {
    const res = await fetch(`${API}/text-to-speech/${idFor[l.role]}?output_format=mp3_22050_32`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: l.text, model_id: "eleven_multilingual_v2" }),
    });
    if (!res.ok) throw new Error(`${l.file}: ${res.status} ${await res.text()}`);
    const file = path.join(OUT, l.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(`made ${l.file}`);
  }
  execFileSync("python3", ["script/audio/manifest.py"], { stdio: "inherit" });
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
