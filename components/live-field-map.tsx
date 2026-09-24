"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, LocateFixed, MapPin, Navigation, WifiOff } from "lucide-react";
import { useLanguage } from "@/components/language-provider";

export type FieldTask = {
  id: string;
  title: string;
  address: string;
  city_village: string;
  latitude: number;
  longitude: number;
  status: "assigned" | "in_progress" | "completed" | "cancelled";
  notes: string | null;
  due_date: string | null;
};

export type VisitMarker = {
  id: string;
  latitude: number;
  longitude: number;
  address: string | null;
  status: string;
  completed_at: string;
};

export function LiveFieldMap({ tasks, visits, onSelectTask }: { tasks: FieldTask[]; visits: VisitMarker[]; onSelectTask: (task: FieldTask) => void }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const layerRef = useRef<unknown>(null);
  const locationLayerRef = useRef<unknown>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selected, setSelected] = useState<FieldTask | null>(null);
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [locating, setLocating] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const online = () => setOffline(false);
    const offlineHandler = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offlineHandler);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offlineHandler);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((leaflet) => {
      if (cancelled || !elementRef.current || mapRef.current) return;
      const map = leaflet.map(elementRef.current, { zoomControl: true }).setView([44.0165, 21.0059], 7);
      leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = leaflet.layerGroup().addTo(map);
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      const map = mapRef.current as { remove?: () => void } | null;
      map?.remove?.();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    let cancelled = false;
    void import("leaflet").then((leaflet) => {
      if (cancelled) return;
      const map = mapRef.current as ReturnType<typeof leaflet.map>;
      const layer = layerRef.current as ReturnType<typeof leaflet.layerGroup>;
      layer.clearLayers();
      const coordinates: [number, number][] = [];
      for (const task of tasks) {
        const point: [number, number] = [task.latitude, task.longitude];
        coordinates.push(point);
        const marker = leaflet.marker(point, {
          icon: leaflet.divIcon({
            className: "task-marker-shell",
            html: `<span class="task-marker ${task.status}"></span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
        }).addTo(layer);
        marker.bindTooltip(`${task.title} · ${task.address}`, { direction: "top" });
        marker.on("click", () => setSelected(task));
      }
      for (const visit of visits) {
        const point: [number, number] = [visit.latitude, visit.longitude];
        coordinates.push(point);
        leaflet.circleMarker(point, { radius: 6, color: "#fff", weight: 2, fillColor: "#397968", fillOpacity: .9 })
          .bindTooltip(visit.address || t("Zabeležena poseta", "Recorded visit"))
          .addTo(layer);
      }
      if (coordinates.length) map.fitBounds(leaflet.latLngBounds(coordinates), { padding: [38, 38], maxZoom: 15 });
    });
    return () => { cancelled = true; };
  }, [tasks, visits, t, mapReady]);

  const locateUser = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const leaflet = await import("leaflet");
      const map = mapRef.current as ReturnType<typeof leaflet.map> | null;
      if (!map) return setLocating(false);
      const oldLayer = locationLayerRef.current as { remove?: () => void } | null;
      oldLayer?.remove?.();
      const group = leaflet.layerGroup().addTo(map);
      leaflet.circle([coords.latitude, coords.longitude], { radius: Math.max(coords.accuracy, 25), color: "#ef5b38", weight: 1, fillOpacity: .08 }).addTo(group);
      leaflet.circleMarker([coords.latitude, coords.longitude], { radius: 8, color: "#fff", weight: 3, fillColor: "#ef5b38", fillOpacity: 1 }).bindTooltip(t("Tvoja trenutna lokacija", "Your current location")).addTo(group);
      locationLayerRef.current = group;
      map.setView([coords.latitude, coords.longitude], 16, { animate: true });
      setLocating(false);
    }, () => setLocating(false), { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 });
  };

  return <section className="live-map-card">
    <div className="live-map-toolbar"><span className={offline ? "offline" : "online"}>{offline ? <WifiOff /> : <MapPin />}{offline ? t("Selo režim · keširana mapa", "Village mode · cached map") : t("OpenStreetMap · uživo", "OpenStreetMap · live")}</span><button type="button" className="locate-button" onClick={locateUser} disabled={locating}>{locating ? <LoaderCircle className="spin" /> : <LocateFixed />}{t("Trenutna lokacija", "Current location")}</button></div>
    <div ref={elementRef} className="leaflet-map" aria-label={t("Mapa terenskih zadataka", "Field task map")} />
    {selected && <div className="map-task-card"><div><small>{selected.city_village}</small><h3>{selected.title}</h3><p>{selected.address}</p></div><div><button type="button" onClick={() => onSelectTask(selected)}>{t("Zabeleži posetu", "Log visit")}</button><a href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer"><Navigation /> {t("Ruta", "Route")}</a></div></div>}
  </section>;
}
