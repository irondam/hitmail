// ─── Tables de correction ────────────────────────────────────────────────────

const TYPO_DOMAINS = {
  'gnail.com':'gmail.com','gmai.com':'gmail.com','gamil.com':'gmail.com',
  'gmial.com':'gmail.com','gmail.fr':'gmail.com','gmal.com':'gmail.com',
  'homail.com':'hotmail.com','hotmai.com':'hotmail.com','hotmial.com':'hotmail.com',
  // hotmail.fr supprimé : domaine valide
  'hotmaill.com':'hotmail.com',
  'yaho.com':'yahoo.com','yaho.fr':'yahoo.fr','yahooo.com':'yahoo.com',
  'yhoo.com':'yahoo.com','yahoo.com.fr':'yahoo.fr',
  'outlok.com':'outlook.com','outllook.com':'outlook.com',
  'orang.fr':'orange.fr','orangge.fr':'orange.fr','ornage.fr':'orange.fr',
  'lapost.net':'laposte.net','lapostte.net':'laposte.net',
  'freee.fr':'free.fr','fre.fr':'free.fr',
  'bouygue.fr':'bouygues.fr','bougues.fr':'bouygues.fr',
};

const TLD_TYPOS = {
  '.fe':'.fr','.ft':'.fr','.fre':'.fr','.r':'.fr',
  '.cmo':'.com','.ocm':'.com','.con':'.com','.cm':'.com',
  '.ogr':'.org','.nrt':'.net','.ne':'.net','.ney':'.net',
};

const HTML_ENTITIES = {
  '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",
  '&#64;':'@','&#46;':'.','&nbsp;':' ',
  '&eacute;':'é','&egrave;':'è','&ecirc;':'ê','&euml;':'ë',
  '&agrave;':'à','&acirc;':'â','&auml;':'ä',
  '&ocirc;':'ô','&ouml;':'ö','&ugrave;':'ù','&ucirc;':'û','&uuml;':'ü',
  '&ccedil;':'ç','&iuml;':'ï','&icirc;':'î',
};

const PARASITIC_PREFIXES = ['mailto:','MAILTO:','smtp:','SMTP:','mail:','MAIL:'];

// ─── Nettoyage d'un email ────────────────────────────────────────────────────

