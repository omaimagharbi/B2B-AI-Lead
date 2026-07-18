'use client'

import { useState, useRef, useEffect } from 'react'

type Option = { value: string; label: string }

export default function DropdownMultiSelect({
  options,
  selectionnes,
  onToggle,
  placeholder,
  disabled,
}: {
  options: Option[]
  selectionnes: Set<string>
  onToggle: (value: string) => void
  placeholder: string
  disabled?: boolean
}) {
  const [ouvert, setOuvert] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fermerSiExterieur = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', fermerSiExterieur)
    return () => document.removeEventListener('mousedown', fermerSiExterieur)
  }, [])

  const libelle =
    selectionnes.size === 0
      ? placeholder
      : options
          .filter((o) => selectionnes.has(o.value))
          .map((o) => o.label)
          .join(', ')

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        disabled={disabled}
        className="w-full text-left rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm flex items-center justify-between disabled:opacity-50"
      >
        <span className={selectionnes.size === 0 ? 'text-slate-500 truncate' : 'text-slate-200 truncate'}>
          {libelle}
        </span>
        <span className="text-slate-500 ml-2">{ouvert ? '▲' : '▼'}</span>
      </button>

      {ouvert && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-sm px-3 py-2 hover:bg-slate-800 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectionnes.has(opt.value)}
                onChange={() => onToggle(opt.value)}
                className="accent-accent"
              />
              <span className={selectionnes.has(opt.value) ? 'text-accent' : 'text-slate-300'}>
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
