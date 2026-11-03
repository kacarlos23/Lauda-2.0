import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, Eye, MousePointer2, Move, Pencil, Plus, Redo2, Trash2, Type, Undo2, X, ZoomIn } from "lucide-react-native";
import { ChordSheetView } from "../ChordSheetView";
import { colors, fontFamilies, iconSizes } from "../../theme";
import { changeChord, editorLines, graphemeCells, insertChord, isChordSymbol, legacyConversion, moveChord, normalizeEditorChord, paletteChords, removeEditorLine, replaceLineLyrics, type EditorLine } from "../../utils/visualChordEditor";
import type { VisualChordEditorProps } from "./VisualChordEditor.types";
import { hasInlineChords } from "../../../../src/utils/chordText";

type MarkSelection = { line: number; mark: number };
type Mode = "visual" | "text" | "preview";
const iconSize = iconSizes.s16;

function lineRuns(line: EditorLine) {
  const positions = [...new Set([0, ...line.marks.map(mark => mark.position)])].sort((a, b) => a - b);
  return positions.flatMap((position, index) => {
    const text = line.lyrics.slice(position, positions[index + 1] ?? line.lyrics.length);
    const words = [...text.matchAll(/\S+\s*|\s+/g)];
    const marks = line.marks.map((mark, markIndex) => ({ ...mark, markIndex })).filter(mark => mark.position === position);
    return (words.length ? words : [{ 0: "", index: 0 }]).map((word, wordIndex) => ({ position: position + word.index!, text: word[0], marks: wordIndex === 0 ? marks : [] }));
  });
}

function blockLabel(raw: string): string {
  const directive = raw.match(/^\s*\{\s*([a-z_]+)\s*(?::\s*([^}]*))?\}\s*$/i);
  if (!directive) return raw;
  const name = directive[1].toLowerCase();
  const text = directive[2]?.trim();
  if (["title", "t", "subtitle", "st", "comment", "c", "comment_italic", "ci", "comment_box", "cb"].includes(name) && text) return text;
  if (["key", "k"].includes(name) && text) return `Tom: ${text}`;
  const sections: Record<string, string> = { soc: "Refrão", start_of_chorus: "Refrão", eoc: "Fim do refrão", end_of_chorus: "Fim do refrão", sov: "Verso", start_of_verse: "Verso", eov: "Fim do verso", end_of_verse: "Fim do verso", sob: "Ponte", start_of_bridge: "Ponte", eob: "Fim da ponte", end_of_bridge: "Fim da ponte", sot: "Tablatura", start_of_tab: "Tablatura", eot: "Fim da tablatura", end_of_tab: "Fim da tablatura" };
  return sections[name] ?? raw;
}

