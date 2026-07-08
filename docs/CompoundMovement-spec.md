# Especificación: Movimientos Compuestos

## 1. Concepto general

Los **movimientos compuestos** (también: combinados / conjuntos) son un mecanismo para **agrupar o dividir movimientos**. Permiten relacionar entre sí movimientos que individualmente existen por separado, para verlos y tratarlos como un conjunto.

---

## 2. Modelo de datos

### Movimiento (individual)

- Atributo **`parentId`**: referencia al `MovimientoCompuesto` al que pertenece (si lo hay).
- Campo de envelope como **mapa `{ envelopeId: cantidad }`** en lugar de un ID único, para permitir la división de un movimiento entre varios sobres (ver CU3).

### MovimientoCompuesto (superclase ligera)

- **`id`**
- **`nombre`**
- **`tipo`** (p. ej. `isCancelable`, ver CU2)
- **`mesPropietario`** (o `null`, ver §6)
- Sirve además como registro centralizado de qué IDs están en uso.

El agrupamiento se resuelve buscando los movimientos que comparten `parentId`.

### Tabla auxiliar (división en envelopes)

Para poder listar por envelope sin perder velocidad:

- Tabla `(movementId, envelopeId, amount)`.
- Clave / restricción: la pareja **`(movementId, amount)`** como clave de la tabla (`UNIQUE(movementId, amount)`).

### Transfers

- Un `Transfer` generado por un movimiento lleva una **FOREIGN KEY** al movimiento que lo originó (ver CU3, opción transfers).

---

## 3. Caso de uso 1 — Agrupar movimientos

**Situación:** un viaje a Asturias con gastos dispersos (gasolina, peaje, hotel, museo…) que quieres ver juntos como "viaje a X".

**Comportamiento:** todos los movimientos comparten `parentId` y el frontend los agrupa. Es el caso más sencillo; apenas requiere lógica de backend.

---

## 4. Caso de uso 2 — Movimientos que se cancelan mutuamente

**Situación:** pagas una cena de 120 € con tu tarjeta y los amigos te devuelven su parte por Bizum (varias entradas de ~20 €). El gasto real tuyo es solo 20 €.

**Opciones:**

- **A (manual):** el usuario simplifica él mismo e introduce directamente un único gasto neto (p. ej. 20 €). Funciona, pero recae en el usuario.
- **B (compuesto):** se agrupan todos bajo un mismo `parentId`, con **tipo `isCancelable`**. En el frontend se muestra el conjunto en lugar de cada movimiento suelto (con opción a desplegar / ver detalle).

El cómputo de estos movimientos (neteo, mes de imputación) se rige por las reglas de §6.

---

## 5. Caso de uso 3 — Dividir un movimiento entre varios envelopes

**Situación:** entra el salario (p. ej. 2.000 €) y quieres repartirlo entre varios presupuestos. También aplica a ingresos puntuales (regalo, préstamo) que quieras dividir.

### Opción elegida — Mapa en el propio movimiento

- El campo envelope del movimiento es un **mapa `{ envelopeId: cantidad }`**.
- Ej.: un movimiento de 200 € → `gasolina: 25, comida: 25, bares: 150`.
- **Display en el envelope:** el movimiento aparece en cada envelope implicado con su cantidad parcial (p. ej. +200 en comida), **marcado como movimiento parcial** y clicable para ver que forma parte del salario / movimiento origen.
- **Rendimiento:** listar movimientos de un envelope obliga a recorrer un mapa. Se resuelve sin perder velocidad con la **tabla auxiliar** descrita en §2 (`(movementId, envelopeId, amount)`).

### Opción alternativa — Vía transfers (considerada, no elegida)

- Apoyarse en la lógica de **transferencias entre sobres** (mueven dinero entre sobres sin alterar el total de la cuenta).
- El movimiento entra y **genera automáticamente una serie de transfers**. Encaja bien con **movimientos periódicos** (salario), lo que facilitaría la implementación.
- Cada transfer se **vincula al movimiento origen mediante FOREIGN KEY**. Debería poder hacerse también manualmente.

---

## 6. Agrupaciones a lo largo de varios meses + cálculos

Los movimientos deben seguir existiendo en su mes real (para que los balances de fin de mes cuadren con el banco), así que **no se agrupan visualmente entre meses**. Solución mediante `mesPropietario`:

### Display

- En el **mes propietario**: todos los movimientos del compuesto se comprimen en un **único movimiento pseudoficticio**, anotado como compuesto, con "ver detalle" / desplegable.
- En los **otros meses** (no propietarios): los movimientos se muestran **tal cual e individuales, pero grayed out**, indicando que no están "activos". On hover (o método por decidir) se informa: pertenecen al compuesto X, cuyo mes propietario es Y, y por tanto no se usan en los cálculos de este mes.
- **Desplegar en el mes propietario:** al desplegar el movimiento pseudoficticio se muestran **solo los movimientos de ese mes** (preferencia; frente a mostrar todos).
- **Acceso al detalle:** desde ambos lados (mes propietario y meses grayed out) hay opción de acceder al **detalle del movimiento compuesto**, que muestra **todos** los movimientos con ese `parentId`.

