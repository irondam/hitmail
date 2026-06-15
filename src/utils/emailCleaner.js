// ─── Tables de correction ────────────────────────────────────────────────────

const TYPO_DOMAINS = {
  'gnail.com':'gmail.com','gmai.com':'gmail.com','gamil.com':'gmail.com',
  'gmial.com':'gmail.com','gmail.fr':'gmail.com','gmal.com':'gmail.com',
  'homail.com':'hotmail.com','hotmai.com':'hotmail.com','hotmial.com':'hotmail.com',
  'hotmail.fr':'hotmail.com','hotmaill.com':'hotmail.com',
  'yaho.com':'yahoo.com','yaho.fr':'yahoo.fr','yahooo.com':'yahoo.com',
  'yhoo.com':'yahoo.com','yahoo.com.fr':'yahoo.fr',
  'outlok.com':'outlook.com','outllook.com':'outlook.com',
  'wanadoo.fr':'wanadoo.fr','orang.fr':'orange.fr','orangge.fr':'orange.fr',
  'ornage.fr':'orange.fr','lapost.net':'laposte.net','lapostte.net':'laposte.net',
  'sfr.fr':'sfr.fr','freee.fr':'free.fr','fre.fr':'free.fr',
  'bouygue.fr':'bouygues.fr','bougues.fr':'bouygues.fr',
};

const TLD_TYPOS = {
  '.fe':'.fr','.ft':'.fr','.fre':'.fr','.r':'.fr',
  '.cmo':'.com','.ocm':'.com','.con':'.com','.cm':'.com',
  '.ogr':'.org','.nrt':'.net','.ne':'.net','.ney':'.net',
};

// Entités HTML courantes
const HTML_ENTITIES = {
  '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",
  '&#64;':'@','&#46;':'.','&nbsp;':' ',
  // Entités encodées d'accents (peu probables dans un email mais nettoyées quand même)
  '&eacute;':'é','&egrave;':'è','&ecirc;':'ê','&euml;':'ë',
  '&agrave;':'à','&acirc;':'â','&auml;':'ä',
  '&ocirc;':'ô','&ouml;':'ö','&ugrave;':'ù','&ucirc;':'û','&uuml;':'ü',
  '&ccedil;':'ç','&iuml;':'ï','&icirc;':'î',
};

// Préfixes parasites à supprimer
const PARASITIC_PREFIXES = [
  'mailto:', 'MAILTO:',
  'smtp:', 'SMTP:',
  'mail:', 'MAIL:',
];

// ─── Nettoyage d'un email ────────────────────────────────────────────────────

export function cleanEmail(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return { cleaned: '', status: 'empty' };
  }

  let email = String(raw);

  // 1. Retours à la ligne dans la cellule → prendre le premier segment non vide
  email = email.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean)[0] || '';

  // 2. Entités HTML (ex: &#40; ou &amp;)
  //    D'abord les entités nommées de la table
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    email = email.split(entity).join(char);
  }
  //    Puis les entités numériques restantes &#NNN; et &#xHH;
  email = email.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  email = email.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));

  // 3. Caractères invisibles et espaces insécables
  //    \u00A0 = espace insécable, \u200B = zero-width space, \uFEFF = BOM,
  //    \u200C/D/E = zero-width non-joiner/joiner, \u2060 = word joiner
  email = email.replace(/[\u00A0\u200B\u200C\u200D\u200E\u200F\u2060\uFEFF]/g, '');
  //    Espaces classiques internes
  email = email.replace(/\s+/g, '');

  // 4. Guillemets et apostrophes typographiques enveloppant l'email
  //    «»„""''‹›
  email = email.replace(/^[«»„\u201C\u201D\u2018\u2019\u2039\u203A"'`]+/, '');
  email = email.replace(/[«»„\u201C\u201D\u2018\u2019\u2039\u203A"'`]+$/, '');

  // 5. Préfixes parasites (mailto:, SMTP:, etc.)
  for (const prefix of PARASITIC_PREFIXES) {
    if (email.toLowerCase().startsWith(prefix.toLowerCase())) {
      email = email.slice(prefix.length);
      break;
    }
  }

  // 6. Punycode : xn-- dans le domaine → décoder en unicode lisible
  //    (ex: xn--tlphone-bua.fr → téléphone.fr)
  //    On utilise l'API URL du navigateur qui gère ça nativement
  if (email.includes('xn--')) {
    try {
      const [local, domain] = email.split('@');
      if (domain) {
        // URL() décode le punycode dans les hostnames
        const decoded = new URL('http://' + domain).hostname;
        email = local + '@' + decoded;
      }
    } catch (_) { /* on garde tel quel si le décodage échoue */ }
  }

  // 7. Mise en minuscules
  email = email.toLowerCase();

  // 8. Virgules/points-virgules résiduels en fin de chaîne
  email = email.replace(/[,;]+$/, '');

  const original = email;
  if (!email) return { cleaned: '', status: 'empty' };

  // 9. Validation structure @
  if (!email.includes('@')) return { cleaned: email, status: 'invalid', reason: 'pas de @' };
  const parts = email.split('@');
  if (parts.length !== 2 || !parts[1]) return { cleaned: email, status: 'invalid', reason: 'format @ invalide' };

  let [local, domain] = parts;

  // 10. Correction domaine connu
  if (TYPO_DOMAINS[domain]) { domain = TYPO_DOMAINS[domain]; email = `${local}@${domain}`; }

  // 11. Correction TLD
  for (const [bad, good] of Object.entries(TLD_TYPOS)) {
    if (domain.endsWith(bad)) { domain = domain.slice(0, -bad.length) + good; email = `${local}@${domain}`; break; }
  }

  // 12. Validation finale
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

// ─── Déduplication ───────────────────────────────────────────────────────────

/**
 * Prend le tableau de rows nettoyées (après cleanEmail) et supprime les doublons
 * sur les colonnes email. Garde la première occurrence, marque les suivantes.
 * Retourne { deduped: rows[], duplicatesRemoved: number }
 */
export function deduplicateRows(cleanedRows, emailCols) {
  const seen = new Set();
  const deduped = [];
  let duplicatesRemoved = 0;

  for (const row of cleanedRows) {
    // Clé = concaténation des emails nettoyés des colonnes surveillées
    const key = emailCols
      .map(ci => row.emailResults[ci]?.cleaned || '')
      .filter(Boolean)
      .join('|');

    if (key && seen.has(key)) {
      duplicatesRemoved++;
      // On ne pousse pas la ligne → suppression silencieuse
    } else {
      if (key) seen.add(key);
      deduped.push(row);
    }
  }

  return { deduped, duplicatesRemoved };
}