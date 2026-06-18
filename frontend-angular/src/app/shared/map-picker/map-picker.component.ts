import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

@Component({
  selector: 'app-map-picker',
  standalone: true,
  imports: [CommonModule],
  template: `<div [id]="mapId" class="map-container" style="height:{{height}}px;width:100%;border-radius:12px;"></div>`,
})
export class MapPickerComponent implements OnInit, OnDestroy {
  @Input() lat = 5.0703;
  @Input() lng = -75.5138;
  @Input() height = 380;
  @Input() readonly = false;
  @Input() mapId = 'map-picker-' + Math.random().toString(36).slice(2);
  @Output() locationPicked = new EventEmitter<{ lat: number; lng: number }>();

  private map!: L.Map;
  private marker?: L.Marker;

  ngOnInit(): void {
    setTimeout(() => this.initMap(), 100);
  }

  private initMap(): void {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl: 'assets/leaflet/marker-icon.png',
      shadowUrl: 'assets/leaflet/marker-shadow.png',
    });

    this.map = L.map(this.mapId).setView([this.lat, this.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    if (this.lat && this.lng) {
      this.setMarker(this.lat, this.lng);
    }

    if (!this.readonly) {
      this.map.on('click', (e: L.LeafletMouseEvent) => {
        this.setMarker(e.latlng.lat, e.latlng.lng);
        this.locationPicked.emit({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }
  }

  private setMarker(lat: number, lng: number): void {
    if (this.marker) this.map.removeLayer(this.marker);
    const icon = L.divIcon({
      className: '',
      html: `<div style="background:#2d3ef0;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    this.marker = L.marker([lat, lng], { icon }).addTo(this.map);
  }

  addRouteMarkers(paraderos: Array<{ latitud?: number; longitud?: number; nombre?: string; orden?: number }>): void {
    paraderos.forEach((p, i) => {
      if (p.latitud == null || p.longitud == null) return;
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#2d3ef0;color:white;width:24px;height:24px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${i + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      L.marker([p.latitud, p.longitud], { icon })
        .bindPopup(`<b>${p.nombre ?? 'Paradero ' + (i + 1)}</b>`)
        .addTo(this.map);
    });

    const coords = paraderos
      .filter(p => p.latitud != null && p.longitud != null)
      .map(p => [p.latitud!, p.longitud!] as L.LatLngTuple);

    if (coords.length > 1) {
      L.polyline(coords, { color: '#2d3ef0', weight: 3, opacity: 0.8 }).addTo(this.map);
      this.map.fitBounds(L.polyline(coords).getBounds(), { padding: [30, 30] });
    } else if (coords.length === 1) {
      this.map.setView(coords[0], 14);
    }
  }

  addUserMarker(lat: number, lng: number): void {
    L.circleMarker([lat, lng], {
      radius: 12, fillColor: '#2d3ef0', color: '#ffffff',
      weight: 3, opacity: 1, fillOpacity: 0.9,
    }).addTo(this.map).bindPopup('📍 Tu ubicación actual');
    this.map.setView([lat, lng], 14);
  }

  addNearbyMarkers(paraderos: Array<{ latitud?: number; longitud?: number; nombre?: string; tipo?: string }>): void {
    paraderos.forEach(p => {
      if (p.latitud == null || p.longitud == null) return;
      L.circleMarker([p.latitud, p.longitud], {
        radius: 8, fillColor: '#ef4444', color: '#ffffff',
        weight: 2, opacity: 1, fillOpacity: 0.85,
      }).addTo(this.map).bindPopup(`<b>${p.nombre}</b><br>Tipo: ${p.tipo}`);
    });
  }

  mostrarRuta(paraderos: Array<{ nombre?: string; latitud?: number; longitud?: number; orden?: number }>): void {
    if (!this.map) return;
    this.map.eachLayer(layer => { if (!(layer instanceof L.TileLayer)) this.map.removeLayer(layer); });
    const sorted = [...paraderos]
      .filter(p => p.latitud != null && p.longitud != null)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    if (sorted.length === 0) return;
    const coords: L.LatLngTuple[] = sorted.map(p => [p.latitud!, p.longitud!]);
    L.polyline(coords, { color: '#2d3ef0', weight: 4, opacity: 0.8 }).addTo(this.map);
    sorted.forEach((p, i) => {
      const color = i === 0 ? '#22c55e' : i === sorted.length - 1 ? '#ef4444' : '#2d3ef0';
      L.circleMarker([p.latitud!, p.longitud!], {
        radius: 10, fillColor: color, color: '#fff', weight: 2, fillOpacity: 1,
      }).addTo(this.map).bindPopup(`<b>${(p.orden ?? i + 1)}. ${p.nombre}</b>`);
    });
    const avgLat = sorted.reduce((s, p) => s + p.latitud!, 0) / sorted.length;
    const avgLng = sorted.reduce((s, p) => s + p.longitud!, 0) / sorted.length;
    this.map.setView([avgLat, avgLng], 14);
  }

  panTo(lat: number, lng: number): void {
    this.map?.setView([lat, lng], 15);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
