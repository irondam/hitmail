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

export function cleanEmail(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return { cleaned: '', status: 'empty' };
  }
  let email = String(raw).trim().toLowerCase();
  // Supprime espaces internes, virgules, points-virgules parasites
  email = email.replace(/\s+/g, '').replace(/[,;]+$/, '');
  const original = email;

  if (!email) return { cleaned: '', status: 'empty' };
  if (!email.includes('@')) {
    return { cleaned: email, status: 'invalid', reason: 'pas de @' };
  }

  const parts = email.split('@');
  if (parts.length !== 2 || !parts[1]) {
    return { cleaned: email, status: 'invalid', reason: 'format @ invalide' };
  }

  let [local, domain] = parts;

  // Correction domaine connu
  if (TYPO_DOMAINS[domain]) {
    domain = TYPO_DOMAINS[domain];
    email = `${local}@${domain}`;
  }

  // Correction TLD
  for (const [bad, good] of Object.entries(TLD_TYPOS)) {
    if (domain.endsWith(bad)) {
      domain = domain.slice(0, -bad.length) + good;
      email = `${local}@${domain}`;
      break;
    }
  }

  // Validation finale basique
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { cleaned: email, status: 'invalid', reason: 'format invalide' };
  }

  return {
    cleaned: email,
    status: email === original ? 'ok' : 'fixed',
    original: email !== original ? original : undefined,
  };
}

export function detectEmailColumns(headers) {
  return headers
    .map((h, i) => ({ h: String(h).toLowerCase(), i }))
    .filter(({ h }) =>
      h.includes('email') || h.includes('mail') ||
      h.includes('courriel') || h.includes('e-mail')
    )
    .map(({ i }) => i);
}

export function detectCPColumns(headers) {
  return headers
    .map((h, i) => ({ h: String(h).toLowerCase(), i }))
    .filter(({ h }) =>
      h.includes('cp') || h.includes('code postal') ||
      h.includes('codepostal') || h.includes('postal') || h.includes('zip')
    )
    .map(({ i }) => i);
}
