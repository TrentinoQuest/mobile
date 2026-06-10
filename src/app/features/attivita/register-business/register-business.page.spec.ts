import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { RegisterBusinessPage } from './register-business.page';

describe('RegisterBusinessPage', () => {
  let component: RegisterBusinessPage;
  let fixture: ComponentFixture<RegisterBusinessPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterBusinessPage],
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterBusinessPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
