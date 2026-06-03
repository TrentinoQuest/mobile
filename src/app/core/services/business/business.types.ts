// Tipi di dominio per il modulo Attività Locale.
// Business e Offer non sono ancora in @trentino-quest/shared-types: definiti qui
// localmente allineati allo schema OpenAPI (componenti/schemas Business, Offer, ecc.)

export type BusinessApprovalStatus = 'pending' | 'approved' | 'rejected';

export type BusinessType = 'restaurant' | 'museum' | 'farm_stay' | 'mountain_hut' | 'other';

export type OfferStatus = 'active' | 'archived';

export interface Business {
  id: string;
  email: string;
  role: 'business';
  businessName: string;
  businessType: BusinessType;
  address: string;
  position: { lat: number; lng: number };
  approvalStatus: BusinessApprovalStatus;
  createdAt: string;
}

export interface Offer {
  id: string;
  businessId: string;
  title: string;
  description: string;
  pointsCost: number;
  status: OfferStatus;
  createdAt: string;
}

export interface UpdateBusinessProfileRequest {
  businessName?: string;
  businessType?: BusinessType;
  address?: string;
}

export interface CreateOfferRequest {
  title: string;
  description: string;
  pointsCost: number;
}

export interface UpdateOfferRequest {
  title?: string;
  description?: string;
  pointsCost?: number;
}

export interface RegisterBusinessRequest {
  email: string;
  password: string;
  businessName: string;
  businessType: BusinessType;
  address: string;
  position: { lat: number; lng: number };
}

/** Mappa BusinessType -> etichetta italiana per la UI. */
export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  restaurant: 'Ristorante',
  museum: 'Museo',
  farm_stay: 'Agriturismo',
  mountain_hut: 'Rifugio',
  other: 'Altro',
};