export function cleanEmail(raw) {
  if (raw === null || raw === undefined || raw === '') return { cleaned: '', status: 'empty' };

  let email = String(raw);

  // 1. Retours à la ligne → premier segment non vide
  email = email.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean)[0] || '';

  // 2. Entités HTML nommées
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    email = email.split(entity).join(char);
  }
  email = email.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  email = email.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));

  // 3. Caractères invisibles et espaces insécables
  email = email.replace(/[\u00A0\u200B\u200C\u200D\u200E\u200F\u2060\uFEFF]/g, '');
  email = email.replace(/\s+/g, '');

  // 4. Guillemets typographiques enveloppants
  email = email.replace(/^[«»„\u201C\u201D\u2018\u2019\u2039\u203A"'`]+/, '');
  email = email.replace(/[«»„\u201C\u201D\u2018\u2019\u2039\u203A"'`]+$/, '');

  // 5. Préfixes parasites
  for (const prefix of PARASITIC_PREFIXES) {
    if (email.toLowerCase().startsWith(prefix.toLowerCase())) { email = email.slice(prefix.length); break; }
  }

  // 6. Punycode → unicode
  if (email.includes('xn--')) {
    try {
      const [local, domain] = email.split('@');
      if (domain) email = local + '@' + new URL('http://' + domain).hostname;
    } catch (_) {}
  }

  // 7. Minuscules + nettoyage final
  email = email.toLowerCase().replace(/[,;]+$/, '');

  const original = email;
  if (!email) return { cleaned: '', status: 'empty' };
  if (!email.includes('@')) return { cleaned: email, status: 'invalid', reason: 'pas de @' };

  const parts = email.split('@');
  if (parts.length !== 2 || !parts[1]) return { cleaned: email, status: 'invalid', reason: 'format @ invalide' };

  let [local, domain] = parts;

  if (TYPO_DOMAINS[domain]) { domain = TYPO_DOMAINS[domain]; email = `${local}@${domain}`; }

  for (const [bad, good] of Object.entries(TLD_TYPOS)) {
    if (domain.endsWith(bad)) { domain = domain.slice(0, -bad.length) + good; email = `${local}@${domain}`; break; }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { cleaned: email, status: 'invalid', reason: 'format invalide' };
  }

  return {
    cleaned: email,
    status: email === original ? 'ok' : 'fixed',
    original: email !== original ? original : undefined,
  };
}

// ─── Détection automatique de colonnes ──────────────────────────────────────

export function detectEmailColumns(headers) {
  return headers
    .map((h, i) => ({ h: String(h).toLowerCase(), i }))
    .filter(({ h }) => h.includes('email') || h.includes('mail') || h.includes('courriel') || h.includes('e-mail'))
    .map(({ i }) => i);
}

export function detectCPColumns(headers) {
  return headers
    .map((h, i) => ({ h: String(h).toLowerCase(), i }))
    .filter(({ h }) => h.includes('cp') || h.includes('code postal') || h.includes('codepostal') || h.includes('postal') || h.includes('zip'))
    .map(({ i }) => i);
}

// ─── Parsing CSV ─────────────────────────────────────────────────────────────

export function parseCSV(text) {
  const firstLine = text.split('\n')[0] || '';
  const sep = (firstLine.split(';').length >= firstLine.split(',').length) ? ';' : ',';

  const rows = [];
  let cur = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cell += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === sep) { cur.push(cell); cell = ''; }
      else if (ch === '\n') {
        cur.push(cell); cell = '';
        if (cur.some(c => c !== '')) rows.push(cur);
        cur = [];
      } else if (ch === '\r') {}
      else { cell += ch; }
    }
  }
  cur.push(cell);
  if (cur.some(c => c !== '')) rows.push(cur);

  return rows;
}

// ─── Déduplication ───────────────────────────────────────────────────────────

export function deduplicateRows(cleanedRows, emailCols) {
  const seen = new Set();
  const deduped = [];
  let duplicatesRemoved = 0;

  for (const row of cleanedRows) {
    const key = emailCols.map(ci => row.emailResults[ci]?.cleaned || '').filter(Boolean).join('|');
    if (key && seen.has(key)) {
      duplicatesRemoved++;
    } else {
      if (key) seen.add(key);
      deduped.push(row);
    }
  }

  return { deduped, duplicatesRemoved };
}

// ─── Détection d'encodage et décodage ───────────────────────────────────────

/**
 * Prend un ArrayBuffer (fichier CSV lu en binaire) et retourne une string UTF-8.
 * Détection dans l'ordre :
 *   1. BOM UTF-8 (EF BB BF) → UTF-8
 *   2. BOM UTF-16 LE/BE     → UTF-16
 *   3. Heuristique : si le buffer contient des séquences UTF-8 valides → UTF-8
 *   4. Sinon → Windows-1252 (encodage par défaut des exports Excel FR/EU)
 *
 * Windows-1252 est préféré à ISO-8859-1 car il couvre en plus :
 *   €, guillemets typographiques " " ' ', tirets –, —, etc.
 */
export function decodeBuffer(buffer) {
  const bytes = new Uint8Array(buffer)

  // 1. BOM UTF-8
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(buffer)
  }

  // 2. BOM UTF-16 LE
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(buffer)
  }

  // 3. BOM UTF-16 BE
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(buffer)
  }

  // 4. Heuristique UTF-8 : on tente de décoder et on vérifie l'absence d'erreurs
  //    TextDecoder en mode fatal lève une exception si le buffer n'est pas UTF-8 valide
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return text
  } catch (_) {
    // Pas du UTF-8 valide → on tombe sur Windows-1252
  }

  // 5. Windows-1252 (couvre ISO-8859-1 + caractères typographiques FR courants)
  return new TextDecoder('windows-1252').decode(buffer)
}