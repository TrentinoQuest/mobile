import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { RegisterPlayerPage } from './register-player.page';

describe('RegisterPlayerPage', () => {
  let component: RegisterPlayerPage;
  let fixture: ComponentFixture<RegisterPlayerPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterPlayerPage],
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterPlayerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
