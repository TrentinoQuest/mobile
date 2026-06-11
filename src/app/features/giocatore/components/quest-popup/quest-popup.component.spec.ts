import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { QuestPopupComponent } from './quest-popup.component';
import { MOCK_REPOSITORY_PROVIDERS } from '../../../../../testing/mock-repositories';

describe('QuestPopupComponent', () => {
  let component: QuestPopupComponent;
  let fixture: ComponentFixture<QuestPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestPopupComponent],
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...MOCK_REPOSITORY_PROVIDERS,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuestPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