export function VisualChordEditor({ value, onChange, originalKey, disabled = false }: VisualChordEditorProps) {
  const [mode, setMode] = useState<Mode>("visual");
  const [selectedChord, setSelectedChord] = useState(() => paletteChords(value)[0] ?? "");
  const [extraChords, setExtraChords] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newChord, setNewChord] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [selection, setSelection] = useState<MarkSelection | null>(null);
  const [replacement, setReplacement] = useState("");
  const [moving, setMoving] = useState<MarkSelection | null>(null);
  const [conversionOpen, setConversionOpen] = useState(false);
  const [lyricEdit, setLyricEdit] = useState<{ line: number; text: string; source: string } | null>(null);
  const [lineRemoval, setLineRemoval] = useState<{ line: number; source: string } | null>(null);
  const [composing, setComposing] = useState(!value.trim());
  const [historyVersion, setHistoryVersion] = useState(0);
  const history = useRef({ present: value, past: [] as string[], future: [] as string[] });
  const rootRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => editorLines(value), [value]);
  const conversion = useMemo(() => legacyConversion(value), [value]);
  const palette = useMemo(() => [...new Set([...paletteChords(conversion.convertedLines ? conversion.content : value), ...extraChords])], [value, conversion, extraChords]);
  const selectedMark = selection ? lines[selection.line]?.marks[selection.mark] : undefined;
  const movingMark = moving ? lines[moving.line]?.marks[moving.mark] : undefined;
  let lyricPreview: ReturnType<typeof replaceLineLyrics> | undefined;
  let lyricError = "";
  if (lyricEdit) {
    try {
      lyricPreview = replaceLineLyrics(lyricEdit.source, lyricEdit.line, lyricEdit.text);
      if (lyricPreview.content.length > 100_000) lyricError = "A cifra deve ter no máximo 100 mil caracteres.";
    }
    catch (reason) { lyricError = reason instanceof Error ? reason.message : "Revise a letra."; }
  }

  useEffect(() => {
    if (history.current.present !== value) {
      history.current = { present: value, past: [], future: [] };
      setSelection(null); setMoving(null); setLyricEdit(null); setLineRemoval(null); setHistoryVersion(version => version + 1);
    }
  }, [value]);

  const modalOpen = conversionOpen || Boolean(lyricEdit) || Boolean(lineRemoval);
  useEffect(() => {
    if (!modalOpen) return;
    returnFocus.current = document.activeElement as HTMLElement;
    const frame = requestAnimationFrame(() => modalRef.current?.querySelector<HTMLElement>("textarea, button")?.focus());
    return () => { cancelAnimationFrame(frame); returnFocus.current?.focus(); };
  }, [modalOpen]);

  function commit(next: string, message?: string) {
    if (disabled) return;
    if (next.length > 100_000) { setError("A cifra deve ter no máximo 100 mil caracteres."); return; }
    if (next === value) return;
    history.current = { present: next, past: [...history.current.past, value].slice(-80), future: [] };
    setHistoryVersion(version => version + 1);
    setSelection(null); setMoving(null); setError("");
    if (message) setFeedback(message);
    onChange(next);
  }

  function act(operation: () => string, message?: string) {
    try { commit(operation(), message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível alterar a cifra."); }
  }

  function undo(redo = false) {
    const state = history.current;
    const stack = redo ? state.future : state.past;
    if (!stack.length || disabled) return;
    const next = stack[stack.length - 1];
    history.current = redo
      ? { present: next, past: [...state.past, value], future: state.future.slice(0, -1) }
      : { present: next, past: state.past.slice(0, -1), future: [...state.future, value] };
    setSelection(null); setMoving(null); setLyricEdit(null); setError(""); setFeedback(redo ? "Alteração refeita." : "Alteração desfeita.");
    setHistoryVersion(version => version + 1); onChange(next);
  }

  function choosePosition(line: number, position: number, drag?: MarkSelection) {
    setActiveLine(line); setCursor(position);
    const move = drag ?? moving;
    if (move) act(() => moveChord(value, move.line, move.mark, line, position), "Acorde movido.");
    else if (selectedChord) act(() => insertChord(value, line, position, selectedChord), `${selectedChord} inserido.`);
  }

  function addChord(event: React.FormEvent) {
    event.preventDefault();
    const chord = normalizeEditorChord(newChord);
    if (!isChordSymbol(chord)) { setError("Informe um acorde como C, Am7, G/B ou Bb9."); return; }
    setExtraChords(items => [...new Set([...items, chord])]); setSelectedChord(chord); setNewChord(""); setError(""); setAddOpen(false);
    setFeedback(`${chord} selecionado. Toque na letra para inserir.`);
  }

  function requestLineRemoval(line: EditorLine) {
    setSelection(null); setMoving(null); setActiveLine(null); setCursor(0);
    if (!line.raw.trim()) act(() => removeEditorLine(value, line.index), "Linha removida. Você pode desfazer.");
    else setLineRemoval({ line: line.index, source: value });
  }

  function closeModal() { setConversionOpen(false); setLyricEdit(null); setLineRemoval(null); }
  function modalKeys(event: React.KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeModal(); }
    if (event.key === "Tab") {
      const nodes = Array.from(modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, input, [tabindex="0"]') ?? []);
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); }
    }
  }

  return <div ref={rootRef} className="lauda-cifra-editor" data-testid="visual-chord-editor" data-history={historyVersion} aria-busy={disabled}>
    <style>{editorCss}</style>
    <div className="ve-heading">
      <div><span className="ve-eyebrow">CONSTRUA A CIFRA</span><h3>Os acordes, no lugar certo.</h3><p>Escolha um acorde e toque na letra onde ele entra.</p></div>
      {process.env.EXPO_PUBLIC_APP_ENV === "staging" && <span className="ve-experiment">Editor visual · teste</span>}
    </div>
    <div className="ve-tools">
      <div className="ve-mode-row">
        <div role="tablist" aria-label="Modo de edição" className="ve-tabs">
          {([{ id: "visual", title: "Visual", icon: MousePointer2 }, { id: "text", title: "Texto ChordPro", icon: Type }, { id: "preview", title: "Prévia", icon: Eye }] as const).map(tab => <button key={tab.id} type="button" role="tab" id={`ve-tab-${tab.id}`} aria-selected={mode === tab.id} aria-controls="ve-editor-panel" className={mode === tab.id ? "ve-tab active" : "ve-tab"} disabled={disabled} onClick={() => { setMode(tab.id); setSelection(null); setMoving(null); }}><tab.icon size={iconSize} /><span>{tab.title}</span></button>)}
        </div>
        <div className="ve-history"><button type="button" className="ve-icon" aria-label="Desfazer alteração da cifra" title="Desfazer" disabled={disabled || !history.current.past.length} onClick={() => undo()}><Undo2 size={iconSizes.s18} /></button><button type="button" className="ve-icon" aria-label="Refazer alteração da cifra" title="Refazer" disabled={disabled || !history.current.future.length} onClick={() => undo(true)}><Redo2 size={iconSizes.s18} /></button></div>
      </div>
      {mode === "visual" && <>
        <div className="ve-palette-row"><span className="ve-label">Acordes da música</span><button type="button" className="ve-text-button" disabled={disabled} onClick={() => setAddOpen(open => !open)}><Plus size={iconSizes.s15} />Adicionar acorde</button></div>
        <div className="ve-palette" aria-label="Paleta de acordes">{palette.map(chord => <button key={chord} type="button" className={selectedChord === chord ? "ve-chip active" : "ve-chip"} aria-label={`Selecionar acorde ${chord}`} aria-pressed={selectedChord === chord} disabled={disabled} onClick={() => { setSelectedChord(chord); setMoving(null); setSelection(null); setFeedback(`${chord} selecionado. Toque na letra para inserir.`); }}>{chord}</button>)}{!palette.length && <span className="ve-muted">Adicione os acordes que você vai usar.</span>}</div>
        {addOpen && <form className="ve-add-form" onSubmit={addChord}><input autoFocus aria-label="Novo acorde" data-testid="visual-new-chord" placeholder="Ex.: Am7, G/B, Bb9" value={newChord} maxLength={32} onChange={event => setNewChord(event.target.value)} disabled={disabled} /><button type="submit" className="ve-button primary" disabled={disabled}><Plus size={iconSizes.s15} />Adicionar</button><button type="button" className="ve-icon" aria-label="Cancelar novo acorde" onClick={() => setAddOpen(false)}><X size={iconSizes.s16} /></button></form>}
        <div className="ve-instruction"><span>{movingMark ? <><Move size={iconSizes.s14} />Mover {movingMark.chord}: toque no novo ponto.</> : selectedChord ? <><MousePointer2 size={iconSizes.s14} /><strong>{selectedChord}</strong> selecionado · toque em uma letra.</> : "Selecione um acorde para começar."}</span>{moving ? <button type="button" className="ve-text-button" onClick={() => setMoving(null)}>Cancelar movimento</button> : <button type="button" className={zoom ? "ve-text-button active" : "ve-text-button"} aria-pressed={zoom} onClick={() => setZoom(current => !current)}><ZoomIn size={iconSizes.s15} />{zoom ? "Reduzir letras" : "Ampliar letras"}</button>}</div>
        {selectedMark && selection && <div className="ve-mark-actions" role="group" aria-label={`Editar acorde ${selectedMark.chord}`}><span className="ve-label">Acorde {selectedMark.chord}</span><input aria-label="Substituir acorde" value={replacement} maxLength={32} onChange={event => setReplacement(event.target.value)} /><button type="button" className="ve-button small" disabled={disabled} onClick={() => act(() => changeChord(value, selection.line, selection.mark, replacement.trim()), "Acorde alterado.")}><Check size={iconSizes.s14} />Trocar</button><button type="button" className="ve-button small" disabled={disabled} onClick={() => { setMoving(selection); setSelection(null); }}><Move size={iconSizes.s14} />Mover</button><button type="button" className="ve-button small danger" disabled={disabled} onClick={() => act(() => changeChord(value, selection.line, selection.mark, null), "Acorde removido.")}><Trash2 size={iconSizes.s14} />Remover</button><button type="button" className="ve-icon" aria-label="Fechar ações do acorde" onClick={() => setSelection(null)}><X size={iconSizes.s16} /></button></div>}
      </>}
    </div>
    {error && <div role="alert" className="ve-error">{error}</div>}
    <div className="ve-screenreader" aria-live="polite">{feedback}</div>
    <div id="ve-editor-panel" role="tabpanel" aria-labelledby={`ve-tab-${mode}`}>
      {mode === "text" ? <div className="ve-text-mode"><p className="ve-muted">O mesmo conteúdo da edição visual. Os acordes ficam entre colchetes: [C]Vou te [G]cantar.</p><textarea wrap={hasInlineChords(value) ? "soft" : "off"} aria-label="Texto ChordPro" data-testid="song-chord-input" value={value} spellCheck={false} disabled={disabled} onChange={event => commit(event.target.value)} /><span className="ve-count">{value.length.toLocaleString("pt-BR")} / 100.000 caracteres</span></div>
      : mode === "preview" ? <div className="ve-preview"><span className="ve-label">COMO A CIFRA SERÁ EXIBIDA · TOM {originalKey}</span><ChordSheetView content={value} originalKey={originalKey} semitones={0} fontSize={16} /></div>
      : composing ? <div className="ve-compose"><span className="ve-step">01 / A LETRA</span><h4>Comece com a letra da música</h4><p>Cole a letra pura ou uma cifra em ChordPro. Depois, posicione os acordes com um toque.</p><textarea aria-label="Letra inicial" data-testid="visual-initial-lyrics" placeholder={"Vou te cantar\nCom todo o meu coração"} value={value} disabled={disabled} spellCheck={false} onChange={event => commit(event.target.value)} /><button type="button" className="ve-button primary" disabled={disabled || !value.trim()} onClick={() => setComposing(false)}>Começar a cifrar<ChevronRight size={iconSizes.s16} /></button></div>
      : conversion.convertedLines > 0 ? <div className="ve-conversion"><span className="ve-step">PREPARAR PARA EDIÇÃO VISUAL</span><h4>Esta cifra usa acordes acima da letra.</h4><p>Confira a conversão para posicionar os acordes por toque. Seu conteúdo só muda quando você aplicar a conversão.</p><div className="ve-wrap"><button type="button" className="ve-button primary" disabled={disabled} onClick={() => setConversionOpen(true)}>Conferir conversão<ChevronRight size={iconSizes.s16} /></button><button type="button" className="ve-button" onClick={() => setMode("text")}>Continuar no texto</button></div><div className="ve-legacy-preview"><ChordSheetView content={value} originalKey={originalKey} semitones={0} fontSize={15} /></div></div>
      : <div className="ve-sheet" data-testid="visual-sheet">
        <div className="ve-sheet-heading"><span className="ve-label">TOQUE NA LETRA PARA INSERIR</span><span className="ve-muted">Toque em um acorde para ajustar.</span></div>
        {lines.map(line => line.protected ? <div key={line.index} className="ve-protected" data-testid={`visual-protected-${line.index}`}><span>{blockLabel(line.raw) || " "}</span><button type="button" className="ve-icon" title="Editar bloco no texto" aria-label={`Editar bloco da linha ${line.index + 1} no texto`} onClick={() => setMode("text")}><Type size={iconSizes.s14} /></button></div> : <div key={line.index} className={`ve-line${activeLine === line.index ? " focused" : ""}${zoom ? " enlarged" : ""}`} data-testid={`visual-line-${line.index}`}>
          <div className="ve-line-rail"><span>{String(line.index + 1).padStart(2, "0")}</span><button type="button" className="ve-line-edit" disabled={disabled} aria-label={`Editar letra da linha ${line.index + 1}`} title="Editar letra desta linha" onClick={() => { setSelection(null); setLyricEdit({ line: line.index, text: line.lyrics, source: value }); }}><Pencil size={iconSizes.s14} /></button></div>
          <div className="ve-line-content" tabIndex={disabled ? -1 : 0} role="group" aria-label={`Linha ${line.index + 1}: ${line.lyrics || "instrumental ou vazia"}. Use as setas para escolher uma posição e Enter para inserir.`} onFocus={() => { if (activeLine !== line.index) { setActiveLine(line.index); setCursor(0); } }} onKeyDown={event => {
            if (event.target !== event.currentTarget) return;
            const positions = [...graphemeCells(line.lyrics).map(cell => cell.position), line.lyrics.length];
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); setActiveLine(line.index); const at = Math.max(0, positions.indexOf(cursor)); setCursor(positions[Math.max(0, Math.min(positions.length - 1, at + (event.key === "ArrowRight" ? 1 : -1)))]); }
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choosePosition(line.index, activeLine === line.index ? cursor : 0); }
            if (event.key === "Escape") { event.stopPropagation(); setMoving(null); setSelection(null); }
          }}>
            {lineRuns(line).map((run, runIndex) => <span key={`${run.position}-${runIndex}`} className="ve-word"><span className="ve-chord-space">{run.marks.map(mark => <button key={mark.markIndex} type="button" className={selection?.line === line.index && selection.mark === mark.markIndex ? "ve-chord selected" : "ve-chord"} data-testid={`visual-chord-${line.index}-${mark.markIndex}`} disabled={disabled} draggable={!disabled} aria-label={`Editar ${mark.chord} na linha ${line.index + 1}`} onDragStart={event => { event.dataTransfer.setData("application/x-lauda-chord", JSON.stringify({ line: line.index, mark: mark.markIndex })); event.dataTransfer.effectAllowed = "move"; }} onClick={event => { event.stopPropagation(); setSelection({ line: line.index, mark: mark.markIndex }); setReplacement(mark.chord); setMoving(null); setActiveLine(line.index); }}>{mark.chord}</button>)}</span><span className="ve-lyrics">{graphemeCells(run.text).map(cell => <span key={cell.position} className={`ve-letter${activeLine === line.index && cursor === run.position + cell.position ? " at-cursor" : ""}`} role="button" tabIndex={-1} aria-disabled={disabled} aria-label={`${cell.text === " " ? "Espaço" : cell.text}, linha ${line.index + 1}`} data-testid={`visual-letter-${line.index}-${run.position + cell.position}`} onClick={() => { if (!disabled) choosePosition(line.index, run.position + cell.position); }} onDragOver={event => { if (event.dataTransfer.types.includes("application/x-lauda-chord")) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={event => { event.preventDefault(); if (disabled) return; try { const mark = JSON.parse(event.dataTransfer.getData("application/x-lauda-chord")); if (Number.isInteger(mark.line) && Number.isInteger(mark.mark)) choosePosition(line.index, run.position + cell.position, mark); } catch { setError("Não foi possível mover este acorde."); } }}>{cell.text}</span>)}</span></span>)}
            <button type="button" className="ve-line-end" data-testid={`visual-line-end-${line.index}`} aria-label={`Inserir acorde no fim da linha ${line.index + 1}`} title="Inserir no fim da linha" disabled={disabled} onClick={() => choosePosition(line.index, line.lyrics.length)}><Plus size={iconSizes.s13} /></button>
          </div>
          <button type="button" className="ve-line-delete" data-testid={`visual-remove-line-${line.index}`} aria-label={`Remover linha ${line.index + 1}`} title="Remover a linha inteira" disabled={disabled || (lines.length === 1 && !line.raw)} onClick={() => requestLineRemoval(line)}><Trash2 size={iconSizes.s15} /></button>
        </div>)}
        <button type="button" className="ve-text-button ve-add-line" disabled={disabled} onClick={() => { const ending = lines.find(line => line.ending)?.ending ?? "\n"; commit(value + ending); setActiveLine(lines.length); }}><Plus size={iconSizes.s15} />Adicionar linha</button>
      </div>}
    </div>
    <div className="ve-footer"><span><span className="ve-status-dot" />As alterações ficam no formulário até você salvar.</span><span>Tom {originalKey}</span></div>
    {modalOpen && createPortal(<div className="lauda-cifra-editor ve-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) closeModal(); }}>
      <div ref={modalRef} className="ve-modal" role="dialog" aria-modal="true" aria-labelledby="ve-modal-title" onKeyDown={modalKeys}>
        <div className="ve-modal-header"><div><span className="ve-eyebrow">{lineRemoval ? "REMOVER LINHA" : lyricEdit ? "AJUSTAR A LETRA" : "CONFERIR CONVERSÃO"}</span><h4 id="ve-modal-title">{lineRemoval ? `Remover linha ${lineRemoval.line + 1}?` : lyricEdit ? `Editar linha ${lyricEdit.line + 1}` : "A mesma cifra, com acordes ancorados."}</h4></div><button type="button" className="ve-icon" aria-label="Fechar janela do editor" onClick={closeModal}><X size={iconSizes.s20} /></button></div>
        {lineRemoval ? <>
          <div className="ve-modal-body"><p className="ve-muted">A letra e todos os acordes desta linha serão removidos do formulário. Você pode usar Desfazer antes de salvar a música.</p><div className="ve-removal-preview"><ChordSheetView content={lines[lineRemoval.line]?.raw ?? ""} originalKey={originalKey} semitones={0} fontSize={16} /></div></div>
          <div className="ve-modal-footer"><button type="button" className="ve-button" onClick={closeModal}>Cancelar</button><button type="button" className="ve-button danger" disabled={disabled || lineRemoval.source !== value} onClick={() => { act(() => removeEditorLine(value, lineRemoval.line), "Linha e acordes removidos. Você pode desfazer."); closeModal(); }}><Trash2 size={iconSizes.s16} />Remover linha</button></div>
        </> : <>
        <div className="ve-modal-body">{lyricEdit ? <><label className="ve-label" htmlFor="ve-line-lyrics">Letra da linha, sem acordes</label><textarea id="ve-line-lyrics" aria-label="Letra da linha" value={lyricEdit.text} spellCheck={false} onChange={event => setLyricEdit({ ...lyricEdit, text: event.target.value })} /><p className="ve-muted">Os acordes acompanham as letras preservadas. Você também pode inserir quebras de linha.</p>{lyricPreview?.removed.length ? <div role="alert" className="ve-warning">Este trecho contém {lyricPreview.removed.length} acorde(s): {lyricPreview.removed.map(mark => mark.chord).join(", ")}. Eles serão removidos ao aplicar a alteração.</div> : null}{lyricError && <div role="alert" className="ve-error">{lyricError}</div>}</> : <><p className="ve-muted">Confira a posição dos acordes. A conversão preserva as seções e só altera o formulário após sua confirmação.</p><div className="ve-conversion-columns"><div><span className="ve-label">Texto original</span><pre>{value}</pre></div><div><span className="ve-label">Prévia convertida</span><ChordSheetView content={conversion.content} originalKey={originalKey} semitones={0} fontSize={15} /></div></div><details><summary>Ver texto ChordPro convertido</summary><pre data-testid="visual-conversion-source">{conversion.content}</pre></details></> }</div>
        {!lyricEdit && conversion.content.length > 100_000 && <div role="alert" className="ve-error">A conversão ultrapassa o limite de 100 mil caracteres. Revise a cifra no modo Texto ChordPro.</div>}
        <div className="ve-modal-footer"><button type="button" className="ve-button" onClick={closeModal}>Cancelar</button><button type="button" className="ve-button primary" disabled={disabled || Boolean(lyricError) || (!lyricEdit && conversion.content.length > 100_000) || (lyricEdit !== null && lyricEdit.source !== value)} onClick={() => { if (lyricEdit && lyricPreview) commit(lyricPreview.content, "Letra atualizada."); else if (!lyricEdit) commit(conversion.content, "Conversão aplicada ao formulário."); closeModal(); }}><Check size={iconSizes.s16} />{lyricEdit ? lyricPreview?.removed.length ? `Aplicar e remover ${lyricPreview.removed.length} acorde(s)` : "Aplicar letra" : "Aplicar conversão"}</button></div>
        </>}
      </div>
    </div>, document.body)}
  </div>;
}

