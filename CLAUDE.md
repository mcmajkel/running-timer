# Bieg Timer — kontekst projektu dla Claude Code

## Co to jest
Aplikacja webowa (PWA) do prowadzenia interwałowego treningu biegowego.
Działa na iPhone przez Safari, można ją dodać do ekranu głównego.
Hostowana na GitHub Pages pod adresem: https://[twoj-login].github.io/running-timer

## Stack
- React 18 + Vite
- Czyste inline styles (bez CSS frameworka)
- Web Audio API — sygnały dźwiękowe przy zmianie fazy
- Geolocation API — śledzenie dystansu GPS (haversine)
- Screen Wake Lock API — ekran nie wygasa podczas treningu
- PWA manifest — można dodać do ekranu głównego

## Plik główny
Cała logika i UI są w `src/App.jsx` — jeden plik.

## Plan treningowy zakodowany w aplikacji
12-tygodniowy plan biegowy 2x/tydzień (czw + nd, godz. 7:00).
Cel: 5 km do 22 czerwca 2026.

| Tygodnie | Schemat |
|----------|---------|
| 1–2 | 2 min bieg / 1 min marsz × 6 |
| 3–4 | 5 min bieg / 1 min marsz × 4 |
| 5–6 | 8 min bieg / 1 min marsz × 3 |
| 7–8 | 12 min bieg / 1 min marsz × 2 |
| 9–10 | 20 min ciągły |
| 11 | 25 min ciągły |
| 12 | 5 km |

Każdy trening zaczyna się 5 min rozgrzewki i kończy 4 min schładzania.

## Motyw kolorystyczny — Neon B
Każda faza ma swój kolor z efektem glow:
- 🟢 BIEGNIJ — zielony neon `#00ff88`
- 🔵 MARSZ — niebieski `#00cfff`
- 🟠 ROZGRZEWKA — pomarańczowy `#ff8c00`
- 🟣 SCHŁADZANIE — fiolet `#cc66ff`
- 🟡 KONIEC — złoty `#ffd700`

## Kluczowe decyzje UX
- Etykieta fazy (BIEGNIJ/MARSZ) ZAWSZE widoczna z odległości — `clamp()` dobiera rozmiar
- Timer 68–96px — dominuje ekran
- "Następnie:" pokazuje preview kolejnej fazy
- Tło zmienia kolor przy zmianie fazy (transition 0.5s)
- Radialny glow w tle podczas biegu

## Funkcje GPS
- `haversine()` — oblicza dystans między punktami (metry)
- Filtr szumów: ignoruje skoki > 50m
- Dystans łączny + osobno tylko odcinki biegu
- Tempo bieżące w min/km
- Podsumowanie po treningu

## Deploy
Push na branch `main` → GitHub Actions builduje Vite → wdraża na GitHub Pages automatycznie.

## Właściciel projektu
Mike Z., Warszawa. Beginner runner, plan 2x/tydzień.
Telefon: iPhone, przeglądarka: Safari.

## Pomysły na przyszłość (backlog)
- Historia treningów (localStorage)
- Wykres dystansu po treningu
- Powiadomienia push (remindery przed treningiem)
- Eksport do GPX
- Kalibracja GPS (warm-up przed startem)
