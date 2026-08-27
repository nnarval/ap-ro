"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bouton } from "@/components/Jeu";
import { Logo } from "@/components/Logo";
import { LONGUEUR_CODE, codeValide, genererCode } from "@/multi/protocole";

/** Le prénom est retenu d'une soirée à l'autre : personne n'a envie de le
 *  retaper à chaque partie. */
const CLE_NOM = "apero-nom";

export default function Accueil() {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setNom(localStorage.getItem(CLE_NOM) ?? "");
  }, []);

  function retenirNom(): boolean {
    const propre = nom.trim();
    if (propre.length < 1) {
      setErreur("Il me faut ton prénom.");
      return false;
    }
    localStorage.setItem(CLE_NOM, propre);
    return true;
  }

  function creer() {
    if (!retenirNom()) return;
    router.push(`/p/${genererCode()}`);
  }

  function rejoindre() {
    if (!retenirNom()) return;
    const propre = code.trim().toUpperCase();
    if (!codeValide(propre)) {
      setErreur(`Le code fait ${LONGUEUR_CODE} lettres.`);
      return;
    }
    router.push(`/p/${propre}`);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10">
      <div className="text-center">
        <Logo taille={64} />
        <p className="mt-3 text-sm font-medium text-[#5b7891]">
          Le plateau, les défis, les étoiles. Et les gorgées à la fin.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-5">
        <label className="block">
          <span className="text-xs font-bold tracking-wide text-[#5b7891] uppercase">
            Ton prénom
          </span>
          <input
            value={nom}
            onChange={(e) => {
              setNom(e.target.value);
              setErreur(null);
            }}
            maxLength={16}
            autoComplete="given-name"
            placeholder="Chloé"
            className="mt-1 w-full rounded-2xl border-2 border-[#cfe4f0] bg-white px-4 py-3 text-[#0f2a43] placeholder:text-[#a9bccb] focus:border-[#16c47f] focus:outline-none"
          />
        </label>

        <Bouton onClick={creer} couleur="#16c47f">
          Créer une partie
        </Bouton>

        <div className="flex items-center gap-3 text-xs font-semibold text-[#a9bccb]">
          <span className="h-px flex-1 bg-[#cfe4f0]" />
          ou
          <span className="h-px flex-1 bg-[#cfe4f0]" />
        </div>

        <div className="space-y-2">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setErreur(null);
            }}
            maxLength={LONGUEUR_CODE}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            placeholder="CODE"
            className="w-full rounded-2xl border-2 border-[#cfe4f0] bg-white px-4 py-3 text-center text-2xl font-black tracking-[0.4em] text-[#0f2a43] placeholder:tracking-normal placeholder:text-[#a9bccb] focus:border-[#16c47f] focus:outline-none"
          />
          <Bouton onClick={rejoindre} variante="discret">
            Rejoindre une partie
          </Bouton>
        </div>

        {erreur && <p className="text-center text-sm font-semibold text-rose-500">{erreur}</p>}
      </div>
    </main>
  );
}
