// The shared prologue of CazaPira. Both heroes live the SAME opening: the lore of the two moons, Aki's letter from Quimerius, Pi's escape
// (Piracálculos comic) and the night the sea folded over Terragrifus, which throws Pi and Flo at the feet of the Academy fountain
// where Aki finds them. Choosing a hero only decides who you steer; the other travels with you from this scene on.
//
// Names that must NOT be swapped to the active hero carry a zero-width space (see heroName in hero.ts).
export const ZW = '​';
export const AKI = `Aki${ZW}`;

/** The meeting at the fountain: identical for both heroes. */
export const MEETING: string[] = [
  `[${AKI}] ¡Alto ahí! ¿Quién anda en la Fuente de la Academia a estas horas?`,
  '[Flo] ¡Squawk! ¡Capitán, tierra firme! ...Pero este no es el Mar de los Números.',
  `[Pi] Soy Pi, capitán de la Cólera Escarlata. Busco a Gladius, el Cazapirata. Antes de desaparecer me dejó una carta: "Si el mar se pliega, buscá la Academia de los Cazaproblemas".`,
  `[${AKI}] ¿Gladius? ¡Es mi padre! Lo exiliaron después del Fracaso de la catapulta y hace años que no sé nada de él.`,
  `[Pi] ¿Tu padre? ¡Él me crió en el Mar de los Números! Entonces somos casi hermanos, ${AKI}.`,
  '[Flo] ¡Squawk! ¡Hermanos! ¡Ahora hay dos cabezas contando!',
  `[Consola: Quimerius] ${AKI}, Pi. Los esperaba. Esta noche el eclipse rasgó el cielo: el Mar de los Números se plegó sobre Terragrifus y dejó cinco Ecos abiertos, pedazos del mar llenos de trampas de Olivera.`,
  `[Consola: Quimerius] Solo un Cazaproblemas puede cerrarlos y acercarse a la Fuente. Si quieren encontrar a Gladius, los dos deberán graduarse.`,
  `[Pi] ¿Yo, un Cazaproblemas? Un pirata calcula tesoros, no tareas... Pero si es el camino para encontrar a Gladius, acepto.`,
  '[Consola: Quimerius] Bien. La Academia admite un solo aprendiz nuevo por año, así que serán dos caminos: uno estudiará aquí, en las Torres; el otro será aprendiz de campo y recorrerá Terragrifus vigilando los Ecos.',
];
