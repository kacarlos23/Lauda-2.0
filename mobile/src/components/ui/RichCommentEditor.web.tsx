import React, { useEffect, useRef, useState } from "react";
import { countRichTextCharacters, RICH_TEXT_MAX_CHARACTERS } from "../../../../src/contracts/richText";
import { colors, radii, spacing } from "../../theme";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  testID?: string;
};

const palette = [colors.ink, colors.primary, colors.info, colors.accent, colors.danger];

export function RichCommentEditor({ value, onChange, label = "Comentários", placeholder = "Adicione comentários...", disabled, testID }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [limitReached, setLimitReached] = useState(false);
  const count = countRichTextCharacters(value);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && document.activeElement !== editor && editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);

  const command = (name: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, commandValue);
    const next = editorRef.current?.innerHTML ?? "";
    if (countRichTextCharacters(next) <= RICH_TEXT_MAX_CHARACTERS) onChange(next);
  };

  const handleInput = () => {
    const next = editorRef.current?.innerHTML ?? "";
    const nextCount = countRichTextCharacters(next);
    if (nextCount > RICH_TEXT_MAX_CHARACTERS) {
      setLimitReached(true);
      if (editorRef.current) editorRef.current.innerHTML = value;
      return;
    }
    setLimitReached(false);
    onChange(next);
  };

  return (
    <div data-testid={testID} style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ color: colors.text, fontSize: 13, fontWeight: 800 }}>{label}</label>
        <span aria-live="polite" style={{ color: limitReached ? colors.danger : colors.muted, fontSize: 12, fontWeight: 700 }}>{count}/{RICH_TEXT_MAX_CHARACTERS}</span>
      </div>
      <div role="toolbar" aria-label="Formatação dos comentários" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: spacing.xs }}>
        <ToolbarButton label="B" title="Negrito" onClick={() => command("bold")} style={{ fontWeight: 900 }} disabled={disabled} />
        <ToolbarButton label="I" title="Itálico" onClick={() => command("italic")} style={{ fontStyle: "italic" }} disabled={disabled} />
        <ToolbarButton label="U" title="Sublinhado" onClick={() => command("underline")} style={{ textDecoration: "underline" }} disabled={disabled} />
        <ToolbarButton label="• Lista" title="Lista com tópicos" onClick={() => command("insertUnorderedList")} disabled={disabled} />
        {palette.map((color) => <button key={color} type="button" title={`Cor ${color}`} aria-label={`Cor ${color}`} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => command("foreColor", color)} style={{ width: 28, height: 28, padding: 0, borderRadius: 14, border: `2px solid ${colors.surface}`, background: color, cursor: "pointer" }} />)}
      </div>
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={handleInput}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
        }}
        style={{ minHeight: 130, boxSizing: "border-box", border: `1px solid ${limitReached ? colors.danger : colors.line}`, borderRadius: radii.md, background: colors.surfaceMuted, color: colors.ink, padding: spacing.md, fontSize: 15, lineHeight: "23px", outlineColor: colors.primary, overflowY: "auto" }}
      />
      {limitReached ? <span role="alert" style={{ color: colors.danger, fontSize: 12 }}>O limite é de 3.000 caracteres visíveis.</span> : null}
    </div>
  );
}

function ToolbarButton({ label, title, onClick, style, disabled }: { label: string; title: string; onClick: () => void; style?: React.CSSProperties; disabled?: boolean }) {
  return <button type="button" title={title} aria-label={title} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick} style={{ minWidth: 38, height: 36, padding: `0 ${spacing.sm}px`, border: `1px solid ${colors.line}`, borderRadius: radii.sm, background: colors.surface, color: colors.ink, cursor: "pointer", ...style }}>{label}</button>;
}
