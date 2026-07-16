import { routePartykitRequest, Server, type Connection } from "partyserver";
import { REGLAGES } from "../src/game/config";
import { NOMS_EQUIPES, creerPartie, reduire, type DefinitionPion } from "../src/game/partie";
import { graineAleatoire } from "../src/game/rng";
import type { EtatPartie } from "../src/game/types";
import type { JoueurSalon, MessageClient, MessageServeur, Salon } from "../src/multi/protocole";

export interface Env {
  Partie: DurableObjectNamespace<Partie>;
}

interface Sauvegarde {
  salon: Salon;
  partie: EtatPartie | null;
}

/**
 * Une partie = une salle = une instance de ce Durable Object, nommée par le
 * code. Le code de partie *est* l'adresse : pas d'annuaire à tenir, pas de
 * collision à gérer, la salle naît à la première connexion.
 *
 * Le serveur fait autorité : il détient l'état et applique lui-même le
 * réducteur, exactement le même code que celui des téléphones. Les clients
 * n'envoient que des intentions.
 */
export class Partie extends Server<Env> {
  static options = { hibernate: true };

  private salon: Salon = { code: "", hoteId: null, joueurs: [], nbEquipes: 4 };
  private partie: EtatPartie | null = null;

  async onStart() {
    // Le Durable Object hiberne entre deux coups : sans ça, une partie
    // s'évaporerait pendant que les joueurs discutent.
    const sauvegarde = await this.ctx.storage.get<Sauvegarde>("partie");
    if (sauvegarde) {
      this.salon = sauvegarde.salon;
      this.partie = sauvegarde.partie;
    }
    this.salon.code = this.name;
  }

  private async sauver() {
    await this.ctx.storage.put<Sauvegarde>("partie", {
      salon: this.salon,
      partie: this.partie,
    });
  }

  private diffuser() {
    for (const conn of this.getConnections()) {
      const message: MessageServeur = {
        type: "etat",
        salon: this.salon,
        partie: this.partie,
        toiId: conn.id,
      };
      conn.send(JSON.stringify(message));
    }
  }

  /** L'équipe la moins fournie, pour que les nouveaux se répartissent seuls. */
  private equipeLaPlusVide(): number {
    const effectifs = Array.from({ length: this.salon.nbEquipes }, (_, i) =>
      this.salon.joueurs.filter((j) => j.equipe === i).length,
    );
    return effectifs.indexOf(Math.min(...effectifs));
  }

  private estHote(conn: Connection): boolean {
    return this.salon.hoteId === conn.id;
  }

  onConnect(conn: Connection) {
    const connu = this.salon.joueurs.find((j) => j.id === conn.id);
    if (connu) connu.connecte = true;
    this.diffuser();
  }

  onClose(conn: Connection) {
    const joueur = this.salon.joueurs.find((j) => j.id === conn.id);
    if (!joueur) return;

    if (this.partie) {
      // Partie lancée : on garde le joueur, son équipe existe sur le plateau.
      // Il repassera « connecté » en revenant.
      joueur.connecte = false;
    } else {
      this.salon.joueurs = this.salon.joueurs.filter((j) => j.id !== conn.id);
      if (this.salon.hoteId === conn.id) {
        this.salon.hoteId = this.salon.joueurs[0]?.id ?? null;
      }
    }
    void this.sauver();
    this.diffuser();
  }

  async onMessage(conn: Connection, brut: string | ArrayBuffer) {
    if (typeof brut !== "string") return;

    let message: MessageClient;
    try {
      message = JSON.parse(brut) as MessageClient;
    } catch {
      return this.repondreErreur(conn, "Message illisible.");
    }

    switch (message.type) {
      case "rejoindre": {
        if (this.partie) return this.repondreErreur(conn, "La partie a déjà commencé.");
        if (this.salon.joueurs.some((j) => j.id === conn.id)) break;

        const nom = message.nom.trim().slice(0, 16) || "Sans nom";
        const joueur: JoueurSalon = {
          id: conn.id,
          nom,
          equipe: this.equipeLaPlusVide(),
          connecte: true,
        };
        this.salon.joueurs.push(joueur);
        this.salon.hoteId ??= conn.id;
        break;
      }

      case "reglerEquipes": {
        if (!this.estHote(conn)) return this.repondreErreur(conn, "Seul l'hôte règle les équipes.");
        if (this.partie) break;
        const n = Math.round(message.nbEquipes);
        if (n < REGLAGES.pionsMin || n > REGLAGES.pionsMax) break;

        this.salon.nbEquipes = n;
        // Rapatrier ceux dont l'équipe vient de disparaître.
        for (const j of this.salon.joueurs) {
          if (j.equipe >= n) j.equipe = this.equipeLaPlusVide();
        }
        break;
      }

      case "changerEquipe": {
        if (this.partie) break;
        const cible = this.salon.joueurs.find((j) => j.id === message.joueurId);
        // Chacun se déplace lui-même ; l'hôte déplace tout le monde.
        if (!cible || (cible.id !== conn.id && !this.estHote(conn))) break;
        if (message.equipe < 0 || message.equipe >= this.salon.nbEquipes) break;
        cible.equipe = message.equipe;
        break;
      }

      case "demarrer": {
        if (!this.estHote(conn)) return this.repondreErreur(conn, "Seul l'hôte lance la partie.");
        if (this.partie) break;

        const equipes = this.equipes();
        const vides = equipes.filter((e) => e.membres.length === 0);
        if (vides.length > 0) {
          return this.repondreErreur(
            conn,
            "Chaque équipe doit avoir au moins un joueur pour démarrer.",
          );
        }
        this.partie = creerPartie(graineAleatoire(), equipes, "multi");
        break;
      }

      case "action": {
        if (!this.partie) break;
        // Le réducteur ignore de lui-même une action hors phase : deux
        // téléphones qui tapent en même temps ne sont pas une erreur.
        this.partie = reduire(this.partie, message.action);
        break;
      }

      case "rejouer": {
        if (!this.estHote(conn)) return this.repondreErreur(conn, "Seul l'hôte relance.");
        this.partie = null;
        break;
      }
    }

    await this.sauver();
    this.diffuser();
  }

  /**
   * Les équipes dans l'ordre, vides comprises.
   *
   * On ne filtre surtout pas les vides : l'index de l'équipe est aussi celui de
   * son pion, et un décalage ferait piloter à un joueur l'équipe du voisin.
   * C'est le démarrage qui refuse les équipes vides.
   */
  private equipes(): DefinitionPion[] {
    return Array.from({ length: this.salon.nbEquipes }, (_, i) => ({
      nom: NOMS_EQUIPES[i],
      membres: this.salon.joueurs.filter((j) => j.equipe === i).map((j) => j.nom),
    }));
  }

  private repondreErreur(conn: Connection, message: string) {
    conn.send(JSON.stringify({ type: "erreur", message } satisfies MessageServeur));
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ?? new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
