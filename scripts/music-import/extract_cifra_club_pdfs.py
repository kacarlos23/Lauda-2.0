#!/usr/bin/env python3
"""Builds a reviewable Lauda music-catalog JSON file from Cifra Club PDFs."""

from __future__ import annotations

import argparse
import csv
from difflib import SequenceMatcher
import json
import re
import unicodedata
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from pypdf import PdfReader


KEY_ALIASES = {
    "DB": "C#", "EB": "D#", "GB": "F#", "AB": "G#", "BB": "A#",
    "DBM": "C#m", "EBM": "D#m", "GBM": "F#m", "ABM": "G#m", "BBM": "A#m",
}
VALID_KEYS = {
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
    "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm",
}
URL_RE = re.compile(r"https?://[^\s<>\])}]+", re.IGNORECASE)
KEY_RE = re.compile(r"(?im)^\s*Tom\s*:\s*([A-G](?:#|b)?m?)\s*$")
HEADER_RE = re.compile(r"(?im)^\s*(?:Composi|Afina).*$")


def clean_line(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalized_identity(song: dict[str, Any]) -> str:
    def normalize(value: str) -> str:
        plain = unicodedata.normalize("NFKD", value)
        return " ".join("".join(char for char in plain if not unicodedata.combining(char)).casefold().split())
    return f"{normalize(song['artist'])}\0{normalize(song['title'])}"


def canonical_key(raw: str | None) -> str | None:
    if not raw:
        return None
    compact = raw.strip().replace("♭", "b").replace("♯", "#")
    alias = KEY_ALIASES.get(compact.upper())
    if alias:
        return alias
    normalized = compact[0].upper() + compact[1:]
    return normalized if normalized in VALID_KEYS else None


def annotation_urls(reader: PdfReader) -> list[str]:
    urls: list[str] = []
    for page in reader.pages:
        for annotation_ref in page.get("/Annots", []):
            try:
                annotation = annotation_ref.get_object()
                action = annotation.get("/A")
                uri = action.get("/URI") if action else None
                if uri:
                    urls.append(str(uri))
            except Exception:
                continue
    return urls


def normalize_url(value: str) -> str | None:
    try:
        parsed = urlsplit(value.strip().rstrip(".,;"))
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return urlunsplit(("https", parsed.netloc.lower(), parsed.path, "", ""))


def choose_cifra_url(values: list[str]) -> str | None:
    unique = {normalized for value in values if (normalized := normalize_url(value))}
    cifra_club = [value for value in unique if urlsplit(value).netloc in {"cifraclub.com.br", "www.cifraclub.com.br"}]
    if not cifra_club:
        return None

    def score(value: str) -> tuple[int, int]:
        segments = [part for part in urlsplit(value).path.split("/") if part]
        return (len(segments), len(value))

    selected = max(cifra_club, key=score)
    return selected if len([part for part in urlsplit(selected).path.split("/") if part]) >= 2 else None


def specific_cifra_urls(values: list[str]) -> set[str]:
    result: set[str] = set()
    for value in values:
        normalized = normalize_url(value)
        if not normalized or urlsplit(normalized).netloc not in {"cifraclub.com.br", "www.cifraclub.com.br"}:
            continue
        parts = [part for part in urlsplit(normalized).path.split("/") if part]
        if len(parts) >= 2 and (not parts[-1].endswith(".html") or len(parts) >= 3):
            result.add(normalized)
    return result


def comparable(value: str) -> str:
    plain = unicodedata.normalize("NFKD", value)
    return " ".join(re.sub(r"[^a-z0-9]+", " ", "".join(char for char in plain if not unicodedata.combining(char)).casefold()).split())


def url_slugs(cifra_url: str | None) -> tuple[str, str]:
    if not cifra_url:
        return "", ""
    parts = [part for part in urlsplit(cifra_url).path.split("/") if part]
    if len(parts) < 2:
        return "", ""
    song_part = parts[-2] if parts[-1].endswith(".html") else parts[-1]
    return comparable(parts[0]), comparable(song_part)


def similarity(value: str, slug: str) -> float:
    left, right = comparable(value), comparable(slug)
    if not left or not right:
        return 0.0
    if left in right or right in left:
        return 1.0
    return SequenceMatcher(None, left, right).ratio()


def best_split(raw: str, cifra_url: str | None, prefix: str = "") -> tuple[str | None, str | None, float]:
    value = raw[len(prefix):].strip() if prefix and raw.casefold().startswith(prefix.casefold()) else raw.strip()
    parts = [clean_line(part) for part in value.split(" - ") if clean_line(part)]
    if len(parts) < 2:
        return None, None, 0.0
    artist_slug, song_slug = url_slugs(cifra_url)
    choices: list[tuple[str, str, float]] = []
    for index in range(1, len(parts)):
        left, right = " - ".join(parts[:index]), " - ".join(parts[index:])
        if prefix:
            choices.append((right, left, similarity(right, song_slug) + similarity(left, artist_slug)))
        else:
            choices.append((left, right, similarity(left, song_slug) + similarity(right, artist_slug)))
            choices.append((right, left, similarity(right, song_slug) + similarity(left, artist_slug)))
    title, artist, score = max(choices, key=lambda choice: choice[2])
    return title, artist, score


def metadata_header(reader: PdfReader, cifra_url: str | None) -> tuple[str | None, str | None, float]:
    raw = str((reader.metadata or {}).get("/Title") or "")
    if not re.match(r"^Cifra Club\s*-", raw, re.IGNORECASE):
        return None, None, 0.0
    return best_split(raw, cifra_url, re.match(r"^Cifra Club\s*-\s*", raw, re.IGNORECASE).group(0))


def parse_pdf(path: Path, manifest: dict[str, Any] | None = None) -> dict[str, Any]:
    problems: list[str] = []
    try:
        reader = PdfReader(str(path))
        page_texts = [(page.extract_text() or "").replace("\r\n", "\n").replace("\r", "\n") for page in reader.pages]
    except Exception as error:
        return {"path": str(path), "problems": [f"PDF ilegível: {type(error).__name__}"], "song": None, "candidate": {}, "urls": []}

    text = "\n".join(page_texts).strip()
    lines = [clean_line(line) for line in text.splitlines() if clean_line(line)]

    embedded_urls = annotation_urls(reader)
    visible_urls = URL_RE.findall(text)
    cifra_url = choose_cifra_url([*embedded_urls, *visible_urls])
    song_urls = specific_cifra_urls([*embedded_urls, *visible_urls])
    if len(song_urls) > 1:
        problems.append("PDF contém hyperlinks de várias músicas")
    artist_slug, song_slug = url_slugs(cifra_url)
    candidates: list[tuple[str, str, float, str]] = []
    invalid_header = r"^\[|^(Intro|Primeira|Segunda|Refr|Ponte|Composi|Tom\s*:|Afina)|^[A-G](?:#|b)?m?(?:\d|/|\s|$)"
    if len(lines) > 1 and not re.match(invalid_header, lines[0], re.IGNORECASE) and not re.match(invalid_header, lines[1], re.IGNORECASE):
        candidates.append((lines[0], lines[1], similarity(lines[0], song_slug) + similarity(lines[1], artist_slug), "texto"))
    metadata_title, metadata_artist, metadata_score = metadata_header(reader, cifra_url)
    if metadata_title and metadata_artist:
        candidates.append((metadata_title, metadata_artist, metadata_score, "metadados"))
    source = (manifest or {}).get(path.stem, {})
    source_name = str(source.get("title") or path.name)
    source_title, source_artist, source_score = best_split(re.sub(r"\.pdf$", "", source_name, flags=re.IGNORECASE), cifra_url, "Cifra Club - " if source_name.casefold().startswith("cifra club - ") else "")
    if source_title and source_artist:
        candidates.append((source_title, source_artist, source_score, "nome do arquivo"))

    title = artist = None
    candidate_source = ""
    if candidates:
        title, artist, score, candidate_source = max(candidates, key=lambda candidate: candidate[2])
        if cifra_url and score < 1.35:
            problems.append("Nome/artista não conferem com o hyperlink do Cifra Club")
    if title and len(comparable(title).replace(" ", "")) < 3:
        problems.append("Nome da música curto demais para confirmação automática")
    if artist and len(comparable(artist).replace(" ", "")) < 3:
        problems.append("Artista curto demais para confirmação automática")
    has_visible_cifra_header = any(re.match(r"^(Composi|Tom\s*:|Afina)", line, re.IGNORECASE) for line in lines[:8])
    if not cifra_url and not metadata_title and not has_visible_cifra_header:
        problems.append("Estrutura de cifra sem origem confirmada")

    key_match = KEY_RE.search(text)
    original_key = canonical_key(key_match.group(1) if key_match else None)
    if key_match and not original_key:
        problems.append(f"Tom não suportado: {key_match.group(1)}")

    raw_lines = text.splitlines()
    remove_indexes: set[int] = set()
    for index, raw_line in enumerate(raw_lines):
        line = clean_line(raw_line)
        if re.match(r"^(Composi|Tom\s*:|Afina)", line, re.IGNORECASE):
            remove_indexes.add(index)
            if re.match(r"^(Tom\s*:|Composi)", line, re.IGNORECASE):
                for previous in range(max(0, index - 3), index):
                    previous_line = clean_line(raw_lines[previous])
                    if previous_line and (similarity(previous_line, comparable(title or "")) > 0.9 or similarity(previous_line, comparable(artist or "")) > 0.9):
                        remove_indexes.add(previous)
    content = "\n".join(line for index, line in enumerate(raw_lines) if index not in remove_indexes).strip()

    if not title:
        problems.append("Nome da música não identificado")
    if not artist:
        problems.append("Artista não identificado")
    if not original_key:
        problems.append("Tom não identificado")
    if not content:
        problems.append("Cifra não identificada")

    song = None
    candidate = {
        "title": title or "",
        "artist": artist or "",
        "originalKey": original_key or "",
        "content": content,
        "cifraUrl": cifra_url,
    }
    if not problems:
        song = candidate
    return {
        "path": str(path),
        "source": source.get("path") or source_name,
        "candidateSource": candidate_source,
        "problems": problems,
        "song": song,
        "candidate": candidate,
        "urls": sorted({value for value in embedded_urls + visible_urls if normalize_url(value)}),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Extrai cifras de PDFs do Cifra Club para o formato de importação do Lauda.")
    parser.add_argument("input", type=Path, help="Pasta com os PDFs")
    parser.add_argument("--output", type=Path, required=True, help="Arquivo .json que será importado no Lauda")
    parser.add_argument("--review", type=Path, required=True, help="Relatório .csv da conferência")
    parser.add_argument("--manifest", type=Path, help="Manifesto JSON opcional com nomes e caminhos originais do Drive")
    args = parser.parse_args()

    pdfs = sorted(args.input.rglob("*.pdf"), key=lambda item: str(item).casefold())
    manifest = json.loads(args.manifest.read_text(encoding="utf-8")) if args.manifest else {}
    results = [parse_pdf(path, manifest) for path in pdfs]
    groups: dict[str, list[dict[str, Any]]] = {}
    for result in results:
        if result["song"]:
            groups.setdefault(normalized_identity(result["song"]), []).append(result)

    songs: list[dict[str, Any]] = []
    for group in groups.values():
        reference = group[0]["song"]
        same_key_and_content = all(
            item["song"]["originalKey"] == reference["originalKey"]
            and item["song"]["content"].replace("\r\n", "\n").strip() == reference["content"].replace("\r\n", "\n").strip()
            for item in group
        )
        nonempty_links = {item["song"].get("cifraUrl") for item in group if item["song"].get("cifraUrl")}
        if not same_key_and_content or len(nonempty_links) > 1:
            for item in group:
                item["problems"].append("Há outra versão da mesma música com tom, cifra ou link diferente")
                item["song"] = None
            continue

        merged = dict(reference)
        if nonempty_links:
            merged["cifraUrl"] = next(iter(nonempty_links))
        songs.append(merged)
        for duplicate in group[1:]:
            duplicate["duplicate"] = True

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"format": "lauda.music-catalog", "version": 1, "songs": songs}, ensure_ascii=False, indent=2), encoding="utf-8")
    args.review.parent.mkdir(parents=True, exist_ok=True)
    with args.review.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["status", "arquivo_drive", "arquivo_local", "origem_dos_dados", "nome", "artista", "tom", "link", "problemas", "urls_encontradas"])
        writer.writeheader()
        for result in results:
            song = result.get("song") or result.get("candidate") or {}
            status = "REVISAR" if result["problems"] else "DUPLICADO" if result.get("duplicate") else "PRONTO"
            writer.writerow({
                "status": status,
                "arquivo_drive": result.get("source", ""),
                "arquivo_local": result["path"],
                "origem_dos_dados": result.get("candidateSource", ""),
                "nome": song.get("title", ""),
                "artista": song.get("artist", ""),
                "tom": song.get("originalKey", ""),
                "link": song.get("cifraUrl", "") or "",
                "problemas": "; ".join(result["problems"]),
                "urls_encontradas": " | ".join(result["urls"]),
            })

    review_count = sum(1 for result in results if result["problems"])
    duplicate_count = sum(1 for result in results if result.get("duplicate"))
    print(json.dumps({"pdfs": len(pdfs), "ready": len(songs), "review": review_count, "duplicates": duplicate_count, "output": str(args.output), "reviewFile": str(args.review)}, ensure_ascii=False))
    return 0 if pdfs else 2


if __name__ == "__main__":
    raise SystemExit(main())
