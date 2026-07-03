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
