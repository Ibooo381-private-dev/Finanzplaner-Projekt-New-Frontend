import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App (Grundlayout)', () => {
  it('zeigt die Überschrift "Finance OS" im Kopfbereich', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Finance OS' })).toBeInTheDocument()
  })

  it('zeigt ohne Daten einen verständlichen Leerzustand mit Weg zu „Daten & Backups“', () => {
    render(<App />)
    expect(screen.getByText(/keine Finanzdaten geladen/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zu „Daten & Backups“' })).toBeInTheDocument()
  })

  it('startet auf der Seite „Übersicht“ und zeigt im Kopfbereich „Keine Datei geöffnet“', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 2, name: 'Übersicht' })).toBeInTheDocument()
    expect(screen.getByText('Keine Datei geöffnet')).toBeInTheDocument()
  })
})
