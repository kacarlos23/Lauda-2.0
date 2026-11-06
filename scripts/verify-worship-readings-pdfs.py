"""Inspect text, sequence and pagination of the actual public acceptance PDFs."""
import json
from pathlib import Path
import fitz

folder = Path(__file__).resolve().parent.parent / "test-results/worship-readings"
results = []
for name in ["legacy.pdf", "public-download.pdf", "evening.pdf", "reading-only.pdf", "long-reading.pdf"]:
    doc = fitz.open(folder / name)
    pages = [page.get_text() for page in doc]
    content = "\n".join(pages)
    assert "ORDEM DE CULTO" in content, name
    assert all("Gerado pelo Lauda" in text for text in pages), (name, "footer")
    for page in doc:
        for block in page.get_text("blocks"):
            assert block[1] >= 45 and block[3] <= page.rect.height - 30, (name, page.number, block)
            if not block[4].startswith("Gerado pelo Lauda"):
                assert block[3] <= page.rect.height - 60, (name, page.number, "body overlaps footer", block)
        for link in page.get_links():
            assert link["uri"].startswith("https://"), (name, "unsafe link")
    if name == "public-download.pdf":
        markers = ["CULTO DA MANHÃ", "Celebração da esperança", "Salmo 23:1", "Primeira canção", "João 3:16", "Última canção", "CULTO DA NOITE", "Encontro de gratidão", "Canção da noite"]
        positions = [content.index(marker) for marker in markers]
        assert positions == sorted(positions), (name, positions)
        assert "Porque Deus amou o mundo." in content and "Leitura de validação com acentuação." in content
    if name == "evening.pdf":
        assert "CULTO DA NOITE" in content and "CULTO DA MANHÃ" not in content
        assert content.index("Salmo 23:1") < content.index("Canção da noite")
    if name == "reading-only.pdf":
        assert "João 3:16" in content and "Primeira canção" not in content
    if name == "legacy.pdf":
        assert "Leitura bíblica" not in content and "Primeira canção" in content
    if name == "long-reading.pdf":
        assert len(doc) > 2
        positions = [content.index(f"Linha {i:03}") for i in range(1, 181)]
        assert positions == sorted(positions)
        assert content.index("Primeira canção") < positions[0] < positions[-1] < content.index("Última canção")
    doc[0].get_pixmap(matrix=fitz.Matrix(1.2, 1.2)).save(folder / f"{Path(name).stem}-preview.png")
    results.append({"file": name, "pages": len(doc), "links": sum(len(p.get_links()) for p in doc), "status": "passed"})
    doc.close()
(folder / "pdf-inspection.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(results, ensure_ascii=True, indent=2))
