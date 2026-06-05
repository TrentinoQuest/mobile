import { Component, inject, OnInit, signal } from '@angular/core';
import { AlertController, IonContent, ToastController } from '@ionic/angular/standalone';
import type { FeedActivityItem, KudosRequest } from '@trentino-quest/shared-types';
import { SocialService } from '../../../core/services/social/social.service';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import type {
  FriendRequestView,
  FriendSuggestionView,
  FriendView,
} from '../../../core/services/social/social.types';

type AmiciTab = 'attivita' | 'amici' | 'settimana';

// Gradienti avatar deterministici (palette bosco/ocra del tema).
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#5A8A3A,#2F4A1F)',
  'linear-gradient(135deg,#8E6314,#4A3416)',
  'linear-gradient(135deg,#6BA046,#2F4A1F)',
  'linear-gradient(135deg,#C8930F,#5C3E0A)',
  'linear-gradient(135deg,#5A8A3A,#2F4A1F)',
];

// Emoji selezionabili per il kudos (CLAUDE.md: beer/highfive/star).
const KUDOS_EMOJI: { id: KudosRequest['emoji']; glyph: string; label: string }[] = [
  { id: 'beer', glyph: '🍺', label: 'Offri una birra' },
  { id: 'highfive', glyph: '🙌', label: 'Batti il cinque' },
  { id: 'star', glyph: '⭐', label: 'Stella alpina' },
];

@Component({
  selector: 'app-amici',
  templateUrl: './amici.page.html',
  styleUrls: ['./amici.page.scss'],
  standalone: true,
  imports: [IonContent],
})
export class AmiciPage implements OnInit {
  private readonly socialService = inject(SocialService);
  private readonly haptics = inject(HapticsService);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);

  protected readonly activeTab = signal<AmiciTab>('attivita');

  protected readonly feed = this.socialService.feed;
  protected readonly friends = this.socialService.friends;
  protected readonly requests = this.socialService.requests;
  protected readonly suggestions = this.socialService.suggestions;
  protected readonly friendCount = this.socialService.friendCount;
  protected readonly requestCount = this.socialService.requestCount;
  protected readonly loading = this.socialService.loading;
  protected readonly error = this.socialService.error;

  protected readonly kudosEmoji = KUDOS_EMOJI;

  protected readonly tabs: { id: AmiciTab; label: () => string }[] = [
    { id: 'attivita', label: () => 'Attività' },
    { id: 'amici', label: () => `Amici · ${this.friendCount()}` },
    { id: 'settimana', label: () => 'Settimana' },
  ];

  ngOnInit(): void {
    this.socialService.loadFeed();
    this.socialService.loadSuggestions();
    this.socialService.loadFriends();
    this.socialService.loadRequests();
    this.socialService.loadNotifications();
  }

  protected setTab(tab: AmiciTab): void {
    this.haptics.light();
    this.activeTab.set(tab);
  }

  // -- Feed -------------------------------------------------------------

  /** Verbo descrittivo derivato dal tipo di attività. */
  protected verbOf(item: FeedActivityItem): string {
    return item.type === 'quest_completion' ? 'ha completato' : 'ha sbloccato';
  }

  /** Nome del luogo/collezionabile da mostrare in evidenza. */
  protected placeOf(item: FeedActivityItem): string {
    return item.questName ?? item.collectibleName ?? '';
  }

  /** Tempo relativo compatto (es. "12 MIN FA", "1 ORA FA", "IERI"). */
  protected whenOf(item: FeedActivityItem): string {
    const diffMs = Date.now() - new Date(item.timestamp).getTime();
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return 'ORA';
    if (min < 60) return `${min} MIN FA`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours} ${hours === 1 ? 'ORA' : 'ORE'} FA`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'IERI';
    return `${days} GIORNI FA`;
  }

  /** Invia un kudos con l'emoji scelta. Feedback aptico + aggiornamento locale. */
  protected sendKudos(item: FeedActivityItem, emoji: KudosRequest['emoji']): void {
    if (item.myKudos) return;
    this.haptics.success();
    this.socialService.sendKudos(item, emoji);
  }

  // -- Amici / richieste ------------------------------------------------

  protected acceptRequest(request: FriendRequestView): void {
    this.haptics.medium();
    this.socialService.acceptRequest(request);
  }

  protected rejectRequest(request: FriendRequestView): void {
    this.haptics.light();
    this.socialService.rejectRequest(request);
  }

  /** Rimuove un amico previa conferma nativa (CLAUDE.md). */
  protected removeFriend(friend: FriendView): void {
    const ok = window.confirm(`Vuoi rimuovere ${friend.username} dai tuoi amici?`);
    if (!ok) return;
    this.haptics.warning();
    this.socialService.removeFriend(friend);
  }

  // -- Suggerimenti -----------------------------------------------------

  protected async addSuggestion(suggestion: FriendSuggestionView): Promise<void> {
    this.haptics.medium();
    const ok = await this.socialService.sendFriendRequest(suggestion);
    await this.presentToast(
      ok ? `Richiesta inviata a ${suggestion.username}` : 'Impossibile inviare la richiesta',
    );
  }

  /** Apre il dialog per aggiungere un amico cercandolo per nickname. */
  protected async openAddFriend(): Promise<void> {
    this.haptics.light();
    const alert = await this.alertCtrl.create({
      header: 'Aggiungi un amico',
      message: 'Inserisci il nickname della persona da invitare.',
      inputs: [
        {
          name: 'username',
          type: 'text',
          placeholder: 'Nickname',
          attributes: { autocapitalize: 'off', autocorrect: 'off' },
        },
      ],
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Invia richiesta',
          handler: (data: { username?: string }) => {
            const username = (data.username ?? '').trim();
            if (!username) return false;
            void this.submitAddFriend(username);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async submitAddFriend(username: string): Promise<void> {
    const ok = await this.socialService.sendFriendRequestByUsername(username);
    if (ok) this.haptics.success();
    await this.presentToast(
      ok ? `Richiesta inviata a ${username}` : 'Nessun utente trovato con questo nickname',
    );
  }

  // -- Avatar -----------------------------------------------------------

  /** Gradiente avatar deterministico a partire da una chiave (id/username). */
  protected avatarGradient(key: string): string {
    return AVATAR_GRADIENTS[this.seedOf(key) % AVATAR_GRADIENTS.length];
  }

  /** Iniziale maiuscola per l'avatar testuale. */
  protected initial(username: string): string {
    return username.charAt(0).toUpperCase();
  }

  /** Hash deterministico stabile di una stringa in un intero non negativo. */
  private seedOf(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  private async presentToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2200,
      position: 'bottom',
      cssClass: 'tq-toast',
    });
    await toast.present();
  }
}
