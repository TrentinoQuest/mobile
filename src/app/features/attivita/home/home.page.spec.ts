import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AttivitaHomePage } from './home.page';

describe('HomePage', () => {
  let component: AttivitaHomePage;
  let fixture: ComponentFixture<AttivitaHomePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AttivitaHomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
