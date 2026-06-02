import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner';
import type { ScanQrResponse } from '@trentino-quest/shared-types';
import { GeolocationService } from '../geolocation/geolocation.service';
import { environment } from '../../../../environments/environment';

export interface ScanError {
  code: string;
  message: string;
}

interface QrPayload {
  questId: string;
  token: string;
}

/**
 * Service di scansione QR.
 *
 * Incapsula il flusso completo:
 *   1. Apertura scanner nativo Capacitor
 *   2. Parsing del payload JSON nel QR
 *   3. Lettura posizione GPS dal GeolocationService
 *   4. Chiamata POST /quests/{id}/scan con token + fix GPS
 *
 * Formato atteso del contenuto QR:
 *   {"questId":"<mongoId>","token":"qr_<32hex>"}
 */
@Injectable({ providedIn: 'root' })
export class ScanService {
  private readonly http = inject(HttpClient);
  private readonly geoService = inject(GeolocationService);

  private readonly ERROR_MESSAGES: Record<string, string> = {
    INVALID_QR_TOKEN: 'QR code non valido. Non appartiene a Trentino Quest.',
    QUEST_ALREADY_COMPLETED: 'Hai già completato questa quest.',
    OUT_OF_VALIDATION_RADIUS: 'Sei troppo lontano dal QR code.',
    QR_QUEST_MISMATCH: 'QR code non riconosciuto.',
    QUEST_NOT_PLACED: 'Quest non ancora disponibile sul territorio.',
    COLLECTIBLE_MISSING: 'Errore di configurazione della quest.',
    OUT_OF_RANGE_ACCURACY: 'GPS troppo impreciso. Spostati in uno spazio aperto.',
    STALE_FIX: 'Fix GPS scaduto. Attendi un aggiornamento della posizione.',
    GPS_UNAVAILABLE: 'Posizione GPS non disponibile. Verifica che il GPS sia attivo.',
  };

  /**
   * Avvia la scansione e invia il risultato al backend.
   * Lancia ScanError in tutti i casi di fallimento.
   * Lancia { code: 'CANCELLED' } se l'utente chiude lo scanner senza scansionare.
   */
  async scanAndSubmit(): Promise<ScanQrResponse> {
    const result = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
    });

    // Stringa vuota = utente ha annullato (comportamento Capacitor)
    if (!result.ScanResult) {
      throw { code: 'CANCELLED', message: '' } satisfies ScanError;
    }

    const payload = this.parseQrPayload(result.ScanResult);
    if (!payload) {
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
      this.http.post<ScanQrResponse>(`${environment.apiUrl}/quests/${payload.questId}/scan`, {
        qrToken: payload.token,
        position: { lat: position.lat, lng: position.lng },
        fix: { accuracy: position.accuracy, clientTimestamp: position.clientTimestamp },
      }),
    ).catch((err: unknown) => {
      const code = (err as { error?: { error?: { code?: string } } })?.error?.error?.code;
      const message =
        (code && this.ERROR_MESSAGES[code]) ?? 'Errore durante la scansione. Riprova.';
      throw { code: code ?? 'UNKNOWN', message } satisfies ScanError;
    });
  }

  private parseQrPayload(raw: string): QrPayload | null {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof (parsed as Record<string, unknown>)['questId'] === 'string' &&
        typeof (parsed as Record<string, unknown>)['token'] === 'string'
      ) {
        return {
          questId: (parsed as Record<string, string>)['questId'],
          token: (parsed as Record<string, string>)['token'],
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}
