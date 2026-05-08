import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterBusinessPage } from './register-business.page';

describe('RegisterBusinessPage', () => {
  let component: RegisterBusinessPage;
  let fixture: ComponentFixture<RegisterBusinessPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RegisterBusinessPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
