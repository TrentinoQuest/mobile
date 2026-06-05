import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { AlertController, IonContent } from '@ionic/angular/standalone';
import { LoreQuizService } from '../../../core/services/lore-quiz/lore-quiz.service';
import { HapticsService } from '../../../core/services/haptics/haptics.service';

/** Stato visuale di un'opzione di risposta. */
type OptionState = 'idle' | 'correct' | 'wrong' | 'dim';

/** Lettere A/B/C/D per le opzioni. */
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

/**
 * LoreQuizPage — quiz della lore giornaliero (GDD "Sapere Territoriale").
 *
 * Domanda a 4 opzioni, un solo tentativo al giorno. Dopo la risposta i bottoni
 * si bloccano: corretta in verde, scelta errata in rosso, e in entrambi i casi
 * viene mostrata la spiegazione. Se la risposta e' corretta e arriva un
 * frammento di mappa, viene proposto in un alert con possibilita' di salvarlo.
 */
@Component({
  selector: 'app-lore-quiz',
  templateUrl: './lore-quiz.page.html',
  styleUrls: ['./lore-quiz.page.scss'],
  standalone: true,
  imports: [IonContent],
})
export class LoreQuizPage implements OnInit {
  private readonly service = inject(LoreQuizService);
  private readonly haptics = inject(HapticsService);
  private readonly alertCtrl = inject(AlertController);
  private readonly location = inject(Location);

  protected readonly letters = OPTION_LETTERS;
  protected readonly question = this.service.question;
  protected readonly answer = this.service.answer;
  protected readonly answered = this.service.answered;
  protected readonly correctIndex = this.service.correctIndex;
  protected readonly explanation = this.service.explanation;
  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;

  /** Indice scelto dall'utente in questa sessione. */
  protected readonly selectedIndex = signal<number | null>(null);

  /** Evita di riproporre piu' volte l'alert del frammento di mappa. */
  private fragmentShown = false;

  constructor() {
    // Reagisce all'arrivo della risposta: feedback aptico + frammento di mappa.
    effect(() => {
      const res = this.answer();
      if (!res) return;
      if (res.correct) {
        this.haptics.success();
        if (res.mapFragment && !this.fragmentShown) {
          this.fragmentShown = true;
          void this.presentFragment(res.mapFragment.questName, res.mapFragment.hint);
        }
      } else {
        this.haptics.error();
      }
    });
  }

  ngOnInit(): void {
    this.service.load();
  }

  protected goBack(): void {
    this.location.back();
  }

  protected select(index: number): void {
    if (this.answered()) return;
    this.haptics.medium();
    this.selectedIndex.set(index);
    this.service.submit(index);
  }

  protected optionState(index: number): OptionState {
    if (!this.answered()) return 'idle';
    if (index === this.correctIndex()) return 'correct';
    if (index === this.selectedIndex()) return 'wrong';
    return 'dim';
  }

  private async presentFragment(questName: string, hint: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Frammento di mappa',
      subHeader: questName,
      message: hint,
      cssClass: 'tq-fragment-alert',
      buttons: [
        { text: 'Chiudi', role: 'cancel' },
        {
          text: 'Salva promemoria',
          handler: () => {
            this.service.saveFragment(questName, hint);
          },
        },
      ],
    });
    await alert.present();
  }
}
