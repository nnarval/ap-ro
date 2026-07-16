"use client";

import PartySocket from "partysocket";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EtatPartie } from "../game/types";
import type { MessageClient, MessageServeur, Salon } from "./protocole";

/** En dev, `wrangler dev` sert le Worker ici. En production, l'URL du Worker
 *  déployé, à passer par NEXT_PUBLIC_PARTY_HOST. */
const HOTE = process.env.NEXT_PUBLIC_PARTY_HOST ?? "localhost:8787";

export interface Connexion {
  salon: Salon | null;
  partie: EtatPartie | null;
  /** Mon identifiant de connexion dans ce salon. */
  moiId: string | null;
  connecte: boolean;
  erreur: string | null;
  envoyer: (message: MessageClient) => void;
}

/**
 * Branche le téléphone sur la salle `code`.
 *
 * Le serveur fait autorité : on ne garde aucun état local du jeu, on affiche ce
 * qu'il diffuse. Ça évite toute divergence entre les téléphones, au prix d'un
 * aller-retour par action — imperceptible pour un jeu au tour par tour.
 */
export function useSalon(code: string): Connexion {
  const [salon, setSalon] = useState<Salon | null>(null);
  const [partie, setPartie] = useState<EtatPartie | null>(null);
  const [moiId, setMoiId] = useState<string | null>(null);
  const [connecte, setConnecte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const socket = useRef<PartySocket | null>(null);

  useEffect(() => {
    const s = new PartySocket({ host: HOTE, party: "partie", room: code });
    socket.current = s;

    const ouvert = () => {
      setConnecte(true);
      setErreur(null);
    };
    const ferme = () => setConnecte(false);
    const recu = (e: MessageEvent) => {
      const message = JSON.parse(e.data as string) as MessageServeur;
      if (message.type === "etat") {
        setSalon(message.salon);
        setPartie(message.partie);
        setMoiId(message.toiId);
      } else {
        setErreur(message.message);
      }
    };

    s.addEventListener("open", ouvert);
    s.addEventListener("close", ferme);
    s.addEventListener("message", recu);
    return () => {
      s.removeEventListener("open", ouvert);
      s.removeEventListener("close", ferme);
      s.removeEventListener("message", recu);
      s.close();
    };
  }, [code]);

  const envoyer = useCallback((message: MessageClient) => {
    socket.current?.send(JSON.stringify(message));
  }, []);

  return { salon, partie, moiId, connecte, erreur, envoyer };
}
