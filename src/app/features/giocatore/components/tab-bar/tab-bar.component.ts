import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { mapOutline, imagesOutline, peopleOutline, personOutline, qrCode } from 'ionicons/icons';
import { ScanModalComponent } from '../scan-modal/scan-modal.component';

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
    addIcons({ mapOutline, imagesOutline, peopleOutline, personOutline, qrCode });
  }

  async openScanModal(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ScanModalComponent,
      cssClass: 'tq-scan-modal',
      backdropDismiss: false, // L'utente deve usare i bottoni interni
    });
    await modal.present();
    // La navigazione all'album in caso di successo avviene dentro ScanModalComponent
    await modal.onDidDismiss();
  }
}
