# Resources

Drop one **logo.png** (1024×1024, transparent background recommended) and
one **splash.png** (2732×2732, vendor's primary color background).

The build script auto-generates all required Android + iOS icon sizes
and splash variants via `@capacitor/assets`:

```bash
npx capacitor-assets generate \
  --iconBackgroundColor "${PRIMARY_COLOR}" \
  --splashBackgroundColor "${PRIMARY_COLOR}"
```

Output lives in:
- `android/app/src/main/res/mipmap-*/` (all density buckets)
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
