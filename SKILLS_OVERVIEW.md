# QA Team Skills — Quick Reference

Documento breve para el equipo QA de SpaceDev sobre cada skill disponible.

---

## 📋 Skills de QA

### 1. **qa-blackbox** — Auditoría QA Completa
**Cuándo usarlo:** Pruebas full en un flujo específico sin acceso al código.
- ✅ Valida funcionalidad, validaciones, navegación, diseño, accesibilidad
- 📊 Genera un score 0-100 con 6 dimensiones de calidad
- 📸 Crea evidencia (screenshots) de cada hallazgo
- 📄 Genera reporte detallado con tabla de bugs

**Invocación automática:** Cuando das una URL + flujo a probar.

---

### 2. **qa-smoke-test** — Prueba Rápida de un Ticket
**Cuándo usarlo:** Validar rápidamente que un feature específico funciona según su criterio de aceptación en ClickUp.
- 🎯 Pruebas enfocadas solo en lo que dice el ticket
- ⚡ Más rápido que `qa-blackbox`
- 📝 Genera reporte en el mismo formato (compatible con ClickUp)
- 🔄 Actualiza automáticamente `context/regression-flows.md`

**Invocación manual:** `/qa-smoke-test <ticket-link-o-ID>`

---

### 3. **qa-text-check** — Auditoría de Textos
**Cuándo usarlo:** Revisar textos (typos, gramática, idioma mezclado) en el UI.
- 🇪🇸🇬🇧 Especifica idioma: `--lang=es` o `--lang=en`
- 🔍 Detecta: typos, errores de gramática, i18n keys sin traducir, inconsistencias
- 📋 Genera reporte con tabla de hallazgos
- 🎨 Mismo formato compatible con ClickUp

**Invocación manual:** `/qa-text-check <url> --lang=es|en`

---

### 4. **qa-regression** — Regresión Completa
**Cuándo usarlo:** Ejecutar todos los flujos core del proyecto de una vez.
- 📋 Lee flujos documentados en `context/regression-flows.md`
- ✅ Ejecuta cada flujo end-to-end
- 📅 Actualiza la fecha de "última ejecución exitosa"
- 📊 Genera reportes individuales + resumen general

**Invocación manual:** `/qa-regression`

---

### 5. **qa-project-setup** — Configuración Inicial
**Cuándo usarlo:** Primera vez en un proyecto o cuando la estructura cambia.
- 🗺️ Mapea navegación (`context/navigation-map.md`)
- 🔄 Documenta flujos core (`context/regression-flows.md`)
- 🎯 Define comportamientos intencionales (no son bugs)
- 🔐 Configura `.env` con BASE_URL y credenciales

**Invocación manual:** `/qa-project-setup`

---

## 🎟️ Skills de Integración ClickUp

### 6. **report-bugs-to-clickup** — Crear Tickets de Bugs
**Cuándo usarlo:** Después de `qa-blackbox` o `qa-smoke-test`, subir bugs a ClickUp.
- 📊 Lee tabla de bugs del reporte QA
- 🎫 Crea 1 ticket ClickUp por cada bug encontrado
- 📎 Adjunta screenshots como evidencia
- 🏷️ Etiqueta por ambiente (staging, production, etc.)
- 👤 Asigna automáticamente al usuario especificado

**Invocación manual:** `/report-bugs-to-clickup <ruta-del-reporte>`

---

### 7. **report-improvements-to-clickup** — Crear Tickets de Mejoras
**Cuándo usarlo:** Después de `qa-blackbox` o `qa-smoke-test`, subir mejoras sugeridas a ClickUp.
- 💡 Lee sección "Nice to Have" del reporte QA
- 🎫 Crea 1 ticket ClickUp por cada mejora propuesta
- 📎 Adjunta screenshot compartido
- 🏷️ Asocia automáticamente al sprint activo

**Invocación manual:** `/report-improvements-to-clickup <ruta-del-reporte>`

---

## 🔄 Flujo Típico de Una Sesión QA

```
1. /qa-project-setup                      ← (solo 1ª vez)
2. Proporcionar URL + flujo a probar
   → qa-blackbox se ejecuta automáticamente
3. /report-bugs-to-clickup qa-report.md   ← crear tickets de bugs
4. /report-improvements-to-clickup qa-report.md  ← crear tickets de mejoras
```

---

## 📂 Estructura de Evidencia

Cada sesión crea carpetas automáticamente:

```
evidence/
└── {hostname}/               (ej: localhost-5173)
    ├── {flujo}/              (ej: register, login, dashboard)
    │   └── {YYYY-MM-DD}/     (fecha de ejecución)
    │       ├── qa-report.md  (reporte completo)
    │       ├── 01-*.png      (screenshots)
    │       ├── 02-*.png
    │       └── ...
    └── AUDIT-SUMMARY-*.md    (resumen cuando se audita todo el sitio)
```

---

## ⚙️ Configuración Requerida

### `.env` (gitignored, NO se comparte)
```bash
BASE_URL='http://localhost:5173'
TEST_USER_EMAIL='test@example.com'
TEST_USER_PASSWORD='password123'
CLICKUP_API_KEY='pk_...'           (solo si usas ClickUp)
CLICKUP_BUGS_LIST_ID='...'         (solo si usas ClickUp)
CLICKUP_SPRINT_LIST_ID='...'       (solo si usas ClickUp)
```

### `.claude/settings.json` (opcional pero recomendado)
```json
{
  "mcpServers": {
    "playwright": { ... }  // para navegación del navegador
  }
}
```

---

## 🎯 Tips Prácticos

| Necesidad | Skill | Comando |
|-----------|-------|---------|
| Probar un flujo completo | `qa-blackbox` | Proporciona URL + flujo |
| Validar rápido 1 feature | `qa-smoke-test` | `/qa-smoke-test <ticket>` |
| Revisar textos/typos | `qa-text-check` | `/qa-text-check <url> --lang=es` |
| Regresión completa | `qa-regression` | `/qa-regression` |
| Subir bugs encontrados | `report-bugs-to-clickup` | `/report-bugs-to-clickup path/qa-report.md` |
| Subir mejoras | `report-improvements-to-clickup` | `/report-improvements-to-clickup path/qa-report.md` |

---

## 📊 Scoring en qa-blackbox

**6 Dimensiones evaluadas:**
- **Funcionalidad (30%)** — features funcionan correctamente end-to-end
- **Validaciones (20%)** — manejo de errores, validaciones
- **Navegación (15%)** — flujos completos sin dead ends
- **Diseño (15%)** — consistencia, contraste, layout
- **Accesibilidad (10%)** — labels, headings, roles ARIA
- **Consola (10%)** — sin JS errors ni network failures

**Resultado:**
- 85–100 → **PASS** ✅
- 60–84 → **CONDITIONAL PASS** ⚠️
- 0–59 → **FAIL** ❌

---

Preguntas frecuentes o más detalles: revisa los archivos `.claude/skills/` en el repo.
