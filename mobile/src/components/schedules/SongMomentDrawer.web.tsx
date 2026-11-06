import React from "react";

type Props = { open: boolean; id: string; children: React.ReactNode };

const css = `
.song-moment-drawer {
  display: grid;
  grid-template-rows: 0fr;
  position: relative;
  z-index: 10;
  margin-top: -6px;
  transition: grid-template-rows 300ms ease-out;
}
.song-moment-drawer[data-open="true"] { grid-template-rows: 1fr; }
.song-moment-drawer__clip { min-height: 0; overflow: hidden; }
.song-moment-drawer__content {
  transform: translateY(-20px);
  opacity: 0;
  transition: transform 300ms ease-out, opacity 250ms ease-out;
}
.song-moment-drawer[data-open="true"] .song-moment-drawer__content {
  transform: translateY(0);
  opacity: 1;
}
.song-moment-chevron { display: flex; transform: rotate(0deg); transition: transform 300ms ease-out; }
.song-moment-chevron[data-open="true"] { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) {
  .song-moment-drawer, .song-moment-drawer__content, .song-moment-chevron { transition: none; }
}
`;

export function SongMomentDrawer({ open, id, children }: Props) {
  return <>
    <style>{css}</style>
    <div id={id} className="song-moment-drawer" data-open={open} aria-hidden={!open} inert={!open}>
      <div className="song-moment-drawer__clip">
        <div className="song-moment-drawer__content">{children}</div>
      </div>
    </div>
  </>;
}

export function SongMomentChevron({ open, children }: Omit<Props, "id">) {
  return <span className="song-moment-chevron" data-open={open} aria-hidden="true">{children}</span>;
}
