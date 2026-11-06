import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";
import { colors } from "../src/theme";
import { themePreviewEnabled } from "../src/tokens/colorModes";
import { themeBootstrapScript } from "../src/store/themeStore";

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="theme-color" content={colors.primaryDark} />
        <meta
          name="description"
          content="Lauda — gestão de ministérios, escalas e equipes."
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/icons/apple-touch-icon.png"
        />
        <link rel="manifest" href="/site.webmanifest" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          [data-lauda-control]:focus { outline: none; }
          [data-lauda-control="standalone"]:focus,
          [data-lauda-field]:focus-within {
            border-color: ${colors.primary};
            box-shadow: 0 0 0 3px ${colors.primarySoft};
          }
          [data-lauda-control][aria-invalid="true"], [data-lauda-field][data-invalid="true"] { border-color: ${colors.danger}; }
          [role="button"]:focus-visible, a:focus-visible { outline: 2px solid ${colors.primary}; outline-offset: 3px; }
          [data-lauda-rich-editor]:focus { outline: 2px solid ${colors.primary}; outline-offset: 2px; }
        ` }} />
        {themePreviewEnabled ? <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript() }} /> : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
