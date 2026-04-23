// Single source of truth for the plan content.
// Edit this file to update buckets, pillars, etc.

export const pillars = [
  {
    name: "musique artsy",
    desc: "Alt, texturée, thèmes qui vont loin. On assume que c'est pas pour tout le monde.",
  },
  {
    name: "vibe naturelle",
    desc: "Pas de persona, pas de mise en scène. Elle est comme elle est devant la caméra.",
  },
  {
    name: "humour pince-sans-rire",
    desc: "Dead pan, second degré, sec. Pas d'humour internet, pas de meme-core.",
  },
  {
    name: "qualité de chanson",
    desc: "L'écriture et la construction avant le gimmick. La toune tient debout toute seule.",
  },
  {
    name: "artisanat / process",
    desc: "Coulisses réelles : demos, voice memos, screenshots Notes, studio, guitare dans le lit.",
  },
] as const;

export const contrastPrinciple = `Le fil qui tient les 5 piliers ensemble, c'est le contraste entre la musique et la personne. La musique est dense, artsy, chargée. Marie-Neiges en vrai est relax, drôle, terre-à-terre. On cache pas l'un derrière l'autre — on laisse les deux exister en même temps. Une ligne lourde avec une caption sèche. Un stem-by-stem suivi d'un face-cam dans la cuisine. C'est ça qui fait que ça sonne vrai et pas posé.`;

export type Bucket = {
  id: number;
  name: string;
  description: string;
  highlight?: string;
  refs: string[];
};

export const buckets: Bucket[] = [
  {
    id: 1,
    name: "perfo lofi",
    description:
      "Perfo plutôt intime, lofi, contact direct avec la caméra. Peut inclure des éléments genre drum machine, décor, etc. pour donner de l'ambiance. Les perfos n'ont pas besoin d'être des vraies perfos — lipsync OK.",
    highlight: "très très lofi, contact direct caméra",
    refs: [
      "https://www.instagram.com/p/DU-CBXdD-Bi/",
      "https://www.instagram.com/p/DRw_QRLDgcT/",
      "https://www.instagram.com/reel/DWrei_rD2nk/",
      "https://www.instagram.com/p/DS2tBo5j0Tb/",
    ],
  },
  {
    id: 2,
    name: "lofi perfo avec contexte",
    description:
      "Perfos style acoustique mais avec plus de personnalité. Bonne opportunité pour montrer qui elle est tout en gardant le showcase sur la chanson et le texte.",
    highlight: "la chanson et le texte",
    refs: [
      "https://www.instagram.com/p/DVvD8IjPEBg/",
      "https://www.instagram.com/p/DNOB-CjuGD_/",
    ],
  },
  {
    id: 3,
    name: "b-roll content",
    description:
      "Mega easy. Tu peux juste shooter 50 shots de toi de même et tester plein de captions par-dessus. Peut être du très bon shareable content tout en ayant la track et du texte qui est quelque part dans ton univers.",
    highlight: "shareable content",
    refs: [
      "https://www.instagram.com/p/DTQHZDvEUId/",
      "https://www.instagram.com/p/DPmCjoMjQn9/",
      "https://www.instagram.com/p/DNcEg5Apf0G/",
    ],
  },
  {
    id: 4,
    name: "laptop webcam",
    description:
      "Un truc vu une couple de fois qui pourrait être très nice avec ton univers. Tu peux te servir de ce qu'il y a autour pour faire de quoi de plus drôle ou renforcer le brand. Ça oblige le monde à rester accroché plus longtemps parce qu'ils veulent regarder ce qu'il y a autour.",
    highlight: "rester accroché plus longtemps",
    refs: [
      "https://www.instagram.com/p/DUQ8WGwCjmd/",
      "https://www.instagram.com/p/DRSPx60CeWd/",
      "https://www.instagram.com/p/DO4IVBBEuGg/",
    ],
  },
  {
    id: 5,
    name: "cover with a twist",
    description:
      "On veut vraiment pas tomber dans un compte de cover, c'est vite cringe. Mais bien fait avec une twist nice, c'est quand même du bonbon côté discovery et ça peut amener du monde en dehors de ton cercle habituel.",
    highlight: "twist nice",
    refs: ["https://www.instagram.com/p/DUK9gKODae7/"],
  },
  {
    id: 6,
    name: "fake performance content",
    description:
      "Ici on veut te mettre toi, dans le contexte avec la chanson. Y'a environ 100K façons de faire ça. Le but : trouver une façon de rendre ça créatif et pas cringe, dans le contexte où tu fais ça DIY pour l'instant.",
    highlight: "créatif et pas cringe",
    refs: [],
  },
  {
    id: 7,
    name: "stills",
    description:
      "Quand même similaire au b-roll content, mais ici on veut vraiment plus des trucs qui vont se rattacher à la chanson. On peut tester juste texte, et texte + lyrics.",
    highlight: "rattacher à la chanson",
    refs: ["https://www.instagram.com/p/DSdp4IbkxLB/"],
  },
  {
    id: 8,
    name: "creative concepts",
    description:
      "Ici on veut essayer de trouver des concepts moins communs, des twists de perfo, des potentielles shareable trends qui sont vraiment autour de la chanson. Comme Dexter And the Moonrocks.",
    highlight: "twists de perfo",
    refs: [],
  },
];
