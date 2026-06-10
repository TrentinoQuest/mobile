import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { ProfiloPage } from './profilo.page';
import { MOCK_REPOSITORY_PROVIDERS } from '../../../../testing/mock-repositories';

describe('ProfiloPage', () => {
  let component: ProfiloPage;
  let fixture: ComponentFixture<ProfiloPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfiloPage],
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...MOCK_REPOSITORY_PROVIDERS,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfiloPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
