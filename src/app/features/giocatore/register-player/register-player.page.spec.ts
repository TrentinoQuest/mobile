import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterPlayerPage } from './register-player.page';

describe('RegisterPlayerPage', () => {
  let component: RegisterPlayerPage;
  let fixture: ComponentFixture<RegisterPlayerPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RegisterPlayerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