### Cálculos

- El `MovimientoCompuesto` se considera **ocurrido íntegramente dentro del `mesPropietario`** a efectos de `PeriodSummary` y cálculos similares, aunque no sea literalmente así.
- Los movimientos en meses no propietarios **no se usan para los cálculos de `PeriodSummary` de su mes**, con la **excepción del balance final** de ese mes.
- Ej. (CU2): salen 120 el 31 y entran 100 al mes siguiente → no se computa como −120 en un mes y +100 en otro, sino como **−20 en el mes propietario**.
- Se pierde precisión en casos como un viaje repartido en varios meses, pero se asume conscientemente.

### Caso multi-mes / vacaciones (`mesPropietario = null`)

- Con `mesPropietario = null`, el compuesto **no se usa en el cálculo de ningún mes**. Se trata como gasto anómalo o como movimiento **perteneciente al año**, mostrándose solo en el resumen anual y no en el de ningún mes concreto.
- Justificación: las vacaciones/viajes son, por naturaleza, anómalos y poco frecuentes; normalmente no interesa "cuánto gasto de media al mes en vacaciones". Quien viaje muy a menudo tendrá suficiente control y conocimiento como para crearse un envelope concreto; y algo semanal o mensual ya no encaja como "vacaciones".

---

## 7. Sobres, anomalías y viajes

**Situación:** los gastos de un viaje (gasolina, restaurantes…) se consideran parte del "viaje", no de sus sobres habituales. Meter 500 € de gasolina de un viaje en el sobre "gasolina" genera una **anomalía grande** que distorsiona medias y detección de valores anómalos. Igual con restaurantes: un mes de viaje no debería subir la media de gasto habitual en restaurantes, porque es dinero de "vacaciones", no de "restaurantes".

**Postura:** esto **no debe forzarlo el desarrollador**. Es una forma de pensar personal ("la gasolina de un viaje sale del sobre viajes, no del de gasolina") que otros usuarios pueden no compartir; imponerla sería incorrecto. Descartado también forzar envelopes por defecto (no todos trackean lo mismo; p. ej. comida en efectivo sin tracking).

**Enfoque adoptado (relacionado con §8):**

- No se fuerza el mismo sobre. Esto puede causar anomalías en los sobres.
- Opción prevista: en el `MovimientoCompuesto`, **"marcar todos los movimientos hijos como anómalos"**, para que no alteren medias ni estadísticas de sus respectivos sobres.
- Cuando el usuario reparta movimientos en varios sobres, se le puede **informar de que esto puede causar problemas** y ofrecerle un prompt para **moverlos todos a un envelope nuevo o existente**.
- El detalle exacto se concretará al desarrollar esta parte del frontend; queda documentado.

---

## 8. Reglas de forzado (decisiones)

- **Mismo mes:** **NO se fuerza.**
- **Mismo sobre:** **NO se fuerza** (~70% de confianza).

### Sub-sección: posibilidad de forzar el mismo sobre (considerada)

Aunque no se adopta, se documenta la alternativa:

- **Ventaja:** al mostrar un sobre (p. ej. "gasolina"), no aparecerían movimientos sueltos que en realidad pertenecen a un compuesto; empuja suavemente al usuario a usar un sobre "viaje X".
- **Coste:** más rigidez para el usuario. Por eso se prefiere no forzarlo y mitigar las anomalías con el marcado de hijos como anómalos (§7).

---

## 9. Descartado

- **Envelope inverso (semántica):** la idea de modelar los movimientos que se cancelan en distintos meses como un "envelope al revés" (gastas y luego te va entrando) se consideró interesante conceptualmente pero **se descarta** por falta de relevancia práctica.

# Implementación

Esta sección describe cómo funcionan los movimientos compuestos tal y como están implementados: una guía de uso, no de código.

## Qué son

Un **movimiento compuesto** agrupa dos o más movimientos reales bajo un mismo conjunto. Hay dos modalidades:

- **Agrupación** (no cancelable): movimientos que quieres ver y analizar juntos pero que siguen siendo gastos/ingresos independientes (la gasolina, el hotel y los restaurantes de un viaje).
- **Cancelable:** movimientos que en realidad forman uno solo movimiento en varios trozos y que se compensan entre sí (pagas una cena de 120 € y tus amigos te devuelven su parte por Bizum: tu gasto real son 20 €, pero tienes varios apuntes ensuciando las cuentas). El conjunto se trata como **un único movimiento por su neto**.

Un movimiento pertenece como mucho a un compuesto.

## Requisitos de los miembros

