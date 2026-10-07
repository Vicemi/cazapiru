// The CazaPira story: how the two worlds merged, the Ecos (portals to the pirate sea) and the chapter flow.
//
// Canon: when Gladius' catapult hid Syrëlia (the blue moon) behind Serélia, the Vis stopped falling on Terragrifus and spilled
// over the Sea of Numbers instead. The sea folded over the land: five "Ecos" of it (the cell, the cave, the pier, the hold and
// the board island) now hang open in Terragrifus, and the pirate Olivera, who commands the Vis-hungry crews of the sea, wants
// the Blue Vis that the Order hid under the Academy fountain. Gladius, exiled, lived on that sea and raised Pi; Aki grew up in
// Terragrifus. The two of them, and Flo, must close the Ecos, free Gladius and put the moons right.
import { save, commit, type Save } from '../save';
import { AKI } from './prologue';

export interface PortalDef {
  id: string;
  level: 1 | 2 | 3 | 4 | 5;
  map: string;
  wp: string;
  dx: number;
  dy: number;
  name: string;
  /** requirement to open (besides the previous Eco being closed) */
  tier: number;
  /** lazy: the text depends on who is playing */
  intro: () => string[];
  outro: () => string[];
  reward: number;
}


export const PORTALS: PortalDef[] = [
  {
    id: 'eco1', level: 1, map: 'logiverum', wp: 'SPAWN_POINT_ACADEMY', dx: 70, dy: 70, name: 'Eco del Calabozo', tier: 2050, reward: 12,
    intro: () => [
      `[Consola: Quimerius] ${AKI}, Pi: la consola marca una distorsión de Vis en la entrada del pueblo. Es un Eco, un pedazo del Mar de los Números caído sobre Terragrifus.`,
      '[Flo] ¡Squawk! ¡Es una copia del calabozo de Olivera, del que escapamos! Mientras haya candados cerrados el mar seguirá plegado.',
      '[Pi] Yo conozco ese calabozo: hay que llevar cada llave a su candado. Flo, ¡a volar!',
      `[${AKI}] La Academia pone la cabeza y los piratas, la experiencia. ¡Contá conmigo, Flo!`,
    ],
    outro: () => [
      '[Flo] ¡Squawk! ¡Abrimos todos los candados!',
      `[Pi] Un Eco menos. Cada uno que cerramos devuelve un pedazo del mar a su lugar... y nos acerca a Gladius.`,
      `[${AKI}] Entonces vamos por el siguiente. Antes de que Olivera encuentre el Vis.`,
    ],
  },
  {
    id: 'eco2', level: 2, map: 'woods', wp: 'SPAWN_POINT_LOGIVERUM', dx: 0, dy: 160, name: 'Eco de la Cueva', tier: 2070, reward: 14,
    intro: () => [
      '[Pi] Esa grieta huele a la cueva de Olivera. Los números en las rocas marcan el único camino a la superficie.',
      '[Flo] Squawk. Saltá de roca en roca siguiendo el orden de los números. Y para los saltos largos... ¡esperame, que te ayudo!',
    ],
    outro: () => [
      '[Pi] ¡Lo logramos! Cada Eco que cerramos devuelve un pedazo del mar a su lugar.',
      '[Consola: Quimerius] El Vis se agita ahora en las montañas. Hay más Ecos allí arriba, pero todavía están sellados.',
    ],
  },
  {
    id: 'eco3', level: 3, map: 'woods', wp: 'ARMANDIUS_OUTSIDE_TOWER', dx: -90, dy: 40, name: 'Eco del Muelle', tier: 2110, reward: 16,
    intro: () => [
      '[Armandius] ¡Un barco en medio del bosque! Los pilotes de ese muelle son demasiado altos... Hay que apilar cajones como escalera.',
      '[Máximus] ¿Piratas? ¡Ja! Yo me ocupo de que no suban: ¡tomen mis barriles!',
      '[Flo] ¡Squawk! Los números del piso dicen cuántos cajones llevar. Y cuidado con los barriles que ruedan.',
    ],
    outro: () => [
      '[Armandius] Esos cajones... tienen el sello de la Orden. Quimerius sabía que el mar iba a caer sobre nosotros.',
    ],
  },
  {
    id: 'eco4', level: 4, map: 'mountains', wp: 'FARSANTIUS_SPAWN_POINT', dx: -140, dy: 30, name: 'Eco de la Bodega', tier: 2090, reward: 18,
    intro: () => [
      '[Farsantius] ¡Un barco sin buque! Cuidado, forastero: allí abajo dicen que hay tesoros... y oscuridad.',
      '[Jocosius] No se me asusten: yo limpio esta bodega desde antes del eclipse. Solo no me toquen la escoba.',
      '[Flo] Squawk. En la bodega necesitamos materiales para una balsa. Yo te digo qué objetos hay que traer. ¡Y no tengas miedo de la oscuridad!',
    ],
    outro: () => [
      '[Pi] ¡Con esto construimos la balsa! Y mirá: entre las cajas había una página del diario de Gladius: "La Fuente guarda lo que las lunas esconden".',
    ],
  },
  {
    id: 'eco5', level: 5, map: 'mountains', wp: 'AURELIA_SPAWN_POINT', dx: 90, dy: 60, name: 'Eco del Tablero', tier: 2090, reward: 20,
    intro: () => [
      '[Aurelia] Ese tablero es una trampa de Olivera. Cada casilla suma o resta: lee bien los dados antes de dar un paso.',
      '[Pi] Dos dados, una suma exacta. ¡Y las bombas y la calavera no esperan!',
    ],
    outro: () => [
      '[Aurelia] Cinco Ecos cerrados. El Vis ya no se escapa al mar. Solo queda lo que hay bajo la Fuente de la Academia.',
    ],
  },
];

