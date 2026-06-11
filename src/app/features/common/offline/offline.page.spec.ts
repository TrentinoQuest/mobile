import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { OfflinePage } from './offline.page';

describe('OfflinePage', () => {
  let component: OfflinePage;
  let fixture: ComponentFixture<OfflinePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OfflinePage],
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OfflinePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
