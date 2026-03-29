# Backlog & Pomysły — Bieg Timer

## ✅ Zrobione — v1 live
- [x] Zwiększyć czytelność napisów na ekranie wyboru planu
- [x] Licznik km i kroków podczas całego treningu
- [x] Domyślnie pokazuj plan wyboru na start + localStorage
- [x] Przeskok między etapami (⏭ skip button)
- [x] Countdown wibracje (5s przed zmianą fazy) — nie działa na Safari iOS
- [x] Odhaczanie/ukrywanie ukończonych planów
- [x] Safe area iPhone (notch/dynamic island)
- [x] PWA na ekran główny iPhone

## 📊 P1 — Ważne (siguiente)
- [ ] **Historia treningów** — localStorage z datą, tygodniem, czasem, dystansem
  - Pokaż listę ostatnich treningów (czy na osobnym ekranie czy w idle?)
  - Stats: ile razy ukończyłem plan, ile km w sumie, średnie tempo

- [ ] **Powiadomienia push** — remindery przed treningiem
  - Integracja z Notification API (iOS 16.4+)
  - Domyślnie: czw + nd, 15 min przed 7:00

- [ ] **Eksport/sync ostatniego treningu** — zapisz do chmury (Google Drive? iCloud?)
  - JSON z dystansem, czasem, GPS track'iem

## 🎯 P2 — Nice to have (przyszłość)
- [ ] **Eksport do GPX** — zapisz track jako plik
  - Button na ekranie done, download do Files app

- [ ] **Statystyki long-term** — chart z dystansami po każdym treningu
  - Timeline: kiedy ostatni trening, próg streaks

- [ ] **Integracja Strava** — OAuth + activity upload
  - Automatycznie po zakończeniu treningu

- [ ] **Custom plany** — edytor schematów zamiast hardcoded
  - runMin, walkMin, rounds configuratble w UI

- [ ] **Alternatywne motywy** — Light mode, inne kolory (poza Neon B)

- [ ] **Offline полный** — cache assets, działa bez internetu całkowicie

---

**Ostatnia aktualizacja:** 29 marca 2026, 12:00
**Status:** v1 live na https://mcmajkel.github.io/running-timer/
