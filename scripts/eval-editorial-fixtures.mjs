// Editorial benchmark fixture catalogue + strategy bundle.
// 12 fixtures organised in four canonical types of three each per Annex C of the cabinet brief.
// Imported by scripts/eval-editorial-quality.mjs.

export const strategyBundle = {
  profile: {
    name: "Philippe",
    positioning: "Consultant IA generative pour PME",
    bio: "J aide les PME a deployer l IA sans theatre ni promesse vide.",
    expertiseSummary: "Adoption IA, cadrage, ROI, gouvernance et execution terrain."
  },
  offers: [
    {
      name: "Audit IA PME",
      promise: "Prioriser les cas d usage utiles et deployables sans theatre.",
      problems: "Trop d idees, pas de priorisation, pas de sponsor, pas de garde-fous.",
      proofPoints: "",
      ctaModes: ""
    }
  ],
  icps: [
    {
      segment: "Dirigeants de PME",
      pains: "Trop d idees IA, pas de priorisation, peu de ROI lisible et une equipe deja sous tension.",
      objections: "Peur du cout, du flou, de la complexite et du temps de supervision.",
      desiredOutcomes: "Des cas d usage deployables, utiles et defendables devant l equipe et la direction.",
      languageCues: "Deployable, concret, ROI, equipe, process, pilotage.",
      linkedinBehavior: "S arrete sur les arbitrages concrets, les erreurs a eviter et les retours terrain."
    }
  ],
  pillars: [
    {
      label: "Adoption IA",
      description: "Comment deployer l IA avec roles, process et responsabilites claires.",
      position: 0,
      isDefault: true
    },
    {
      label: "ROI IA",
      description: "Comment arbitrer entre promesse, cout, risque et impact operationnel.",
      position: 1,
      isDefault: false
    },
    {
      label: "Cadrage",
      description: "Comment prioriser les cas d usage et eviter le theatre technologique.",
      position: 2,
      isDefault: false
    }
  ],
  voiceRules: [
    {
      category: "Anti-style",
      ruleText:
        "Interdire les formulations creuses, les slogans IA, les phrases hors-sol et les effets de manche qui pourraient s appliquer a n importe quel consultant.",
      ruleType: "anti_style"
    }
  ]
};

// Fixture identifiers follow the convention <TypeLetter><Index> (A1, A2, A3, B1, ..., D3).
// Each fixture targets exactly one skill per the spec FR-011 / FR-012 mapping.
// Type A and Type C → linkedin-post-writer.
// Type B → linkedin-news-to-post.
// Type D → linkedin-post-editor.

