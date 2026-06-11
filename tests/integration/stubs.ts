/**
 * Stub dei controller Ionic e dei servizi "nativi" (haptics/audio) per i test
 * dei componenti pagina.
 *
 * I componenti contengono la logica HTTP delle feature (social, shop, coop,
 * album…) ma orchestrano anche feedback UI: alert di conferma, toast,
 * action sheet, vibrazione, audio. Nei test sostituiamo questi controller con
 * stub deterministici, così possiamo guidare i flussi reali (incluse le
 * conferme utente) senza un browser e senza plugin Capacitor.
 */
import { Provider } from '@angular/core';
import {
  ActionSheetController,
  AlertController,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { HapticsService } from '../../src/app/core/services/haptics/haptics.service';
import { AudioService } from '../../src/app/core/services/audio.service';

/** Proxy che risponde no-op (Promise risolta) a qualunque metodo chiamato. */
function noopServiceProxy<T>(): T {
  return new Proxy(
    {},
    {
      get: () => () => Promise.resolve(),
    },
  ) as T;
}

interface AlertButton {
  text?: string;
  role?: string;
  handler?: (value?: unknown) => void;
}

/**
 * AlertController che, alla `present()`, simula l'utente che conferma:
 * invoca automaticamente l'handler del primo bottone non-"cancel".
 */
class AutoConfirmAlertController {
  lastButtons: AlertButton[] = [];
  async create(opts: { buttons?: (AlertButton | string)[] }) {
    const buttons = (opts.buttons ?? []).filter(
      (b): b is AlertButton => typeof b === 'object',
    );
    this.lastButtons = buttons;
    return {
      present: async () => {
        const confirm = buttons.find((b) => b.role !== 'cancel' && typeof b.handler === 'function');
        confirm?.handler?.();
      },
      dismiss: async () => undefined,
    };
  }
}

interface SheetButton {
  text?: string;
  role?: string;
  handler?: () => void;
}

/**
 * ActionSheetController che invoca l'handler di un bottone scelto per testo
 * (default: il primo bottone non-cancel). Configurabile per test specifici.
 */
class AutoPickActionSheetController {
  pickByText: string | null = null;
  async create(opts: { buttons?: SheetButton[] }) {
    const buttons = opts.buttons ?? [];
    return {
      present: async () => {
        const chosen = this.pickByText
          ? buttons.find((b) => b.text?.includes(this.pickByText!))
          : buttons.find((b) => b.role !== 'cancel' && typeof b.handler === 'function');
        chosen?.handler?.();
      },
      dismiss: async () => undefined,
    };
  }
}

class NoopToastController {
  async create() {
    return { present: async () => undefined, dismiss: async () => undefined };
  }
}

class NoopModalController {
  async create() {
    return {
      present: async () => undefined,
      dismiss: async () => undefined,
      onDidDismiss: async () => ({ data: undefined }),
    };
  }
}

class StubRouter {
  navigate = () => Promise.resolve(true);
  navigateByUrl = () => Promise.resolve(true);
}

/**
 * Provider di stub UI da aggiungere al TestBed per i test dei componenti.
 * Espone le istanze per poterle configurare (es. cambiare la scelta
 * dell'action sheet) all'interno del singolo test.
 */
export function uiStubProviders(): {
  providers: Provider[];
  alert: AutoConfirmAlertController;
  actionSheet: AutoPickActionSheetController;
} {
  const alert = new AutoConfirmAlertController();
  const actionSheet = new AutoPickActionSheetController();
  return {
    alert,
    actionSheet,
    providers: [
      { provide: AlertController, useValue: alert },
      { provide: ActionSheetController, useValue: actionSheet },
      { provide: ToastController, useValue: new NoopToastController() },
      { provide: ModalController, useValue: new NoopModalController() },
      { provide: Router, useValue: new StubRouter() },
      { provide: HapticsService, useValue: noopServiceProxy<HapticsService>() },
      { provide: AudioService, useValue: noopServiceProxy<AudioService>() },
    ],
  };
}
