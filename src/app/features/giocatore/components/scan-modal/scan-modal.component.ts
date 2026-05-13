import { Component, inject } from '@angular/core';
import { IonContent, IonButton, ModalController } from '@ionic/angular/standalone';

/**
 * Modal placeholder per la scansione QR.
 *
 * NATURA TEMPORANEA: questo componente serve solo a testare il flusso di
 * apertura/chiusura della modal lanciata dal FAB centrale della tab bar.
 * Verra' interamente sostituito dalla modal di scansione vera quando
 * svilupperemo l'integrazione con la camera Capacitor + libreria di
 * decoding QR + validazione GPS lato backend.
 *
 * Quando si rimuove:
 * 1. Cancellare l'intera cartella scan-modal-placeholder/
 * 2. Sostituire l'import in tab-bar.component.ts con il componente vero
 * 3. Rivedere la gestione del valore di ritorno in TabBarComponent.openScanModal()
 *
 * Il componente e' standalone e si auto-dismissa al click del bottone.
 */
@Component({
  selector: 'app-scan-modal',
  templateUrl: './scan-modal.component.html',
  styleUrls: ['./scan-modal.component.scss'],
  standalone: true,
  imports: [IonContent, IonButton],
})
export class ScanModalComponent {
  private readonly modalCtrl = inject(ModalController);

  /**
   * Chiude la modal senza restituire dati.
   * Quando avremo lo scan vero, qui passeremo il QR code decodificato
   * a modalCtrl.dismiss(qrPayload).
   */
  async dismiss(): Promise<void> {
    await this.modalCtrl.dismiss();
  }
}
