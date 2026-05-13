import { Component, Input, computed, signal } from '@angular/core';
import { Quest, QuestStatus, Zone } from '../../../../core/services/quest/quest.types';

/**
 * Contenuto visualizzato dentro un popup Leaflet quando l'utente clicca
 * su un marker quest o su una zona.
 *
 * Pattern di montaggio:
 * Non si usa via template (<app-quest-popup>). Viene istanziato
 * programmaticamente in home.page.ts con createComponent() e il suo
 * elemento root e' passato a Leaflet via L.Popup.setContent(element).
 *
 * Doppia modalita':
 * Il popup serve sia per Quest (marker puntuali) che per Zone (cerchi).
 * Discrimina via il signal mode. La UI cambia minimamente:
 * - Quest: kicker stato, descrizione, punti
 * - Zone: kicker "ZONA", descrizione
 *
 * Stato:
 * Usa signal interni perche' l'@Input setter sincronizza i signal.
 * Cosi' il template puo' usare la new control flow syntax (@if, @for).
 *
 * Stile:
 * Quasi tutto in SCSS scoped. Il popup esterno (cornice, bordi) e' uno
 * stile Leaflet — lo stiliziamo in global.scss perche' lo wrapper
 * .leaflet-popup-content-wrapper e' iniettato da Leaflet.
 */
@Component({
  selector: 'app-quest-popup',
  templateUrl: './quest-popup.component.html',
  styleUrls: ['./quest-popup.component.scss'],
  standalone: true,
})
export class QuestPopupComponent {
  // Signal interni: aggiornati dai setter @Input qui sotto.
  protected readonly quest = signal<Quest | null>(null);
  protected readonly zone = signal<Zone | null>(null);

  /**
   * Modalita' di visualizzazione, derivata da quale signal e' popolato.
   * Se entrambi null (stato iniziale prima di setQuest/setZone), mostra
   * un placeholder neutro.
   */
  protected readonly mode = computed<'quest' | 'zone' | 'empty'>(() => {
    if (this.quest()) return 'quest';
    if (this.zone()) return 'zone';
    return 'empty';
  });

  /**
   * Label leggibile per lo stato della quest.
   * Computed: si aggiorna automaticamente quando quest() cambia.
   */
  protected readonly statusLabel = computed<string>(() => {
    const q = this.quest();
    if (!q) return '';
    return STATUS_LABELS[q.status];
  });

  /**
   * Classe modificatrice per colorare il kicker in base allo stato.
   * Usata dal template per applicare il modificatore BEM corretto.
   */
  protected readonly statusModifier = computed<string>(() => {
    const q = this.quest();
    if (!q) return '';
    return `quest-popup__kicker--${q.status}`;
  });

  /**
   * @Input usato dal codice che istanzia il componente.
   * Esempio in home.page.ts:
   *   componentRef.setInput('questData', quest);
   * Internamente sincronizza i signal e svuota l'altra modalita'.
   */
  @Input() set questData(value: Quest | null) {
    this.quest.set(value);
    if (value) this.zone.set(null);
  }

  @Input() set zoneData(value: Zone | null) {
    this.zone.set(value);
    if (value) this.quest.set(null);
  }
}

// ----------------------------------------------------------------
// Costanti private del modulo (non esposte)
// ----------------------------------------------------------------

const STATUS_LABELS: Record<QuestStatus, string> = {
  discovered: '— SCOPERTA —',
  available: '— DA SCOPRIRE —',
  locked: '— BLOCCATA —',
};