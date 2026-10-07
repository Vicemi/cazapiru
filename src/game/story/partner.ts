// The hero you did not pick goes "por su lado" to become a Cazaproblemas too (like the rival / friend of Pokémon games):
// they show up at key points of the original Cazaproblemas story to tell how their search for Gladius is going, and they
// wait next to every open Eco so both heroes enter it together. Lines are written for both pairings (Aki+Pi, Pi+Aki).
import type { Save } from '../save';
import { AKI } from './prologue';

export type HeroId = 'aki' | 'pi';
export const nameOf = (h: HeroId): string => (h === 'aki' ? AKI : 'Pi');

export interface Encounter {
  id: string;
  map: string;
  when: (s: Save) => boolean;
  /** hero = who you play, partner = the other one */
  lines: (hero: HeroId, partner: HeroId) => string[];
}

export const ENCOUNTERS: Encounter[] = [
  {
    id: 'towers', map: 'academy', when: (s) => s.tier >= 1060 && s.tier < 1210,
    lines: (h, p) => [
      `[${nameOf(p)}] ¡${nameOf(h)}! ¿Cómo van las clases de las Torres?`,
      p === 'pi'
        ? '[Pi] Como aprendiz de campo, resuelvo los encargos que me da Jocosius por todo el pueblo. Y escuché a dos profesores decir que Gladius "nunca se equivocó".'
        : `[${AKI}] Como aprendiz de campo, recorro Terragrifus con los encargos de Luceria. Y escuché a dos profesores decir que mi padre "nunca se equivocó".`,
      `[${nameOf(h)}] ¿Que no se equivocó? Entonces alguien nos está ocultando algo.`,
      `[${nameOf(p)}] Vos seguí con las clases; yo sigo investigando. ¡Nos vemos!`,
      ...(p === 'pi' ? ['[Flo] ¡Squawk! ¡Estudiá, estudiá!'] : []),
    ],
  },
  {
    id: 'diploma', map: 'academy', when: (s) => s.tier >= 1220 && s.tier < 2050,
    lines: (h, p) => [
      `[${nameOf(p)}] ¡Felicitaciones, ${nameOf(h)}! Ya sos Cazaproblemas.`,
      p === 'pi'
        ? '[Pi] Yo también: aprobé el examen de campo de Jocosius... ¡mientras él barría! Ahora el pirata tiene diploma.'
        : `[${AKI}] Yo también aprobé el examen de campo de Luceria. ¡Ya somos dos Cazaproblemas!`,
      `[${nameOf(h)}] Quimerius dice que el próximo paso es Logiverum.`,
      `[${nameOf(p)}] La consola marca un Eco en la entrada del pueblo. Me adelanto: te espero allí.`,
    ],
  },
  {
    id: 'town', map: 'logiverum', when: (s) => s.tier >= 2050,
    lines: (h, p) => [
      `[${nameOf(p)}] ¡Llegaste, ${nameOf(h)}! Mirá: ese remolino es el Eco, un pedazo del Mar de los Números.`,
      `[${nameOf(p)}] Y hay criaturas del mar sueltas por el pueblo. Si un dado o una calavera te alcanza, te reta a un duelo de cálculo. Si dudás, pedí una pista.`,
      `[${nameOf(h)}] Entonces cerramos los Ecos y de paso ayudamos a la gente del pueblo.`,
      `[${nameOf(p)}] Trato hecho. Cuando estés listo, entramos juntos al Eco.`,
    ],
  },
  {
    id: 'mountains', map: 'mountains', when: (s) => s.tier >= 2090,
    lines: (h, p) => [
      `[${nameOf(p)}] Subí antes que vos, ${nameOf(h)}. Hay un vendedor, Farsantius, que vende miniaturas del "Fracaso de Gladius"... ¡qué falta de respeto!`,
      `[${nameOf(h)}] Dicen que Gladius calculó mal la elipse. Hay que averiguar quién tiene razón.`,
      `[${nameOf(p)}] Más arriba vive Aurelia; dicen que conoció a Gladius. Y en estas montañas hay dos Ecos más, todavía sellados.`,
    ],
  },
  {
    id: 'order', map: 'woods', when: (s) => s.tier >= 2110,
    lines: (h, p) => [
      `[${nameOf(p)}] ${nameOf(h)}, ¿Aurelia te habló de la Orden? Gladius era parte de ella... y Quimerius también.`,
      `[${nameOf(h)}] Entonces Quimerius sabía la verdad desde el principio.`,
      `[${nameOf(p)}] Busquemos el taller de Armandius, la casa de techo rojo del bosque. Allí está la respuesta.`,
    ],
  },
  {
    id: 'fountain', map: 'academy', when: (s) => s.tier >= 2150,
    lines: (h, p) => [
      `[${nameOf(p)}] ${nameOf(h)}, lo sé todo: el plano de Armandius prueba que la catapulta apuntó bien. Gladius escondió la luna a propósito.`,
      `[${nameOf(p)}] Y está aquí, bajo la Fuente. Terminá los problemas que te pide Quimerius: esta vez bajamos juntos.`,
      `[${nameOf(h)}] Juntos. Por Gladius.`,
    ],
  },
];

export const pendingEncounter = (s: Save, map: string): Encounter | null =>
  ENCOUNTERS.find((e) => e.map === map && !s.flags[`enc_${e.id}`] && e.when(s)) ?? null;

/** End of the meeting at the fountain: the other hero leaves to train on their own. */
export const PARTING = (h: HeroId): string[] => h === 'aki'
  ? [
    `[Consola: Quimerius] ${AKI}, tú recibiste mi carta: estudiarás en la Academia. Pi, tú serás el aprendiz de campo.`,
    '[Pi] Me parece justo: los piratas aprendemos en el camino. Me haré Cazaproblemas por mi lado y buscaré pistas de Gladius afuera.',
    `[${AKI}] Entonces, el que encuentre algo primero le avisa al otro.`,
    '[Flo] ¡Squawk! ¡Nos vemos en el camino!',
    `[Consola: Quimerius] Dos caminos, un mismo destino. ${AKI}, ve a ver a Luceria: tus clases empiezan ahora.`,
  ]
  : [
    `[${AKI}] Pi, el lugar en la Academia es tuyo: vos necesitás aprender cómo se calcula en Terragrifus. Yo seré aprendiz de campo y buscaré pistas de mi padre afuera.`,
    '[Pi] ¿Me dejás solo con los libros? ...Está bien. El que encuentre algo primero le avisa al otro.',
    '[Flo] ¡Squawk! ¡Yo me quedo con el capitán!',
    '[Consola: Quimerius] Dos caminos, un mismo destino. Pi, ve a ver a Luceria: tus clases empiezan ahora.',
  ];
