# MODLOG — CazaPira

## Recon
* `F:\Games\Piracalculos\...\Piracalculos.activity`: Sugar activity de Batoví; `bin/piracalculos` = ELF i386 C++/SDL1.2 con símbolos (motor `bat`). 1200x900 (pantalla del XO). Seis niveles (`LevelOne`..`LevelSix`), imágenes con color key magenta, JPG 1200x900 dentro de 2048x1024.
* `F:\Games\Cazaproblemas`: exe MinGW (SDL + luabind + pugixml, motor "TC"), datos en `data/`: mapas TMX 19px, XML de objetos, scripts Lua 5.1 compilados, `puzzles.enc` cifrado. 600x450.
* Cifrado de los problemas: `_decrypt_data` = TEA (delta 0x9e3779b9, 32 rondas), clave = 4 dwords en `_lala` (0x5d6554); la longitud va en los últimos 4 bytes. XML latin-1 con `&` sueltos (pugixml los toleraba).
* Condiciones de Lua 5.1: `TEST A C` salta si `isfalse(R[A]) != C`; `EQ/LT/LE A` salta si `(cmp) == A`. (Mi primer pseudo-decompilador las tenía invertidas.)

## Ruta
Reimplementar ambos juegos en TS sobre una base común: mundo de Cazaproblemas (más posibilidades) + niveles de Piracálculos como Ecos. Scripts originales ejecutados por una VM Lua 5.1 propia (generadores para que `Dialog.line/options` bloqueen).

## Hechos del motor
* Entidades: pos = pie del sprite; collider 52x12 en (0,-7); capas < 10 debajo, >= 10 encima. Triggers: `enter`/`action` (Trigger table por script). Tiles de colisión: 0 lleno, 1-4 medias diagonales.
* `executed_all` original = 36 pueblos; aquí 16 (suficiente para activar todos los gates 2070/2090).
* Bug conocido arreglado: `World.update` reseteaba `moving` del jugador cada frame (sin animación de caminar).

## Cambios de la fusión
* Menú con los assets del menú de Cazaproblemas (botones normal/over/press, burbujas) + insignia CazaPira + Pi.
* Ecos (`story/fusion.ts`), enemigos (`caza/enemies.ts`), duelos (`caza/duel.ts`), compañeros (`story/hero.ts`), final (`scenes/story.ts`).

## Verificación (2026-10-07)
* `tsc --noEmit` y `npm run build` limpios.
* Humo de scripts Lua originales: todos los triggers (enter/action) de las 14 mapas en tiers 1040/2060/2090/2110/5000-5010 sin errores.
* Banco de problemas: los 116 ejercicios se abren sin excepciones; todos los ids que usan `data.lua` y los scripts existen en el banco.
* Bots que completan los seis niveles de Piracálculos; flujo portal -> intro -> nivel -> outro -> recompensas, duelo de cálculo, final -> pantalla de final.
* Bugs corregidos: animación de caminar del jugador (flag `moving`), idle de Pi, globales Lua cruzadas entre escenas, sincronización de `currentTier` anidada, clics perdidos con 2 ticks por frame (`pointer.clicked`), textos de Eco dependientes del héroe evaluados en import.

## Prólogo común, jefes y créditos (rev. 2)
* Prólogo en historieta: `src/game/story/comic.ts` (3 páginas, paneles que aparecen de a uno, globos y cartelas) + `MeetingScene` (diálogo en la Fuente). Mismo texto para Aki y Pi; el héroe solo cambia a quién se maneja. Los nombres que no deben mutar a Pi llevan un espacio de ancho cero (`AKI` en `story/prologue.ts`).
* Los compañeros (el otro héroe y Flo) siguen al jugador desde el prólogo (`flags.met`).
* Jefes: `FinaleScene` = diálogo → `DuelScene('sabio', 5 rondas, 4 aciertos)` contra Quimerius → Olivera (nivel 6).
* Duelos con mecánicas de Piracálculos (llave/candado, cajones, dado oculto) y geometría de Cazaproblemas.
* Fuente bitmap de Piracálculos: `tools/build_pixfont.py` segmenta el atlas (hay que unir bandas con huecos ≤8 px y columnas con huecos ≤2 px por los acentos) → `font.json`; `ui/pixfont.ts`.
* Créditos: primero Vicemi Dev, luego las páginas originales de Cazaproblemas, la de Piracálculos y la nota legal.
* El nombre del juego se mantiene: **CazaPira**.
* Verificado en el navegador: páginas 1-3 de la historieta, diálogo, aterrizaje en la Academia con compañero, diálogo del Sabio, duelo (derrota → reintento), créditos. Pendiente: partida humana completa.

