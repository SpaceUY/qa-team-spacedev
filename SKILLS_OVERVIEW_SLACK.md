📋 *QA Team Skills — Quick Reference*

Aquí te dejo un overview de cada skill disponible para el equipo QA.

---

*🎯 SKILLS DE QA*

*1️⃣ qa-blackbox* — Auditoría QA Completa
Cuándo: Pruebas full en un flujo específico sin acceso al código
✅ Valida funcionalidad, validaciones, navegación, diseño, accesibilidad
📊 Score 0-100 con 6 dimensiones de calidad
📸 Screenshots de cada hallazgo
📄 Reporte con tabla de bugs
→ Uso: Proporciona URL + flujo para activarlo automáticamente

---

*2️⃣ qa-smoke-test* — Prueba Rápida de un Ticket
Cuándo: Validar rápido que un feature funciona según su criterio de aceptación
⚡ Pruebas enfocadas solo en lo que dice el ticket
📝 Mismo formato compatible con ClickUp
🔄 Actualiza automáticamente regression-flows.md
→ Comando: `/qa-smoke-test <ticket-link-o-ID>`

---

*3️⃣ qa-text-check* — Auditoría de Textos
Cuándo: Revisar typos, gramática, idioma mezclado en el UI
🇪🇸🇬🇧 Especifica idioma: --lang=es o --lang=en
🔍 Detecta: typos, errores de gramática, i18n keys sin traducir
📋 Reporte con tabla de hallazgos compatible con ClickUp
→ Comando: `/qa-text-check <url> --lang=es|en`

---

*4️⃣ qa-regression* — Regresión Completa
Cuándo: Ejecutar todos los flujos core del proyecto de una vez
📋 Lee flujos documentados en context/regression-flows.md
✅ Ejecuta cada flujo end-to-end
📅 Actualiza fecha de última ejecución exitosa
📊 Reportes individuales + resumen general
→ Comando: `/qa-regression`

---

*5️⃣ qa-project-setup* — Configuración Inicial
Cuándo: Primera vez en un proyecto o cuando la estructura cambia
🗺️ Mapea navegación
🔄 Documenta flujos core
🎯 Define comportamientos intencionales (no son bugs)
🔐 Configura .env con BASE_URL y credenciales
→ Comando: `/qa-project-setup`

---

*🎟️ SKILLS DE INTEGRACIÓN CLICKUP*

*6️⃣ report-bugs-to-clickup* — Crear Tickets de Bugs
Cuándo: Después de qa-blackbox o qa-smoke-test, subir bugs a ClickUp
📊 Lee tabla de bugs del reporte QA
🎫 Crea 1 ticket ClickUp por cada bug
📎 Adjunta screenshots como evidencia
🏷️ Etiqueta por ambiente
👤 Asigna automáticamente
→ Comando: `/report-bugs-to-clickup <ruta-del-reporte>`

---

*7️⃣ report-improvements-to-clickup* — Crear Tickets de Mejoras
Cuándo: Después de qa-blackbox o qa-smoke-test, subir mejoras a ClickUp
💡 Lee sección "Nice to Have" del reporte QA
🎫 Crea 1 ticket ClickUp por cada mejora
📎 Adjunta screenshot compartido
🏷️ Asocia automáticamente al sprint activo
→ Comando: `/report-improvements-to-clickup <ruta-del-reporte>`

---

*📊 SCORING EN QA-BLACKBOX*

6 Dimensiones evaluadas:
• Funcionalidad (30%) — features funcionan correctamente
• Validaciones (20%) — manejo de errores
• Navegación (15%) — flujos completos sin dead ends
• Diseño (15%) — consistencia, contraste, layout
• Accesibilidad (10%) — labels, headings, roles ARIA
• Consola (10%) — sin JS errors ni network failures

Resultado:
• 85–100 → ✅ PASS
• 60–84 → ⚠️ CONDITIONAL PASS
• 0–59 → ❌ FAIL

---

*🔄 FLUJO TÍPICO DE UNA SESIÓN QA*

1. /qa-project-setup ← (solo 1ª vez)
2. Proporciona URL + flujo a probar
   → qa-blackbox se ejecuta automáticamente
3. /report-bugs-to-clickup qa-report.md ← crear tickets
4. /report-improvements-to-clickup qa-report.md ← crear mejoras

---

*⚡ QUICK REFERENCE*

| Necesidad | Skill | Comando |
| Probar flujo completo | qa-blackbox | Proporciona URL + flujo |
| Validar rápido 1 feature | qa-smoke-test | /qa-smoke-test <ticket> |
| Revisar textos/typos | qa-text-check | /qa-text-check <url> --lang=es |
| Regresión completa | qa-regression | /qa-regression |
| Subir bugs | report-bugs-to-clickup | /report-bugs-to-clickup path/qa-report.md |
| Subir mejoras | report-improvements-to-clickup | /report-improvements-to-clickup path/qa-report.md |

---

*📂 ESTRUCTURA DE EVIDENCIA*

Cada sesión crea carpetas automáticamente:

evidence/
└── {hostname}/ (ej: localhost-5173)
    ├── {flujo}/ (ej: register, login)
    │   └── {YYYY-MM-DD}/
    │       ├── qa-report.md
    │       ├── 01-*.png
    │       ├── 02-*.png
    │       └── ...
    └── AUDIT-SUMMARY-*.md

---

*✅ CONFIGURACIÓN REQUERIDA*

.env (gitignored, NO se comparte):
BASE_URL='http://localhost:5173'
TEST_USER_EMAIL='test@example.com'
TEST_USER_PASSWORD='password123'
CLICKUP_API_KEY='pk_...' (solo si usas ClickUp)
CLICKUP_BUGS_LIST_ID='...'
CLICKUP_SPRINT_LIST_ID='...'

---

¿Preguntas? Revisa los archivos .claude/skills/ en el repo para más detalles técnicos. 🚀
