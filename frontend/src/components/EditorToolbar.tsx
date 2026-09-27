interface EditorToolbarProps {
  language: string;
  languages: string[];
  canEdit: boolean;
  canSubmit: boolean;
  busy: boolean;
  /** Live transport available; false pauses actions without losing the draft. */
  connected: boolean;
  isTeam: boolean;
  submitHint: string;
  onLanguage: (language: string) => void;
  onFontBigger: () => void;
  onFontSmaller: () => void;
  onRun: () => void;
  onSubmit: () => void;
}

export function EditorToolbar(props: EditorToolbarProps) {
  const { canEdit, canSubmit, busy, connected, isTeam } = props;
  const actionsLive = connected && !busy;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-3 py-2">
      <label className="font-mono text-xs text-neutral-600">
        Language{" "}
        <select
          aria-label="Language"
          className="rounded border border-neutral-300 bg-white px-1 py-1 text-xs"
          value={props.language}
          disabled={!canEdit}
          onChange={(e) => props.onLanguage(e.target.value)}
        >
          {props.languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="rounded border border-neutral-300 px-2 py-1 text-xs" onClick={props.onFontSmaller} aria-label="Smaller font">
        A−
      </button>
      <button type="button" className="rounded border border-neutral-300 px-2 py-1 text-xs" onClick={props.onFontBigger} aria-label="Larger font">
        A+
      </button>
      <span className="flex-1" />
      <button
        type="button"
        className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm font-medium text-neutral-800 disabled:opacity-50"
        disabled={!canEdit || !actionsLive}
        onClick={props.onRun}
      >
        Run
      </button>
      <button
        type="button"
        data-arena="submit"
        className="rounded bg-teal-700 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
        disabled={!canSubmit || !actionsLive}
        aria-describedby="submit-warning"
        onClick={props.onSubmit}
      >
        {isTeam ? "Submit Team Solution" : "Submit"}
      </button>
      <p id="submit-warning" role="status" className="w-full border-t border-neutral-300 bg-neutral-100 px-2 py-1 text-sm font-medium text-neutral-900">
        {!connected && "Connection lost — actions paused, your draft is kept. "}
        {props.submitHint} Submitting again replaces your current scored result for this round.
      </p>
    </div>
  );
}
