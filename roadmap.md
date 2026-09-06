# Roadmap

## Open

## VCR browser-shell canvas — IN PROGRESS (resume here, edits not yet applied)
- [ ] VcrRoom render: for tabs kind syllabus/myspace/library stop rendering VcrAppPanel popover; mount full UIs (StudentSyllabus/syllabus folder view, MyResources page body, Library page body) inside the tab canvas (embedded mode, no DashboardLayout).
- [ ] Recordings tab: VcrRecordingsPanel filtered to current student/room; never navigate away.
- [ ] Web tabs: Drive -> https://drive.google.com/, YouTube -> https://www.youtube.com/, Google -> https://www.google.com/, URL tab with in-tab address bar; blocked-frame fallback card (VcrWebTab already handles).
- [ ] Launcher: single compact Class Apps button (desktop + mobile), order Syllabus, Whiteboard, Drive, YouTube, Google, URL/Web, Recordings, My Drive, Library; no Voice Call; close on select (VcrAppRail list order done, desktop column still expanded).
- [ ] Remove leftover embed/VcrAppPanel/grey popover rendering from canvas; My Copy vs Synced as one segmented control in top bar.
- [ ] Zoom: class Join bar action launches the scheduled meeting URL for this class (web join preferred, app fallback); no iframe.
- [ ] Admin/examiner on /vcr route: observer-only, hide edit/marking/whiteboard-draw controls; full editing only via impersonation.
- [ ] Run tsgo + build; report implemented vs limitations.
- [ ] End-to-end walk: upload as teacher → share with student → open in class → mark → save version → reopen with marks.
- [x] Library syllabus folders: folder-per-subject view with ordered resources; VCR picker grouped by folder.
- [x] Library-as-single-source: editing syllabus folder/subject/order on existing library items.


- [ ] Security: sensitive profile columns (bank/gov ID/medical) still readable cross-role — needs a decided migration.
- [ ] Activate Zoom Meeting SDK app and copy Client ID/Secret into LMS In-app player credentials.
- [ ] Test in-app Zoom join for a scheduled class.
- [ ] Submit SDK app for Zoom Marketplace review if teachers/students outside the app owner account need it.

## Done
- [x] Removed class-to-account linking card from Zoom account credentials panel; group class Zoom assignment deferred to future division/course flow.
