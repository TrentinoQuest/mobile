import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * HapticsService — feedback tattile centralizzato.
 *
 * Wrappa @capacitor/haptics con un'API espressiva e semantica: i componenti
 * non chiamano impact/notification grezzi ma intent ("tap", "success",
 * "unlock"...), cosi' il "linguaggio aptico" del gioco resta coerente e
 * regolabile da un solo punto.
 *
 * Sicurezza piattaforma:
 * - Su web i metodi nativi sono no-op o lanciano: tutto e' guardato da
 *   isNativePlatform() + try/catch, mai un errore propagato al chiamante.
 * - Tutti i metodi sono fire-and-forget (void): l'UI non deve mai attendere
 *   il feedback aptico.
 *
 * "Dinamico": oltre agli intent fissi, `dynamic(intensity)` modula la
 * vibrazione in base a un valore 0..1 (es. piu' sei vicino a una quest,
 * piu' forte il tap). Usato per la prossimita' sulla mappa.
 */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly enabled = Capacitor.isNativePlatform();

  // -- Impatti base -----------------------------------------------------

  /** Tap leggero: selezione, tab, toggle, apertura di un elemento. */
  light(): void {
    this.impact(ImpactStyle.Light);
  }

  /** Tap medio: conferma di un'azione, CTA premuta. */
  medium(): void {
    this.impact(ImpactStyle.Medium);
  }

  /** Tap forte: evento importante, sblocco, errore "fisico". */
  heavy(): void {
    this.impact(ImpactStyle.Heavy);
  }

  // -- Notifiche semantiche --------------------------------------------

  /** Successo: check-in riuscito, quest completata. */
  success(): void {
    this.notify(NotificationType.Success);
  }

  /** Avviso: sei entrato in un'area, attenzione. */
  warning(): void {
    this.notify(NotificationType.Warning);
  }

  /** Errore: azione fallita, fuori range. */
  error(): void {
    this.notify(NotificationType.Error);
  }

  // -- Intent di gioco --------------------------------------------------

  /**
   * Sblocco collezionabile: pattern "celebrativo" — un colpo forte seguito
   * da un eco leggero. L'eco e' schedulato, non bloccante.
   */
  unlock(): void {
    this.heavy();
    setTimeout(() => this.light(), 90);
    setTimeout(() => this.success(), 180);
  }

  /** Selezione discreta in liste/carousel. */
  selection(): void {
    if (!this.enabled) return;
    void Haptics.selectionChanged().catch(() => undefined);
  }

  /**
   * Feedback dinamico modulato 0..1. Sotto 0.34 → light, sotto 0.67 → medium,
   * altrimenti heavy. Permette curve di intensita' (es. avvicinamento quest).
   */
  dynamic(intensity: number): void {
    const clamped = Math.max(0, Math.min(1, intensity));
    if (clamped < 0.34) this.light();
    else if (clamped < 0.67) this.medium();
    else this.heavy();
  }

  // -- Implementazione --------------------------------------------------

  private impact(style: ImpactStyle): void {
    if (!this.enabled) return;
    void Haptics.impact({ style }).catch(() => undefined);
  }

  private notify(type: NotificationType): void {
    if (!this.enabled) return;
    void Haptics.notification({ type }).catch(() => undefined);
  }
}
