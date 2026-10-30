/**
 * Sources externes injoignables, distinguées des vraies pannes.
 *
 * Une synchronisation échoue pour deux raisons très différentes, et les
 * confondre coûtait cher : soit notre code a un défaut — requête mal formée,
 * écriture refusée par la base — soit la source ne nous répond pas. Le second
 * cas n'a rien d'anormal ni de réparable depuis ici : la NBA filtre par région
 * au bord de son CDN, ESPN a son propre pare-feu, et un serveur tombe. Le
 * traiter comme une panne noyait la console de traces d'exception et faisait
 * répondre 502 à des routes qui fonctionnaient parfaitement.
 *
 * Une source injoignable donne donc une erreur typée, que les routes
 * reconnaissent pour répondre « rien à faire » plutôt que « je suis cassé ».
 * Elles le disent quand même dans leur réponse, pour que le récapitulatif du
 * cron ne présente pas un silence comme un succès.
 */

export class UpstreamUnavailableError extends Error {
  /** Nom lisible de la source, pour le journal : « CDN NBA », « ESPN ». */
  readonly source: string;
  /** Statut HTTP, absent sur un délai dépassé ou une coupure réseau. */
  readonly status?: number;

  constructor(source: string, message: string, status?: number) {
    super(message);
    this.name = "UpstreamUnavailableError";
    this.source = source;
    this.status = status;
  }
}

export function isUpstreamUnavailable(err: unknown): err is UpstreamUnavailableError {
  return err instanceof UpstreamUnavailableError;
}

/**
 * Refus au bord d'un CDN, reconnaissable à son corps de réponse.
 *
 * Akamai — que la NBA emploie — répond un 403 avec une page « Access Denied »
 * et un lien vers `errors.edgesuite.net`. Ce refus vaut pour l'adresse IP
 * appelante et ne bougera pas dans les secondes qui suivent : le distinguer d'un
 * 403 de débit évite trois tentatives et huit secondes d'attente pour rien.
 */
export function isEdgeDenial(body: string): boolean {
  return /errors\.edgesuite\.net|Access Denied/i.test(body);
}
