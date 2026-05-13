import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  mapOutline,
  imagesOutline,
  peopleOutline,
  personOutline,
  qrCode,
} from 'ionicons/icons';
import { ScanModalComponent } from '../scan-modal/scan-modal.component';

/**
 * Tab bar custom della sezione Giocatore.
 *
 * Posizionata in features/giocatore/components/ perche' e' un componente
 * strutturale interno alla feature giocatore, non riusabile altrove.
 *
 * Anatomia (da sinistra a destra):
 *   1. Mappa    -> /giocatore/home
 *   2. Album    -> /giocatore/album
 *   3. QR Scan  -> apre modal (NON e' una rotta)
 *   4. Amici    -> /giocatore/amici
 *   5. Profilo  -> /giocatore/profilo
 *
 * Look (dal design):
 * - Altezza ~64px + safe area inset bottom
 * - Background gradient + backdrop-filter blur (effetto "glass") che permette
 *   alla mappa sottostante di trasparire — vedi SCSS
 * - Tab attiva evidenziata in --tq-ocra (icona + label + barra superiore 3px)
 * - FAB centrale 58x58 in ocra solido, elevato ~16px sopra la barra
 *
 * Navigazione:
 * Uso RouterLink + RouterLinkActive per gestione dichiarativa della tab attiva.
 * Angular aggiunge la classe tab-bar__tab--active automaticamente sulla tab
 * corrispondente alla rotta corrente.
 *
 * Modal QR:
 * Click sul FAB centrale apre la modal di scansione tramite ModalController.
 * Per ora monta ScanModalPlaceholderComponent (cartella scan-modal-placeholder/
 * adiacente). Quando svilupperemo la scansione vera, sostituiremo l'import.
 *
 * TODO:
 * - Sostituire ScanModalPlaceholderComponent con la modal di scansione vera
 *   (Capacitor camera + libreria QR decoding + validazione GPS lato backend)
 * - Quando lo scan va a buon fine e sblocca un collectible, gestire il
 *   redirect a /giocatore/album con highlight del nuovo collectible
 * - Valutare se rendere la tab bar nascosta/ridotta in scroll-down (pattern
 *   "auto-hide on scroll") nelle pagine non-mappa, per piu' spazio contenuto
 */
@Component({
  selector: 'app-tab-bar',
  templateUrl: './tab-bar.component.html',
  styleUrls: ['./tab-bar.component.scss'],
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IonIcon],
})
export class TabBarComponent {
  private readonly modalCtrl = inject(ModalController);

  constructor() {
    // Registrazione esplicita delle icone Ionicons (richiesto da Ionic 8
    // standalone — non c'e' piu' la registrazione globale).
    addIcons({
      mapOutline,
      imagesOutline,
      peopleOutline,
      personOutline,
      qrCode,
    });
  }

  /**
   * Apre la modal di scansione QR.
   * Per ora monta un placeholder; verra' sostituito dalla scan vera.
   */
  async openScanModal(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ScanModalComponent,
      // Animazione bottom-up gia' default in Ionic, niente da configurare.
      // cssClass permette di stilizzare il backdrop e il container se servisse.
      cssClass: 'tq-scan-modal',
      backdropDismiss: true,
    });
    await modal.present();

    // Attendi la chiusura. Il valore data non lo usiamo ancora — sara'
    // utilizzato quando la scan modal restituira' il QR decodificato.
    const { data } = await modal.onDidDismiss();

    // TODO: gestire il risultato dello scan
    // - se data contiene un QR valido -> chiamare backend /quests/scan
    // - se la quest e' completata con successo -> navigate /giocatore/album
    //   con highlight del nuovo collectible
    // - se errore (QR non valido, GPS fuori range) -> toast di errore
    if (data) {
      // Placeholder per debugging in fase di sviluppo.
      // eslint-disable-next-line no-console
      console.log('[TabBar] scan result:', data);
    }
  }
}