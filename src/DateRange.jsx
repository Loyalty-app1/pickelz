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

// DateRangePicker react-aria adapté au système Pickel'z :
// formes arrondies, mauve profond, accent apricot.

const segmentClass =
  "px-0.5 text-xs font-semibold tabular-nums text-foreground outline-none rounded data-[placeholder]:text-muted-foreground/60 focus:bg-accent focus:text-accent-foreground";

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
      <AriaGroup className="flex h-11 items-center gap-2 rounded-full bg-surface px-4 ring-2 ring-transparent transition-all duration-150 focus-within:ring-foreground hover:bg-raised">
        {dateInput("start")}
        <span className="text-xs text-muted-foreground">–</span>
        {dateInput("end")}
        <AriaButton className="ml-1 rounded-full p-1 text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:text-foreground">
          <CalendarIcon size={16} strokeWidth={2} />
        </AriaButton>
      </AriaGroup>
      <AriaPopover
        placement="bottom start"
        className="rounded-3xl bg-surface p-4 ring-2 ring-border shadow-[0_12px_50px_rgba(0,0,0,0.45)]"
      >
        <AriaDialog className="outline-none">
          <RangeCalendar className="text-foreground">
            <header className="mb-3 flex items-center justify-between">
              <AriaButton
                slot="previous"
                className="rounded-full p-2 text-muted-foreground outline-none transition-colors duration-150 hover:bg-raised hover:text-foreground"
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </AriaButton>
              <Heading className="font-display text-base font-bold capitalize text-foreground" />
              <AriaButton
                slot="next"
                className="rounded-full p-2 text-muted-foreground outline-none transition-colors duration-150 hover:bg-raised hover:text-foreground"
              >
                <ChevronRight size={16} strokeWidth={2.5} />
              </AriaButton>
            </header>
            <CalendarGrid className="border-separate border-spacing-1">
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className="pb-1 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
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
                        "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-xs font-semibold tabular-nums outline-none transition-colors duration-100",
                        isOutsideMonth ? "invisible" : "",
                        isSelectionStart || isSelectionEnd
                          ? "bg-accent text-accent-foreground"
                          : isSelected
                            ? "bg-raised text-foreground"
                            : "text-foreground hover:bg-raised",
                        isFocusVisible ? "ring-2 ring-foreground" : "",
                      ].join(" ")
                    }
                  />
                )}
              </CalendarGridBody>
            </CalendarGrid>
          </RangeCalendar>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(p.range)}
                className="rounded-full bg-surface-deep px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
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
