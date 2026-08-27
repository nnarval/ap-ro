"use client";

import QRCode from "qrcode";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bouton, Jeu } from "@/components/Jeu";
import { Logo } from "@/components/Logo";
import { REGLAGES } from "@/game/config";
import type { Ambiance, CategorieDefi } from "@/game/defis";
import { COULEURS_PIONS } from "@/game/partie";
import { codeValide } from "@/multi/protocole";
import { useSalon } from "@/multi/useSalon";

const AMBIANCES: { valeur: Ambiance; nom: string; desc: string }[] = [
  { valeur: "classique", nom: "Classique", desc: "Tout le catalogue, progression normale." },
  { valeur: "dejaChaud", nom: "Déjà chaud", desc: "Ça tape, mais moins de cartes hard." },
  { valeur: "sale", nom: "Sale", desc: "Plus de medium et hard, moins de gentilles." },
  { valeur: "chaos", nom: "Chaos", desc: "Max d'effets, roulettes et cartes musclées." },
  { valeur: "equipes", nom: "Équipes", desc: "Favorise défis collectifs, duels, interactions." },
];

const TYPES_CARTE: { valeur: CategorieDefi; nom: string; desc: string; exemple: string }[] = [
  {
    valeur: "collectif",
    nom: "Fin de manche",
    desc: "Tout le monde joue, une équipe gagne l'étoile.",
    exemple: "Ex : chaque équipe invente un slogan de soirée. Le meilleur gagne.",
  },
  {
    valeur: "duel",
    nom: "Duel",
    desc: "Deux équipes s'affrontent sur une case défi.",
    exemple: "Ex : bras de fer. Le perdant boit 4 gorgées.",
  },
  {
    valeur: "reflexe",
    nom: "Réflexe",
    desc: "Se déclenche quand deux équipes tombent sur la même case.",
    exemple: "Ex : le dernier à lever la main boit 3 gorgées.",
  },
  {
    valeur: "malus",
    nom: "Malus",
    desc: "Tombe sur une case rouge. Refus possible contre des pièces.",
    exemple: "Ex : bois 3 gorgées, ou paie pour refuser.",
  },
];

