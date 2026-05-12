import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-register-business',
  templateUrl: './register-business.page.html',
  styleUrls: ['./register-business.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule],
})
export class RegisterBusinessPage implements OnInit {
  constructor() {}

  ngOnInit() {
    return;
  }
}
