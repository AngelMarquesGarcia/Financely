import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { QuickCreateMovementButtonComponent } from '../quick-create-movement-button/quick-create-movement-button.component';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, QuickCreateMovementButtonComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {}
