<script lang="ts">
  import { DatePicker, TimePicker } from "@lapismd/design-core/forms";
  import type { RegisteredFormRendererProps } from "@lapismd/design-core/forms";

  import type { RegistryReleaseEditDraft } from "./model.js";
  import "./RegistryReleaseDateTimeField.css";

  type Props = RegisteredFormRendererProps<
    "registry-date-time",
    RegistryReleaseEditDraft
  > & {
    blur?: () => void;
  };

  let {
    value,
    field,
    issues = [],
    readonly = false,
    update,
    blur = () => {},
  }: Props = $props();

  const error = $derived(issues[0]?.message ?? null);
  const parts = $derived(datetimeParts(value));
  const dateValue = $derived(parts.date || undefined);
  const timeValue = $derived(parts.time || undefined);

  function pad(value: number): string {
    return String(value).padStart(2, "0");
  }

  function datetimeParts(value: string): { date: string; time: string } {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      const date = new Date(parsed);
      return {
        date: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
        time: `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`,
      };
    }
    const match =
      /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d{3})?)?/u.exec(
        value,
      );
    if (!match) return { date: "", time: "" };
    return { date: match[1] ?? "", time: match[2] ?? "" };
  }

  function composeIso(date: string, time: string): string {
    const [year = "0", month = "1", day = "1"] = date.split("-");
    const [hour = "0", minute = "0"] = time.split(":");
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
      ),
    ).toISOString();
  }

  function updateDate(nextDate: string | undefined): void {
    if (!nextDate) {
      void update("");
      return;
    }
    void update(composeIso(nextDate, timeValue ?? "00:00"));
  }

  function updateTime(nextTime: string | undefined): void {
    if (!dateValue) return;
    void update(composeIso(dateValue, nextTime ?? "00:00"));
  }
</script>

<div
  class="registry-release-date-time"
  data-invalid={error ? "" : undefined}
  onfocusout={blur}
>
  <DatePicker
    value={dateValue}
    ariaLabel={`${field.label} date`}
    disabled={readonly}
    {error}
    onValueChange={updateDate}
  />
  <TimePicker
    value={timeValue}
    ariaLabel={`${field.label} time`}
    clearable={false}
    disabled={readonly || !dateValue}
    onValueChange={updateTime}
  />
</div>