const editorCss = `
.ve-line-delete{align-self:center;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;min-width:36px;min-height:36px;padding:6px;border:0;border-radius:5px;background:transparent;color:${colors.muted}}.ve-line-delete:hover,.ve-line-delete:focus-visible{background:${colors.dangerSoft};color:${colors.danger}}.ve-removal-preview{padding:14px;background:${colors.surfaceMuted};border-radius:6px;margin-top:16px;overflow:auto}
.lauda-cifra-editor{--ve-green:${colors.primary};--ve-ink:${colors.ink};--ve-line:${colors.line};color:var(--ve-ink);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;width:100%;min-width:0}
.lauda-cifra-editor *{box-sizing:border-box}.lauda-cifra-editor button,.lauda-cifra-editor input,.lauda-cifra-editor textarea{font:inherit}.lauda-cifra-editor button{cursor:pointer}.lauda-cifra-editor button:disabled{cursor:default;opacity:.45}.lauda-cifra-editor button:focus-visible,.lauda-cifra-editor input:focus,.lauda-cifra-editor textarea:focus,.lauda-cifra-editor [tabindex="0"]:focus-visible{outline:2px solid var(--ve-green)!important;outline-offset:3px!important}
.ve-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px 0 20px}.ve-eyebrow,.ve-step{font-size:10px;font-weight:750;letter-spacing:1.5px;color:var(--ve-green)}.ve-heading h3{font-size:25px;line-height:1.2;letter-spacing:-.8px;margin:8px 0}.ve-heading p,.ve-compose p,.ve-conversion p{font-size:13px;line-height:1.65;color:${colors.muted};margin:0}.ve-experiment{font-size:10px;white-space:nowrap;padding:7px 9px;border:1px solid var(--ve-line);border-radius:20px;color:${colors.muted}}
.ve-tools{position:sticky;top:0;z-index:10;background:${colors.surface};border:1px solid var(--ve-line);border-radius:8px;padding:12px 14px;box-shadow:0 3px 10px #10282008}.ve-mode-row,.ve-palette-row,.ve-instruction,.ve-footer{display:flex;align-items:center;justify-content:space-between;gap:10px}.ve-tabs{display:flex;gap:4px;min-width:0}.ve-tab{display:flex;gap:7px;align-items:center;min-height:38px;border:0;border-radius:5px;padding:8px 12px;background:transparent;color:${colors.muted};font-size:12px!important;font-weight:650!important}.ve-tab.active{color:var(--ve-green);background:${colors.primarySoft}}.ve-history{display:flex;border-left:1px solid var(--ve-line);padding-left:8px;gap:2px}.ve-icon{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:5px;min-width:34px;min-height:36px;background:transparent;color:${colors.muted};padding:6px}.ve-icon:hover{background:${colors.surfaceMuted}}
.ve-palette-row{border-top:1px solid var(--ve-line);padding-top:13px;margin-top:10px;margin-bottom:10px}.ve-label{display:block;font-size:11px;font-weight:700;letter-spacing:.25px;color:${colors.muted}}.ve-text-button{display:inline-flex;align-items:center;justify-content:center;gap:5px;border:0;background:transparent;color:var(--ve-green);font-weight:650!important;font-size:12px!important;min-height:30px;padding:4px}.ve-text-button.active{text-decoration:underline}.ve-palette{display:flex;gap:7px;flex-wrap:wrap;padding-bottom:10px}.ve-chip{border:1px solid var(--ve-line);border-radius:5px;background:${colors.surface};color:var(--ve-green);font-size:15px!important;font-weight:750!important;min-width:47px;min-height:42px;padding:8px 12px}.ve-chip.active{background:var(--ve-green);border-color:var(--ve-green);color:${colors.surface};box-shadow:0 2px 5px #10282016}.ve-instruction{font-size:11px;color:${colors.muted};padding-top:4px}.ve-instruction>span{display:flex;align-items:center;gap:5px}.ve-instruction strong{color:var(--ve-green)}.ve-add-form,.ve-mark-actions,.ve-wrap{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ve-add-form{padding:4px 0 10px}.ve-add-form input,.ve-mark-actions input{min-width:80px;min-height:38px;padding:7px 10px;border:1px solid var(--ve-line);border-radius:5px;background:${colors.surface};color:var(--ve-ink);max-width:100%}.ve-add-form input{flex:1}.ve-mark-actions{border-top:1px solid var(--ve-line);margin-top:10px;padding-top:10px}.ve-mark-actions input{width:85px}.ve-mark-actions .ve-label{margin-right:4px}.ve-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:42px;max-width:100%;padding:10px 14px;border:1px solid var(--ve-line);border-radius:5px;background:${colors.surface};color:var(--ve-green);font-size:12px!important;font-weight:650!important}.ve-button.primary{background:var(--ve-green);border-color:var(--ve-green);color:${colors.surface}}.ve-button.small{min-height:36px;padding:7px 9px}.ve-button.danger{color:${colors.danger}}
.ve-sheet{padding:20px 0 8px;min-width:0}.ve-sheet-heading{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:4px 0 15px}.ve-muted{font-size:12px;color:${colors.muted};line-height:1.65}.ve-line{display:flex;gap:10px;border-radius:5px;border:1px solid transparent;padding:7px 7px 9px 0;min-width:0;position:relative}.ve-line.focused{background:${colors.primarySoft}55;border-color:${colors.primarySoft}}.ve-line-rail{width:28px;flex-shrink:0;display:flex;align-items:center;flex-direction:column;justify-content:space-between;gap:2px;padding-top:5px}.ve-line-rail>span{font-family:monospace;font-size:10px;color:${colors.muted};opacity:.65}.ve-line-edit{padding:5px;border:0;color:${colors.muted};background:transparent;border-radius:4px;min-width:27px;min-height:29px}.ve-line-edit:hover{color:var(--ve-green);background:${colors.primarySoft}}.ve-line-content{display:flex;flex-wrap:wrap;align-items:flex-end;flex:1;min-width:0;border-radius:3px;font-family:${fontFamilies.monospace},monospace;font-size:16px;line-height:1.7}.ve-line.enlarged .ve-line-content{font-size:22px}.ve-word{display:inline-flex;flex-direction:column;vertical-align:bottom;max-width:100%;min-width:0}.ve-chord-space{display:flex;align-items:center;gap:3px;min-height:28px;padding-right:3px;align-self:flex-start}.ve-chord{font-family:inherit!important;line-height:1.3;min-height:25px;font-size:13px!important;font-weight:750!important;color:var(--ve-green);background:${colors.primarySoft};border:1px solid transparent;border-radius:4px;padding:3px 5px;margin:0;white-space:nowrap}.ve-chord.selected{background:var(--ve-green);color:${colors.surface}}.ve-lyrics{white-space:pre-wrap;overflow-wrap:anywhere;min-height:1.7em}.ve-letter{cursor:crosshair;border-radius:2px;display:inline;position:relative;touch-action:manipulation}.ve-letter:hover{background:${colors.warningHighlight};box-shadow:0 2px 0 ${colors.accent}}.ve-line-content:focus-visible .ve-letter.at-cursor{background:${colors.warningHighlight};box-shadow:0 2px 0 var(--ve-green)}.ve-line-end{align-self:flex-end;display:inline-flex;align-items:center;justify-content:center;min-height:27px;min-width:23px;padding:3px;margin:0 0 2px 4px;color:${colors.muted};background:transparent;border:1px dashed var(--ve-line);border-radius:4px;opacity:.5}.ve-line-end:hover{opacity:1}.ve-add-line{margin:12px 0 4px 36px}.ve-protected{display:flex;justify-content:space-between;align-items:center;gap:10px;background:${colors.surfaceMuted};border-left:2px solid ${colors.lineStrong};border-radius:3px;padding:6px 10px;margin:8px 0;min-height:32px;font-family:monospace;font-size:12px;color:${colors.muted};white-space:pre-wrap;overflow-wrap:anywhere;min-width:0}.ve-protected>span{min-width:0}
.ve-footer{font-size:10px;color:${colors.muted};line-height:1.5;border-top:1px solid var(--ve-line);padding-top:13px;margin-top:8px}.ve-footer>span:first-child{display:flex;align-items:center;gap:6px}.ve-status-dot{display:inline-block;width:5px;height:5px;flex-shrink:0;background:var(--ve-green);border-radius:50%}.ve-preview{padding:24px 0;overflow-wrap:anywhere;overflow-x:auto}.ve-preview>.ve-label{margin-bottom:20px}.ve-text-mode{padding-top:18px}.ve-text-mode p{margin:0 0 10px}.lauda-cifra-editor textarea{display:block;width:100%;min-height:360px;resize:vertical;border:1px solid var(--ve-line);border-radius:6px;padding:16px;color:var(--ve-ink);background:${colors.surface};font-family:monospace;font-size:14px;line-height:1.75;tab-size:4}.ve-count{display:block;text-align:right;font-size:10px;color:${colors.muted};margin-top:8px}.ve-compose,.ve-conversion{padding:28px 0 16px}.ve-compose h4,.ve-conversion h4{font-size:20px;letter-spacing:-.5px;margin:10px 0}.ve-compose p,.ve-conversion p{margin-bottom:18px}.ve-compose textarea{min-height:240px;margin-bottom:16px}.ve-legacy-preview{margin-top:28px;border-top:1px solid var(--ve-line);padding-top:22px;max-height:350px;overflow:auto}.ve-error,.ve-warning{padding:12px;border-radius:5px;font-size:12px;line-height:1.65;margin:12px 0;overflow-wrap:anywhere}.ve-error{background:${colors.dangerSoft};color:${colors.danger}}.ve-warning{background:${colors.warningSoft};color:${colors.warningTextStrong}}
.ve-modal-backdrop{position:fixed;inset:0;z-index:10000;background:#10282088;display:flex;align-items:center;justify-content:center;padding:20px}.ve-modal{background:${colors.surface};border:1px solid var(--ve-line);border-radius:10px;max-width:900px;width:100%;max-height:90dvh;display:flex;flex-direction:column;box-shadow:0 24px 70px #10282033;min-width:0}.ve-modal-header{padding:22px 24px 16px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:1px solid var(--ve-line)}.ve-modal h4{font-size:20px;line-height:1.3;letter-spacing:-.4px;margin:7px 0 0}.ve-modal-body{overflow:auto;padding:20px 24px;min-height:0;min-width:0}.ve-modal-body textarea{min-height:160px;margin-top:10px}.ve-modal-footer{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;padding:16px 24px;border-top:1px solid var(--ve-line)}.ve-conversion-columns{display:grid;grid-template-columns:1fr 1fr;gap:20px}.ve-conversion-columns>div{min-width:0}.ve-conversion-columns .ve-label{margin-bottom:12px}.ve-modal pre{white-space:pre-wrap;overflow-wrap:anywhere;font-family:monospace;font-size:12px;line-height:1.8;margin:0;padding:12px;background:${colors.surfaceMuted};border-radius:5px}.ve-modal details{margin-top:20px;font-size:12px;color:${colors.muted}}.ve-modal summary{cursor:pointer;padding:10px 0}.ve-screenreader{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:600px){.ve-heading{padding:18px 0 14px}.ve-heading h3{font-size:22px}.ve-heading p{font-size:12px}.ve-experiment{display:none}.ve-tools{padding:10px;top:0}.ve-tab{padding:8px 7px;font-size:11px!important;gap:5px;min-height:40px}.ve-tab svg{width:14px}.ve-history{padding-left:4px;gap:0}.ve-history .ve-icon{min-width:30px;padding:4px}.ve-palette{flex-wrap:nowrap;overflow-x:auto;padding-bottom:10px;scrollbar-width:thin}.ve-chip{flex-shrink:0;min-width:46px;min-height:44px;padding:8px 10px}.ve-instruction{align-items:flex-start;flex-direction:column;gap:2px}.ve-instruction .ve-text-button{min-height:32px}.ve-sheet-heading{flex-direction:column;align-items:flex-start;gap:2px}.ve-line{gap:6px;padding-right:4px}.ve-line-rail{width:23px}.ve-line-edit{min-height:32px}.ve-line-content{font-size:16px}.ve-line.enlarged .ve-line-content{font-size:24px}.ve-chord{min-height:30px;padding:4px 6px}.ve-chord-space{min-height:34px}.ve-footer{gap:8px;align-items:flex-start}.ve-footer>span:last-child{white-space:nowrap}.ve-modal-backdrop{padding:10px}.ve-modal{max-height:94dvh}.ve-modal-header{padding:17px 16px 13px}.ve-modal h4{font-size:18px}.ve-modal-body{padding:16px}.ve-modal-footer{padding:13px 16px}.ve-conversion-columns{grid-template-columns:1fr}.ve-modal-footer .ve-button{flex:1}.ve-mark-actions{gap:6px}.ve-mark-actions>.ve-label{width:100%}.ve-mark-actions .ve-button{font-size:11px!important;padding:7px}.ve-mark-actions input{width:70px}.ve-add-line{margin-left:28px}}
@media(max-width:600px){.ve-mode-row{flex-wrap:wrap}.ve-tabs{flex:1 1 auto}.ve-history{margin-left:auto}.ve-tab{font-size:10px!important;padding:7px 6px;gap:4px}}
@media(prefers-reduced-motion:reduce){.lauda-cifra-editor *{scroll-behavior:auto!important}}
`;
