export function normalizeCatalogText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function cleanCatalogText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}
