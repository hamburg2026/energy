# Energiekosten – Strom · Gas · Wasser

Eine Web-App, die deine Energiekosten im Blick behält: Verträge, Rechnungen, die Entwicklung der Preise über die Jahre und konkrete Empfehlungen, ob sich ein Tarif- oder Anbieterwechsel lohnt.
Sie läuft komplett im Browser (React + Vite) und wird über GitHub Pages veröffentlicht. Aufbau und Bedienung entsprechen der Finanz-App.

## Funktionen

| Bereich | Inhalt |
|---|---|
| **Übersicht** | Hochgerechnete Jahreskosten je Sparte, Effektivpreis gegenüber Bundesdurchschnitt, Kosten pro Jahr als Diagramm, anstehende Fristen und die wichtigsten Empfehlungen |
| **Empfehlungen** | Sparpotenzial durch erfasste Alternativtarife (Bonus und Laufzeit sind eingerechnet), Preis über dem Marktdurchschnitt, Grundversorgung, Kündigungsfristen, Ende der Preisgarantie, Sonderkündigungsrecht bei Preiserhöhung, zu hoher oder zu niedriger Abschlag, Verbrauchsanstieg, Wasserverbrauch pro Person |
| **Preisentwicklung** | Arbeitspreis laut Vertrag (inkl. erfasster Preisänderungen), Effektivpreis laut Rechnungen und Bundesdurchschnitt als Vergleichslinie; dazu Kosten und Verbrauch pro Kalenderjahr, tagesgenau aus den Rechnungszeiträumen umgerechnet |
| **Verträge** | Anbieter, Tarif, Arbeits- und Grundpreis, Abschlag, Laufzeit, Kündigungsfrist, Preisgarantie, Preishistorie und angehängtes Dokument |
| **Rechnungen** | Abrechnungszeitraum, Verbrauch, Kosten, Abschläge, Nachzahlung oder Guthaben |
| **Tarifvergleich** | Aktueller Vertrag und Angebote in einer Rangliste (1. Jahr, Folgejahre, Ø über die Laufzeit), dazu Links zu Vergleichsportalen. Mit „Wechseln“ wird ein Angebot direkt zum neuen Vertrag. |
| **PDF-Import** | Rechnungen, Preisblätter und Angebote hochladen. Anbieter, Zeitraum, Verbrauch, Preise, Beträge, Bonus und Fristen werden automatisch erkannt und können vor dem Speichern geprüft werden. |
| **Einstellungen** | PLZ, Haushaltsgröße, Jahresverbrauch, Wechselschwelle, Richtwert-Tabelle (anpassbar), Beispieldaten, PIN |
| **Datensicherung** | Export und Import als JSON, optional AES-256-verschlüsselt und auf Wunsch inklusive PDFs |

## Datenschutz

Alle Daten bleiben lokal im Browser: Verträge, Rechnungen und Einstellungen im `localStorage`, Dokumente in der `IndexedDB`. Die Daten werden an keinen Server gesendet. Auch die PDF-Auswertung läuft lokal (pdf.js).
Wenn du die Daten auf ein anderes Gerät übertragen willst, nutze die **Datensicherung**.

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Produktions-Build nach dist/
```

## Veröffentlichung auf GitHub Pages

1. Im Repository unter **Settings → Pages → Build and deployment → Source** den Eintrag **GitHub Actions** wählen.
2. Bei jedem Push auf `main` baut `.github/workflows/deploy.yml` die App (Basis-Pfad `/energy/`) und veröffentlicht sie.
3. Danach ist die App erreichbar unter `https://<benutzer>.github.io/energy/`. Sie lässt sich als PWA auf dem Home-Bildschirm installieren.

## Hinweise

- Die PDF-Erkennung arbeitet mit Heuristiken für typische deutsche Rechnungslayouts. Gescannte PDFs ohne Textebene lassen sich nicht auslesen; dann trägst du die Werte manuell ein.
- Die Richtwerte für Durchschnittspreise sind ungefähre Bundesmittelwerte (Orientierung an BDEW und Destatis). In den Einstellungen kannst du sie anpassen.
- Die Empfehlungen ersetzen keine Prüfung der konkreten Vertragsbedingungen.
