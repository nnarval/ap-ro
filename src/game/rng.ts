/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 *
 * Tout l'aléatoire du jeu passe par ici. En mode multi, l'état RNG fait partie
 * de l'état de partie : deux appareils qui rejouent les mêmes actions depuis la
 * même graine obtiennent exactement la même partie. C'est ce qui permet de
 * synchroniser des actions plutôt que de recopier tout l'état à chaque coup.
 */

/** Avance le RNG d'un cran. Rend la valeur tirée dans [0, 1[ et le nouvel état. */
export function tirer(etat: number): [valeur: number, suivant: number] {
  let a = (etat + 0x6d2b79f5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/** Entier dans [min, max] inclus. */
export function tirerEntier(etat: number, min: number, max: number): [number, number] {
  const [v, suivant] = tirer(etat);
  return [min + Math.floor(v * (max - min + 1)), suivant];
}

/** Élément au hasard dans un tableau non vide. */
export function tirerElement<T>(etat: number, liste: readonly T[]): [T, number] {
  const [i, suivant] = tirerEntier(etat, 0, liste.length - 1);
  return [liste[i], suivant];
}

/**
 * Générateur à état interne, pour le code hors réducteur (génération de plateau).
 * Le réducteur, lui, doit rester pur et utiliser `tirer` directement.
 */
export function creerRng(graine: number) {
  let etat = graine >>> 0;
  return {
    reel(): number {
      const [v, suivant] = tirer(etat);
      etat = suivant;
      return v;
    },
    entier(min: number, max: number): number {
      const [v, suivant] = tirerEntier(etat, min, max);
      etat = suivant;
      return v;
    },
    element<T>(liste: readonly T[]): T {
      const [v, suivant] = tirerElement(etat, liste);
      etat = suivant;
      return v;
    },
    /** Mélange de Fisher-Yates, sur une copie. */
    melanger<T>(liste: readonly T[]): T[] {
      const copie = [...liste];
      for (let i = copie.length - 1; i > 0; i--) {
        const j = this.entier(0, i);
        [copie[i], copie[j]] = [copie[j], copie[i]];
      }
      return copie;
    },
    get etat() {
      return etat;
    },
  };
}

/** Graine aléatoire pour lancer une nouvelle partie. */
export function graineAleatoire(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
