# Fix Plan — Playful UI Bug Fix Round 2

> Stato: DA FARE
> Regola: per ogni fix completato → commit → aggiorna stato in questo file

---

## PRIORITA' MASSIMA

### [DONE] 5. Pulsante "Sei arrivato" / Obiettivo vicino — BUG CRITICO animazione
- File: `home.page.html` + `home.page.scss`
- **BUG**: quando si preme, NON va giu' il pulsante — va su TUTTO IL RESTO al contrario (translateY bug)
- Il pulsante deve avere piu' importanza visiva quando sei arrivato vs obiettivo piu' vicino
- Togli l'icona con il contorno (outline icon) — mettine una coerente o rimuovila
- Deve essere filled solid come tutti gli altri pulsanti del sistema (es. "AVANTI")
- ZERO outline, ZERO stile diverso dagli altri pulsanti

---

## Lista completa fix

### [ ] 1. Onboarding
- File: cercare in `src/app/features/onboarding/`
- **Tutte le scene in dark mode perdono contrasto** — rivedere colori di ogni scena
- **Schermata sblocco taccuino** — mai toccata, stile completamente fuori tema, da rifare

### [ ] 2. Schermata completamento quest
- File: `checkin-success-modal` o simile in `quest/` o `giocatore/`
- Il tema NON e' stato aggiornato (solo il font)
- Rimuovere il tasto chiudi in alto
- "Continua a esplorare" in basso fa gia' da chiudi — tenere solo quello

### [ ] 3. Streak milestone modal — giorni settimana
- File: `streak-milestone-modal.component.html/.scss`
- Le icone dei giorni (pallini con fiammella) non sono state modificate
- Verificare anche il font

### [ ] 4. Home header — ring XP
- File: `home-header.component.html/.scss`
- Il ring XP attorno all'avatar non e' visibile / non e' presente correttamente

### [x] 5. Pulsante "Sei arrivato" / Obiettivo vicino — vedi sopra (PRIORITA' MASSIMA)

### [ ] 6. Taccuino — header "Ricordi raccolti"
- File: `album.page.html/.scss`
- La scritta esce fuori dal box
- In dark mode: scarso contrasto (bianco su verde chiaro, verde chiaro su verde chiaro)

### [ ] 7. Taccuino — Card collezionabili
- File: `album.page.html/.scss`
- Peggiorati: barra grigia con scritta trasparente — sbagliato
- Effetto 3D come i pulsanti — stile targhetta/pietra solida
- Coerenza di design con il resto del sistema

### [ ] 8. Taccuino — Missioni
- File: `album.page.html/.scss` (tab missioni)
- Stile completamente diverso dal tema
- Pulsanti/componenti con tema sbagliato

### [ ] 9. Taccuino — Quiz del giorno
- File: `album.page.html/.scss` (tab quiz)
- Stile completamente diverso dal tema
- I pulsanti sono diversi dagli altri

### [ ] 10. Pagina giocatore (profilo)
- File: `profilo.page.html/.scss`
- In dark mode il verde dell'header e' accecante (non fixato)
- In alto a destra pulsante liquid glass con icona sbagliata
- In generale tutto fuori tema (eccetto fiammella)

---

## Log commit

<!-- Aggiungere riga per ogni commit fatto -->
| # | Fix | Commit hash | Note |
|---|-----|-------------|------|
| 1 | Fix #5 + home header press + nearby rows press | 0ca3bf6 | Bug translate vs transform animation fill-mode |
| 2 | Fix #6 + #7 + #8/#9 — taccuino hero, card plate, quiz, missioni | 1e1b64d | |
| 3 | Fix #10 — profilo social btn glass -> Flat 2.0, icone filled | 94a2ac8 | |
