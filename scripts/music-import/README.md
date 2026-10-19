# Importação de PDFs de cifras

O extrator gera um catálogo compatível com a importação do Lauda e um CSV de revisão. Ele confere texto, metadados, nome original do arquivo e hyperlinks internos do PDF. Somente registros consistentes entram no JSON.

```powershell
python -m pip install -r scripts/music-import/requirements.txt
python scripts/music-import/extract_cifra_club_pdfs.py <pasta-dos-pdfs> `
  --manifest <manifesto-opcional-do-drive.json> `
  --output catalogo.lauda-musicas.json `
  --review revisao.csv
```

Cada música exportada possui exclusivamente `title`, `artist`, `originalKey`, `content` e `cifraUrl`. O link pode ser nulo; os demais campos são obrigatórios.