- Todos los miembros deben ser de la **misma cuenta**.
- No pueden ser movimientos **divididos entre varios sobres** (split), **instancias de un movimiento periódico**, ni movimientos **pendientes de revisión** (tentativos).
- Un compuesto necesita **al menos dos** miembros. Si por cualquier motivo se queda con uno, se **disuelve** automáticamente (el movimiento superviviente vuelve a ser normal).
- Un compuesto **cancelable** exige además que **todos sus miembros compartan el mismo sobre** (así su neto tiene un único sitio donde imputarse). Una agrupación sí puede repartir sus miembros entre varios sobres.

## Creación

Se crean desde la página **Compounds**. Al crearlo eliges:

- **Nombre**.
- **Miembros:** seleccionando movimientos ya existentes (solo se ofrecen los elegibles) y/o creando movimientos nuevos en el momento con el botón "New movement". Si cancelas la creación del compuesto, esos movimientos nuevos se descartan; solo se conservan si terminas creándolo.
- **Tipo:** cancelable o agrupación.
- **Mes propietario** (owner month): ver el apartado siguiente.
- **Anómalo** y **notas** (opcionales).

## Mes propietario y efecto en los cálculos

El **balance nunca se ve afectado**: cada movimiento sigue contando en su mes y sobre reales para el saldo, que siempre cuadra con el banco. El mes propietario solo re-atribuye las **estadísticas** (medias, totales, cash flow de "hábitos"), nunca el dinero.

- Por defecto, el mes propietario es el **mes más temprano** de los miembros; puedes cambiarlo a cualquier mes en el que caiga algún miembro.
- También puedes dejarlo en **"Anual (sin dueño)"**. En ese caso **no se re-atribuye nada**: los miembros se muestran en gris en sus fechas y solo se excluyen de las estadísticas si están marcados como anómalos.

Cuando hay mes propietario, las estadísticas del conjunto se **colapsan en ese mes**:

- Los miembros que caen en **otros meses** se **retiran** de las estadísticas de esos meses...
- ...y el conjunto se **inyecta en el mes propietario**: si es **cancelable**, como **un único movimiento por su neto** (p. ej. −20 €); si es una **agrupación**, como sus miembros **individuales**.

Esta re-atribución se aplica **a nivel de cuenta** siempre. **A nivel de sobre** solo se aplica a los cancelables (que comparten un único sobre). Es decir: los miembros de una **agrupación repartida en varios sobres siguen contando en las estadísticas de su sobre y su mes reales**; solo la vista global de la cuenta los agrupa en el mes propietario. (Un sobre es un fondo real: el dinero salió de ese sobre en ese mes, y las estadísticas del sobre lo reflejan.)

## Cómo se ven

- En el listado de movimientos, en el **mes propietario** los miembros se **comprimen en una única fila desplegable** (al desplegar se ven solo los de ese mes).
- En los **demás meses**, los miembros se muestran **en gris** ("no contados aquí"), con una nota de a qué compuesto pertenecen y cuál es su mes propietario. Siguen ahí porque afectan al balance.
- Desde cualquiera de esas filas se abre el **detalle** del compuesto.

## Vista de estadísticas

En las tarjetas de resumen (Overview), la vista **con la re-atribución de compuestos ya aplicada es la que se muestra por defecto** (marcada con una insignia de compuesto). Se combina con el interruptor de **anómalos**, de modo que puedes ver los agregados con o sin los movimientos marcados como anómalos. Cuando ningún compuesto afecta a un periodo, la tarjeta muestra simplemente las cifras normales.

## Anómalos

Un movimiento suelto ya podía marcarse como **anómalo** para excluirlo de las medias y agregados de "gasto normal" (sin sacarlo del balance). Con los compuestos:

- Puedes marcar **todo el compuesto** como anómalo; entonces **todos sus miembros pasan a ser anómalos** y no pueden dejar de serlo mientras el compuesto lo esté.
- Si el compuesto no es anómalo, cada miembro puede ser anómalo o no de forma individual.

Es la vía recomendada para viajes o compras grandes: los agrupas y, si no quieres que distorsionen tus medias, marcas el conjunto como anómalo.

## Edición

Se puede editar en cualquier momento: **nombre**, **notas**, **tipo** (cancelable/agrupación), **mes propietario**, marca de **anómalo**, y **añadir o quitar miembros**. Al quitar un miembro, si el mes propietario se queda sin ningún miembro se re-ancla automáticamente al mes más temprano de los que quedan. Al convertir el compuesto en cancelable se exige que todos los miembros compartan sobre.

## Borrado y disolución

- **Borrar** un compuesto ofrece la opción de **borrar también sus movimientos** (marcada por defecto) o de solo deshacer la agrupación, dejando los movimientos como sueltos.
- Se **disuelve** automáticamente si se queda con menos de dos miembros (al quitar o borrar miembros). El/los superviviente(s) quedan como movimientos normales y conservan su propia marca de anómalo.
