import { Component, computed, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonSkeletonText } from '@ionic/angular/standalone';
import { TqButtonComponent } from '../../../shared/components/tq-button/tq-button.component';
import { addIcons } from 'ionicons';
import { pricetagsOutline, arrowForwardOutline } from 'ionicons/icons';
import { BusinessService } from '../../../core/services/business/business.service';
import { BUSINESS_TYPE_LABEL, OfferStatus } from '../../../core/services/business/business.types';

/**
 * HomePage — dashboard principale dell'attività locale approvata.
 *
 * Mostra: nome attività, tipo, indirizzo, numero offerte attive,
 * e un pulsante rapido verso la gestione offerte.
 */
@Component({
  selector: 'app-attivita-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, IonSkeletonText, TqButtonComponent],
})
export class AttivitaHomePage implements OnInit {
  protected readonly businessService = inject(BusinessService);
  private readonly router = inject(Router);

  protected readonly businessTypeLabel = computed(() => {
    const type = this.businessService.profile()?.businessType;
    return type ? BUSINESS_TYPE_LABEL[type] : '';
  });

  protected readonly activeOffersCount = computed(
    () => this.businessService.offers().filter((o) => o.status === OfferStatus.ACTIVE).length,
  );

  constructor() {
    addIcons({ pricetagsOutline, arrowForwardOutline });
  }

  ngOnInit(): void {
    this.businessService.loadProfile();
    this.businessService.loadOffers();
  }

  navigateToOfferte(): void {
    this.router.navigate(['/attivita/offerte']);
  }
}
