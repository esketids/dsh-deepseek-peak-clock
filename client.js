/**
 * DeepSeek peak/off-peak clock, rendered in the HUD row under the composer.
 *
 * Schedule logic is a port of deepakness.com/deepseek and
 * github.com/deepakness/deepseek-price-clock `price.js` — keep SWITCH_MINUTES,
 * WEEKEND_RULE_START and CN_HOLIDAYS in sync with the site.
 */
window.__ModuleLoader__.load({
  id: 'dsh-deepseek-peak-clock',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'deepseek-peak-clock';
    const SLOT = 'conversation.composer.dock';
    const CELL_ID = 'deepseek-peak-clock';

    // --- schedule ---------------------------------------------------------

    // Peak window switch instants in UTC minutes-of-day: 01:00 and 06:00 open
    // a peak window, 04:00 and 10:00 close one. Everything else is off-peak.
    const SWITCH_MINUTES = [60, 240, 360, 600];

    // Since 00:00 Beijing time on Sunday August 23, 2026 (16:00 UTC Saturday
    // August 22) the split only applies Monday to Friday Beijing time.
    const WEEKEND_RULE_START = Date.UTC(2026, 7, 22, 16);

    // Chinese public holidays as Beijing dates; DeepSeek bills them off-peak
    // all day. Add the next year's dates once the State Council announces them.
    const CN_HOLIDAYS = [
      ['2026-09-25', '2026-09-27'], // Mid-Autumn
      ['2026-10-01', '2026-10-07'], // National Day
    ];

    function isBeijingWeekend(date) {
      const day = new Date(date.getTime() + 8 * 3600000).getUTCDay();
      return day === 0 || day === 6;
    }

    function beijingDateKey(date) {
      return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10);
    }

    function isBeijingHoliday(date) {
      const key = beijingDateKey(date);
      for (const [from, to] of CN_HOLIDAYS) {
        if (key >= from && key <= to) return true;
      }
      return false;
    }

    // A Saturday, Sunday or public holiday under the current rules is off-peak
    // all day.
    function offPeakAllDay(date) {
      return (
        date.getTime() >= WEEKEND_RULE_START &&
        (isBeijingWeekend(date) || isBeijingHoliday(date))
      );
    }

    function kindAtInstant(date) {
      if (offPeakAllDay(date)) return 'off';
      const minuteOfDay = date.getUTCHours() * 60 + date.getUTCMinutes();
      return (minuteOfDay >= 60 && minuteOfDay < 240) ||
        (minuteOfDay >= 360 && minuteOfDay < 600)
        ? 'peak'
        : 'off';
    }

    function isSwitchInstant(date) {
      const minuteOfDay = date.getUTCHours() * 60 + date.getUTCMinutes();
      for (const m of SWITCH_MINUTES) {
        if (minuteOfDay === m) return !offPeakAllDay(date);
      }
      return false;
    }

    function nextSwitch(now) {
      const dayStart = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      );
      let day = 0;
      let index = 0;
      // Bounded scan: a gated weekend/holiday stretch never exceeds a few days.
      for (let guard = 0; guard < 4000; guard++) {
        const instant =
          dayStart + day * 86400000 + SWITCH_MINUTES[index] * 60000;
        const candidate = new Date(instant);
        if (instant > now.getTime() && isSwitchInstant(candidate)) {
          return { date: candidate, kind: kindAtInstant(candidate) };
        }
        index++;
        if (index >= SWITCH_MINUTES.length) {
          index = 0;
          day++;
        }
      }
      return null;
    }

    // --- formatting -------------------------------------------------------

    function formatDuration(ms) {
      const total = Math.max(0, Math.round(ms / 1000));
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const seconds = total % 60;
      if (hours > 0) {
        return hours + 'h ' + String(minutes).padStart(2, '0') + 'm';
      }
      if (minutes > 0) {
        return minutes + 'm ' + String(seconds).padStart(2, '0') + 's';
      }
      return seconds + 's';
    }

    function formatLocalTime(date) {
      try {
        return date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return date.getUTCHours() + ':00';
      }
    }

    // Rates per 1M tokens, from deepakness.com/deepseek (off-peak is half price).
    const RATES = {
      off: {
        flash: ['$0.15', '$0.003', '$0.60'],
        pro: ['$0.66', '$0.022', '$1.98'],
      },
      peak: {
        flash: ['$0.30', '$0.006', '$1.20'],
        pro: ['$1.32', '$0.044', '$3.96'],
      },
    };

    function rateLine(kind, t) {
      const table = RATES[kind];
      return (
        'Flash ' +
        table.flash.join(' / ') +
        ' · Pro ' +
        table.pro.join(' / ') +
        ' · ' +
        t('perMillion')
      );
    }

    // --- dictionaries -----------------------------------------------------

    const DICTS = {
      en: {
        offPeak: 'Off-peak',
        peak: 'Peak',
        endsIn: 'ends in',
        endsAt: 'next window',
        until: 'until',
        prices: 'input / cached input / output',
        perMillion: 'per 1M tokens',
        aria: 'DeepSeek API price window',
      },
      zh: {
        offPeak: '低谷',
        peak: '高峰',
        endsIn: '剩余',
        endsAt: '下次切换',
        until: '截至',
        prices: '输入 / 缓存输入 / 输出',
        perMillion: '每百万 tokens',
        aria: 'DeepSeek API 峰谷计费时段',
      },
    };

    // --- component --------------------------------------------------------

    function useTicker(periodMs) {
      const [now, setNow] = React.useState(() => new Date());
      React.useEffect(() => {
        const id = setInterval(() => setNow(new Date()), periodMs);
        return () => clearInterval(id);
      }, [periodMs]);
      return now;
    }

    function Clock(props) {
      const t = props.t;
      const now = useTicker(1000);
      const next = nextSwitch(now);
      const kind = kindAtInstant(now);
      const offPeak = kind === 'off';

      if (!next) return null;

      const label = t(offPeak ? 'offPeak' : 'peak');
      const remaining = formatDuration(next.date.getTime() - now.getTime());
      const flip = formatLocalTime(next.date);
      const accent = offPeak
        ? 'var(--dsw-alias-state-success-primary)'
        : 'var(--dsw-alias-state-warn-primary)';

      const title =
        label +
        ' · ' +
        t('prices') +
        ' · ' +
        t('until') +
        ' ' +
        flip +
        '\n' +
        rateLine(kind, t);

      return h(
        'span',
        {
          title,
          'aria-label': t('aria') + ': ' + label + ' ' + remaining,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            userSelect: 'none',
            color: 'var(--dsw-alias-label-secondary)',
            fontVariantNumeric: 'tabular-nums',
          },
        },
        h('span', {
          'aria-hidden': true,
          style: {
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            flex: '0 0 auto',
            background: accent,
            boxShadow: '0 0 0 3px color-mix(in srgb, ' + accent + ' 18%, transparent)',
          },
        }),
        h(
          'span',
          { style: { color: 'var(--dsw-alias-label-primary)' } },
          label,
        ),
        h('span', { 'aria-hidden': true, opacity: 0.5 }, '·'),
        h('span', null, t('endsIn') + ' ' + remaining),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          const disposers = [];
          for (const [locale, dict] of Object.entries(DICTS)) {
            disposers.push(ctx.locale.register(NS, locale, dict));
          }
          return () => {
            for (const dispose of disposers) dispose();
          };
        });

        const t = ctx.locale.bind(NS);

        ctx.slots.inject(SLOT, () =>
          ctx.slots.register({ name: SLOT, id: CELL_ID, order: 2 }, () =>
            h(Clock, { t }),
          ),
        );
      },
    };
  },
});
