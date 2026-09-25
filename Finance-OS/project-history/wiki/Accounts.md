# Accounts (M8 – Konten)

[Home](Home.md) · Verwandt: [Depot](Depot.md), [Data-Model](Data-Model.md)

**Zweck:** Alle Konten (Giro, Tagesgeld, Depot, Rücklage, Krypto, …) mit Zweckbindung und datierten Salden-Historien.

**Prägende Entscheidungen:**
- **Kein-Löschen-Linie:** Konten werden deaktiviert, nie gelöscht (stabile Referenzen) – wurde Projektmuster ([Decision D10](../Finance_OS_Decision_Log.md)).
- Saldo-Aktualisierung = neuer datierter Eintrag (G4); Typ nachträglich unveränderbar; Depot-Konten tragen keinen eigenen Saldo (Depotwert kommt aus Positionen – Doppelzählungsschutz C2).
- **DM21 hier erstmals verdrahtet:** Salden an gesperrten Snapshot-Daten sind unveränderlich.
- Zweckbindung als Daten-Flags (`countsAsFreeLiquidity`, `earmark`): die ING-Rücklage zählt nie zur freien Liquidität – die Kennzahl selbst ist V1.x-23.

**Seed-Konten:** Sparkasse Giro, ING-Rücklage (Shares2you), VW-Bank-Tagesgeld, TR Cash + TR Depot (getrennt! G6), FNZ VL-Depot, Equatex, Bitget (zurückgestellt), Telekom-Pensionsfonds (Merkposten ohne Wert).

**Bekannte Altpunkte:** V1.x-18 (K2-Guard bei Formular-Edits, Trim, Warnungs-Aufräumen) und V1.x-20/21 (A11y-Nachrüstung).

**Dateien:** `src/pages/AccountsPage.tsx`, `src/data/accounts.ts`; Tests: `tests/data/accounts.test.ts`, `tests/pages/accountsPage.test.tsx`.
