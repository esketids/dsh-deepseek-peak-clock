# dsh-deepseek-peak-clock

A [DeepSeek Harness](https://github.com/deepseek-ai) plugin that shows whether the DeepSeek API is
in its **peak** or **off-peak** billing window — right in the composer HUD row, next to turns,
tok/s and cache hit rate.

```
● Off-peak · ends in 1h 22m      green dot, half price
● Peak · ends in 2h 04m          amber dot, full price
```

The countdown ticks every second. Hovering the cell shows the window end in your local time and the
current per-1M-token rates:

```
Peak · input / cached input / output · until 12:00
Flash $0.30 / $0.006 / $1.20 · Pro $1.32 / $0.044 / $3.96 · per 1M tokens
```

## Schedule

Peak windows are **01:00–04:00** and **06:00–10:00 UTC**, everything else is off-peak at half price.
Since 2026-08-22 16:00 UTC the split only applies Monday–Friday Beijing time; Saturdays, Sundays and
Chinese public holidays are off-peak all day.

The rules are a port of the logic behind [deepakness.com/deepseek](https://deepakness.com/deepseek/)
and its [price clock extension](https://github.com/deepakness/deepseek-price-clock), which in turn
follow the [official DeepSeek pricing page](https://api-docs.deepseek.com/quick_start/pricing).

## Install

This is a Harness bundle: a package whose `cordis.patch.yml` inserts one Loader row.

1. Clone the repo somewhere stable (the profile links to the directory, so do not delete it).
2. Install it into your profile with the plugin manager, pointing at the checkout directory:

   ```
   plugin_manager install_bundle /absolute/path/to/dsh-deepseek-peak-clock
   ```

   Or add it by hand to your profile's Cordis composition:

   ```yaml
   - insert:
       - id: deepseek-peak-clock
         name: dsh-deepseek-peak-clock
   ```

3. Refresh the Web GUI. The cell appears under the composer; it is session-scoped, so open a
   session to see it.

The Host half is a no-op: the schedule is pure UTC arithmetic, so the clock renders entirely in the
browser and works offline.

## Configuration

None. The plugin adds one locale namespace, one HUD cell and nothing else.

## Maintenance

`CN_HOLIDAYS` in `client.js` lists Chinese public holidays that DeepSeek bills off-peak all day.
The State Council publishes the next year's arrangement around November, so add those dates when
they are announced. Everything else (windows, weekend rule) only changes when DeepSeek changes its
pricing, which this plugin does not detect automatically — compare with the pricing page
occasionally.

## Layout

| File | Purpose |
| --- | --- |
| `index.js` | Host half (empty `apply`; no services, no network) |
| `client.js` | Schedule port + the HUD cell component |
| `cordis.patch.yml` | Loader row that activates the bundle |
| `locale/en.json`, `locale/zh.json` | Plugin title and description for the Plugins page |
| `icon.svg` | Half-green/half-red clock icon |

## License

MIT. The schedule logic derives from DeepakNess's price clock; see the license file.
