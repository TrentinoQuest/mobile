import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { ScanModalComponent } from './scan-modal.component';
import { MOCK_REPOSITORY_PROVIDERS } from '../../../../../testing/mock-repositories';

describe('ScanModalComponent', () => {
  let component: ScanModalComponent;
  let fixture: ComponentFixture<ScanModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScanModalComponent],
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...MOCK_REPOSITORY_PROVIDERS,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ScanModalComponent);
    component = fixture.componentInstance;
    // Senza questId il componente entra in stato 'no-context' e non apre
    // lo scanner nativo (non disponibile nei test browser).
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
