import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly enabled = Capacitor.isNativePlatform();

  // Tap leggero — selezione, navigazione tab, scroll snap
  async tapLight(): Promise<void> {
    if (!this.enabled) return;
    await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  }

  // Tap medio — tap bottone secondario, apertura card
  async tapMedium(): Promise<void> {
    if (!this.enabled) return;
    await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
  }

  // Tap pesante — tap bottone primario, conferma importante
  async tapHeavy(): Promise<void> {
    if (!this.enabled) return;
    await Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
  }

  // Successo — completamento quest, sblocco, level up
  async success(): Promise<void> {
    if (!this.enabled) return;
    await Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
  }

  // Errore — validazione fallita, posizione errata, azione negata
  async error(): Promise<void> {
    if (!this.enabled) return;
    await Haptics.notification({ type: NotificationType.Error }).catch(() => undefined);
  }

  // Attenzione — warning, nudge, scadenza imminente
  async warning(): Promise<void> {
    if (!this.enabled) return;
    await Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined);
  }

  // Sblocco collezionabile — pattern ricco celebrativo
  async collectibleUnlock(): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    await this.delay(80);
    await Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
    await this.delay(60);
    await Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
  }

  // Level up — pattern lungo e progressivo
  async levelUp(): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    await this.delay(100);
    await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    await this.delay(80);
    await Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
    await this.delay(60);
    await Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
  }

  // Streak milestone — pesante e deciso
  async streakMilestone(): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
    await this.delay(120);
    await Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
  }

  // Timbro (onboarding, momento WOW) — impatto secco
  async stamp(): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
    await this.delay(40);
    await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  }

  // Prossimità warm — battito lento (chiamato ogni poll, non in loop)
  async proximityWarm(): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  }

  // Prossimità hot — doppio battito (chiamato ogni poll)
  async proximityHot(): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    await this.delay(80);
    await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
  }

  // Prossimità burning — triplo intenso (chiamato ogni poll)
  async proximityBurning(): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
    await this.delay(60);
    await Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
    await this.delay(60);
    await Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
  }

  // Kudos inviato — leggero e brioso
  async kudosSent(): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    await this.delay(60);
    await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
  }

  // Flip card taccuino
  async cardFlip(): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  }

  // Acquisto coupon confermato
  async purchase(): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    await this.delay(100);
    await Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
  }

  // Rimozione / rifiuto (amico rimosso, richiesta rifiutata)
  async dismiss(): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    await this.delay(60);
    await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  }

  // Alias backward-compat (usati dai componenti non ancora ridisegnati)
  light(): void { void this.tapLight(); }
  medium(): void { void this.tapMedium(); }
  heavy(): void { void this.tapHeavy(); }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
