# Dashboard Improvement Plan

## P0 - Critical / Blocking

- [x] **Test Coverage** - Add unit tests for `use-dashboard-storage`, `dashboard-context`, `dashboard-filters-context`, `planner-context`, widget tree operations, filter resolution, pgrest utilities
    # Run all dashboard tests                                                                                                                      
  cd turbo-repo/apps/app && npx vitest run src/features/dashboard/                                                                             

  # Watch mode (re-runs on file changes)                                                                                                         
  cd turbo-repo/apps/app && npx vitest src/features/dashboard/
                                                                                                                                                 
  # With coverage report                                                                                                                       
  cd turbo-repo/apps/app && npx vitest run --coverage src/features/dashboard/                                                                    
                                                            
  # Run a specific test file
  cd turbo-repo/apps/app && npx vitest run src/features/dashboard/dashlets/common/pgrest-utils.test.ts
- [x] **Chart Widget (echarts)** - Create `chart` dashlet supporting line, bar, pie, gauge, scatter via echarts-for-react. Settings modal with series config, axis labels, legend, colors, data source (pgrest/planner/static)
- [ ] **Auto-Refresh / Polling** - Configurable `refreshInterval` (10s, 30s, 60s, 5m, off) at dashboard and per-widget level. Implement via SWR `refreshInterval` in `usePgrestRows` and `PlannerProvider`
- [ ] **Widget Duplication** - "Duplicate" button in `WidgetControls` (edit mode). Deep-clone widget + children with new UUIDs, place adjacent in grid

## P1 - High Value

- [ ] **Schema Migration System** - Migration pipeline in `useDashboardStorage` to transform old schema versions to current. Required before any schema changes
- [ ] **Undo/Redo** - Command history stack (snapshot-based, max ~50). Keyboard shortcuts Ctrl+Z / Ctrl+Shift+Z. Toolbar buttons in header
- [ ] **Threshold / Conditional Formatting** - Stat widgets define threshold rules (value ranges -> colors). Apply to background, text, icon color
- [ ] **Kiosk / Fullscreen Mode** - Hide header, nav, filter bar, edit controls. Auto-refresh on. URL param `?kiosk=true`. Depends on auto-refresh
- [ ] **Responsive Breakpoints** - Root grid breakpoints (24 cols desktop, 12 tablet, 6 mobile). Per-breakpoint layouts in schema. Depends on schema migrations
- [ ] **Dashboard Templates / Presets** - Template selection UI when creating new dashboard. Seed from existing 7 default configs
- [ ] **Cross-Widget Filtering** - Click table row or chart segment -> propagate value as filter to other widgets. Configure click behavior per widget. Depends on chart widget
- [ ] **Extract Duplicated Grid CSS** - ~600 lines styled-jsx in `dashboard-view.tsx` and `container/dashlet.tsx`. Extract to shared CSS module

## P2 - Medium Priority

- [ ] **Gauge Widget** - Dedicated gauge/dial dashlet for single-sensor readings (temp, pressure, battery). Depends on chart widget
- [ ] **Map Widget** - Render devices/assets on map from pgrest lat/lng data. Deps already exist: `mapbox-gl`, `react-map-gl`, `deck.gl`, `supercluster`
- [ ] **Alarm / Alert Widget** - Active alarms, severity levels, ack/resolve actions, history. Depends on backend alarm API
- [ ] **Dashboard Versioning / History** - Store version snapshots on save, allow rollback. Depends on backend Alfresco support
- [ ] **Keyboard Shortcuts** - `E` toggle edit, `Ctrl+Z` undo, `Del` delete widget, `Ctrl+D` duplicate, `Esc` close modals. Depends on undo/redo + duplication
- [ ] **Data Transformation Layer** - Computed columns, aggregations (sum/avg/count/min/max), simple joins between planner variables
- [ ] **Widget Move Between Containers** - Drag-drop to reparent widgets across containers
- [ ] **Fix JSON.stringify Effect Dependencies** - Replace `JSON.stringify` deps in `PlannerContext` and `useDashletPgrest` with deep-comparison hook
- [ ] **Optimize Widget Tree Traversal** - Replace O(n) tree walk on every mutation with flat `Map<id, Widget>` + parent refs

## P3 - Nice to Have

- [ ] **Real-Time WebSocket Data** - Upgrade from polling to WebSocket/SSE for sub-second updates
- [ ] **Dashboard Linking / Drill-Through** - Navigate between dashboards with context/filters
- [ ] **Scheduled Reports / PDF Export** - Periodic PDF/PNG snapshots delivered via email
- [ ] **Embeddable Dashboards** - iframe + token auth for embedding in third-party apps
- [ ] **Natural Language Query** - AI-powered widget/filter generation from plain English
- [ ] **Annotation System** - Timestamped notes on time-series charts
- [ ] **Lazy-Load Dashlet Registry** - Dynamic imports for bundle size optimization
- [ ] **Widget Animations & Transitions** - Count-up, layout transitions, skeleton loading states
- [ ] **Dashboard Sharing & Permissions** - Role-based access, public links

## Recommended Sprint Sequence

| Sprint | Items | Theme |
|--------|-------|-------|
| 1-2 | Tests, Widget Duplication, Schema Migrations, CSS Dedup | Foundation |
| 3-4 | Chart Widget, Auto-Refresh | Live Data & Visualization |
| 5-6 | Thresholds, Kiosk Mode, Gauge Widget | IoT Core |
| 7-8 | Undo/Redo, Responsive Breakpoints, Keyboard Shortcuts | UX Polish |
| 9-10 | Cross-Widget Filtering, Templates, Map Widget | Advanced Features |
| 11+ | P2/P3 items based on user feedback | Iteration |
