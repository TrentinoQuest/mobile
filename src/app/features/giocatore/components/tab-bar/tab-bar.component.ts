import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { mapOutline, bookOutline, trophyOutline, personOutline, qrCode } from 'ionicons/icons';
import { QuestType } from '@trentino-quest/shared-types';
import type { PrimaryQuest } from '@trentino-quest/shared-types';
import { QuestService } from '../../../../core/services/quest/quest.service';
import { GeolocationService } from '../../../../core/services/geolocation/geolocation.service';
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
  private readonly questService = inject(QuestService);
  private readonly geoService = inject(GeolocationService);

  constructor() {
    addIcons({ mapOutline, bookOutline, trophyOutline, personOutline, qrCode });
  }

  async openScanModal(): Promise<void> {
    const questId = this.findNearestAvailablePrimaryQuestId();
    const modal = await this.modalCtrl.create({
      component: ScanModalComponent,
      cssClass: 'tq-scan-modal',
      backdropDismiss: false,
      componentProps: { questId },
    });
    await modal.present();
    await modal.onDidDismiss();
  }

  /**
   * Cerca la quest primaria disponibile più vicina all'utente.
   * Usa searchRadiusMeters come soglia: se l'utente è dentro l'area
   * di ricerca del QR, seleziona quella quest automaticamente.
   * Restituisce null se nessuna quest è in range (mostra no-context).
   */
  private findNearestAvailablePrimaryQuestId(): string | null {
    const pos = this.geoService.position();
    if (!pos) return null;

    const candidates = this.questService
      .primaryQuests()
      .filter(
        (q: PrimaryQuest) =>
          q.collectibleId !== null && this.questService.playerStatusOf(q.id) === 'available',
      )
      .map((q: PrimaryQuest) => ({
        id: q.id,
        dist: haversineMeters(pos.lat, pos.lng, q.searchArea.lat, q.searchArea.lng),
        radius: q.searchRadiusMeters,
      }))
      .filter((c) => c.dist <= c.radius)
      .sort((a, b) => a.dist - b.dist);

    return candidates[0]?.id ?? null;
  }
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