## Rev. 3: logo, menú, prólogo en historieta, compañero estilo Pokémon, dificultad
* Logo propio (`public/assets/cazapira/logo.png`): pantalla de presentación (`LogoScene` en `main.ts`) y arriba del menú.
* Menú nuevo (`scenes/title.ts`): fondo con la Academia (izq.) y el Mar de los Números (der.), panel de pergamino con los botones originales, cursor con el sombrero de Pi, navegación ↑↓/Espacio, ventanas modales para dificultad / opciones / confirmación.
* Dificultad: Normal = `flags.year 5` (banco de 5.º de primaria) + 22 s por pregunta, pista automática a los 6 s, primera pista de los problemas gratis; Difícil = `flags.year 6` (banco de 6.º). `isEasy()` en `save.ts`.
* **Orientación**: TODOS los cuadros de Pi y de Flo miran a la IZQUIERDA. Se espeja solo al mirar a la derecha (mundo, niveles 1-4 y 6, historieta, escenas). Antes caminaba al revés.
* `PiCae*` es hundirse en un pozo: no sirve para "salir del portal". La historieta usa `Pi_Salto_*` (entra girando y achicándose; sale creciendo desde el centro del portal).
* La luna ya no se deforma: `skyIn()` escala uniforme y `drawMoons()` por separado. Portal nuevo `visPortal()` (halo, núcleo, tres brazos en espiral, borde con brillo, números orbitando) usado en historieta, encuentro y Ecos del mapa.
* Compañero (`story/partner.ts`): el héroe no elegido se va "por su lado" (`PARTING`) y aparece en 6 encuentros (`ENCOUNTERS`, flags `enc_*`) + espera junto al Eco abierto del mapa. Se quitaron los seguidores permanentes (se superponían con el jugador).
* Pendiente: partida completa a mano; nivel 5 no espeja a Pi (salta en el lugar).

## Rev. 4: caminos, historia, pronombres, aspectos
* `World.flood/findPath` (BFS sobre la grilla de colisiones): el compañero aparece y camina solo por celdas conectadas al jugador; las criaturas aparecen solo en celdas alcanzables (>=14 pasos).
* **Pi, Flo y Olivera son varones** (el pirata, el loro, el villano). Se quitó el cambio hijo->hija de `heroName`.
* Historia: el mapa de Gladius está en clave de números (Olivera necesita que los héroes resuelvan los problemas); el eclipse pliega el mar; un aprendiz por año -> el otro es aprendiz de campo.
* Aspectos de Pi (`story/skins.ts`): recoloreo por zonas (pelo / saco / sombrero / pantalón) por HSL, se desbloquean cerrando Ecos; se aplica en todo el juego vía `setKeyedHook` en `assets.ts`. El mapa muestra la cabeza del héroe elegido (`drawHeroHead`).
* Publicación: `public/assets/caza` y `public/assets/pira` quedan fuera del repo (se regeneran con `tools/`). Rama `public-main` = historial limpio.
* Atuendos unificados: `OUTFITS` (default/cold/brad/shadow) en `story/skins.ts`; se obtienen con los mismos `add_item` del original y valen para ambos héroes (`currentOutfit()` = elegido y comprado, si no 'default'). Pi: recoloreo (Abrigo verde azulado, Brad rubio y fucsia, Sombra silueta negra). Menú, mapa, compañero y jugador usan `currentOutfit()`.
* Corrección: el atuendo solo lo lleva el héroe elegido (`outfitFor(hero)`); el otro conserva el aspecto original en menú, historia y como compañero.
