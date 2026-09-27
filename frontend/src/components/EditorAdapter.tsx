import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import type { CollabClient } from "../arena/collab.js";

/**
 * Editor seam: CodeMirror 6 behind a controlled props contract. Consumers use
 * document value + readOnly + cursor access only — never editor internals
 * (no @codemirror/* imports outside this file).
 *
 * Two modes (ticket 15 §6):
 * LOCAL (1v1): controlled document — `code` is the value, `onChange`
 *   publishes keystrokes.
 * COLLABORATIVE (2v2): `collab` carries the team Y.Text — Y.Text is the
 *   source of truth, `code` is ignored for content, `onChange` still fires
 *   with the converged text so Run/Submit read live shared source.
 * External updates (starter, Reset, language switch, reconnect draft) replace
 * the doc only when they differ, so in-progress typing is never clobbered.
 */

export type ArenaLanguage = "C++" | "Python" | "C";

export interface EditorSelection {
  anchor: number;
  head: number;
}

/** Imperative handle: focus + cursor/selection access. Value flows via props. */
export interface EditorAdapterHandle {
  focus(): void;
  getSelection(): EditorSelection | null;
  setSelection(selection: EditorSelection): void;
}

export interface EditorAdapterProps {
  language: string;
  code: string;
  readOnly: boolean;
  fontSize: number;
  onChange: (code: string) => void;
  /**
   * Collaborative binding (2v2): team Y.Doc + awareness. When present the
   * editor binds y-codemirror.next to the shared Y.Text (remote cursors via
   * the awareness integration, undo via yCollab's Y.UndoManager) and `code`
   * is ignored for content. Absent = local controlled document (1v1).
   */
  collab?: CollabClient;
}

/**
 * ponytail: C shares the maintained C++ grammar (@codemirror/lang-cpp) —
 * no separate C package exists upstream and hand-rolled highlighting would be
 * a second grammar to maintain. Ceiling: C-specific constructs highlight as
 * C++; upgrade path is a dedicated C language package if one appears.
 */
export function resolveEditorLanguage(language: string): "cpp" | "python" | "plain" {
  if (language === "C++" || language === "C") return "cpp";
  if (language === "Python") return "python";
  return "plain";
}

function languageExtension(language: string) {
  switch (resolveEditorLanguage(language)) {
    case "cpp":
      return cpp();
    case "python":
      return python();
    default:
      return [];
  }
}

const baseTheme = EditorView.theme({
  "&": { height: "100%" },
  ".cm-scroller": { overflow: "auto" },
  ".cm-content": { fontSize: "var(--editor-font-size)" },
});

export const EditorAdapter = forwardRef<EditorAdapterHandle, EditorAdapterProps>(
  function EditorAdapter({ language, code, readOnly, fontSize, onChange, collab }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    // Compartments let language/readOnly/label reconfigure without rebuild.
    const confRef = useRef<{
      language: Compartment;
      readOnly: Compartment;
      label: Compartment;
    } | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const label = `Solution editor (${language})`;
    // ponytail: first-render props captured for one-time view creation; every
    // later external update flows through the sync effects below, never here.
    // In collab mode the initial doc is whatever Y.Text holds at bind time
    // (usually the authoritative baseline); later syncs merge via CRDT.
    const initialRef = useRef<{ code: string; language: string; readOnly: boolean; label: string } | null>(null);
    if (initialRef.current === null) {
      initialRef.current = { code: collab ? collab.getSource() : code, language, readOnly, label };
    }
    const collabRef = useRef(collab);
    collabRef.current = collab;

    // Create once; destroy on unmount (clean dispose on remount).
    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;
      const initial = initialRef.current ?? { code: "", language: "Python", readOnly: false, label: "Solution editor" };
      const languageConf = new Compartment();
      const readOnlyConf = new Compartment();
      const labelConf = new Compartment();
      confRef.current = { language: languageConf, readOnly: readOnlyConf, label: labelConf };
      const binding = collabRef.current;
      const view = new EditorView({
        parent: host,
        state: EditorState.create({
          doc: initial.code,
          extensions: [
            lineNumbers(),
            // Undo path per mode: local history for 1v1; the shared
            // Y.UndoManager (keybound here) for the team document.
            ...(binding
              ? [keymap.of(yUndoManagerKeymap), keymap.of(defaultKeymap)]
              : [history(), keymap.of([...defaultKeymap, ...historyKeymap])]),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            baseTheme,
            languageConf.of(languageExtension(initial.language)),
            readOnlyConf.of([EditorView.editable.of(!initial.readOnly), EditorState.readOnly.of(initial.readOnly)]),
            labelConf.of(
              EditorView.contentAttributes.of({
                "aria-label": initial.label,
                spellcheck: "false",
              }),
            ),
            // Collaborative binding: Y.Text <-> CodeMirror + remote cursors.
            // yCollab ships its own Y.UndoManager (shared undo over the team
            // doc), keybound above instead of local history().
            ...(binding ? [yCollab(binding.ytext, binding.awareness)] : []),
            EditorView.updateListener.of((update) => {
              if (binding) {
                if (update.docChanged) onChangeRef.current(binding.getSource());
                if (update.selectionSet) {
                  const s = update.state.selection.main;
                  binding.setLocalCursor(s.anchor, s.head);
                }
                return;
              }
              if (update.docChanged) onChangeRef.current(update.state.doc.toString());
            }),
          ],
        }),
      });
      viewRef.current = view;
      return () => {
        viewRef.current = null;
        view.destroy();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // External value sync (starter / Reset / language switch / reconnect draft):
    // replace only when different so typing is never clobbered. Skipped in
    // collab mode: Y.Text is the source of truth, never the `code` prop.
    useEffect(() => {
      if (collabRef.current) return;
      const view = viewRef.current;
      if (!view) return;
      if (view.state.doc.toString() !== code) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: code },
        });
      }
    }, [code]);

    useEffect(() => {
      const view = viewRef.current;
      const conf = confRef.current;
      if (!view || !conf) return;
      view.dispatch({
        effects: conf.language.reconfigure(languageExtension(language)),
      });
    }, [language]);

    useEffect(() => {
      const view = viewRef.current;
      const conf = confRef.current;
      if (!view || !conf) return;
      view.dispatch({
        effects: conf.readOnly.reconfigure([
          EditorView.editable.of(!readOnly),
          EditorState.readOnly.of(readOnly),
        ]),
      });
    }, [readOnly]);

    useEffect(() => {
      const view = viewRef.current;
      const conf = confRef.current;
      if (!view || !conf) return;
      view.dispatch({
        effects: conf.label.reconfigure(
          EditorView.contentAttributes.of({ "aria-label": label, spellcheck: "false" }),
        ),
      });
    }, [label]);

    useImperativeHandle(ref, () => ({
      focus: () => viewRef.current?.focus(),
      getSelection: () => {
        const view = viewRef.current;
        if (!view) return null;
        const s = view.state.selection.main;
        return { anchor: s.anchor, head: s.head };
      },
      setSelection: (selection: EditorSelection) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ selection: { anchor: selection.anchor, head: selection.head } });
        view.focus();
      },
    }));

    return (
      <div
        ref={hostRef}
        data-language={language}
        data-testid="solution-editor"
        className="h-64 w-full resize-y overflow-auto rounded-md border border-neutral-300 bg-white font-mono leading-relaxed text-neutral-900 focus-within:outline-2 focus-within:outline-teal-700"
        style={{ "--editor-font-size": `${fontSize}px` } as React.CSSProperties}
      />
    );
  },
);
