import { Component, Input, computed, signal } from '@angular/core';
import {
  AnyQuest,
  PlayerQuestStatus,
  QuestType,
} from '../../../../core/services/quest/quest.types';

/**
 * Contenuto visualizzato dentro un popup Leaflet quando l'utente clicca
 * su un marker quest.
 *
 * Pattern di montaggio:
 * Non si usa via template (<app-quest-popup>). Viene istanziato
 * programmaticamente in home.page.ts con createComponent() e il suo
 * elemento root e' passato a Leaflet via L.Popup.setContent(element).
 *
 * Stato:
 * Usa signal interni; l'@Input setter li sincronizza. Permette al
 * template di usare la new control flow syntax (@if, @for).
 *
 * Allineamento OpenAPI v0.2.0:
 * Il popup mostra una AnyQuest (primary o secondary). Lo stato della quest
 * per il giocatore (discovered/available/locked) NON e' un campo dei DTO
 * ma una vista client-side: viene passato come @Input separato.
 *
 * Stile:
 * Tutto in SCSS scoped. Il frame esterno del popup (cornice, freccia)
 * e' stilizzato in global.scss perche' .leaflet-popup-* sono iniettati
 * da Leaflet.
 */
@Component({
  selector: 'app-quest-popup',
  templateUrl: './quest-popup.component.html',
  styleUrls: ['./quest-popup.component.scss'],
  standalone: true,
})
export class QuestPopupComponent {
  // Signal interni: aggiornati dai setter @Input qui sotto.
  protected readonly quest = signal<AnyQuest | null>(null);
  protected readonly playerStatus = signal<PlayerQuestStatus>('available');

  /** Esposto al template per il branching primary/secondary. */
  protected readonly QuestType = QuestType;

  /**
   * Label leggibile dello stato giocatore (kicker del popup).
   * Computed: si aggiorna quando playerStatus() cambia.
   */
  protected readonly statusLabel = computed<string>(() => {
    return PLAYER_STATUS_LABELS[this.playerStatus()];
  });

  /**
   * Classe modificatrice BEM per colorare il kicker.
   * Usata dal template per applicare il modificatore corretto.
   */
  protected readonly statusModifier = computed<string>(() => {
    return `quest-popup__kicker--${this.playerStatus()}`;
  });

  /**
   * Etichetta del tipo di quest (mostrata sotto il titolo).
   */
  protected readonly typeLabel = computed<string>(() => {
    const q = this.quest();
    if (!q) return '';
    return q.type === QuestType.PRIMARY ? 'Quest principale · QR' : 'Quest secondaria · Check-in';
  });

  /**
   * @Input: la quest da mostrare nel popup.
   * Esempio in home.page.ts:
   *   componentRef.setInput('questData', quest);
   */
  @Input() set questData(value: AnyQuest | null) {
    this.quest.set(value);
  }

  /**
   * @Input: lo stato giocatore corrente per questa quest.
   * Determina colore del kicker e label visualizzata.
   */
  @Input() set status(value: PlayerQuestStatus) {
    this.playerStatus.set(value);
  }
}

// ----------------------------------------------------------------
// Costanti private del modulo (non esposte)
// ----------------------------------------------------------------

const PLAYER_STATUS_LABELS: Record<PlayerQuestStatus, string> = {
  discovered: '— SCOPERTA —',
  available: '— DA SCOPRIRE —',
  locked: '— BLOCCATA —',
};