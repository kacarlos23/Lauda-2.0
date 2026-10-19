"""Inspect the actual PDFs exported by validate-worship-test.cjs (requires PyMuPDF)."""
import json
from pathlib import Path

import fitz


def main():
    directory = Path(__file__).resolve().parent.parent / "test-results" / "worship-acceptance"
    expected = {"morning.pdf": (2, 1), "evening.pdf": (5, 5), "both.pdf": (7, 6), "long.pdf": (32, 31), "download.pdf": (7, 6)}
    results = []
    for name, (expected_cards, expected_links) in expected.items():
        document = fitz.open(directory / name)
        cards_count = links_count = play_count = 0
        contents = []
        for page in document:
            contents.append(page.get_text())
            assert "Gerado pelo Lauda" in contents[-1], (name, page.number, "footer missing")
            drawings = page.get_drawings()
            cards = [drawing["rect"] for drawing in drawings
                     if drawing["type"] == "f" and abs(drawing["rect"].x0 - 46) < 1 and abs(drawing["rect"].width - 46) < 1 and abs(drawing["rect"].height - 46) < 1]
            cards_count += len(cards)
            assert not any(d["type"] == "fs" and d["rect"].width > 450 for d in drawings), (name, "card borders remain")
            assert all(rect.y0 >= 46 and rect.y1 <= page.rect.height - 64 for rect in cards), (name, "artist image outside content area")
            assert page.get_images(), (name, "missing background logo")
            for link in page.get_links():
                links_count += 1
                if abs(link["from"].width - 34) < 1 and abs(link["from"].height - 34) < 1:
                    play_count += 1
                assert link["uri"].startswith("https://"), (name, "unsafe hyperlink")
                assert link["from"].y0 >= 80 and link["from"].y1 <= page.rect.height - 64, (name, "hyperlink outside content area")
            for block in page.get_text("blocks"):
                assert block[1] >= 46 and block[3] < page.rect.height - 30, (name, "text outside margins")
        text = "\n".join(contents)
        assert "ORDEM DE CULTO" in text and "ORDEM DOS CULTOS" not in text, (name, "incorrect title")
        assert all(link["uri"] == "https://www.youtube.com/watch?v=LaudaTest01" for page in document for link in page.get_links()), (name, "video is not from song catalog")
        assert cards_count == expected_cards, (name, cards_count)
        assert play_count == expected_links, (name, play_count)
        assert links_count >= expected_links * 2, (name, "title hyperlinks missing")
        assert "Programa de Louvor" not in text and "Lauda — Desenvolvimento isolado" not in text
        if name == "morning.pdf":
            assert "CULTO DA MANHÃ" in text and "CULTO DA NOITE" not in text
        if name == "evening.pdf":
            assert "CULTO DA NOITE" in text and "CULTO DA MANHÃ" not in text
        if name in ("both.pdf", "download.pdf"):
            assert text.index("CULTO DA MANHÃ") < text.index("CULTO DA NOITE")
            assert "Encerramento de homologação" in text
            assert "Grandioso És Tu" in text
        if name == "long.pdf":
            assert len(document) > 1
            for index in range(8, 33):
                assert f"[TESTE] {index} -" in text, (name, index, "missing title")
        document[0].get_pixmap(matrix=fitz.Matrix(1.2, 1.2)).save(directory / f"{Path(name).stem}-preview.png")
        results.append({"file": name, "pages": len(document), "cards": cards_count, "hyperlinks": links_count, "play_actions": play_count, "status": "passed"})
        document.close()
    (directory / "pdf-inspection.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(results, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
