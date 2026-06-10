import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { AttivitaHomePage } from './home.page';
import { MOCK_REPOSITORY_PROVIDERS } from '../../../../testing/mock-repositories';

describe('AttivitaHomePage', () => {
  let component: AttivitaHomePage;
  let fixture: ComponentFixture<AttivitaHomePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttivitaHomePage],
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...MOCK_REPOSITORY_PROVIDERS,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AttivitaHomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
