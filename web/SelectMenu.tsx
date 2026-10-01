import React, { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type Option = { value: string; label: string };

export function SelectMenu({
  options,
  value,
  onChange,
  label,
  placeholder = "Tanlang",
}: {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.findIndex((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => {
    if (open)
      document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({
        block: "nearest",
      });
  }, [open, active, listId]);

  const show = () => {
    setActive(Math.max(0, selected));
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className="select-menu" ref={root}>
      <button
        type="button"
        className={"select-trigger" + (open ? " is-open" : "")}
        ref={trigger}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={!options.length}
        onBlur={(event) => {
          if (!root.current?.contains(event.relatedTarget as Node)) setOpen(false);
        }}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) show();
            else
              setActive((index) =>
                (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length,
              );
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) choose(active);
            else show();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          } else if (open && (event.key === "Home" || event.key === "End")) {
            event.preventDefault();
            setActive(event.key === "Home" ? 0 : options.length - 1);
          } else if (event.key === "Tab") setOpen(false);
        }}
      >
        <span>{options[selected]?.label || placeholder}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="select-options" role="listbox" id={listId} aria-label={label}>
          {options.map((option, index) => (
            <button
              type="button"
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              tabIndex={-1}
              className={index === active ? "is-active" : ""}
              onPointerMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
