import { useEffect, useRef, useState } from "react";
import { usePlayer, errorMessage, fetchHunterCode, restoreHunter } from "@/lib/game";
import { HUNTER_CODE_EXAMPLE, tidyHunterCode } from "@shared/game";

// A hunter lives in one browser's cookie. This panel shows the hunter's code (to save),
// and takes a code from another device (to bring that hunter here). The server decides
// everything, including whether the hunter on this device would be lost and must be
// asked about first; the code is only ever sent to the hunter it belongs to.

const INK = "hsl(25,40%,15%)";

export function KeepHunter() {
  const { data: player } = usePlayer();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<"show" | "new" | "restore" | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const [askNew, setAskNew] = useState(false);
  const [typed, setTyped] = useState("");
  // Set by the server's answer: the callsign of the hunter here who would be left behind
  const [leaves, setLeaves] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // The keyboard follows what just appeared: the code, or the words of a question. Never
  // straight onto the button that answers it: Enter held down, or pressed twice, in the
  // code field would press that button before the question could be read.
  const codeRef = useRef<HTMLOutputElement>(null);
  const codeErrorRef = useRef<HTMLParagraphElement>(null);
  const leavesRef = useRef<HTMLParagraphElement>(null);
  const newRef = useRef<HTMLParagraphElement>(null);
  const newLinkRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const was = useRef<{ leaves: string | null; askNew: boolean; code: string | null }>({ leaves: null, askNew: false, code: null });
  useEffect(() => {
    const before = was.current;
    was.current = { leaves, askNew, code };
    const to = (el: HTMLElement | null) => el?.focus({ preventScroll: true });
    if (code !== before.code && code) to(codeRef.current);           // a code (first or new) appeared
    else if (askNew && !before.askNew) to(newRef.current);            // "make a new one?" appeared
    else if (!askNew && before.askNew) to(newLinkRef.current);        // ...and was turned down
    else if (leaves && !before.leaves) to(leavesRef.current);         // "replace this hunter?" appeared
    else if (!leaves && before.leaves) to(inputRef.current);          // ...and was turned down
  }, [code, askNew, leaves]);
  useEffect(() => {
    if (codeError) codeErrorRef.current?.focus({ preventScroll: true });
  }, [codeError]);

  if (!player) return null;

  const show = async (fresh: boolean) => {
    setBusy(fresh ? "new" : "show");
    setCodeError(null);
    setCopied(null);
    try {
      setCode(await fetchHunterCode(fresh));
      setAskNew(false);
    } catch (err) {
      setCodeError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied("yes");
    } catch {
      setCopied("no");
    }
  };

  // `replace` is only ever true from the Replace button. Enter in the field, and the
  // Bring back button, ask the server, which answers "ask" if the hunter here has
  // anything to lose.
  const restore = async (replace: boolean) => {
    if (busy) return;
    const entered = tidyHunterCode(typed);
    if (!entered) {
      setRestoreError(`A hunter code is 12 letters and numbers, like ${HUNTER_CODE_EXAMPLE}.`);
      setLeaves(null);
      return;
    }
    setBusy("restore");
    setRestoreError(null);
    try {
      const answer = await restoreHunter(entered, replace);
      if (answer.outcome === "restored") {
        // This browser is someone else now: start every page from what the server says.
        window.location.reload();
        return;
      }
      if (answer.outcome === "same") {
        setRestoreError("That is this hunter's own code. It is for your other devices.");
        setLeaves(null);
      } else {
        setLeaves(answer.callsign);
      }
    } catch (err) {
      setRestoreError(errorMessage(err));
      setLeaves(null);
    }
    setBusy(null);
  };

  return (
    <section className="comic-panel bg-[hsl(38,35%,88%)] p-4" style={{ color: INK }} data-testid="panel-keep-hunter">
      <h2 className="pulp-title text-lg">Keep your hunter</h2>
      <p className="text-sm leading-snug mt-1">
        Your hunter lives in this browser. If its cookies are cleared, or you play on another phone or from
        your Home Screen, a new hunter may take their place. A hunter code brings this one back.
      </p>

      {code ? (
        <div className="mt-3">
          <output ref={codeRef} tabIndex={-1} className="hunter-code" aria-label="Your hunter code" data-testid="text-hunter-code">{code}</output>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2">
            <button className="retro-btn teal text-sm" onClick={copy} data-testid="button-copy-code">
              {copied === "yes" ? "Copied" : "Copy code"}
            </button>
            {!askNew && (
              <button ref={newLinkRef} className="underline text-xs min-h-[44px]" onClick={() => setAskNew(true)} data-testid="button-new-code">
                Make a new code
              </button>
            )}
          </div>
          {copied === "no" && (
            <p className="text-xs mt-2" role="status">Couldn't copy it for you. Press and hold the code to copy it.</p>
          )}
          <p className="text-xs mt-2 text-[hsl(25,20%,32%)]">
            Save it somewhere safe. Anyone who has it can play as you.
          </p>
          {askNew && (
            <div className="mt-3 pt-3 border-t-2 border-dashed border-[hsl(30,20%,68%)]" role="group" aria-label="Make a new code">
              <p ref={newRef} tabIndex={-1} className="text-sm keep-hunter-ask">
                A new code replaces this one, and the old code stops working. A device that already used the old
                code keeps your hunter.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <button className="retro-btn text-sm" onClick={() => show(true)} disabled={busy !== null} data-testid="button-confirm-new-code">
                  {busy === "new" ? "Making…" : "Make a new code"}
                </button>
                <button className="retro-btn teal text-sm" onClick={() => setAskNew(false)} disabled={busy !== null}>
                  Keep this one
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button className="retro-btn teal text-sm mt-3" onClick={() => show(false)} disabled={busy !== null} data-testid="button-show-code">
          {busy === "show" ? "Fetching…" : "Show my hunter code"}
        </button>
      )}
      {codeError && <p ref={codeErrorRef} tabIndex={-1} className="text-xs text-[hsl(0,65%,45%)] mt-2 keep-hunter-ask" role="alert">{codeError}</p>}

      <form
        className="mt-4 pt-3 border-t-2 border-dashed border-[hsl(30,20%,68%)]"
        onSubmit={(e) => {
          e.preventDefault();
          void restore(false);
        }}
      >
        <label className="pulp-title text-sm block" htmlFor="hunter-code">Have a code from another device?</label>
        <div className="flex gap-2 mt-2">
          <input
            id="hunter-code"
            ref={inputRef}
            value={typed}
            maxLength={20}
            placeholder={HUNTER_CODE_EXAMPLE}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            readOnly={busy === "restore"}
            onChange={(e) => {
              setTyped(e.target.value);
              setLeaves(null);
              setRestoreError(null);
            }}
            className="flex-1 w-0 min-w-0 min-h-[44px] px-3 py-2 text-base uppercase tracking-wider bg-[hsl(38,30%,85%)] text-[hsl(25,40%,15%)] border-2 border-[hsl(30,20%,68%)] rounded focus:border-[hsl(45,80%,48%)] focus:outline-none placeholder:text-[hsl(25,15%,55%)]"
            data-testid="input-hunter-code"
          />
          {!leaves && (
            <button type="submit" className="retro-btn text-sm" disabled={!typed.trim() || busy !== null} data-testid="button-restore-hunter">
              {busy === "restore" ? "Calling…" : "Bring back"}
            </button>
          )}
        </div>
        {leaves && (
          <div className="mt-3" role="group" aria-label="Replace this device's hunter">
            <p ref={leavesRef} tabIndex={-1} className="text-sm keep-hunter-ask" role="status" data-testid="text-replace-warning">
              {leaves} is the hunter on this device and will be left behind. Save their code first if you want them back.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="button" className="retro-btn text-sm" onClick={() => void restore(true)} disabled={busy !== null} data-testid="button-confirm-restore">
                {busy === "restore" ? "Calling…" : `Replace ${leaves}`}
              </button>
              <button type="button" className="retro-btn teal text-sm" onClick={() => setLeaves(null)} disabled={busy !== null}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {restoreError && <p className="text-xs text-[hsl(0,65%,45%)] mt-2" role="alert" data-testid="text-restore-error">{restoreError}</p>}
      </form>
    </section>
  );
}
