import { Check } from 'lucide-react';
import { FieldLabel } from '@/components/scaler/DefinitionForm';
import { TRIGGER_CATALOG } from '@/lib/triggers';
import type { TriggerFieldValues, TriggerTypeId } from '@/lib/types';

/**
 * The trigger catalog grid plus the selected trigger's config fields — the
 * "Signal" step of the Guided tab. Field keys match controller/triggers.mjs
 * one-for-one, so whatever is filled in here maps directly onto the
 * scaler.io/v1alpha1 `source` block shown in the YAML tab.
 */
export function TriggerPicker({
  selected,
  onSelect,
  values,
  onChangeField,
}: {
  selected: TriggerTypeId;
  onSelect: (id: TriggerTypeId) => void;
  values: TriggerFieldValues;
  onChangeField: (key: string, value: string | number) => void;
}) {
  const trigger =
    TRIGGER_CATALOG.find((item) => item.id === selected) ?? TRIGGER_CATALOG[0];
  return (
    <div className="col-span-full">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {TRIGGER_CATALOG.map((item) => {
          const active = item.id === selected;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-pressed={active}
              className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition ${
                active
                  ? 'border-[#5e9478] bg-[#f2f8f4] ring-2 ring-[#dcece2]'
                  : 'border-[#dde3de] bg-white hover:border-[#b9c8bd]'
              }`}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-md [&>svg]:size-3.5 ${active ? 'bg-[#153e32] text-white' : 'bg-[#eef2ee] text-[#546358]'}`}
              >
                <Icon />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#26342d]">
                  {item.shortLabel}
                  {active ? <Check className="size-3 text-[#2e7452]" /> : null}
                </span>
                <span className="mt-0.5 block text-[10px] leading-4 text-[#7a867e]">
                  {item.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {trigger.fields.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {trigger.fields.map((fieldDef) => (
            <FieldLabel
              key={fieldDef.key}
              label={fieldDef.label}
              wide={fieldDef.wide}
            >
              <div className="relative">
                <input
                  type={fieldDef.type}
                  value={values[fieldDef.key] ?? fieldDef.defaultValue}
                  placeholder={fieldDef.placeholder}
                  onChange={(event) =>
                    onChangeField(
                      fieldDef.key,
                      fieldDef.type === 'number'
                        ? Number(event.target.value)
                        : event.target.value,
                    )
                  }
                  className={`definition-input ${fieldDef.wide ? 'font-mono text-[11px]' : ''} ${fieldDef.suffix ? 'pr-16' : ''}`}
                />
                {fieldDef.suffix ? (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#8a958e]">
                    {fieldDef.suffix}
                  </span>
                ) : null}
              </div>
            </FieldLabel>
          ))}
        </div>
      ) : null}
    </div>
  );
}
