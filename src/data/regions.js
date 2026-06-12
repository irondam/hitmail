export const DEPT_TO_REGION = {
  "01":"Auvergne-Rhône-Alpes","03":"Auvergne-Rhône-Alpes","07":"Auvergne-Rhône-Alpes",
  "15":"Auvergne-Rhône-Alpes","26":"Auvergne-Rhône-Alpes","38":"Auvergne-Rhône-Alpes",
  "42":"Auvergne-Rhône-Alpes","43":"Auvergne-Rhône-Alpes","63":"Auvergne-Rhône-Alpes",
  "69":"Auvergne-Rhône-Alpes","73":"Auvergne-Rhône-Alpes","74":"Auvergne-Rhône-Alpes",

  "21":"Bourgogne-Franche-Comté","25":"Bourgogne-Franche-Comté","39":"Bourgogne-Franche-Comté",
  "58":"Bourgogne-Franche-Comté","70":"Bourgogne-Franche-Comté","71":"Bourgogne-Franche-Comté",
  "89":"Bourgogne-Franche-Comté","90":"Bourgogne-Franche-Comté",

  "22":"Bretagne - Pays de la Loire","29":"Bretagne - Pays de la Loire","35":"Bretagne - Pays de la Loire","56":"Bretagne - Pays de la Loire",

  "18":"Centre-Val de Loire","28":"Centre-Val de Loire","36":"Centre-Val de Loire",
  "37":"Centre-Val de Loire","41":"Centre-Val de Loire","45":"Centre-Val de Loire",

  "2A":"Corse","2B":"Corse",

  "08":"Grand Est","10":"Grand Est","51":"Grand Est","52":"Grand Est",
  "54":"Grand Est","55":"Grand Est","57":"Grand Est","67":"Grand Est",
  "68":"Grand Est","88":"Grand Est",

  "02":"Hauts-de-France","59":"Hauts-de-France","60":"Hauts-de-France",
  "62":"Hauts-de-France","80":"Hauts-de-France",

  "75":"Île-de-France","77":"Île-de-France","78":"Île-de-France","91":"Île-de-France",
  "92":"Île-de-France","93":"Île-de-France","94":"Île-de-France","95":"Île-de-France",

  "14":"Normandie","27":"Normandie","50":"Normandie","61":"Normandie","76":"Normandie",

  "16":"Nouvelle-Aquitaine","17":"Nouvelle-Aquitaine","19":"Nouvelle-Aquitaine",
  "23":"Nouvelle-Aquitaine","24":"Nouvelle-Aquitaine","33":"Nouvelle-Aquitaine",
  "40":"Nouvelle-Aquitaine","47":"Nouvelle-Aquitaine","64":"Nouvelle-Aquitaine",
  "79":"Nouvelle-Aquitaine","86":"Nouvelle-Aquitaine","87":"Nouvelle-Aquitaine",

  "09":"Occitanie","11":"Occitanie","12":"Occitanie","30":"Occitanie","31":"Occitanie",
  "32":"Occitanie","34":"Occitanie","46":"Occitanie","48":"Occitanie","65":"Occitanie",
  "66":"Occitanie","81":"Occitanie","82":"Occitanie",

  "44":"Bretagne - Pays de la Loire","49":"Bretagne - Pays de la Loire","53":"Bretagne - Pays de la Loire",
  "72":"Bretagne - Pays de la Loire","85":"Bretagne - Pays de la Loire",

  "04":"Provence-Alpes-Côte d'Azur","05":"Provence-Alpes-Côte d'Azur","06":"Provence-Alpes-Côte d'Azur",
  "13":"Provence-Alpes-Côte d'Azur","83":"Provence-Alpes-Côte d'Azur","84":"Provence-Alpes-Côte d'Azur",

  "971":"DOM-TOM","972":"DOM-TOM","973":"DOM-TOM","974":"DOM-TOM","976":"DOM-TOM",
};

// Extrait le code département depuis un code postal FR
export function cpToDept(cp) {
  if (!cp && cp !== 0) return null;
  const s = String(cp).trim().replace(/\s/g, "").padStart(5, "0");
  if (!/^\d{5}$/.test(s)) return null;
  // DOM : 971xx→971, 972xx→972, etc.
  const domPrefix = s.slice(0, 3);
  if (["971","972","973","974","976"].includes(domPrefix)) return domPrefix;
  // Corse : 20xxx (2A/2B sont les codes INSEE, les CP commencent par 20)
  if (s.startsWith("20")) return s < "20200" ? "2A" : "2B";
  return s.slice(0, 2);
}

export function getContactFromCP(cp) {
  const dept = cpToDept(cp);
  if (!dept) return { dept: null, region: null };
  const region = DEPT_TO_REGION[dept] || null;
  return { dept, region };
}
