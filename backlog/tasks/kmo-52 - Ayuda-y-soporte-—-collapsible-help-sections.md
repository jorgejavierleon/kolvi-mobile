---
id: KMO-52
title: Ayuda y soporte — collapsible help sections
status: Done
assignee:
  - '@claude'
created_date: '2026-08-14 10:00'
updated_date: '2026-08-14 10:11'
labels: []
dependencies: []
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Ayuda y soporte screen (KMO-27) currently renders every help section's full body text at once, so the screen is a long wall of text. Make each section an accordion: only the title is visible by default, and tapping it expands/collapses that section's body. This is a UX request from Jorge after reviewing the shipped KMO-27 screen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each help section (src/features/profile/help-support.tsx) shows only its title by default; the body is hidden
- [x] #2 Tapping a section's title toggles that section's body open/closed
- [x] #3 Multiple sections can be open at the same time (no accordion-group exclusivity implied unless the design calls for it)
- [x] #4 The expand/collapse control is reachable and operable via screen reader, with an accessibility state that announces expanded/collapsed
- [x] #5 The contact card (Escribir a soporte) and version label are unaffected and remain always visible
- [x] #6 Existing help-support tests are updated and new tests cover expanding and collapsing a section
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/ui/icons.tsx — add ChevronDownIcon (Lucide chevron-down, 'm6 9 6 6 6-6'), matching ChevronLeftIcon's pattern.
2. src/features/profile/help-support.tsx — turn HelpSection into a collapsible: track open state per section with useState(Record<string, boolean>) in HelpSupport (default: all closed), pass isOpen/onToggle into HelpSection. Header becomes a Pressable row (title + ChevronDownIcon that rotates via a style transform when open) with accessibilityRole='button' and accessibilityState={{ expanded: isOpen }}. Body paragraphs render only when isOpen (conditional mount, not just visually hidden, so a screen reader does not see the hidden text). Call LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut) before the state flip (React Native's standard mechanism for animating a height change without measuring it manually) so the expand/collapse animates instead of snapping. Keep the contact card and version Text exactly as they are, outside HelpSection.
3. src/features/profile/help-support.test.tsx — replace the 'shows every section heading and its first paragraph' test: assert bodies are absent by default (queryByText), press a section's title (getByText or a new testID per section header), assert its body appears and the sibling section's body still does not, and press again to assert it collapses back out.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
npm run check green (typecheck, lint, format, 1273 tests). Verified live on the emulator: Ayuda y soporte opens with every section collapsed to its heading; tapping a title expands only that section's body with an animated (LayoutAnimation) chevron flip, a second tap collapses it, and a sibling section stays untouched while one is open. accessibilityRole='button' + accessibilityState.expanded on the header is RN's standard disclosure pattern (verified via the accessibilityState prop in tests); not manually verified with TalkBack running.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made each Ayuda y soporte section a disclosure: collapsed to its heading by default, tapping expands/collapses just that section (others stay independent), with an animated chevron and accessibilityState.expanded for screen readers. The contact card and version label are untouched. Also carried over an earlier fix: the contact row (Escribir a soporte) was missing the horizontal padding perfil.tsx's identical padded={false}+ListRow pattern applies, so its text sat flush against the card edge.
<!-- SECTION:FINAL_SUMMARY:END -->
