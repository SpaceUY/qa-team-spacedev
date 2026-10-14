# Automatizaciones de Slack

Este archivo es la referencia para que Claude programe los recordatorios recurrentes sin empezar de cero. Cuando haya que cargar una nueva tanda, Claude debe leer este archivo, programar los envíos pendientes que entren en la ventana de 120 días y devolver una versión actualizada del archivo.

## Cómo funciona

- Los mensajes se programan con la conexión de Slack (herramienta de mensajes programados), a nombre del usuario.
- Slack solo permite programar hasta **120 días** hacia adelante, por eso se cargan en tandas.
- Desde la conexión no se pueden ver ni borrar mensajes programados. Para revisarlos o eliminarlos: Slack → "Borradores y enviados" → pestaña "Programados".
- Zona horaria de referencia: **Buenos Aires (UTC-3)**.

---

## Automatización 1: Carga de horas en Clocki

| Campo | Valor |
|---|---|
| Canal | #qa-chapter (privado) |
| ID del canal | C0B3G1GSCUU |
| Frecuencia | Una vez por mes |
| Día | El 28 de cada mes |
| Hora | 9:00 (Buenos Aires) |
| Regla | Si el 28 cae sábado o domingo, se envía el siguiente día hábil (lunes) |

**Mensaje (texto exacto):**

> ⭐ Recuerden cargar sus horas en Clocki, por favor! Gracias 🙌

### Calendario de envíos

| Mes | El 28 cae | Fecha de envío | Se puede programar desde | Estado |
|---|---|---|---|---|
| Oct 2026 | miércoles | mié 28/10/2026 | — | ✅ Programado |
| Nov 2026 | sábado | lun 30/11/2026 | — | ✅ Programado |
| Dic 2026 | lunes | lun 28/12/2026 | — | ✅ Programado |
| Ene 2027 | jueves | jue 28/01/2027 | 30/09/2026 | ⏳ Pendiente |
| Feb 2027 | domingo | lun 01/03/2027 | 01/11/2026 | ⏳ Pendiente (ver nota) |
| Mar 2027 | domingo | lun 29/03/2027 | 29/11/2026 | ⏳ Pendiente |
| Abr 2027 | miércoles | mié 28/04/2027 | 29/12/2026 | ⏳ Pendiente |
| May 2027 | viernes | vie 28/05/2027 | 28/01/2027 | ⏳ Pendiente |
| Jun 2027 | lunes | lun 28/06/2027 | 28/02/2027 | ⏳ Pendiente |
| Jul 2027 | miércoles | mié 28/07/2027 | 30/03/2027 | ⏳ Pendiente |
| Ago 2027 | sábado | lun 30/08/2027 | 02/05/2027 | ⏳ Pendiente |
| Sep 2027 | martes | mar 28/09/2027 | 31/05/2027 | ⏳ Pendiente |

**Nota sobre febrero 2027:** el 28 cae domingo, así que con la regla actual el envío pasa al lunes 1 de marzo y marzo recibe dos recordatorios (el 1 y el 29). Decisión pendiente: mantenerlo así o adelantarlo al viernes 26 de febrero.

### Historial

- 28/09/2026: se programaron octubre, noviembre (lunes 30) y diciembre. Se eliminó a mano un envío duplicado del sábado 28/11.

---

## Plantilla para nuevas automatizaciones

Copiar este bloque y completarlo para cada recordatorio nuevo:

| Campo | Valor |
|---|---|
| Canal | |
| ID del canal | (lo busca Claude) |
| Frecuencia | |
| Día | |
| Hora | |
| Regla | |

**Mensaje (texto exacto):**

> 
