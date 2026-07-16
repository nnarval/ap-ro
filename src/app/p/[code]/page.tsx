"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bouton, Jeu } from "@/components/Jeu";
import { REGLAGES } from "@/game/config";
import { COULEURS_PIONS, NOMS_EQUIPES } from "@/game/partie";
import { codeValide } from "@/multi/protocole";
import { useSalon } from "@/multi/useSalon";

export default function Salle() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();

  const { salon, partie, moiId, connecte, erreur, envoyer } = useSalon(code);
  const [annonce, setAnnonce] = useState<string | null>(null);

  const moi = salon?.joueurs.find((j) => j.id === moiId);

  // On s'annonce dès que la connexion est là. Le serveur ignore les doublons.
  useEffect(() => {
    if (!connecte || partie) return;
    const nom = localStorage.getItem("apero-nom");
    if (!nom) {
      router.replace("/");
      return;
    }
    envoyer({ type: "rejoindre", nom });
  }, [connecte, partie, envoyer, router]);

  if (!codeValide(code)) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
        <p className="text-slate-300">Ce code de partie n&apos;est pas valide.</p>
        <Bouton onClick={() => router.push("/")} variante="discret">
          Retour à l&apos;accueil
        </Bouton>
      </main>
    );
  }

  if (partie) {
    return (
      <Jeu
        etat={partie}
        envoyer={(action) => envoyer({ type: "action", action })}
        monPionId={moi ? `p${moi.equipe}` : null}
        onRejouer={
          salon?.hoteId === moiId ? () => envoyer({ type: "rejouer" }) : undefined
        }
      />
    );
  }

  if (!salon || !connecte) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-sm text-slate-400">
        {connecte ? "Chargement du salon…" : "Connexion à la partie…"}
      </main>
    );
  }

  const jeSuisHote = salon.hoteId === moiId;
  const equipes = Array.from({ length: salon.nbEquipes }, (_, i) => ({
    index: i,
    nom: NOMS_EQUIPES[i],
    couleur: COULEURS_PIONS[i],
    membres: salon.joueurs.filter((j) => j.equipe === i),
  }));
  const equipesVides = equipes.filter((e) => e.membres.length === 0).length;

  async function partager() {
    const lien = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "Apéro Party", url: lien });
      else {
        await navigator.clipboard.writeText(lien);
        setAnnonce("Lien copié");
        setTimeout(() => setAnnonce(null), 2000);
      }
    } catch {
      // L'utilisateur a annulé le partage : rien à signaler.
    }
  }

  return (
    <main className="flex min-h-dvh flex-col gap-5 bg-slate-900 px-5 py-8">
      <div className="text-center">
        <p className="text-xs tracking-[0.2em] text-slate-500 uppercase">Code de la partie</p>
        <p className="text-5xl font-black tracking-[0.3em] text-emerald-400">{code}</p>
        <button
          onClick={partager}
          className="mt-2 rounded-full bg-slate-800 px-4 py-1.5 text-xs font-medium text-slate-200 active:bg-slate-700"
        >
          {annonce ?? "Partager le lien"}
        </button>
      </div>

      {jeSuisHote && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-slate-400">Équipes :</span>
          {Array.from(
            { length: REGLAGES.pionsMax - REGLAGES.pionsMin + 1 },
            (_, i) => i + REGLAGES.pionsMin,
          ).map((n) => (
            <button
              key={n}
              onClick={() => envoyer({ type: "reglerEquipes", nbEquipes: n })}
              className={`h-8 w-8 rounded-lg text-sm font-bold ${
                salon.nbEquipes === n
                  ? "bg-slate-100 text-slate-900"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-2">
        {equipes.map((e) => (
          <button
            key={e.index}
            onClick={() => moiId && envoyer({ type: "changerEquipe", joueurId: moiId, equipe: e.index })}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2.5 text-left active:bg-slate-800"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: e.couleur }}
            />
            <span className="w-24 shrink-0 text-sm font-semibold text-slate-200">{e.nom}</span>
            <span className="flex-1 truncate text-sm text-slate-400">
              {e.membres.length === 0 ? (
                <span className="text-slate-600 italic">personne — touche pour rejoindre</span>
              ) : (
                e.membres
                  .map((m) => (m.id === moiId ? `${m.nom} (toi)` : m.nom))
                  .join(", ")
              )}
            </span>
          </button>
        ))}
      </div>

      {erreur && <p className="text-center text-sm text-rose-400">{erreur}</p>}

      {jeSuisHote ? (
        <div className="space-y-2">
          <Bouton
            onClick={() => envoyer({ type: "demarrer" })}
            couleur="#34d399"
            disabled={equipesVides > 0}
          >
            Lancer la partie
          </Bouton>
          {equipesVides > 0 && (
            <p className="text-center text-xs text-slate-500">
              {equipesVides === 1
                ? "Une équipe est encore vide."
                : `${equipesVides} équipes sont encore vides.`}{" "}
              Réduis le nombre d&apos;équipes ou attends du monde.
            </p>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-slate-500">
          {salon.joueurs.length} joueur{salon.joueurs.length > 1 ? "s" : ""} — on attend que
          l&apos;hôte lance la partie.
        </p>
      )}
    </main>
  );
}