export const fixtures = [
  // Type A — manual leadership ideas (post-writer)
  {
    id: "A1",
    type: "A",
    label: "Prompts vs process",
    skill: "linkedin-post-writer",
    payload: {
      title: "On parle beaucoup de prompts. Pas assez de process.",
      angle:
        "En PME, le blocage vient souvent du workflow, des validations et des droits, pas du prompt lui-meme.",
      pillarLabel: "Cadrage",
      persona: "Dirigeants de PME"
    }
  },
  {
    id: "A2",
    type: "A",
    label: "20 cas d'usage vs 3 bons",
    skill: "linkedin-post-writer",
    payload: {
      title: "Une PME n a pas besoin de 20 cas d usage IA. Elle a besoin des 3 bons.",
      angle:
        "Multiplier les idees donne une impression de mouvement, mais sans priorisation on ajoute surtout du bruit, des attentes et du travail de coordination.",
      pillarLabel: "ROI IA",
      persona: "Dirigeants de PME"
    }
  },
  {
    id: "A3",
    type: "A",
    label: "Automatisation vs agent autonome",
    skill: "linkedin-post-writer",
    payload: {
      title: "Automatisation VS Agent IA autonome",
      angle:
        "Automatisation = fiable, predicible, faible cout. Agents = plus souples, mais plus couteux a cadrer, superviser et fiabiliser.",
      pillarLabel: "ROI IA",
      persona: "Dirigeants de PME"
    }
  },

  // Type B — external news / article (news-to-post)
  {
    id: "B1",
    type: "B",
    label: "Annonce GPT entreprise",
    skill: "linkedin-news-to-post",
    payload: {
      title: "OpenAI annonce une nouvelle option entreprise",
      sourceText:
        "OpenAI a annonce une nouvelle option de deploiement entreprise avec gouvernance des donnees, controles d acces et journalisation. La promesse: faciliter l adoption pour les organisations regulees, sans changer le modele sous-jacent. Les premiers clients evoquent une mise en place de plusieurs semaines, principalement pour cadrer les usages internes et former les equipes.",
      pillarLabel: "Adoption IA"
    }
  },
  {
    id: "B2",
    type: "B",
    label: "Etude penurie talents",
    skill: "linkedin-news-to-post",
    payload: {
      title: "Une etude pointe la penurie de competences IA",
      sourceText:
        "Une etude publiee cette semaine indique que pres de 60 pourcent des PME francaises declarent ne pas disposer en interne des competences pour evaluer un projet IA. Resultat: les premiers projets sont sous-traites sans cadrage prealable, ce qui produit des deceptions dans la moitie des cas selon le meme echantillon.",
      pillarLabel: "Cadrage"
    }
  },
  {
    id: "B3",
    type: "B",
    label: "Reglement IA Acte europeen",
    skill: "linkedin-news-to-post",
    payload: {
      title: "AI Act: phase d application progressive",
      sourceText:
        "L AI Act europeen entre en application progressive. Les usages a haut risque doivent demontrer un cadre de gouvernance, une tracabilite et un controle humain. Pour une PME, l enjeu n est pas de tout reclasser mais d identifier rapidement les usages qui basculent dans cette categorie.",
      pillarLabel: "Adoption IA"
    }
  },

  // Type C — anonymized client case (post-writer)
  {
    id: "C1",
    type: "C",
    label: "Industriel Grand-Est: pilote sans sponsor",
    skill: "linkedin-post-writer",
    payload: {
      title: "Quand un pilote IA n a pas de sponsor",
      angle:
        "Cas vecu chez un industriel: trois pilotes IA sans dirigeant proprietaire ont produit des prototypes orphelins. Apres recadrage et nomination d un sponsor unique, deux des trois ont ete relances avec un objectif chiffre.",
      pillarLabel: "Cadrage",
      persona: "Dirigeants de PME",
      clientContext: "Industriel 80 personnes, Grand-Est",
      problem: "Trois pilotes IA sans sponsor, peu d adoption",
      intervention: "Audit + nomination d un sponsor unique + relance ciblee",
      outcome: "Deux pilotes reactives avec objectif chiffre, le troisieme arrete sans regret"
    }
  },
  {
    id: "C2",
    type: "C",
    label: "Cabinet d'avocats: confidentialite et IA",
    skill: "linkedin-post-writer",
    payload: {
      title: "Confidentialite et IA dans un cabinet d avocats",
      angle:
        "Le client voulait deployer un assistant IA generative sur ses dossiers internes. L analyse de sensibilite a impose un environnement isole et un workflow d anonymisation prealable, ce qui a allonge le delai de mise en production de plusieurs semaines.",
      pillarLabel: "Adoption IA",
      persona: "Dirigeants de PME",
      clientContext: "Cabinet d avocats, 25 collaborateurs",
      problem: "Risque de fuite de donnees clients sur dossiers en cours",
      intervention: "Choix d un environnement isole + pipeline d anonymisation prealable",
      outcome: "Mise en production retardee mais conforme; usage interne valide"
    }
  },
  {
    id: "C3",
    type: "C",
    label: "Distributeur regional: ROI mesure",
    skill: "linkedin-post-writer",
    payload: {
      title: "Mesurer le ROI reel d un assistant IA en service client",
      angle:
        "Le distributeur voulait quantifier l effet d un assistant IA sur son service client. La mesure a porte sur le temps de premiere reponse, le taux de bonne resolution et le cout par ticket. Le gain net s est revele plus modeste que les chiffres marketing publies dans la presse.",
      pillarLabel: "ROI IA",
      persona: "Dirigeants de PME",
      clientContext: "Distributeur regional, 120 personnes",
      problem: "Promesse marketing ambigue sur l impact d un assistant IA",
      intervention: "Mesure controlee sur 6 semaines avec 3 indicateurs operationnels",
      outcome: "Gain net plus modeste que les chiffres marketing, mais reel et reproductible"
    }
  },

  // Type D — existing draft to correct (post-editor)
  {
    id: "D1",
    type: "D",
    label: "Draft generique cadrage",
    skill: "linkedin-post-editor",
    payload: {
      qualityIssue:
        "Ouverture molle, formulations creuses, pas d element concret, repete le titre dans la premiere phrase",
      draftMarkdown: `Le vrai probleme avec l IA en PME, c'est qu'on en parle tout le temps sans agir.

Dans beaucoup de PME, les dirigeants se demandent par ou commencer. En realite, le sujet n est pas l outil, c est la methode. Sur le terrain, on voit toujours les memes blocages.

Il faut prendre du recul, structurer sa demarche, et avancer pas a pas. La cle, c est la methode.

Et vous, quelle methode utilisez-vous ?`
    }
  },
  {
    id: "D2",
    type: "D",
    label: "Draft trop long avec meta",
    skill: "linkedin-post-editor",
    payload: {
      qualityIssue:
        "Trop long, contient des phrases meta sur la structure du post, n a pas de chute claire",
      draftMarkdown: `Structure retenue: contraste fort entre automatisation et agent IA.

Une automatisation classique fait toujours la meme tache. Elle est fiable. Predicible. Peu chere. Et surtout, elle ne demande pas de cadrage continu. C est l outil le plus rentable pour les taches repetitives a faible variabilite.

Un agent IA autonome, c est autre chose. Il decide. Il enchaine. Il s adapte. Mais il faut le superviser, le tester, le cadrer, le re-tester. Le cout cache de la souplesse, c est le cout du cadrage permanent.

Ce post part d un constat terrain: trop de PME sautent l etape automatisation pour aller directement vers l agent autonome. Resultat: elles paient plus cher pour moins de previsible.

Variante orientee angle complementaire: si votre besoin est repetitif et stable, automatisez. Si votre besoin est variable et tolere la supervision, alors envisagez un agent.`
    }
  },
  {
    id: "D3",
    type: "D",
    label: "Draft court mais pertinent",
    skill: "linkedin-post-editor",
    payload: {
      qualityIssue: "Court mais valide, simple polish demande",
      draftMarkdown: `Une PME m a demande hier comment evaluer un editeur IA.

Ma reponse en trois lignes:
1. Demandez un audit de leurs process de fiabilisation, pas une demo.
2. Verifiez le cadrage qu ils proposent en kickoff.
3. Refusez tout engagement sans plan de supervision documente.

Le reste est marketing.`
    }
  }
];

