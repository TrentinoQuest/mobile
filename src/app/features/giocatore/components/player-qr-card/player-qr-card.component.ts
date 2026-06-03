import { Component, ElementRef, OnChanges, ViewChild, input } from '@angular/core';
import QRCode from 'qrcode';

@Component({
  selector: 'app-player-qr-card',
  templateUrl: './player-qr-card.component.html',
  styleUrls: ['./player-qr-card.component.scss'],
  standalone: true,
  imports: [],
})
export class PlayerQrCardComponent implements OnChanges {
  @ViewChild('qrCanvas', { static: true }) private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly playerId = input.required<string>();

  ngOnChanges(): void {
    void this.renderQr();
  }

  private async renderQr(): Promise<void> {
    const id = this.playerId();
    if (!id || !this.canvasRef?.nativeElement) return;

    await QRCode.toCanvas(this.canvasRef.nativeElement, id, {
      width: 200,
      margin: 1,
      color: {
        dark: '#1a1815',
        light: '#f4ebdc',
      },
      errorCorrectionLevel: 'M',
    });
  }
}
