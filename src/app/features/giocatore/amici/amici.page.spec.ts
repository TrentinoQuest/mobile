import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AmiciPage } from './amici.page';

describe('AmiciPage', () => {
  let component: AmiciPage;
  let fixture: ComponentFixture<AmiciPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AmiciPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
