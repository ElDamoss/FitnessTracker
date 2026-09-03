import { TiltCard } from '../components/TiltCard'

export default function PageUpdates() {
  return (
    <div>
      <div className="page-header"><h2 className="page-h1 display">Mises à jour</h2></div>
      {[
        {
          v: 'v8.3', date: '22 juillet 2026', title: 'Design Figma, séance repensée & muscles détaillés',
          feats: [
            'Thèmes clairs Stitch (bleu) et Girly (fuchsia) alignés sur la maquette',
            'Logo hexagonal + nouveau wordmark FITNESS TRACKER',
            'Exercices unilatéraux : saisie gauche / droite par série',
            'Minuteur de repos réductible en pastille (continue en fond)',
            'Historique : téléchargement d\u2019un rapport PDF par séance (avec évolution)',
            'Temps de repos réglable par exercice dans l\u2019éditeur de programme',
            'Groupes musculaires détaillés (Quadriceps, Ischios, Mollets, Adducteurs, Abducteurs, fessiers…)',
          ],
          fixes: [
            'Les poids et le repos en cours sont conservés quand on réduit la séance',
            'Icônes de séance conformes à la maquette (changer d\u2019exercice, séance précédente)',
          ],
          ui: [
            'Page séance : barre de progression, badges ronds, panneau S1/S2/S3, commentaire toujours visible',
            'Historique : cartes de séries repensées',
          ],
        },
        {
          v: 'v8.2', date: '22 juillet 2026', title: 'Reprise de séance, repos en arrière-plan & finitions',
          feats: [
            'Reprendre une séance réduite (barre « Séance en cours »)',
            'Le minuteur de repos continue même en arrière-plan',
          ],
          fixes: [
            'Poids précédents retrouvés même si le nom variait (casse/accents)',
            'Thèmes : suppression du vert résiduel sur les autres couleurs',
          ],
          ui: [
            'Icônes de séance en SVG cohérents avec la DA',
          ],
        },
        {
          v: 'v8.1', date: '22 juillet 2026', title: 'Accueil, édition des programmes & thèmes',
          feats: [
            'Lancer la séance du jour depuis l\u2019accueil',
            'Édition d\u2019un jour de programme via le crayon',
            'RPE optionnel par exercice',
            'Graphique d\u2019évolution des mensurations',
            'Réorganisation des exercices (monter / descendre)',
          ],
          fixes: [
            'Ajout / suppression de séries en cours de séance',
            'Historique machine : seulement la dernière séance de la même machine',
          ],
          ui: [
            'Tuiles d\u2019accueil en un seul clic',
            'Carte de séance du jour enrichie (durée estimée)',
          ],
        },
        {
          v: 'v8.0', date: '22 juillet 2026', title: 'Nouvelle DA 2.0, séances enrichies & sécurité renforcée',
          feats: [
            'Nouvelle direction artistique 2.0 (animations retirées)',
            'Charges habituelles affichées en séance',
            'Échange d\u2019exercice depuis la bibliothèque',
            'Réorganisation des exercices',
            'Séries en répétitions ou en secondes',
            'Tempo par exercice (affiché le jour J)',
            'Commentaires par exercice',
          ],
          fixes: [
            'Sécurité : session non permanente (sessionStorage)',
            'Sécurité : protection anti-brute-force (verrou après échecs)',
            'Commentaires de séance désormais visibles dans l\u2019historique',
            'Progrès : affichage des reps max (série)',
          ],
          ui: [
            'Tuiles d\u2019accueil plus compactes',
            'Barre de navigation mobile allégée (logo maison uniquement)',
          ],
        },
        {
          v: 'v7.4', date: '4 août 2026', title: 'Story Instagram, mannequin amélioré, cardio séparé',
          feats: ['Story Instagram : image 1080x1920 téléchargeable', 'Mannequin SVG amélioré homme/femme', 'Cardio séparé du workout'],
          fixes: ['Fix signalements', 'Fix historique cardio'],
          ui: ['Vue détail séance : tableau sans colonne #'],
        },
        {
          v: 'v7.3', date: '4 août 2026', title: 'Fixes & améliorations',
          feats: ['Page Cardio : affichage en cartes', 'Rapport export : mannequin musculaire SVG'],
          fixes: ['Fix toast SVG', 'Fix alignement kg/reps', 'Fix iOS'],
          ui: ['Console admin retirée'],
        },
      ].map((b, i) => (
        <TiltCard key={i} style={{ marginBottom: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span className="version-badge">{b.v}</span>
            <span className="update-date">{b.date}</span>
          </div>
          <div className="update-title">{b.title}</div>
          <ul className="update-list">
            {b.feats.map((f, j) => <li key={j} className="update-feat">{f}</li>)}
            {b.fixes.map((f, j) => <li key={j} className="update-fix">{f}</li>)}
            {b.ui.map((f, j) => <li key={j} className="update-ui">{f}</li>)}
          </ul>
        </TiltCard>
      ))}
    </div>
  )
}
