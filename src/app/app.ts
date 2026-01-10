import { Component, signal, OnInit } from '@angular/core';
import { Calculator } from './calculator/calculator';
import { ReportPreviewComponent } from './report-preview/report-preview';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Component({
  selector: 'app-root',
  imports: [Calculator, ReportPreviewComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('investment-calculator');
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  showInstallPrompt = signal(false);

  ngOnInit() {
    // Listen for PWA install prompt
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.showInstallPrompt.set(true);
    });

    // Check if already installed
    window.addEventListener('appinstalled', () => {
      this.showInstallPrompt.set(false);
      console.log('PWA was installed');
    });
  }

  async installPWA() {
    if (!this.deferredPrompt) {
      return;
    }

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }

    this.deferredPrompt = null;
    this.showInstallPrompt.set(false);
  }

  dismissInstallPrompt() {
    this.showInstallPrompt.set(false);
  }
}
