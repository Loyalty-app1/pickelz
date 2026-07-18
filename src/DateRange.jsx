import React from "react";
import {
  DateRangePicker as AriaDateRangePicker,
  Group as AriaGroup,
  DateInput,
  DateSegment,
  Button as AriaButton,
  Popover as AriaPopover,
  Dialog as AriaDialog,
  RangeCalendar,
  Heading,
  CalendarGrid,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarGridBody,
  CalendarCell,
} from "react-aria-components";
import { today, getLocalTimeZone, startOfMonth, endOfMonth } from "@internationalized/date";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

// Adaptation du DateRangePicker react-aria (pattern Untitled UI) à notre système :
// angles vifs, mono, fond sombre, accent vin.

const segmentClass =
  "px-0.5 font-mono text-xs tabular-nums text-foreground outline-none data-[placeholder]:text-muted-foreground/60 focus:bg-accent focus:text-accent-foreground";

function dateInput(slot) {
  return (
    <DateInput slot={slot} className="flex items-center">
      {(segment) => <DateSegment segment={segment} className={segmentClass} />}
    </DateInput>
  );
}

export default function DateRange({ value, onChange }) {
  const now = today(getLocalTimeZone());
  const presets = [
    { label: "7 jours", range: { start: now.subtract({ days: 6 }), end: now } },
    { label: "30 jours", range: { start: now.subtract({ days: 29 }), end: now } },
    { label: "Ce mois", range: { start: startOfMonth(now), end: endOfMonth(now) } },
    {
      label: "Mois dernier",
      range: {
        start: startOfMonth(now.subtract({ months: 1 })),
        end: endOfMonth(now.subtract({ months: 1 })),
      },
    },
    { label: "Tout", range: null },
  ];

  return (
    <AriaDateRangePicker
      aria-label="Période"
      value={value}
      onChange={onChange}
      shouldCloseOnSelect={false}
      className="relative"
    >
      <AriaGroup className="flex h-11 items-center gap-2 border border-border bg-input px-3 transition-colors duration-150 focus-within:border-accent-bright hover:border-foreground/40">
        {dateInput("start")}
        <span className="font-mono text-xs text-muted-foreground">–</span>
        {dateInput("end")}
        <AriaButton className="ml-1 p-1 text-muted-foreground outline-none transition-colors duration-150 hover:text-accent-bright focus-visible:text-accent-bright">
          <CalendarIcon size={16} strokeWidth={1.5} />
        </AriaButton>
      </AriaGroup>
      <AriaPopover
        placement="bottom start"
        className="border border-border bg-card p-4 shadow-[0_8px_40px_rgba(0,0,0,0.7)]"
      >
        <AriaDialog className="outline-none">
          <RangeCalendar className="text-foreground">
            <header className="mb-3 flex items-center justify-between">
              <AriaButton
                slot="previous"
                className="p-1.5 text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground"
              >
                <ChevronLeft size={16} strokeWidth={1.5} />
              </AriaButton>
              <Heading className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-foreground" />
              <AriaButton
                slot="next"
                className="p-1.5 text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground"
              >
                <ChevronRight size={16} strokeWidth={1.5} />
              </AriaButton>
            </header>
            <CalendarGrid className="border-separate border-spacing-0.5">
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className="pb-1 font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => (
                  <CalendarCell
                    date={date}
                    className={({
                      isSelected,
                      isSelectionStart,
                      isSelectionEnd,
                      isOutsideMonth,
                      isFocusVisible,
                    }) =>
                      [
                        "flex h-8 w-8 cursor-pointer items-center justify-center font-mono text-xs tabular-nums outline-none transition-colors duration-100",
                        isOutsideMonth ? "invisible" : "",
                        isSelectionStart || isSelectionEnd
                          ? "bg-accent font-bold text-accent-foreground"
                          : isSelected
                            ? "bg-accent/30 text-foreground"
                            : "text-foreground hover:bg-muted",
                        isFocusVisible ? "ring-1 ring-accent-bright" : "",
                      ].join(" ")
                    }
                  />
                )}
              </CalendarGridBody>
            </CalendarGrid>
          </RangeCalendar>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(p.range)}
                className="border border-border px-2.5 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground transition-colors duration-150 hover:border-accent-bright hover:text-accent-bright"
              >
                {p.label}
              </button>
            ))}
          </div>
        </AriaDialog>
      </AriaPopover>
    </AriaDateRangePicker>
  );
}
