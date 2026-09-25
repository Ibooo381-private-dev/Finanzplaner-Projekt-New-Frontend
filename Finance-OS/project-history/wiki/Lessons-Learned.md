# Lessons Learned

[Home](Home.md) · Langform: [Development History §12](../Finance_OS_Development_History.md#12-lessons-learned)

1. **Sollwerte vor Code.** Vorab nachgerechnete Formelkataloge machen Implementierungsfehler zu Testfehlern statt zu stillen Datenfehlern.
2. **Die Prüfkette prüft auch den Prüfer.** Zwei der besten Funde betrafen die eigene Spezifikation (startMonth, Backup-Default).
3. **Ehrliche Nicht-Umsetzung schlägt Scheinfunktion.** Schätzsummen, Inflations-Schalter und Extra-Schwellen wurden dokumentiert abgelehnt statt quellenlos gebaut (G11).
4. **Pins gegen den plausibelsten Fehler wählen.** Redundante Pins (6 + 12 Monate) sind kein Luxus, sondern Maskierungs-Schutz.
5. **Byte-Identität ist ein hervorragendes Testorakel** – für K2, Dirty-Ehrlichkeit und Backup-Treue (A2).
6. **A11y-Befunde generalisieren.** Aus Einzel-Findings (Fokus auf body, doppelte Regionsnamen) wurden benannte Projektmuster (B1/B2/B3) mit festem Ort (design-system.md).
7. **Soll-Ist-Abgleich gehört ans Projektende.** Drei versprochene Features überlebten alle Modul-Reviews unbemerkt, weil jedes Review nur sein Modul sah (Kennzahlen-Trio, Strg+S, Snapshot-Verlauf).
8. **Vertraulichkeit hängt am Inhalt, nicht am Dateityp.** Ein „Quellcode“-Backup mit realen Seed-Werten ist vertraulich – Zusicherungen müssen der Realität folgen.
9. **Flaky Tests härten, dokumentieren, behalten.** Timeout-Begründung im Code schlägt Wiederholungs-Roulette und Test-Löschung.
10. **Dokumentierte Grauzonen sind Arbeitsvorrat.** U3/U4 entstanden aus sauber festgehaltenen offenen Fragen – nicht aus Ad-hoc-Annahmen.
11. **Additive Schema-Politik zahlt sich aus.** 7 Modul-Erweiterungen, 0 Migrationen, jede Altdatei lädt – dank §6-Protokoll und Altdatei-Nachweisen.
12. **Prozess-Grenzen ehrlich benennen.** jsdom testet keine Browserdialoge, Firefox-Headless hing, manuelle Bedienprüfung fand nicht statt – als solche markiert statt behauptet ([Reviews](Reviews.md), M17).
