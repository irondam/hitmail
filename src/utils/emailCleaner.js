// ─── Tables de correction ────────────────────────────────────────────────────

const TYPO_DOMAINS = {
  'gnail.com':'gmail.com','gmai.com':'gmail.com','gamil.com':'gmail.com',
  'gmial.com':'gmail.com','gmail.fr':'gmail.com','gmal.com':'gmail.com',
  'homail.com':'hotmail.com','hotmai.com':'hotmail.com','hotmial.com':'hotmail.com',
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

// Caractères interdits dans une adresse email (hors local-part et domaine)
// On retire tout ce qui n'est pas alphanum, @, ., -, _, +, ~
// mais on le fait chirurgicalement APRÈS les corrections ciblées
const INVALID_CHARS_RE = /[^\w.@+\-~]/g;

// ─── Séparation multi-emails dans une cellule ────────────────────────────────

/**
 * Détecte si une cellule contient plusieurs emails et les sépare.
 * Séparateurs : espace, ; , \n \r (après nettoyage préliminaire)
 * Retourne un tableau de strings brutes (une par email potentiel).
 */
export function splitMultipleEmails(raw) {
  if (raw === null || raw === undefined || raw === '') return [''];
  let s = String(raw);

  // Si le contenu ressemble à un seul email (pas de séparateur évident), retourne tel quel
  // On sépare sur : retour à la ligne, point-virgule, et espaces/virgules ENTRE deux segments
  // contenant chacun un @
  const hasMultiple = (s.match(/@/g) || []).length > 1;
  if (!hasMultiple) return [s];

  // Sépare sur \n, \r, ;
  // Pour les virgules et espaces : on les utilise comme séparateurs seulement si
  // le résultat contient un @, pour ne pas casser les virgules dans un domaine
  const parts = s
    .split(/[\r\n;]+/)
    .flatMap(p => {
      // Si ce fragment contient plusieurs @, on tente de séparer sur espace ou virgule
      if ((p.match(/@/g) || []).length > 1) {
        return p.split(/[\s,]+/);
      }
      return [p];
    })
    .map(p => p.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [s];
}

// ─── Nettoyage d'un email ────────────────────────────────────────────────────

export function cleanEmail(raw) {
  if (raw === null || raw === undefined || raw === '') return { cleaned: '', status: 'empty' };

  let email = String(raw).trim();

  // 1. [at] / [AT] / (at) → @
  email = email.replace(/\s*\[at\]\s*/gi, '@');
  email = email.replace(/\s*\(at\)\s*/gi, '@');
  email = email.replace(/\s*\{at\}\s*/gi, '@');

  // 2. Entités HTML nommées
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    email = email.split(entity).join(char);
  }
  email = email.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  email = email.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));

  // 3. Caractères invisibles et espaces insécables
  email = email.replace(/[\u00A0\u200B\u200C\u200D\u200E\u200F\u2060\uFEFF]/g, '');

  // 4. Guillemets typographiques enveloppants
  email = email.replace(/^[«»„\u201C\u201D\u2018\u2019\u2039\u203A"'`]+/, '');
  email = email.replace(/[«»„\u201C\u201D\u2018\u2019\u2039\u203A"'`]+$/, '');

  // 5. Préfixes parasites
  for (const prefix of PARASITIC_PREFIXES) {
    if (email.toLowerCase().startsWith(prefix.toLowerCase())) { email = email.slice(prefix.length); break; }
  }

  // 6. Suppression de tous les espaces (internes compris)
  email = email.replace(/\s+/g, '');

  // 7. Minuscules
  email = email.toLowerCase();

  // 8. Virgules dans la partie locale ou domaine → point
  //    (on le fait avant le split @ pour traiter le cas foo,bar@domain,com)
  //    Attention : les virgules comme séparateur multi-emails ont déjà été gérées
  //    par splitMultipleEmails() en amont. Ici il ne reste qu'un seul email.
  email = email.replace(/,/g, '.');

  // 9. Nettoyage des caractères spéciaux non autorisés
  //    On préserve : lettres, chiffres, . @ - _ + ~ (valides en local-part/domaine)
  //    On supprime : ! ? # $ % ^ & * ( ) = [ ] { } | \ / < > ' " ` ; : , (déjà traité)
  //    On fait ça AVANT le split @ pour éviter de corrompre la structure
  email = email.replace(/[!?#$%^&*()=\[\]{}|\\/<>'"`;:]/g, '');

  // 10. Punycode → unicode
  if (email.includes('xn--')) {
    try {
      const [local, domain] = email.split('@');
      if (domain) email = local + '@' + new URL('http://' + domain).hostname;
    } catch (_) {}
  }

  // 11. Nettoyage final (ponctuation résiduelle)
  email = email.replace(/[,;]+$/, '').replace(/\.+$/, '');

  const original = email;
  if (!email) return { cleaned: '', status: 'empty' };

  // 12. Validation structure @
  if (!email.includes('@')) return { cleaned: email, status: 'invalid', reason: 'pas de @' };
  const parts = email.split('@');
  if (parts.length !== 2 || !parts[1]) return { cleaned: email, status: 'invalid', reason: 'format @ invalide' };

  let [local, domain] = parts;
  if (!local) return { cleaned: email, status: 'invalid', reason: 'local vide' };

  // 13. Correction domaine connu
  if (TYPO_DOMAINS[domain]) { domain = TYPO_DOMAINS[domain]; email = `${local}@${domain}`; }

  // 14. Correction TLD
  for (const [bad, good] of Object.entries(TLD_TYPOS)) {
    if (domain.endsWith(bad)) { domain = domain.slice(0, -bad.length) + good; email = `${local}@${domain}`; break; }
  }

  // 15. Domaines académiques (ac-xxx) : s'assurer qu'ils finissent en .fr
  //     ex: ac-poitiers → ac-poitiers.fr, ac-poitiers.edu → ac-poitiers.fr
  if (/^ac-/.test(domain) && !domain.endsWith('.fr')) {
    // Retire une éventuelle extension non-.fr et remplace par .fr
    domain = domain.replace(/\.[^.]+$/, '') + '.fr';
    // Si pas d'extension du tout, ajoute juste .fr
    if (!domain.includes('.')) domain = domain + '.fr';
    email = `${local}@${domain}`;
  }

  // 16. "fr" en fin de domaine sans point avant → ajouter le point
  //     ex: hotmailfr → hotmail.fr  /  gmailfr → gmail.fr
  if (/[a-z]fr$/.test(domain) && !domain.endsWith('.fr')) {
    domain = domain.replace(/fr$/, '.fr');
    email = `${local}@${domain}`;
  }

  // 17. Points multiples consécutifs dans le domaine → un seul
  domain = domain.replace(/\.{2,}/g, '.');
  email = `${local}@${domain}`;

  // 18. Validation finale
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

// ─── Détection d'encodage et décodage ───────────────────────────────────────

export function decodeBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return new TextDecoder('utf-8').decode(buffer);
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(buffer);
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(buffer);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch (_) {}
  return new TextDecoder('windows-1252').decode(buffer);
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