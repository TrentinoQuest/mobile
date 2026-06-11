import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner';
import type { ScanQrResponse } from '@trentino-quest/shared-types';
import { GeolocationService } from '../geolocation/geolocation.service';
import { QuestService } from '../quest/quest.service';
import { extractErrorCode } from '../../utils/http-error';

export interface ScanError {
  code: string;
  message: string;
}

/**
 * Service di scansione QR.
 *
 * Incapsula il flusso completo:
 *   1. Apertura scanner nativo Capacitor
 *   2. Il contenuto del QR è il qrToken grezzo (stringa pura, non JSON)
 *   3. Lettura posizione GPS dal GeolocationService
 *   4. Delega a QuestService.scan() per POST /quests/{questId}/scan
 *      (il service arricchisce il body col fix anti-cheat e aggiorna
 *      automaticamente il signal dei completamenti)
 *
 * Il questId viene passato dal chiamante (popup della quest aperta),
 * non è deducibile dal QR da solo.
 */
@Injectable({ providedIn: 'root' })
export class ScanService {
  private readonly questService = inject(QuestService);
  private readonly geoService = inject(GeolocationService);

  private readonly ERROR_MESSAGES: Record<string, string> = {
    INVALID_QR_TOKEN: 'QR code non valido. Non appartiene a Trentino Quest.',
    QUEST_ALREADY_COMPLETED: 'Hai già completato questa quest.',
    OUT_OF_VALIDATION_RADIUS: 'Sei troppo lontano dal QR code.',
    QR_QUEST_MISMATCH: 'QR code non riconosciuto.',
    QR_EXPIRED: "Il QR e' scaduto o e' stato sostituito.",
    QUEST_NOT_PLACED: 'Quest non ancora disponibile sul territorio.',
    COLLECTIBLE_MISSING: 'Errore di configurazione della quest.',
    OUT_OF_RANGE_ACCURACY: 'GPS troppo impreciso. Spostati in uno spazio aperto.',
    STALE_FIX: 'Fix GPS scaduto. Attendi un aggiornamento della posizione.',
    GPS_UNAVAILABLE: 'Posizione GPS non disponibile. Verifica che il GPS sia attivo.',
  };

  /**
   * Avvia la scansione e invia il risultato al backend.
   *
   * @param questId ID della quest (da passare dal popup — non deducibile dal QR)
   * @throws ScanError in tutti i casi di fallimento
   * @throws { code: 'CANCELLED' } se l'utente chiude lo scanner senza scansionare
   */
  async scanAndSubmit(questId: string): Promise<ScanQrResponse> {
    const result = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
    });

    // Stringa vuota = utente ha annullato (comportamento Capacitor)
    if (!result.ScanResult) {
      throw { code: 'CANCELLED', message: '' } satisfies ScanError;
    }

    // Il QR contiene il token grezzo (non un JSON strutturato)
    const qrToken = result.ScanResult.trim();
    if (!qrToken) {
      throw {
        code: 'INVALID_QR_TOKEN',
        message: this.ERROR_MESSAGES['INVALID_QR_TOKEN'],
      } satisfies ScanError;
    }

    const position = this.geoService.position();
    if (!position) {
      throw {
        code: 'GPS_UNAVAILABLE',
        message: this.ERROR_MESSAGES['GPS_UNAVAILABLE'],
      } satisfies ScanError;
    }

    return firstValueFrom(
      this.questService.scan(questId, {
        qrToken,
        position: { lat: position.lat, lng: position.lng },
      }),
    ).catch((err: unknown) => {
      const code = extractErrorCode(err);
      const message =
        (code && this.ERROR_MESSAGES[code]) ?? 'Errore durante la scansione. Riprova.';
      throw { code: code ?? 'UNKNOWN', message } satisfies ScanError;
    });
  }
}