const ID_PATTERN = /^[A-D][1-9][0-9]?$/;
const REQUIRED_FIELDS_BY_TYPE = {
  A: ["title", "angle", "pillarLabel", "persona"],
  B: ["title", "sourceText", "pillarLabel"],
  C: ["clientContext", "problem", "intervention", "outcome", "pillarLabel"],
  D: ["draftMarkdown", "qualityIssue"]
};

export function validateFixtures() {
  if (fixtures.length !== 12) {
    throw new Error(`Fixture catalogue must have exactly 12 entries, got ${fixtures.length}`);
  }
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  for (const fixture of fixtures) {
    if (!ID_PATTERN.test(fixture.id)) {
      throw new Error(`Fixture id "${fixture.id}" does not match pattern ${ID_PATTERN}`);
    }
    if (!fixture.id.startsWith(fixture.type)) {
      throw new Error(
        `Fixture id "${fixture.id}" does not start with declared type "${fixture.type}"`
      );
    }
    counts[fixture.type] += 1;
    const required = REQUIRED_FIELDS_BY_TYPE[fixture.type];
    for (const field of required) {
      if (
        fixture.payload?.[field] === undefined ||
        fixture.payload?.[field] === null ||
        fixture.payload?.[field] === ""
      ) {
        throw new Error(`Fixture ${fixture.id} (type ${fixture.type}) is missing field "${field}"`);
      }
    }
  }
  for (const type of ["A", "B", "C", "D"]) {
    if (counts[type] !== 3) {
      throw new Error(`Fixture catalogue must have exactly 3 fixtures per type, got ${counts[type]} for type ${type}`);
    }
  }
}
