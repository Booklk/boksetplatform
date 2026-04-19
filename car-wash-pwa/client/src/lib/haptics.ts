/**
 * Haptic feedback utility — wraps navigator.vibrate() with semantic names.
 * Falls back silently on unsupported browsers.
 */
export const haptics = {
  /** Very light tap — button presses, selection changes */
  light: () => navigator.vibrate?.(10),

  /** Medium impact — confirmations, toggles */
  medium: () => navigator.vibrate?.(25),

  /** Heavy impact — destructive actions */
  heavy: () => navigator.vibrate?.(50),

  /** Success pattern — double short pulse */
  success: () => navigator.vibrate?.([10, 50, 10]),

  /** Error pattern — two heavy pulses */
  error: () => navigator.vibrate?.([50, 30, 50]),

  /** Notification pattern — triple light pulse */
  notification: () => navigator.vibrate?.([15, 10, 15]),
};
