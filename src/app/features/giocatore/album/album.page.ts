import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';

/**
 * Album — Tab 2 della sezione giocatore.
 *
 * STUB: pagina placeholder navigabile. La versione vera mostrera' la
 * collezione completa dei collectibles (sbloccati + da scoprire) con
 * filtri per categoria, zona, rarita'.
 *
 * TODO: implementare in chat dedicata. Riferimento design: home-album.jsx
 * e screens-album.jsx nei file di progetto.
 */
@Component({
  selector: 'app-album',
  templateUrl: './album.page.html',
  styleUrls: ['./album.page.scss'],
  standalone: true,
  imports: [IonContent],
})
export class AlbumPage {}