export const RIFT_INTRO = (): string[] => [
  '[Consola: Quimerius] Atención. Desde anoche aparecen criaturas extrañas en el pueblo: dados que ruedan, calaveras sobre cofres y piratas dormidos que roncan en las esquinas.',
  '[Consola: Quimerius] No son de Terragrifus. Si te cruzas con alguno, te desafiará a un duelo de cálculo. Resuélvelo y lo derrotarás.',
];

/** Boss 1 (Cazaproblemas side): Quimerius, leader of the Order, bars the way down the Fountain. */
export const FINALE_SABIO_INTRO = (): string[] => [
  '[Quimerius] Deténganse. Si bajan por la Fuente, no regresarán a la Academia jamás.',
  `[${AKI}] ¡MI PADRE ESTÁ ACÁ Y NUNCA ME LO DIJISTE! Todos sabrán que no se equivocó y que vos lo ocultaste.`,
  '[Quimerius] La catapulta no falló. La Orden escondió la luna azul para que el Vis no cayera en manos piratas, y Gladius aceptó el exilio y la deshonra para custodiar el último Vis bajo la Fuente. Yo callé para protegerlos.',
  '[Pi] ¿Gladius está acá abajo? Entonces ni vos ni nadie nos va a frenar. Ese hombre me crió.',
  '[Quimerius] Solo los verdaderos Cazaproblemas pueden bajar. Si me superan en el Duelo del Sabio, la Academia les abrirá la Fuente.',
];
export const FINALE_SABIO_LOSE = (): string[] => ['[Quimerius] Todavía no. Un Cazaproblemas no se rinde al primer error: inténtenlo otra vez.'];
export const FINALE_SABIO_WIN = (): string[] => [
  '[Quimerius] Eso... eso es calcular de verdad. Gladius estaría orgulloso de ustedes. Bajen, la Fuente está abierta.',
  '[Quimerius] Pero cuídense: el Vis llama a los piratas, y creo que alguien nos siguió hasta aquí.',
];
/** Boss 2 (Piracálculos side): Olivera, who followed the Vis through the folded sea. */
export const FINALE_INTRO = (): string[] => [
  '[Olivera] ¡Ja! Los mocosos y el loro. Mi mapa estaba escrito en clave de números y ninguno de mis piratas sabía leerlo... ¡pero ustedes resolvieron cada problema por mí! Ahora el Vis será MI tesoro.',
  `[Gladius] ¡${AKI}! ¡Pi! Cuando se aprende a calcular de verdad, ningún pirata puede con los números. ¡Usen el combo!`,
];

export const FINALE_OUTRO = (cleared: number): string[] => [
  '[Olivera] ¡Imposible! ¡Mis números! ¡Mi tesoro...!',
  '[Gladius] Gracias, hijos. Esconder la luna azul fue el plan de la Orden; el eclipse abrió el mar y ya es hora de corregirlo.',
  cleared >= 5
    ? '[Quimerius] Con los cinco Ecos cerrados, el cálculo cierra: Syrëlia vuelve a su lugar y el Vis vuelve a caer, ahora para todos.'
    : `[Quimerius] Cerraron ${cleared} de los 5 Ecos. El Vis se acomoda a medias: el mar y la tierra seguirán mezclados hasta que cierren los que faltan.`,
  `[${AKI}] Padre... ¿volvemos a casa?`,
  '[Pi] Casa... Nunca pensé que tendría dos: el mar y la Academia.',
  '[Flo] ¡Squawk! ¡Y yo no pienso despegarme del capitán!',
];

export function portalOpen(s: Save, p: PortalDef): boolean {
  const prevDone = p.level === 1 || s.pira.stars[p.level - 2] > 0;
  return s.tier >= p.tier && prevDone;
}
export const portalDone = (s: Save, p: PortalDef): boolean => s.pira.stars[p.level - 1] > 0;
export const closedEcos = (s: Save): number => s.pira.stars.slice(0, 5).filter((v) => v > 0).length;

export function markLevel(level: number, stars: number, score: number, crystals: number): void {
  const s = save();
  s.pira.stars[level - 1] = Math.max(s.pira.stars[level - 1], stars);
  s.pira.unlocked = Math.max(s.pira.unlocked, level + 1);
  s.score += score;
  s.crystals += crystals;
  commit();
}