export default function Salle() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();

  const { salon, partie, moiId, connecte, erreur, envoyer } = useSalon(code);
  const [annonce, setAnnonce] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  // Créateur de cartes.
  const [ouvertCreateur, setOuvertCreateur] = useState(false);
  const [typeCarte, setTypeCarte] = useState<CategorieDefi>("collectif");
  const [texteCarte, setTexteCarte] = useState("");
  const [nomEquipe, setNomEquipe] = useState("");

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

  // QR code du lien de la salle.
  useEffect(() => {
    if (typeof window === "undefined") return;
    QRCode.toDataURL(window.location.href, { margin: 1, width: 320 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [code]);

  // Le champ de nom d'équipe suit le nom courant tant qu'on n'y touche pas.
  useEffect(() => {
    if (salon && moi) setNomEquipe(salon.nomsEquipes[moi.equipe] ?? "");
  }, [salon, moi]);

  if (!codeValide(code)) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
        <p className="text-[#0f2a43]">Ce code de partie n&apos;est pas valide.</p>
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
        onRejouer={salon?.hoteId === moiId ? () => envoyer({ type: "rejouer" }) : undefined}
      />
    );
  }

  if (!salon || !connecte) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-sm text-[#5b7891]">
        {connecte ? "Chargement du salon…" : "Connexion à la partie…"}
      </main>
    );
  }

  const jeSuisHote = salon.hoteId === moiId;
  const equipes = Array.from({ length: salon.nbEquipes }, (_, i) => ({
    index: i,
    nom: salon.nomsEquipes[i],
    couleur: COULEURS_PIONS[i],
    membres: salon.joueurs.filter((j) => j.equipe === i),
  }));
  const equipesVides = equipes.filter((e) => e.membres.length === 0).length;
  const mesCartes = moi ? salon.cartesPerso.filter((c) => c.equipe === moi.equipe).length : 0;

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

  function ajouterCarte() {
    const texte = texteCarte.trim();
    if (!texte) return;
    envoyer({ type: "ajouterCartePerso", categorie: typeCarte, texte });
    setTexteCarte("");
  }

  const typeChoisi = TYPES_CARTE.find((t) => t.valeur === typeCarte)!;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
      {/* En-tête : logo, code, partage, QR. */}
      <div className="rounded-3xl bg-white p-5 text-center shadow-[0_8px_24px_rgba(15,42,67,0.08)]">
        <Logo taille={40} />
        <p className="mt-3 text-xs font-bold tracking-[0.2em] text-[#5b7891] uppercase">
          Code de la partie
        </p>
        <div className="mt-1 flex justify-center gap-1.5">
          {[...code].map((c, i) => (
            <span
              key={i}
              className="flex h-12 w-11 items-center justify-center rounded-xl bg-[#facc15] text-2xl font-black text-[#0f2a43] shadow-[0_3px_0_#c99a00]"
              style={{ animation: `pop 300ms ease-out ${i * 60}ms both` }}
            >
              {c}
            </span>
          ))}
        </div>
        <button
          onClick={partager}
          className="mt-3 rounded-full bg-[#eef4f8] px-4 py-1.5 text-xs font-bold text-[#0f2a43] active:bg-[#dbe7ef]"
        >
          {annonce ?? "Partager le lien"}
        </button>

        {qr && (
          <div className="mt-4 flex flex-col items-center">
            <p className="text-xs font-bold tracking-[0.15em] text-[#5b7891] uppercase">
              Scan pour rejoindre
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code de la partie" className="mt-2 h-40 w-40 rounded-xl" />
          </div>
        )}
      </div>

      {/* Réglages hôte : objectif + ambiance. */}
      {jeSuisHote && (
        <div className="space-y-4 rounded-3xl bg-white p-4 shadow-[0_8px_24px_rgba(15,42,67,0.08)]">
          <div>
            <p className="text-xs font-extrabold tracking-[0.15em] text-[#ff3d7f] uppercase">
              Objectif
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {REGLAGES.objectifsEtoile.map((n) => (
                <button
                  key={n}
                  onClick={() => envoyer({ type: "reglerObjectif", objectif: n })}
                  className={`h-10 flex-1 rounded-xl text-sm font-black ${
                    salon.objectif === n
                      ? "bg-[#ff3d7f] text-white shadow-[0_3px_0_#c71f5c]"
                      : "bg-[#eef4f8] text-[#0f2a43]"
                  }`}
                >
                  {n} ⭐
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-extrabold tracking-[0.15em] text-[#16c47f] uppercase">
              Ambiance
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {AMBIANCES.map((a) => (
                <button
                  key={a.valeur}
                  onClick={() => envoyer({ type: "reglerAmbiance", ambiance: a.valeur })}
                  className={`rounded-xl border-2 px-3 py-2 text-left ${
                    salon.ambiance === a.valeur
                      ? "border-[#16c47f] bg-[#e7fbf1]"
                      : "border-transparent bg-[#eef4f8]"
                  }`}
                >
                  <span className="text-sm font-black text-[#0f2a43]">{a.nom}</span>
                  <span className="block text-xs text-[#5b7891]">{a.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="text-xs font-semibold text-[#5b7891]">Équipes :</span>
            {Array.from(
              { length: REGLAGES.pionsMax - REGLAGES.pionsMin + 1 },
              (_, i) => i + REGLAGES.pionsMin,
            ).map((n) => (
              <button
                key={n}
                onClick={() => envoyer({ type: "reglerEquipes", nbEquipes: n })}
                className={`h-9 w-9 rounded-lg text-sm font-black ${
                  salon.nbEquipes === n ? "bg-[#0f2a43] text-white" : "bg-[#eef4f8] text-[#0f2a43]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Les équipes. */}
      <div className="space-y-2">
        {equipes.map((e) => (
          <button
            key={e.index}
            onClick={() => moiId && envoyer({ type: "changerEquipe", joueurId: moiId, equipe: e.index })}
            className="flex w-full items-center gap-3 rounded-2xl bg-white px-3 py-2.5 text-left shadow-[0_4px_12px_rgba(15,42,67,0.06)] active:bg-[#f5f9fc]"
          >
            <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: e.couleur }} />
            <span className="w-24 shrink-0 text-sm font-black text-[#0f2a43]">
              {e.nom} <span className="text-[#a9bccb]">({e.membres.length})</span>
            </span>
            <span className="flex-1 truncate text-sm text-[#5b7891]">
              {e.membres.length === 0 ? (
                <span className="text-[#a9bccb] italic">personne — touche pour rejoindre</span>
              ) : (
                e.membres.map((m) => (m.id === moiId ? `${m.nom} (toi)` : m.nom)).join(", ")
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Renommer sa propre équipe. */}
      {moi && (
        <div className="rounded-2xl bg-white p-4 shadow-[0_4px_12px_rgba(15,42,67,0.06)]">
          <p className="text-xs font-extrabold tracking-[0.15em] text-[#ff3d7f] uppercase">
            Votre équipe
          </p>
          <input
            value={nomEquipe}
            onChange={(e) => setNomEquipe(e.target.value)}
            onBlur={() => envoyer({ type: "renommerEquipe", equipe: moi.equipe, nom: nomEquipe })}
            maxLength={16}
            className="mt-1 w-full rounded-xl border-2 border-[#cfe4f0] bg-white px-3 py-2 text-sm font-bold text-[#0f2a43] focus:border-[#ff3d7f] focus:outline-none"
          />
          <p className="mt-1 text-xs text-[#5b7891]">
            Chaque équipe modifie uniquement son propre nom.
          </p>
        </div>
      )}

      {/* Créateur de cartes personnalisées. */}
      {moi && (
        <div className="rounded-2xl bg-white p-4 shadow-[0_4px_12px_rgba(15,42,67,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-extrabold tracking-[0.15em] text-[#ff3d7f] uppercase">
                Créer vos cartes
              </p>
              <p className="text-xs text-[#5b7891]">
                {mesCartes}/{REGLAGES.cartesPersoParEquipe} à ton équipe
              </p>
            </div>
            <button
              onClick={() => setOuvertCreateur((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#facc15] text-xl font-black text-[#0f2a43] shadow-[0_3px_0_#c99a00]"
            >
              {ouvertCreateur ? "−" : "+"}
            </button>
          </div>

          {ouvertCreateur && (
            <div className="mt-3 space-y-3" style={{ animation: "carte-contenu 250ms ease-out both" }}>
              <div className="grid grid-cols-2 gap-2">
                {TYPES_CARTE.map((t) => (
                  <button
                    key={t.valeur}
                    onClick={() => setTypeCarte(t.valeur)}
                    className={`rounded-xl border-2 px-3 py-2 text-left ${
                      typeCarte === t.valeur
                        ? "border-[#16c47f] bg-[#e7fbf1]"
                        : "border-transparent bg-[#eef4f8]"
                    }`}
                  >
                    <span className="text-sm font-black text-[#0f2a43]">{t.nom}</span>
                    <span className="block text-[11px] leading-tight text-[#5b7891]">{t.desc}</span>
                  </button>
                ))}
              </div>

              <textarea
                value={texteCarte}
                onChange={(e) => setTexteCarte(e.target.value)}
                maxLength={140}
                rows={3}
                placeholder={typeChoisi.exemple}
                className="w-full resize-none rounded-xl border-2 border-[#cfe4f0] bg-white px-3 py-2 text-sm text-[#0f2a43] placeholder:text-[#a9bccb] focus:border-[#16c47f] focus:outline-none"
              />

              <Bouton
                onClick={ajouterCarte}
                variante="discret"
                disabled={texteCarte.trim().length === 0 || mesCartes >= REGLAGES.cartesPersoParEquipe}
              >
                Ajouter cette carte {typeChoisi.nom.toLowerCase()}
              </Bouton>

              {/* Les cartes déjà écrites par mon équipe. */}
              {salon.cartesPerso
                .filter((c) => moi && c.equipe === moi.equipe)
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-2 rounded-xl bg-[#f5f9fc] px-3 py-2 text-xs text-[#0f2a43]"
                  >
                    <span className="flex-1">{c.texte}</span>
                    <button
                      onClick={() => envoyer({ type: "supprimerCartePerso", id: c.id })}
                      className="shrink-0 font-black text-rose-500"
                      aria-label="Supprimer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {erreur && <p className="text-center text-sm font-semibold text-rose-500">{erreur}</p>}

      {/* Lancement. */}
      {jeSuisHote ? (
        <div className="space-y-2 pb-4">
          <Bouton
            onClick={() => envoyer({ type: "demarrer" })}
            couleur="#16c47f"
            disabled={equipesVides > 0}
          >
            Lancer la partie
          </Bouton>
          {equipesVides > 0 && (
            <p className="text-center text-xs text-[#5b7891]">
              {equipesVides === 1
                ? "Une équipe est encore vide."
                : `${equipesVides} équipes sont encore vides.`}{" "}
              Réduis le nombre d&apos;équipes ou attends du monde.
            </p>
          )}
        </div>
      ) : (
        <p className="pb-4 text-center text-sm text-[#5b7891]">
          {salon.joueurs.length} joueur{salon.joueurs.length > 1 ? "s" : ""} — on attend que
          l&apos;hôte lance la partie.
        </p>
      )}
    </main>
  );
}
