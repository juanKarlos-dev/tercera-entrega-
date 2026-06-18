import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Zona {
  id: number;
  nombre: string;
}

const unwrap = (r: any) => Array.isArray(r) ? r : (r.data ?? r);

@Injectable({ providedIn: 'root' })
export class ZonasService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/zonas`;

  list(): Observable<Zona[]> {
    return this.http.get<any>(this.base).pipe(map(unwrap));
  }
}
