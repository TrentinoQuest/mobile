import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { LogoutButtonComponent } from '../../../shared/components/logout-button/logout-button.component';
// TODO: aggiusta il path se il componente theme-selector che Claude Code
// ha creato vive altrove. Standard atteso: shared/components/theme-selector/
import { ThemeSelectorComponent } from '../../../shared/components/theme-selector/theme-selector.component';

/**
 * Profilo — Tab 5 della sezione giocatore.
 *
 * STUB con sezione theme selector (gia' implementata) e logout button.
 * La versione vera includera' profilo utente, stats, impostazioni, ecc.
 *
 * TODO: implementare in chat dedicata. Riferimento design: screens-social.jsx
 * (sezione profilo) e ios-frame.jsx.
 */
@Component({
  selector: 'app-profilo',
  templateUrl: './profilo.page.html',
  styleUrls: ['./profilo.page.scss'],
  standalone: true,
  imports: [IonContent, LogoutButtonComponent, ThemeSelectorComponent],
})
export class ProfiloPage {}