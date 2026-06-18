import { Injectable, signal, computed } from '@angular/core';
import { Empresa, Conductor } from '../models/negocio.models';

const EMPRESA_KEY   = 'negocio_empresa_activa';
const CONDUCTOR_KEY = 'negocio_conductor_activo';

@Injectable({ providedIn: 'root' })
export class ContextService {
  private readonly _empresa   = signal<Empresa | null>(this.readStored(EMPRESA_KEY));
  private readonly _conductor = signal<Conductor | null>(this.readStored(CONDUCTOR_KEY));

  readonly empresa   = this._empresa.asReadonly();
  readonly conductor = this._conductor.asReadonly();

  readonly empresaId   = computed(() => this._empresa()?.id   ?? null);
  readonly conductorId = computed(() => this._conductor()?.id ?? null);

  setEmpresa(empresa: Empresa | null): void {
    this._empresa.set(empresa);
    if (empresa) {
      localStorage.setItem(EMPRESA_KEY, JSON.stringify(empresa));
    } else {
      localStorage.removeItem(EMPRESA_KEY);
    }
  }

  setConductor(conductor: Conductor | null): void {
    this._conductor.set(conductor);
    if (conductor) {
      localStorage.setItem(CONDUCTOR_KEY, JSON.stringify(conductor));
    } else {
      localStorage.removeItem(CONDUCTOR_KEY);
    }
  }

  private readStored<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
}
