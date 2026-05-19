import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

export type SelectControlOption = {
    value: string
    label: string
    disabled?: boolean
}

export type SelectControlProps = {
    id?: string
    className?: string
    value: string
    onChange: (value: string) => void
    options: SelectControlOption[]
    disabled?: boolean
    placeholder?: string
    resetAfterChange?: boolean
    'aria-label'?: string
    'aria-describedby'?: string
}

type MenuPosition = {
    top: number
    left: number
    width: number
    maxHeight: number
    placement: 'below' | 'above'
}

const MENU_GAP = 6
const MENU_MAX_HEIGHT = 280
const VIEWPORT_PAD = 8

function buildMenuPosition(trigger: HTMLElement): MenuPosition {
    const rect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD
    const spaceAbove = rect.top - VIEWPORT_PAD
    const placement = spaceBelow >= 120 || spaceBelow >= spaceAbove ? 'below' : 'above'
    const maxHeight = Math.min(MENU_MAX_HEIGHT, placement === 'below' ? spaceBelow - MENU_GAP : spaceAbove - MENU_GAP)

    const top =
        placement === 'below'
            ? rect.bottom + MENU_GAP
            : Math.max(VIEWPORT_PAD, rect.top - MENU_GAP - Math.max(maxHeight, 80))

    return {
        top,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(80, maxHeight),
        placement,
    }
}

export function SelectControl({
    id,
    className,
    value,
    onChange,
    options,
    disabled = false,
    placeholder,
    resetAfterChange = false,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
}: SelectControlProps) {
    const listboxId = useId()
    const rootRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLUListElement>(null)
    const [open, setOpen] = useState(false)
    const [menuPos, setMenuPos] = useState<MenuPosition | null>(null)
    const [activeIndex, setActiveIndex] = useState(-1)

    const selectedOption = options.find((o) => o.value === value)
    const triggerLabel =
        selectedOption?.label ?? (value === '' && placeholder ? placeholder : (selectedOption?.label ?? value))
    const showPlaceholder = value === '' && placeholder != null && placeholder !== ''

    const enabledOptions = options.filter((o) => !o.disabled)

    const updateMenuPosition = useCallback(() => {
        const trigger = triggerRef.current
        if (!trigger) return
        setMenuPos(buildMenuPosition(trigger))
    }, [])

    const closeMenu = useCallback(() => {
        setOpen(false)
        setActiveIndex(-1)
    }, [])

    const openMenu = useCallback(() => {
        if (disabled || options.length === 0) return
        const selectedIdx = enabledOptions.findIndex((o) => o.value === value)
        setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0)
        setOpen(true)
    }, [disabled, enabledOptions, options.length, value])

    const selectOption = useCallback(
        (opt: SelectControlOption) => {
            if (opt.disabled) return
            onChange(opt.value)
            if (resetAfterChange) {
                onChange('')
            }
            closeMenu()
            triggerRef.current?.focus()
        },
        [closeMenu, onChange, resetAfterChange]
    )

    useLayoutEffect(() => {
        if (!open) return
        updateMenuPosition()
    }, [open, updateMenuPosition, options.length])

    useEffect(() => {
        if (!open) return

        const onDocPointerDown = (e: MouseEvent) => {
            const target = e.target as Node
            if (rootRef.current?.contains(target)) return
            if (menuRef.current?.contains(target)) return
            closeMenu()
        }

        const onDocKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                closeMenu()
                triggerRef.current?.focus()
            }
        }

        const onReposition = () => updateMenuPosition()

        document.addEventListener('mousedown', onDocPointerDown)
        document.addEventListener('keydown', onDocKeyDown)
        window.addEventListener('resize', onReposition)
        window.addEventListener('scroll', onReposition, true)

        return () => {
            document.removeEventListener('mousedown', onDocPointerDown)
            document.removeEventListener('keydown', onDocKeyDown)
            window.removeEventListener('resize', onReposition)
            window.removeEventListener('scroll', onReposition, true)
        }
    }, [closeMenu, open, updateMenuPosition])

    useEffect(() => {
        if (!open || activeIndex < 0) return
        const el = menuRef.current?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
        el?.scrollIntoView({ block: 'nearest' })
    }, [activeIndex, open])

    const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return

        if (!open) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openMenu()
            }
            return
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex((i) => {
                const next = i + 1
                return next >= enabledOptions.length ? 0 : next
            })
            return
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((i) => {
                const next = i - 1
                return next < 0 ? enabledOptions.length - 1 : next
            })
            return
        }

        if (e.key === 'Home') {
            e.preventDefault()
            setActiveIndex(0)
            return
        }

        if (e.key === 'End') {
            e.preventDefault()
            setActiveIndex(enabledOptions.length - 1)
            return
        }

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            const opt = enabledOptions[activeIndex]
            if (opt) selectOption(opt)
            return
        }

        if (e.key === 'Tab') {
            closeMenu()
        }
    }

    const triggerClassName = ['intervalSelect', 'selectControlTrigger', className].filter(Boolean).join(' ')

    const menu =
        open && menuPos
            ? createPortal(
                  <ul
                      ref={menuRef}
                      id={listboxId}
                      role="listbox"
                      className="selectControlMenu"
                      aria-label={ariaLabel}
                      style={{
                          position: 'fixed',
                          top: menuPos.top,
                          left: menuPos.left,
                          width: menuPos.width,
                          maxHeight: menuPos.maxHeight,
                      }}
                      data-placement={menuPos.placement}
                  >
                      {options.map((opt) => {
                          const enabledIdx = enabledOptions.indexOf(opt)
                          const isActive = open && enabledIdx === activeIndex
                          return (
                              <li
                                  key={opt.value === '' ? '__empty__' : opt.value}
                                  role="option"
                                  data-option-index={enabledIdx >= 0 ? enabledIdx : undefined}
                                  aria-selected={opt.value === value}
                                  aria-disabled={opt.disabled || undefined}
                                  data-selected={opt.value === value ? 'true' : undefined}
                                  data-disabled={opt.disabled ? 'true' : undefined}
                                  data-active={isActive ? 'true' : undefined}
                                  className="selectControlOption"
                                  onMouseEnter={() => {
                                      if (!opt.disabled && enabledIdx >= 0) setActiveIndex(enabledIdx)
                                  }}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectOption(opt)}
                              >
                                  {opt.label}
                              </li>
                          )
                      })}
                  </ul>,
                  document.body
              )
            : null

    return (
        <div ref={rootRef} className="selectControl">
            <button
                ref={triggerRef}
                type="button"
                id={id}
                className={triggerClassName}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listboxId : undefined}
                aria-label={ariaLabel}
                aria-describedby={ariaDescribedBy}
                data-placeholder={showPlaceholder ? 'true' : undefined}
                onClick={() => {
                    if (open) closeMenu()
                    else openMenu()
                }}
                onKeyDown={onTriggerKeyDown}
            >
                <span className="selectControlTriggerLabel">{triggerLabel}</span>
            </button>
            {menu}
        </div>
    )
}
