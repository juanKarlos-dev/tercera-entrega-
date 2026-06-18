import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class RecaptchaService {
  private scriptPromise: Promise<void> | null = null;

  isConfigured(): boolean {
    return !!environment.recaptchaSiteKey?.trim();
  }

  loadScript(): Promise<void> {
    if (!this.isConfigured()) {
      return Promise.reject(new Error('reCAPTCHA no configurado'));
    }
    if (this.scriptPromise) {
      return this.scriptPromise;
    }
    this.scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-recaptcha="v3"]');
      if (existing) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = `https://www.google.com/recaptcha/api.js?render=${environment.recaptchaSiteKey}`;
      s.async = true;
      s.defer = true;
      s.setAttribute('data-recaptcha', 'v3');
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('No se pudo cargar reCAPTCHA'));
      document.head.appendChild(s);
    });
    return this.scriptPromise;
  }

  async execute(action: string): Promise<string> {
    await this.loadScript();
    const siteKey = environment.recaptchaSiteKey;
    return new Promise((resolve, reject) => {
      if (!window.grecaptcha) {
        reject(new Error('grecaptcha no disponible'));
        return;
      }
      window.grecaptcha.ready(() => {
        window.grecaptcha!
          .execute(siteKey, { action })
          .then(resolve)
          .catch(reject);
      });
    });
  }
}
