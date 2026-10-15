export function parseCSV(input) {
  const source = String(input).replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', quoted = false, closedQuote = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closedQuote = true; }
      else field += ch;
    } else if (ch === '"') {
      if (field.length) throw new Error(`Unexpected quote near row ${rows.length + 1}`);
      quoted = true;
    } else if (closedQuote && ch !== ',' && ch !== '\r' && ch !== '\n') { throw new Error(`Unexpected text after a quote near row ${rows.length + 1}`);
    } else if (ch === ',') { row.push(field); field = ''; closedQuote = false; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(field); field = ''; closedQuote = false;
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (quoted) throw new Error('CSV ends inside a quoted field');
  row.push(field);
  if (row.some(value => value.trim() !== '')) rows.push(row);
  if (!rows.length) throw new Error('CSV contains no header or phrases');
  const header = rows.shift().map(value => value.trim());
  const required = ['id', 'text', 'author', 'category'];
  if (required.some((name, index) => header[index] !== name) || header.length !== 4)
    throw new Error('CSV header must be id,text,author,category');
  const seenIds = new Set(), seenText = new Set(), quotes = [];
  for (let index = 0; index < rows.length; index++) {
    const values = rows[index];
    if (values.length !== 4) throw new Error(`Row ${index + 2} must contain four columns`);
    const [id, text, author, category] = values;
    if (!id.trim() || !text.trim() || !author.trim()) throw new Error(`Row ${index + 2} needs id, text, and author`);
    if (seenIds.has(id)) throw new Error(`Duplicate id on row ${index + 2}`);
    const normalized = text.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^а-я0-9]/giu, '');
    if (!/[а-яё]/iu.test(text)) throw new Error(`Row ${index + 2} has no Russian letters`);
    if (!normalized || seenText.has(normalized)) continue;
    seenIds.add(id); seenText.add(normalized);
    quotes.push({ id, text, author, category });
  }
  if (!quotes.length) throw new Error('CSV has no valid unique phrases');
  return quotes;
}

export async function loadQuotes(url = './quotes.csv', fetchImpl = fetch) {
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Phrase file could not be loaded (${response.status})`);
  return parseCSV(await response.text());
}
