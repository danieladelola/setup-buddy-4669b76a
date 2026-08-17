// Simple CSV/TSV parser supporting ; , and \t delimiters and quoted values.
export type ParsedRow = Record<string, string>;

export type ParsedContact = {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string;
  job_title?: string;
};

export type ParseResult = {
  valid: ParsedContact[];
  invalid: { line: number; value: string; reason: string }[];
  duplicates: number;
  headers: string[];
  delimiter: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function detectDelimiter(line: string): string {
  const counts = { ";": 0, ",": 0, "\t": 0 } as Record<string, number>;
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') inQuote = !inQuote;
    else if (!inQuote && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ",";
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === delim && !inQuote) {
      out.push(cur); cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const HEADER_MAP: Record<string, keyof ParsedContact> = {
  email: "email",
  "e-mail": "email",
  mail: "email",
  firstname: "first_name",
  "first name": "first_name",
  first_name: "first_name",
  lastname: "last_name",
  "last name": "last_name",
  last_name: "last_name",
  sms: "phone",
  phone: "phone",
  mobile: "phone",
  landline_number: "phone",
  "landline number": "phone",
  job_title: "job_title",
  "job title": "job_title",
  jobtitle: "job_title",
  company: "company",
};

export function parseContacts(input: string): ParseResult {
  const text = input.replace(/^\uFEFF/, "").trim();
  if (!text) return { valid: [], invalid: [], duplicates: 0, headers: [], delimiter: "," };
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return { valid: [], invalid: [], duplicates: 0, headers: [], delimiter: "," };

  // If a single column of emails (no delimiter, no email header), short-circuit
  const firstLine = lines[0];
  const looksLikeHeader = /email|mail|firstname|lastname|sms|phone|name/i.test(firstLine);
  const delimiter = detectDelimiter(firstLine);

  let headers: string[] = [];
  let dataLines: string[] = lines;
  if (looksLikeHeader) {
    headers = splitLine(firstLine, delimiter).map((h) => h.toLowerCase().replace(/^_+/, ""));
    dataLines = lines.slice(1);
  }

  const valid: ParsedContact[] = [];
  const invalid: ParseResult["invalid"] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  dataLines.forEach((raw, idx) => {
    const lineNo = idx + (looksLikeHeader ? 2 : 1);
    if (!headers.length) {
      // No header — treat each cell on the line as a potential email
      const cells = splitLine(raw, delimiter);
      for (const cell of cells) {
        const e = cell.toLowerCase().trim();
        if (!e) continue;
        if (!EMAIL_RE.test(e)) { invalid.push({ line: lineNo, value: cell, reason: "invalid email" }); continue; }
        if (seen.has(e)) { duplicates++; continue; }
        seen.add(e);
        valid.push({ email: e });
      }
      return;
    }
    const cells = splitLine(raw, delimiter);
    const row: ParsedRow = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });

    const contact: ParsedContact = { email: "" };
    for (const [key, val] of Object.entries(row)) {
      const mapped = HEADER_MAP[key];
      if (!mapped) continue;
      const v = (val || "").trim();
      if (!v) continue;
      if (mapped === "email") contact.email = v.toLowerCase();
      else (contact as any)[mapped] = v;
    }
    if (!contact.email) { invalid.push({ line: lineNo, value: raw, reason: "missing email" }); return; }
    if (!EMAIL_RE.test(contact.email)) { invalid.push({ line: lineNo, value: contact.email, reason: "invalid email" }); return; }
    if (seen.has(contact.email)) { duplicates++; return; }
    seen.add(contact.email);
    valid.push(contact);
  });

  return { valid, invalid, duplicates, headers, delimiter };
}
