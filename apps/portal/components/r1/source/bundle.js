/* @ds-bundle: {"format":4,"namespace":"R1","components":[{"name":"PageHeader"},{"name":"StatStrip"},{"name":"Meter"},{"name":"ViewState"},{"name":"DeviceBar"},{"name":"Artwork"},{"name":"PlayerControls"},{"name":"UpNext"},{"name":"PlayerFrame"},{"name":"PlayerAmbient"},{"name":"PlayerRail"},{"name":"WaveRing"},{"name":"WaveBar"},{"name":"Clock"},{"name":"PlayerAlert"},{"name":"PlayerFacts"},{"name":"QrCode"},{"name":"SecretValue"},{"name":"Icon"},{"name":"StatusIcon"},{"name":"StatusBadge"},{"name":"Button"},{"name":"ButtonRow"},{"name":"FieldMessage"},{"name":"TextField"},{"name":"Select"},{"name":"Table"},{"name":"Banner"},{"name":"Dialog"},{"name":"EmptyState"},{"name":"Skeleton"},{"name":"MoneyValue"},{"name":"CountValue"},{"name":"DateValue"},{"name":"Identifier"},{"name":"ProvenanceChip"},{"name":"FactList"},{"name":"FreshnessLine"},{"name":"Stepper"},{"name":"FileUpload"},{"name":"LegalTextViewer"},{"name":"SignatureBlock"},{"name":"ApprovalPair"},{"name":"QueueList"},{"name":"Timeline"},{"name":"PlayerStatusBlock"},{"name":"NowPlaying"},{"name":"Chart"},{"name":"PublicShell"},{"name":"PortalShell"},{"name":"ConsoleShell"},{"name":"LangToggle"},{"name":"Panel"},{"name":"Divider"},{"name":"Checkbox"},{"name":"ChoiceList"},{"name":"SegmentedControl"},{"name":"FilterBar"},{"name":"Link"},{"name":"CodeInput"},{"name":"NumberedSteps"},{"name":"StatusLine"},{"name":"NavList"},{"name":"ItemList"},{"name":"ScheduleGrid"},{"name":"Tabs"},{"name":"Pagination"},{"name":"SearchField"},{"name":"Combobox"},{"name":"Calendar"},{"name":"DateField"},{"name":"PasswordField"},{"name":"Breakdown"},{"name":"MetricValue"},{"name":"DeadlineClock"},{"name":"FieldRows"},{"name":"FieldRow"},{"name":"AudioPreview"},{"name":"PrintableRecord"},{"name":"VerificationResult"},{"name":"Menu"},{"name":"NoticeList"},{"name":"Switch"},{"name":"MoneyField"},{"name":"TimeField"},{"name":"Disclosure"},{"name":"Toggletip"},{"name":"Tooltip"},{"name":"Toast"},{"name":"Avatar"},{"name":"ShareSplit"},{"name":"Comparison"},{"name":"TracePath"},{"name":"FileList"},{"name":"DocumentPreview"},{"name":"BulkBar"},{"name":"SidePanel"},{"name":"ScanView"},{"name":"AudioRecorder"}]} */
(function () {
  'use strict';
  var React = window.React;
  var h = React.createElement;
  var Fragment = React.Fragment;
  var useState = React.useState;
  var useRef = React.useRef;
  var useEffect = React.useEffect;
  var useLayoutEffect = React.useLayoutEffect;

  var ICONS = {"archive":[["rect",{"width":"20","height":"5","x":"2","y":"3","rx":"1"}],["path",{"d":"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"}],["path",{"d":"M10 12h4"}]],"arrow-left":[["path",{"d":"m12 19-7-7 7-7"}],["path",{"d":"M19 12H5"}]],"arrow-right":[["path",{"d":"M5 12h14"}],["path",{"d":"m12 5 7 7-7 7"}]],"arrow-right-left":[["path",{"d":"m16 3 4 4-4 4"}],["path",{"d":"M20 7H4"}],["path",{"d":"m8 21-4-4 4-4"}],["path",{"d":"M4 17h16"}]],"ban":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M4.929 4.929 19.07 19.071"}]],"banknote":[["rect",{"width":"20","height":"12","x":"2","y":"6","rx":"2"}],["circle",{"cx":"12","cy":"12","r":"2"}],["path",{"d":"M6 12h.01M18 12h.01"}]],"building-2":[["path",{"d":"M10 12h4"}],["path",{"d":"M10 8h4"}],["path",{"d":"M14 21v-3a2 2 0 0 0-4 0v3"}],["path",{"d":"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"}],["path",{"d":"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"}]],"calendar":[["path",{"d":"M8 2v3"}],["path",{"d":"M16 2v3"}],["rect",{"x":"3","y":"3","width":"18","height":"18","rx":"2"}],["path",{"d":"M3 9h18"}]],"chart-column":[["path",{"d":"M3 3v16a2 2 0 0 0 2 2h16"}],["path",{"d":"M18 17V9"}],["path",{"d":"M13 17V5"}],["path",{"d":"M8 17v-3"}]],"check":[["path",{"d":"M20 6 9 17l-5-5"}]],"chevron-down":[["path",{"d":"m6 9 6 6 6-6"}]],"chevron-left":[["path",{"d":"m15 18-6-6 6-6"}]],"chevron-right":[["path",{"d":"m9 18 6-6-6-6"}]],"circle-alert":[["circle",{"cx":"12","cy":"12","r":"10"}],["line",{"x1":"12","x2":"12","y1":"8","y2":"12"}],["line",{"x1":"12","x2":"12.01","y1":"16","y2":"16"}]],"circle-check":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m16 9-5.5 5.5L8 12"}]],"circle-help":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"}],["path",{"d":"M12 17h.01"}]],"clock":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 6v6l4 2"}]],"command":[["path",{"d":"M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"}]],"copy":[["rect",{"width":"14","height":"14","x":"8","y":"8","rx":"2","ry":"2"}],["path",{"d":"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"}]],"credit-card":[["rect",{"width":"20","height":"14","x":"2","y":"5","rx":"2"}],["line",{"x1":"2","x2":"22","y1":"10","y2":"10"}]],"database":[["ellipse",{"cx":"12","cy":"5","rx":"9","ry":"3"}],["path",{"d":"M3 5V19A9 3 0 0 0 21 19V5"}],["path",{"d":"M3 12A9 3 0 0 0 21 12"}]],"disc-3":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M6 12c0-1.7.7-3.2 1.8-4.2"}],["circle",{"cx":"12","cy":"12","r":"2"}],["path",{"d":"M18 12c0 1.7-.7 3.2-1.8 4.2"}]],"download":[["path",{"d":"M12 15V3"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["path",{"d":"m7 10 5 5 5-5"}]],"ellipsis":[["circle",{"cx":"12","cy":"12","r":"1"}],["circle",{"cx":"19","cy":"12","r":"1"}],["circle",{"cx":"5","cy":"12","r":"1"}]],"external-link":[["path",{"d":"M15 3h6v6"}],["path",{"d":"M10 14 21 3"}],["path",{"d":"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"}]],"eye":[["path",{"d":"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"}],["circle",{"cx":"12","cy":"12","r":"3"}]],"file-check":[["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}],["path",{"d":"m9 15 2 2 4-4"}]],"file-text":[["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}],["path",{"d":"M10 9H8"}],["path",{"d":"M16 13H8"}],["path",{"d":"M16 17H8"}]],"filter":[["path",{"d":"M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"}]],"hand-heart":[["path",{"d":"M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"}],["path",{"d":"m14.45 13.39 5.05-4.694C20.196 8 21 6.85 21 5.75a2.75 2.75 0 0 0-4.797-1.837.276.276 0 0 1-.406 0A2.75 2.75 0 0 0 11 5.75c0 1.2.802 2.248 1.5 2.946L16 11.95"}],["path",{"d":"m2 15 6 6"}],["path",{"d":"m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a1 1 0 0 0-2.75-2.91"}]],"hard-drive":[["path",{"d":"M10 16h.01"}],["path",{"d":"M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"}],["path",{"d":"M21.946 12.013H2.054"}],["path",{"d":"M6 16h.01"}]],"history":[["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}],["path",{"d":"M3 3v5h5"}],["path",{"d":"M12 7v5l4 2"}]],"inbox":[["polyline",{"points":"22 12 16 12 14 15 10 15 8 12 2 12"}],["path",{"d":"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"}]],"info":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 16v-4"}],["path",{"d":"M12 8h.01"}]],"key-round":[["path",{"d":"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"}],["circle",{"cx":"16.5","cy":"7.5","r":".5","fill":"currentColor"}]],"languages":[["path",{"d":"m5 8 6 6"}],["path",{"d":"m4 14 6-6 2-3"}],["path",{"d":"M2 5h12"}],["path",{"d":"M7 2h1"}],["path",{"d":"m22 22-5-10-5 10"}],["path",{"d":"M14 18h6"}]],"layout-dashboard":[["rect",{"width":"7","height":"9","x":"3","y":"3","rx":"1"}],["rect",{"width":"7","height":"5","x":"14","y":"3","rx":"1"}],["rect",{"width":"7","height":"9","x":"14","y":"12","rx":"1"}],["rect",{"width":"7","height":"5","x":"3","y":"16","rx":"1"}]],"library":[["path",{"d":"m16 6 4 14"}],["path",{"d":"M12 6v14"}],["path",{"d":"M8 8v12"}],["path",{"d":"M4 4v16"}]],"link":[["path",{"d":"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"}],["path",{"d":"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"}]],"list-music":[["path",{"d":"M16 5H3"}],["path",{"d":"M11 12H3"}],["path",{"d":"M11 19H3"}],["path",{"d":"M21 16V5"}],["circle",{"cx":"18","cy":"16","r":"3"}]],"loader-circle":[["path",{"d":"M21 12a9 9 0 1 1-6.219-8.56"}]],"lock":[["rect",{"width":"18","height":"11","x":"3","y":"11","rx":"2","ry":"2"}],["path",{"d":"M7 11V7a5 5 0 0 1 10 0v4"}]],"log-out":[["path",{"d":"m16 17 5-5-5-5"}],["path",{"d":"M21 12H9"}],["path",{"d":"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"}]],"mic-vocal":[["path",{"d":"m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12"}],["path",{"d":"M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5"}],["circle",{"cx":"16","cy":"7","r":"5"}]],"monitor":[["rect",{"width":"20","height":"14","x":"2","y":"3","rx":"2"}],["line",{"x1":"8","x2":"16","y1":"21","y2":"21"}],["line",{"x1":"12","x2":"12","y1":"17","y2":"21"}]],"music":[["path",{"d":"M9 18V5l12-2v13"}],["circle",{"cx":"6","cy":"18","r":"3"}],["circle",{"cx":"18","cy":"16","r":"3"}]],"octagon-x":[["path",{"d":"m15 9-6 6"}],["path",{"d":"M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z"}],["path",{"d":"m9 9 6 6"}]],"pause":[["rect",{"x":"14","y":"3","width":"5","height":"18","rx":"1"}],["rect",{"x":"5","y":"3","width":"5","height":"18","rx":"1"}]],"play":[["path",{"d":"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"}]],"plus":[["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]],"power":[["path",{"d":"M12 2v10"}],["path",{"d":"M18.4 6.6a9 9 0 1 1-12.77.04"}]],"qr-code":[["rect",{"width":"5","height":"5","x":"3","y":"3","rx":"1"}],["rect",{"width":"5","height":"5","x":"16","y":"3","rx":"1"}],["rect",{"width":"5","height":"5","x":"3","y":"16","rx":"1"}],["path",{"d":"M21 16h-3a2 2 0 0 0-2 2v3"}],["path",{"d":"M21 21v.01"}],["path",{"d":"M12 7v3a2 2 0 0 1-2 2H7"}],["path",{"d":"M3 12h.01"}],["path",{"d":"M12 3h.01"}],["path",{"d":"M12 16v.01"}],["path",{"d":"M16 12h1"}],["path",{"d":"M21 12v.01"}],["path",{"d":"M12 21v-1"}]],"refresh-cw":[["path",{"d":"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"}],["path",{"d":"M21 3v5h-5"}],["path",{"d":"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"}],["path",{"d":"M8 16H3v5"}]],"route":[["circle",{"cx":"6","cy":"19","r":"3"}],["path",{"d":"M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"}],["circle",{"cx":"18","cy":"5","r":"3"}]],"scale":[["path",{"d":"M12 3v18"}],["path",{"d":"m19 8 3 8a5 5 0 0 1-6 0zV7"}],["path",{"d":"M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"}],["path",{"d":"m5 8 3 8a5 5 0 0 1-6 0zV7"}],["path",{"d":"M7 21h10"}]],"search":[["path",{"d":"m21 21-4.34-4.34"}],["circle",{"cx":"11","cy":"11","r":"8"}]],"settings":[["path",{"d":"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"}],["circle",{"cx":"12","cy":"12","r":"3"}]],"shield-check":[["path",{"d":"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"}],["path",{"d":"m9 12 2 2 4-4"}]],"shopping-bag":[["path",{"d":"M16 10a4 4 0 0 1-8 0"}],["path",{"d":"M3.103 6.034h17.794"}],["path",{"d":"M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"}]],"smartphone":[["rect",{"width":"14","height":"20","x":"5","y":"2","rx":"2","ry":"2"}],["path",{"d":"M12 18h.01"}]],"speaker":[["rect",{"width":"16","height":"20","x":"4","y":"2","rx":"2"}],["path",{"d":"M12 6h.01"}],["circle",{"cx":"12","cy":"14","r":"4"}],["path",{"d":"M12 14h.01"}]],"tablet":[["rect",{"width":"16","height":"20","x":"4","y":"2","rx":"2","ry":"2"}],["line",{"x1":"12","x2":"12.01","y1":"18","y2":"18"}]],"triangle-alert":[["path",{"d":"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"}],["path",{"d":"M12 9v4"}],["path",{"d":"M12 17h.01"}]],"upload":[["path",{"d":"M12 3v12"}],["path",{"d":"m17 8-5-5-5 5"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}]],"user":[["path",{"d":"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"}],["circle",{"cx":"12","cy":"7","r":"4"}]],"users":[["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["path",{"d":"M16 3.128a4 4 0 0 1 0 7.744"}],["path",{"d":"M22 21v-2a4 4 0 0 0-3-3.87"}],["circle",{"cx":"9","cy":"7","r":"4"}]],"volume-x":[["path",{"d":"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"}],["line",{"x1":"22","x2":"16","y1":"9","y2":"15"}],["line",{"x1":"16","x2":"22","y1":"9","y2":"15"}]],"volume-2":[["path",{"d":"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"}],["path",{"d":"M16 9a5 5 0 0 1 0 6"}],["path",{"d":"M19.364 18.364a9 9 0 0 0 0-12.728"}]],"wifi-off":[["path",{"d":"M12 20h.01"}],["path",{"d":"M8.5 16.429a5 5 0 0 1 7 0"}],["path",{"d":"M5 12.859a10 10 0 0 1 5.17-2.69"}],["path",{"d":"M19 12.859a10 10 0 0 0-2.007-1.523"}],["path",{"d":"M2 8.82a15 15 0 0 1 4.177-2.643"}],["path",{"d":"M22 8.82a15 15 0 0 0-11.288-3.764"}],["path",{"d":"m2 2 20 20"}]],"wifi":[["path",{"d":"M12 20h.01"}],["path",{"d":"M2 8.82a15 15 0 0 1 20 0"}],["path",{"d":"M5 12.859a10 10 0 0 1 14 0"}],["path",{"d":"M8.5 16.429a5 5 0 0 1 7 0"}]],"x":[["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],"skip-back":[["path",{"d":"M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z"}],["path",{"d":"M3 20V4"}]],"skip-forward":[["path",{"d":"M21 4v16"}],["path",{"d":"M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"}]],"maximize":[["path",{"d":"M8 3H5a2 2 0 0 0-2 2v3"}],["path",{"d":"M21 8V5a2 2 0 0 0-2-2h-3"}],["path",{"d":"M3 16v3a2 2 0 0 0 2 2h3"}],["path",{"d":"M16 21h3a2 2 0 0 0 2-2v-3"}]],"minus":[["path",{"d":"M5 12h14"}]],"chevron-up":[["path",{"d":"m18 15-6-6-6 6"}]],"eye-off":[["path",{"d":"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"}],["path",{"d":"M14.084 14.158a3 3 0 0 1-4.242-4.242"}],["path",{"d":"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"}],["path",{"d":"m2 2 20 20"}]],"ellipsis-vertical":[["circle",{"cx":"12","cy":"12","r":"1"}],["circle",{"cx":"12","cy":"5","r":"1"}],["circle",{"cx":"12","cy":"19","r":"1"}]],"printer":[["path",{"d":"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"}],["path",{"d":"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"}],["rect",{"x":"6","y":"14","width":"12","height":"8","rx":"1"}]],"bell":[["path",{"d":"M10.268 21a2 2 0 0 0 3.464 0"}],["path",{"d":"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"}]],"file":[["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}]],"file-image":[["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}],["circle",{"cx":"10","cy":"12","r":"2"}],["path",{"d":"m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22"}]],"file-spreadsheet":[["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}],["path",{"d":"M8 13h2"}],["path",{"d":"M14 13h2"}],["path",{"d":"M8 17h2"}],["path",{"d":"M14 17h2"}]],"trash-2":[["path",{"d":"M10 11v6"}],["path",{"d":"M14 11v6"}],["path",{"d":"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"}],["path",{"d":"M3 6h18"}],["path",{"d":"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"}]],"flashlight":[["path",{"d":"M18 6c0 2-2 2-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4V2h12z"}],["line",{"x1":"6","x2":"18","y1":"6","y2":"6"}],["line",{"x1":"12","x2":"12","y1":"12","y2":"12"}]],"keyboard":[["path",{"d":"M10 8h.01"}],["path",{"d":"M12 12h.01"}],["path",{"d":"M14 8h.01"}],["path",{"d":"M16 12h.01"}],["path",{"d":"M18 8h.01"}],["path",{"d":"M6 8h.01"}],["path",{"d":"M7 16h10"}],["path",{"d":"M8 12h.01"}],["rect",{"width":"20","height":"16","x":"2","y":"4","rx":"2"}]],"square":[["rect",{"width":"14","height":"14","x":"5","y":"5","rx":"2","fill":"currentColor"}]],"mic":[["path",{"d":"M12 19v3"}],["path",{"d":"M19 10v2a7 7 0 0 1-14 0v-2"}],["rect",{"x":"9","y":"2","width":"6","height":"13","rx":"3"}]],"chevrons-up-down":[["path",{"d":"m7 15 5 5 5-5"}],["path",{"d":"m7 9 5-5 5 5"}]],"arrow-up":[["path",{"d":"m5 12 7-7 7 7"}],["path",{"d":"M12 19V5"}]],"arrow-down":[["path",{"d":"M12 5v14"}],["path",{"d":"m19 12-7 7-7-7"}]],"approximately-equal":[["path",{"d":"M5 15a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0"}],["path",{"d":"M5 9a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0"}]],"circle-dashed":[["path",{"d":"M10.1 2.182a10 10 0 0 1 3.8 0"}],["path",{"d":"M13.9 21.818a10 10 0 0 1-3.8 0"}],["path",{"d":"M17.609 3.721a10 10 0 0 1 2.69 2.7"}],["path",{"d":"M2.182 13.9a10 10 0 0 1 0-3.8"}],["path",{"d":"M20.279 17.609a10 10 0 0 1-2.7 2.69"}],["path",{"d":"M21.818 10.1a10 10 0 0 1 0 3.8"}],["path",{"d":"M3.721 6.391a10 10 0 0 1 2.7-2.69"}],["path",{"d":"M6.391 20.279a10 10 0 0 1-2.69-2.7"}]],"image":[["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","ry":"2"}],["circle",{"cx":"9","cy":"9","r":"2"}],["path",{"d":"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"}]]};

  // ---------------------------------------------------------------- helpers

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(' ');
  }
  var seq = 0;
  function useUid(prefix) {
    var ref = useRef(null);
    if (ref.current === null) { seq += 1; ref.current = (prefix || 'r1') + '-' + seq; }
    return ref.current;
  }
  function isNil(v) { return v === null || v === undefined; }
  function lang(locale) { return locale === 'en' ? 'en' : 'vi'; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // The value a control shows: its own state, reset whenever the page passes a new value.
  // Compare by a string key when the value is an array or object built afresh on each render.
  function useSynced(value, fallback) {
    var st = useState(isNil(value) ? fallback : value);
    var last = useRef(value);
    if (value !== last.current) { last.current = value; if (!isNil(value) && value !== st[0]) st[1](value); }
    return st;
  }
  // The latest props, for handlers registered once in an effect.
  function useLatest(v) { var r = useRef(v); r.current = v; return r; }

  // Focus moves only after the reader did something. A specimen drawn open on a design canvas,
  // where nothing on the page has focus, never takes it.
  function readerActed() { var a = document.activeElement; return !!a && a !== document.body && a !== document.documentElement; }
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function focusables(root) {
    return root ? Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (e) { return e.getClientRects().length > 0; }) : [];
  }
  function focusEl(el) { if (el && el.focus) el.focus({ preventScroll: true }); }
  function isTyping(el) {
    return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
  }
  function isControl(el) {
    return isTyping(el) || (!!el && (/^(BUTTON|A)$/.test(el.tagName) || el.getAttribute('role') === 'slider'));
  }

  // Screen-reader announcements go through regions that are on the page before anything is said into
  // them; a region created together with its text is often not read.
  function liveRegion(kind) {
    if (typeof document === 'undefined' || !document.body) return null;
    var el = document.querySelector('[data-r1-live="' + kind + '"]');
    if (!el) {
      el = document.createElement('div');
      el.setAttribute('data-r1-live', kind);
      el.setAttribute('aria-live', kind);
      el.setAttribute('aria-atomic', 'true');
      el.className = 'r1-sr';
      document.body.appendChild(el);
    }
    return el;
  }
  function ensureLive() { liveRegion('polite'); liveRegion('assertive'); }
  if (typeof document !== 'undefined') {
    if (document.body) ensureLive(); else document.addEventListener('DOMContentLoaded', ensureLive);
  }
  function announce(text, kind) {
    var el = liveRegion(kind || 'polite');
    if (!el || !text) return;
    el.textContent = '';
    setTimeout(function () { el.textContent = text; }, 100);
  }
  // Join sentences for one announcement: a part that already ends a sentence is not given a second stop.
  function joinSentences(parts) { return parts.filter(Boolean).reduce(function (a, b) { return a ? a + (/[.!?\u2026:]$/.test(a) ? ' ' : '. ') + b : b; }, ''); }
  function textOf(node) {
    if (isNil(node) || node === false) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join(' ');
    return node.props ? textOf(node.props.children) : '';
  }
  // Matching that ignores Vietnamese marks and case: "ha noi" finds "Hà Nội".
  function fold(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd').replace(/\u0110/g, 'D').toLowerCase();
  }
  // A noun put at the start of a sentence: "gi\u1ea5y x\u00e1c nh\u1eadn" opens "Gi\u1ea5y x\u00e1c nh\u1eadn h\u1ee3p l\u1ec7\u2026".
  function capFirst(s) { s = String(s || ''); return s.charAt(0).toLocaleUpperCase() + s.slice(1); }
  // A default sentence that names the record only when the page names it (recordNoun); otherwise the neutral one.
  function nounText(neutral, withNoun, noun) {
    if (!noun) return neutral;
    return withNoun.replace('{Noun}', capFirst(noun)).replace('{noun}', String(noun));
  }
  // Developer messages for a binding the system refuses or a key list that names a key nothing binds. Said once each.
  var warned = {};
  function warnOnce(msg) {
    if (warned[msg]) return;
    warned[msg] = true;
    if (typeof console !== 'undefined' && console.warn) console.warn('R1: ' + msg);
  }

  var TX = {
    "vi": {
      "secret": { "copy": "Sao chép", "copied": "Đã sao chép", "copyAll": "Sao chép cả {n} mã", "once": "Sao chép ngay. Giá trị này không hiện lại sau khi bạn rời trang." },
      "notice": { "until": "Hết hạn lúc {at}, còn {left}", "ended": "Đã hết hạn lúc {at}" },
      "refusedTitle": "Bạn không xem được danh sách này",
      "refusedText": "Bạn chưa có quyền mà yêu cầu này cần. Màn trước đó nêu ai cấp quyền này.",
      "copy": "Sao chép",
      "copied": "Đã sao chép",
      "required": "Bắt buộc",
      "noValue": "không có giá trị",
      "notCalculated": "chưa tính",
      "loading": "Đang tải",
      "unavailableWord": "KHÔNG ĐỌC ĐƯỢC",
      "ack": "Tôi đã đọc cảnh báo này và vẫn tiếp tục",
      "disabledBecause": "Chưa dùng được:",
      "readOnly": "Chỉ xem",
      "policyFrom": "hiệu lực từ",
      "sortAsc": "tăng dần",
      "sortDesc": "giảm dần",
      "showing": "Đang hiện",
      "next": "Trang sau",
      "prev": "Trang trước",
      "code": "Mã",
      "traceRef": "Mã tham chiếu",
      "quoteSupport": "đưa mã này khi liên hệ hỗ trợ.",
      "couldNotLoad": "Không tải được phần này.",
      "retry": "Thử lại",
      "retryNoHelp": "Thử lại lúc này chưa giúp được. Sự cố đã được ghi nhận.",
      "close": "Đóng",
      "cancel": "Huỷ",
      "savedAt": "Đã lưu lúc",
      "step": "Bước",
      "filters": "Bộ lọc",
      "newTab": "mở trong thẻ mới",
      "selectAll": "Chọn tất cả các dòng",
      "selectRow": "Chọn dòng",
      "actionsCol": "Thao tác",
      "codeInput": {
        "digit": "Chữ số",
        "char": "Ký tự",
        "of": "trên",
        "checking": "Đang kiểm tra mã"
      },
      "itemList": {
        "up": "Chuyển lên",
        "down": "Chuyển xuống",
        "remove": "Bỏ khỏi danh sách",
        "moved": "{title}: đã chuyển tới vị trí {n}.",
        "removed": "{title}: đã bỏ khỏi danh sách.",
        "empty": "Chưa có mục nào."
      },
      "pager": {
        "label": "Phân trang",
        "prev": "Trang trước",
        "next": "Trang sau",
        "first": "Về đầu danh sách",
        "perPage": "Mỗi trang",
        "end": "Đã hiện hết danh sách.",
        "loading": "Đang tải trang"
      },
      "search": {
        "clear": "Xoá nội dung tìm",
        "searching": "Đang tìm",
        "results": "{n} kết quả.",
        "noResults": "Không có kết quả nào."
      },
      "combo": {
        "noResults": "Không có mục nào khớp. Thử gõ ít chữ hơn.",
        "results": "{n} mục khớp.",
        "count": "Đã chọn {n}",
        "picked": "Đã chọn {label}.",
        "unpicked": "Đã bỏ {label}.",
        "remove": "Bỏ {label}",
        "clearAll": "Bỏ chọn tất cả",
        "chosen": "Các mục đã chọn",
        "custom": "Dùng “{text}”"
      },
      "date": {
        "choose": "Chọn ngày",
        "from": "Từ ngày",
        "to": "Đến ngày",
        "prevMonth": "Tháng trước",
        "nextMonth": "Tháng sau",
        "today": "hôm nay",
        "placeholder": "dd/mm/yyyy",
        "day": "Ngày",
        "time": "Giờ",
        "helpDateTime": "Ngày theo dạng ngày/tháng/năm, giờ theo 24 giờ.",
        "helpDateTimeStep": "Ngày theo dạng ngày/tháng/năm, giờ theo 24 giờ, bước {n} phút."
      },
      "password": {
        "show": "Hiện mật khẩu",
        "hide": "Ẩn mật khẩu",
        "showShort": "Hiện",
        "hideShort": "Ẩn",
        "met": "đã đạt",
        "notMet": "chưa đạt",
        "visible": "Mật khẩu đang hiện.",
        "hidden": "Mật khẩu đã ẩn."
      },
      "breakdown": {
        "indicative": "Tạm tính",
        "item": "Khoản",
        "basis": "Cách tính",
        "amount": "Số tiền"
      },
      "metric": {
        "noData": "Chưa có dữ liệu",
        "derived": "Tính từ",
        "interval": "Khoảng",
        "derivedNoBasis": "Tính từ các số liệu khác"
      },
      "units": {
        "day": "ngày",
        "days": "ngày",
        "hour": "giờ",
        "hours": "giờ",
        "minute": "phút",
        "minutes": "phút"
      },
      "deadline": {
        "left": "Còn {d}",
        "overdue": "Quá hạn {d}",
        "met": "Đã xử lý trong hạn",
        "late": "Đã xử lý, trễ {d}",
        "paused": "Tạm dừng đếm giờ",
        "due": "Hạn",
        "doneAt": "Xử lý lúc",
        "none": "Chưa đặt hạn",
        "announce": "{label}: còn {d}.",
        "announceBare": "Còn {d} đến hạn."
      },
      "rows": {
        "add": "Thêm dòng",
        "remove": "Xoá dòng",
        "removeShort": "Xoá",
        "max": "Đã đủ {n} dòng, không thêm được nữa.",
        "count": "{n} trên tối đa {max} dòng",
        "added": "Đã thêm {title}.",
        "removed": "Đã xoá một dòng. Còn {n} dòng."
      },
      "audio": {
        "label": "Nghe thử",
        "play": "Nghe thử",
        "pause": "Tạm dừng",
        "position": "Vị trí đang nghe",
        "unavailable": "Chưa nghe thử được: tệp đang xử lý.",
        "failed": "Chưa phát được tệp này. Thử lại sau ít phút."
      },
      "print": {
        "ref": "Mã tham chiếu",
        "verify": "Kiểm tra mã này tại",
        "refNoun": "Mã {noun}",
        "verifyNoun": "Kiểm tra {noun} này tại",
        "issued": "Cấp lúc",
        "page": "Trang",
        "refEnt": "Mã tra cứu",
        "verifyEnt": "Kiểm tra giấy này tại",
        "statusAt": "lúc"
      },
      "verify": {
        "valid": "Mã này hợp lệ và đang có hiệu lực",
        "revoked": "Mã này đã bị thu hồi",
        "expired": "Mã này đã hết hiệu lực",
        "superseded": "Mã này đã được thay bằng bản mới hơn",
        "not-found": "Không tìm thấy mã này",
        "unavailable": "Lúc này chưa kiểm tra được mã này",
        "code": "Mã",
        "checkedAt": "Kiểm tra lúc",
        "recordedAt": "Ghi nhận lúc",
        "checking": "Đang kiểm tra mã",
        "noun": {
          "valid": "{Noun} hợp lệ và đang có hiệu lực",
          "revoked": "{Noun} này đã bị thu hồi",
          "expired": "{Noun} này đã hết hiệu lực",
          "superseded": "{Noun} này đã được thay bằng bản mới hơn",
          "not-found": "Không có {noun} nào mang mã này",
          "unavailable": "Lúc này chưa kiểm tra được {noun}",
          "checking": "Đang kiểm tra {noun}"
        }
      },
      "menu": {
        "more": "Thao tác khác"
      },
      "sw": {
        "on": "Bật",
        "off": "Tắt",
        "saving": "Đang lưu"
      },
      "time": {
        "help": "Giờ theo 24 giờ, ví dụ 18:30.",
        "helpEnd": "Giờ theo 24 giờ; 24:00 là hết ngày.",
        "helpStep": "Giờ theo 24 giờ, bước {n} phút, ví dụ {e}.",
        "helpStepEnd": "Giờ theo 24 giờ, bước {n} phút; 24:00 là hết ngày.",
        "rounded": "Đã làm tròn thành {t}."
      },
      "tip": {
        "explain": "Giải thích"
      },
      "toast": {
        "close": "Đóng thông báo"
      },
      "split": {
        "total": "Tổng",
        "complete": "Đã chia đủ.",
        "short": "Còn {n} chưa chia.",
        "over": "Vượt {n}; hãy bớt phần của một bên."
      },
      "compare": {
        "changed": "{n} trường khác nhau.",
        "changedOne": "1 trường khác nhau.",
        "same": "Không có trường nào khác nhau.",
        "field": "Trường",
        "differs": "Khác"
      },
      "trace": {
        "label": "Nguồn của số liệu"
      },
      "files": {
        "none": "Chưa có tệp nào.",
        "scanning": "Đang kiểm tra",
        "quarantined": "Bị cách ly",
        "failed": "Không tải lên được",
        "download": "Tải về",
        "remove": "Xoá tệp",
        "uploading": "Đang tải lên",
        "retry": "Tải lên lại",
        "cancel": "Huỷ tải lên"
      },
      "doc": {
        "prev": "Trang trước",
        "next": "Trang sau",
        "page": "Trang {n}/{of}",
        "zoomIn": "Phóng to",
        "zoomOut": "Thu nhỏ",
        "download": "Tải về",
        "unavailable": "Chưa xem trước được tệp này. Tải về để mở.",
        "loading": "Đang tải trang {n}"
      },
      "bulk": {
        "label": "Thao tác với các mục đã chọn",
        "count": "Đã chọn {n}",
        "countOf": "Đã chọn {n} trên {total}",
        "clear": "Bỏ chọn",
        "cleared": "Đã bỏ chọn tất cả."
      },
      "side": {
        "close": "Đóng"
      },
      "scan": {
        "label": "Quét mã",
        "labelNoun": "Quét mã {noun}",
        "asking": "Cho phép dùng camera để quét mã QR.",
        "askingNoun": "Cho phép dùng camera để quét mã trên {noun}.",
        "scanning": "Đưa mã QR vào giữa khung.",
        "found": "Đã đọc được mã",
        "denied": "Không dùng được camera. Nhập mã in bên cạnh mã QR.",
        "unsupported": "Thiết bị này không quét được mã. Nhập mã in bên cạnh mã QR.",
        "unavailable": "Lúc này chưa quét được mã. Nhập mã in bên cạnh mã QR.",
        "torch": "Đèn pin",
        "manual": "Nhập mã",
        "allow": "Cho phép dùng camera",
        "help": "Cách bật lại camera"
      },
      "rec": {
        "label": "Ghi âm đo tại chỗ",
        "start": "Bắt đầu ghi",
        "stop": "Dừng ghi",
        "again": "Ghi lại",
        "idle": "Sẵn sàng ghi",
        "recording": "Đang ghi",
        "recorded": "Đã ghi xong",
        "denied": "Không dùng được micro. Cấp quyền micro rồi thử lại.",
        "keep": "Dùng bản ghi này",
        "discard": "Bỏ bản ghi",
        "retry": "Thử lại"
      },
      "table": {
        "details": "Chi tiết",
        "expand": "Xem thêm",
        "collapse": "Thu gọn",
        "total": "Tổng",
        "rowActions": "Thao tác với",
        "loadingMore": "Đang tải thêm",
        "noRows": "Không có dòng nào khớp.",
        "changed": "Vừa cập nhật",
        "selectPage": "Đã chọn cả {n} dòng trên trang này.",
        "selectAll": "Chọn cả {total}",
        "selectedAll": "Đã chọn cả {total}.",
        "clearAll": "Bỏ chọn tất cả",
        "open": "đang mở bên cạnh",
        "none": "Bảng này chưa có dòng nào.",
        "captionFrom": "Bảng gồm các cột {cols}",
        "hidden": "Đang ẩn: {cols}. Mở một dòng để xem.",
        "dropped": "đã loại"
      },
      "chip": {
        "remove": "Bỏ lọc"
      },
      "notices": {
        "title": "Thông báo",
        "unread": "Chưa đọc",
        "unreadCount": "{n} chưa đọc",
        "markAll": "Đánh dấu đã đọc hết",
        "empty": "Chưa có thông báo nào.",
        "markedAll": "Đã đánh dấu đã đọc hết."
      },
      "prov": {
        "registry-sourced": "Từ sổ đăng ký",
        "declared": "Tự khai",
        "evidenced": "Có chứng từ",
        "corrected": "Đã đính chính",
        "derived": "Suy ra",
        "alternative-route": "Tuyến thay thế",
        "manual-override": "Ghi đè thủ công",
        "authoritative": "Chính thức",
        "estimated": "Ước tính",
        "imputed": "Điền khuyết",
        "illustrative": "Minh hoạ"
      },
      "figures": "Số liệu",
      "asOf": "tính đến",
      "upload": {
        "drop": "Kéo tệp vào đây, hoặc",
        "choose": "chọn tệp",
        "pipeline": "Các bước xử lý tệp",
        "release": "Thả tệp để tải lên",
        "replace": "Chọn tệp khác",
        "ready": "Đã xử lý xong tệp.",
        "states": {
          "done": "xong",
          "current": "đang xử lý",
          "todo": "chưa tới",
          "failed": "không thành công"
        }
      },
      "legal": {
        "contents": "Mục lục",
        "version": "Phiên bản",
        "effective": "Hiệu lực từ",
        "read": "Đã đọc"
      },
      "sign": {
        "typeName": "Họ tên pháp lý đầy đủ",
        "mustScroll": "Đọc hết văn bản đến cuối",
        "mustType": "Nhập họ tên pháp lý đúng như trên giấy tờ tuỳ thân",
        "sign": "Ký",
        "remaining": "Để ký, còn:",
        "ready": "Đã đủ điều kiện ký.",
        "signed": "Đã ký lúc {t}.",
        "signedDone": "Đã ký."
      },
      "approval": {
        "preparer": "Người lập",
        "approver": "Người duyệt",
        "awaiting": "Chưa có người duyệt",
        "same": "Người lập hồ sơ không thể tự duyệt. Cần một người duyệt khác.",
        "noPreparer": "Chưa ghi người lập",
        "comment": "Nhận xét của người duyệt",
        "commentShort": "Nhận xét",
        "decision": {
          "approved": "Đã duyệt",
          "rejected": "Không duyệt",
          "returned": "Trả lại để sửa",
          "declined": "Giữ nguyên"
        }
      },
      "queue": {
        "keys": [
          [
            [
              "↑",
              "↓"
            ],
            "di chuyển"
          ],
          [
            [
              "Enter"
            ],
            "mở"
          ],
          [
            [
              "Esc"
            ],
            "quay lại"
          ],
          [
            [
              "X"
            ],
            "chọn"
          ]
        ],
        "selected": "đã chọn",
        "empty": "Không còn việc nào trong hàng chờ này."
      },
      "deck": {
        "pause": "Tạm dừng",
        "play": "Phát tiếp",
        "volume": "Âm lượng",
        "position": "Vị trí trong bài",
        "upNext": "Tiếp theo",
        "later": "Sau đó",
        "artwork": "Ảnh bìa",
        "artworkOff": "Ảnh bìa tạm chưa có",
        "paused": "Nhạc đang tạm dừng",
        "previous": "Bài trước",
        "next": "Bài tiếp",
        "fullscreen": "Toàn màn hình",
        "previousOff": "Không lùi bài được: bài đã phát chỉ phát lại khi cả danh sách đã phát hết.",
        "player": "Player",
        "sync": "Đồng bộ và bộ nhớ",
        "shortcuts": "Phím tắt",
        "keyPause": "Tạm dừng hoặc phát tiếp",
        "keyVolume": "Âm lượng",
        "keyNext": "Bài tiếp",
        "keyFull": "Toàn màn hình",
        "of": "trên",
        "doLabel": "Cần làm",
        "mute": "Tắt tiếng",
        "unmute": "Bật tiếng",
        "min": "phút",
        "mins": "phút",
        "sec": "giây",
        "secs": "giây",
        "posOf": "{at} trên {of}",
        "leftOf": "còn lại trên {max}",
        "leftIn": "còn {d}",
        "more": "và {n} bài nữa trước {until}",
        "moreAll": "và {n} bài nữa",
        "nothingNext": "Không còn bài nào xếp tiếp theo.",
        "schedule": "Lịch phát",
        "offlineLeft": "Thời gian còn được phát khi mất kết nối",
        "storage": "Bộ nhớ đã dùng",
        "states": {
          "online": "Đang phát",
          "offline": "Mất kết nối, nhạc vẫn phát",
          "syncing": "Đang đồng bộ",
          "ceiling": "Tạm ngừng ghi minh chứng",
          "limit-reached": "Đã dừng",
          "cannot-continue": "Đã dừng",
          "stopped": "Đã dừng",
          "fault": "Sự cố thiết bị",
          "paused": "Tạm dừng",
          "unpaired": "Chưa ghép"
        }
      },
      "timeline": {
        "corrects": "Đính chính cho mục",
        "appendOnly": "Lịch sử chỉ ghi thêm.",
        "current": "Mục hiện tại:"
      },
      "player": {
        "online": "Đang phát, đã đồng bộ",
        "offline": "Mất kết nối, nhạc vẫn phát",
        "stopped": "Nhạc đã dừng",
        "cannot": "Không phát được nhạc",
        "ceiling": "Tạm ngừng ghi minh chứng",
        "left": "còn lại",
        "of": "trên",
        "queued": "Minh chứng chờ gửi",
        "lastContact": "Kết nối lần cuối",
        "none": "Không có",
        "limit": "Đã hết thời gian phát khi mất kết nối"
      },
      "now": {
        "nowPlaying": "Đang phát",
        "composer": "Sáng tác",
        "lyricist": "Lời",
        "performer": "Trình bày",
        "producer": "Sản xuất",
        "available": "có",
        "unavailable": "tạm chưa có",
        "optionalNote": "Phần tạm chưa có không ảnh hưởng đến nhạc đang phát.",
        "none": "không có"
      },
      "shell": {
        "help": "Trợ giúp",
        "privacy": "Quyền riêng tư",
        "contact": "Liên hệ",
        "legal": "Văn bản pháp lý",
        "search": "Tìm theo thiết bị, cơ sở hoặc mã",
        "queue": "Hàng chờ",
        "more": "Thêm",
        "narrow": "Bàn vận hành được dựng cho cửa sổ rộng từ 1.024 px. Hãy mở rộng cửa sổ hoặc dùng màn hình lớn hơn để thấy đủ các cột.",
        "language": "Ngôn ngữ",
        "menu": "Điều hướng chính",
        "collapse": "Thu gọn thanh bên",
        "skip": "Tới nội dung chính",
        "signOut": "Đăng xuất",
        "fieldStatus": "Tình trạng thiết bị",
        "online": "Có mạng",
        "offline": "Không có mạng",
        "keyValid": "Khoá xác minh còn hạn đến {date}",
        "keyExpiring": "Khoá xác minh hết hạn lúc {date}",
        "keyMissing": "Chưa có khoá xác minh",
        "keyMissingDo": "Kết nối mạng để tải khoá."
      },
      "chart": {
        "category": "Hạng mục"
      },
      "empty": {
        "notStarted": "Chưa có dữ liệu cho kỳ này.",
        "governed": "Không có mục nào đủ điều kiện.",
        "filtered": "Bộ lọc đang loại hết các dòng.",
        "clearFilters": "Bỏ bộ lọc",
        "noObligation": "Không phát sinh khoản phải nộp cho kỳ này.",
        "waiting": "Đang chờ",
        "decider": "Người quyết định",
        "due": "Hạn quyết định"
      },
      "stepper": {
        "done": "đã xong",
        "current": "đang làm",
        "todo": "chưa làm",
        "blocked": "chưa làm được"
      },
      "navlist": {
        "label": "Đi tới"
      },
      "langs": {
        "vi": "Tiếng Việt",
        "en": "English"
      },
      "status": {
        "positive": "Bình thường",
        "attention": "Cần chú ý",
        "danger": "Nghiêm trọng",
        "neutral": "Ghi chú",
        "info": "Thông tin"
      },
      "badge": {
        "working": "đang xử lý",
        "workingMark": "đang"
      },
      "view": {
        "loaded": "Đã tải xong."
      },
      "panel": {
        "positive": "Đạt",
        "attention": "Cần chú ý",
        "danger": "Có vấn đề",
        "info": "Thông tin",
        "neutral": "Không áp dụng"
      },
      "sched": {
        "next": "còn tiếp sang ngày sau",
        "prev": "tiếp từ ngày trước"
      },
      "layout": {
        "crumbs": "Đường dẫn trang",
        "context": "Đang làm việc với",
        "expand": "Mở rộng thanh bên",
        "moreNav": "Các mục khác",
        "keys": "Phím tắt",
        "keyHelp": "Mở danh sách phím tắt này",
        "keySearch": "Mở bảng lệnh",
        "singleKeys": "Phím một ký tự",
        "singleKeysHelp": "Các phím tắt chỉ có một ký tự, như / và ?. Phím di chuyển giữa các dòng của bảng vẫn dùng được khi đang ở trong bảng.",
        "singleKeysForced": "Ứng dụng này đã tắt phím một ký tự.",
        "keyOff": "đang tắt"
      },
      "copyFailed": "Chưa sao chép được. Mã đã được chọn để bạn tự sao chép.",
      "copyFailedShort": "Chưa sao chép được",
      "noDate": "chưa có ngày",
      "noId": "chưa có mã",
      "qr": {
        "label": "Mã QR",
        "opens": "Mã QR mở {url}"
      },
      "provSource": "Nguồn:",
      "provPlain": {
        "registry-sourced": "Theo sổ đăng ký",
        "declared": "Bạn khai",
        "evidenced": "Bạn khai, có giấy tờ",
        "corrected": "RightOne đã điều chỉnh",
        "derived": "RightOne tính từ quy tắc",
        "alternative-route": "Theo nguồn khác",
        "manual-override": "Theo quyết định của RightOne",
        "authoritative": "Theo nguồn chính thức",
        "estimated": "RightOne ước tính",
        "imputed": "RightOne điền vào chỗ thiếu",
        "illustrative": "Chỉ để minh hoạ"
      },
      "idMask": {
        "show": "Hiện",
        "hide": "Ẩn",
        "showName": "Hiện đầy đủ mã",
        "hideName": "Ẩn mã",
        "shown": "Mã đang hiện đầy đủ.",
        "hidden": "Mã đã ẩn.",
        "ending": "mã kết thúc bằng {tail}",
        "hiddenValue": "mã đang ẩn",
        "copyFailed": "Chưa sao chép được. Hiện đầy đủ mã rồi tự sao chép."
      },
      "valueMask": {
        "show": "Hiện",
        "hide": "Ẩn",
        "showName": "Hiện giá trị",
        "hideName": "Ẩn giá trị",
        "shown": "Giá trị đang hiện.",
        "hidden": "Giá trị đã ẩn.",
        "ending": "giá trị kết thúc bằng {tail}",
        "hiddenValue": "giá trị đang ẩn"
      },
      "facts": {
        "change": "Sửa"
      },
      "freshUnknown": "Chưa rõ số liệu được tính lúc nào."
    },
    "en": {
      "secret": { "copy": "Copy", "copied": "Copied", "copyAll": "Copy all {n} codes", "once": "Copy it now. It is not shown again once you leave this page." },
      "notice": { "until": "Ends at {at}, {left} left", "ended": "Ended at {at}" },
      "refusedTitle": "You cannot see this list",
      "refusedText": "You do not hold the permission this request needs. The screen you came from names who grants it.",
      "copy": "Copy",
      "copied": "Copied",
      "required": "Required",
      "noValue": "no value",
      "notCalculated": "not calculated",
      "loading": "Loading",
      "unavailableWord": "UNAVAILABLE",
      "ack": "I have read this warning and want to continue",
      "disabledBecause": "Not available yet:",
      "readOnly": "Read-only",
      "policyFrom": "effective from",
      "sortAsc": "ascending",
      "sortDesc": "descending",
      "showing": "Showing",
      "next": "Next page",
      "prev": "Previous page",
      "code": "Code",
      "traceRef": "Reference",
      "quoteSupport": "quote it to support.",
      "couldNotLoad": "We could not load this.",
      "retry": "Try again",
      "retryNoHelp": "Trying again now will not help. The fault has been recorded.",
      "close": "Close",
      "cancel": "Cancel",
      "savedAt": "Saved",
      "step": "Step",
      "filters": "Filters",
      "newTab": "opens in a new tab",
      "selectAll": "Select all rows",
      "selectRow": "Select row",
      "actionsCol": "Actions",
      "codeInput": {
        "digit": "Digit",
        "char": "Character",
        "of": "of",
        "checking": "Checking the code"
      },
      "itemList": {
        "up": "Move up",
        "down": "Move down",
        "remove": "Remove",
        "moved": "{title} moved to position {n}.",
        "removed": "{title} removed from the list.",
        "empty": "Nothing here yet."
      },
      "pager": {
        "label": "Pages",
        "prev": "Previous",
        "next": "Next",
        "first": "Back to the start",
        "perPage": "Per page",
        "end": "That is the whole list.",
        "loading": "Loading the page"
      },
      "search": {
        "clear": "Clear the search",
        "searching": "Searching",
        "results": "{n} results.",
        "oneResult": "One result.",
        "noResults": "No results."
      },
      "combo": {
        "noResults": "Nothing matches. Try fewer letters.",
        "results": "{n} options match.",
        "oneResult": "One option matches.",
        "count": "{n} selected",
        "picked": "{label} selected.",
        "unpicked": "{label} removed.",
        "remove": "Remove {label}",
        "clearAll": "Clear all",
        "chosen": "Selected",
        "custom": "Use “{text}”"
      },
      "date": {
        "choose": "Choose a date",
        "from": "From",
        "to": "To",
        "prevMonth": "Previous month",
        "nextMonth": "Next month",
        "today": "today",
        "placeholder": "dd/mm/yyyy",
        "day": "Date",
        "time": "Time",
        "helpDateTime": "Date as day/month/year, time on the 24-hour clock.",
        "helpDateTimeStep": "Date as day/month/year, time on the 24-hour clock in steps of {n} minutes."
      },
      "password": {
        "show": "Show the password",
        "hide": "Hide the password",
        "showShort": "Show",
        "hideShort": "Hide",
        "met": "met",
        "notMet": "not met",
        "visible": "The password is visible.",
        "hidden": "The password is hidden."
      },
      "breakdown": {
        "indicative": "Indicative",
        "item": "Item",
        "basis": "Basis",
        "amount": "Amount"
      },
      "metric": {
        "noData": "No data yet",
        "derived": "Worked out from",
        "interval": "Range",
        "derivedNoBasis": "Worked out from other figures"
      },
      "units": {
        "day": "day",
        "days": "days",
        "hour": "hour",
        "hours": "hours",
        "minute": "minute",
        "minutes": "minutes"
      },
      "deadline": {
        "left": "{d} left",
        "overdue": "Overdue by {d}",
        "met": "Done in time",
        "late": "Done, {d} late",
        "paused": "Clock paused",
        "due": "Due",
        "doneAt": "Done at",
        "none": "No deadline set",
        "announce": "{label}: {d} left.",
        "announceBare": "{d} left before the deadline."
      },
      "rows": {
        "add": "Add a row",
        "remove": "Remove row",
        "removeShort": "Remove",
        "max": "All {n} rows are used; no more can be added.",
        "count": "{n} of at most {max} rows",
        "added": "{title} added.",
        "removed": "A row was removed. {n} rows left."
      },
      "audio": {
        "label": "Listen",
        "play": "Play",
        "pause": "Pause",
        "position": "Position",
        "unavailable": "Cannot be played yet: the file is still being processed.",
        "failed": "This file could not be played. Try again in a few minutes."
      },
      "print": {
        "ref": "Reference",
        "verify": "Check this reference at",
        "refNoun": "{Noun} reference",
        "verifyNoun": "Check this {noun} at",
        "issued": "Issued",
        "page": "Page",
        "refEnt": "Reference",
        "verifyEnt": "Check this document at",
        "statusAt": "at"
      },
      "verify": {
        "valid": "This reference is valid and current",
        "revoked": "This reference has been revoked",
        "expired": "This reference has expired",
        "superseded": "This reference has been replaced by a newer one",
        "not-found": "This reference was not found",
        "unavailable": "This reference cannot be checked right now",
        "code": "Code",
        "checkedAt": "Checked at",
        "recordedAt": "Recorded at",
        "checking": "Checking the reference",
        "noun": {
          "valid": "This {noun} is valid and current",
          "revoked": "This {noun} has been revoked",
          "expired": "This {noun} has expired",
          "superseded": "This {noun} has been replaced by a newer one",
          "not-found": "No {noun} has this code",
          "unavailable": "The {noun} cannot be checked right now",
          "checking": "Checking the {noun}"
        }
      },
      "menu": {
        "more": "More actions"
      },
      "sw": {
        "on": "On",
        "off": "Off",
        "saving": "Saving"
      },
      "time": {
        "help": "24-hour clock, for example 18:30.",
        "helpEnd": "24-hour clock; 24:00 is the end of the day.",
        "helpStep": "24-hour clock in steps of {n} minutes, for example {e}.",
        "helpStepEnd": "24-hour clock in steps of {n} minutes; 24:00 is the end of the day.",
        "rounded": "Rounded to {t}."
      },
      "tip": {
        "explain": "Explain"
      },
      "toast": {
        "close": "Close the message"
      },
      "split": {
        "total": "Total",
        "complete": "Fully shared out.",
        "short": "{n} is not shared out yet.",
        "over": "Over by {n}; reduce one share."
      },
      "compare": {
        "changed": "{n} fields differ.",
        "changedOne": "One field differs.",
        "same": "No field differs.",
        "field": "Field",
        "differs": "Differs"
      },
      "trace": {
        "label": "Where this figure comes from"
      },
      "files": {
        "none": "No files yet.",
        "scanning": "Being checked",
        "quarantined": "Quarantined",
        "failed": "Upload failed",
        "download": "Download",
        "remove": "Remove the file",
        "uploading": "Uploading",
        "retry": "Upload again",
        "cancel": "Cancel the upload"
      },
      "doc": {
        "prev": "Previous page",
        "next": "Next page",
        "page": "Page {n} of {of}",
        "zoomIn": "Zoom in",
        "zoomOut": "Zoom out",
        "download": "Download",
        "unavailable": "This file cannot be previewed. Download it to open it.",
        "loading": "Loading page {n}"
      },
      "bulk": {
        "label": "Actions on the selected items",
        "count": "{n} selected",
        "countOf": "{n} of {total} selected",
        "clear": "Clear the selection",
        "cleared": "Selection cleared."
      },
      "side": {
        "close": "Close"
      },
      "scan": {
        "label": "Scan a code",
        "labelNoun": "Scan a {noun} code",
        "asking": "Allow the camera to scan the QR code.",
        "askingNoun": "Allow the camera to scan the code on the {noun}.",
        "scanning": "Hold the QR code inside the frame.",
        "found": "Code read",
        "denied": "The camera cannot be used. Type the code printed beside the QR code.",
        "unsupported": "This device cannot scan codes. Type the code printed beside the QR code.",
        "unavailable": "Scanning is not available just now. Type the code printed beside the QR code.",
        "torch": "Torch",
        "manual": "Type the code",
        "allow": "Allow the camera",
        "help": "How to turn the camera back on"
      },
      "rec": {
        "label": "On-the-spot recording",
        "start": "Start recording",
        "stop": "Stop recording",
        "again": "Record again",
        "idle": "Ready to record",
        "recording": "Recording",
        "recorded": "Recorded",
        "denied": "The microphone cannot be used. Allow it and try again.",
        "keep": "Use this recording",
        "discard": "Discard it",
        "retry": "Try again"
      },
      "table": {
        "details": "Details",
        "expand": "Show more",
        "collapse": "Show less",
        "total": "Total",
        "rowActions": "Actions for",
        "loadingMore": "Loading more",
        "noRows": "No rows match.",
        "changed": "Just updated",
        "selectPage": "All {n} rows on this page are selected.",
        "selectAll": "Select all {total}",
        "selectedAll": "All {total} are selected.",
        "clearAll": "Clear the selection",
        "open": "open beside the table",
        "none": "This table has no rows yet.",
        "captionFrom": "Table with the columns {cols}",
        "hidden": "Hidden: {cols}. Open a row to see them.",
        "dropped": "dropped"
      },
      "chip": {
        "remove": "Remove the filter"
      },
      "notices": {
        "title": "Notices",
        "unread": "Unread",
        "unreadCount": "{n} unread",
        "markAll": "Mark all as read",
        "empty": "No notices yet.",
        "markedAll": "All notices marked as read."
      },
      "prov": {
        "registry-sourced": "Registry-sourced",
        "declared": "Declared",
        "evidenced": "Evidenced",
        "corrected": "Corrected",
        "derived": "Derived",
        "alternative-route": "Alternative route",
        "manual-override": "Manual override",
        "authoritative": "Authoritative",
        "estimated": "Estimated",
        "imputed": "Imputed",
        "illustrative": "Illustrative"
      },
      "figures": "Figures for",
      "asOf": "as of",
      "upload": {
        "drop": "Drag a file here, or",
        "choose": "choose a file",
        "pipeline": "Processing steps",
        "release": "Drop the file to upload it",
        "replace": "Choose another file",
        "ready": "The file is processed.",
        "states": {
          "done": "done",
          "current": "in progress",
          "todo": "not started",
          "failed": "failed"
        }
      },
      "legal": {
        "contents": "Contents",
        "version": "Version",
        "effective": "Effective from",
        "read": "Read"
      },
      "sign": {
        "typeName": "Full legal name",
        "mustScroll": "Read the text to the end",
        "mustType": "Type your full legal name as it appears on your identity document",
        "sign": "Sign",
        "remaining": "To sign, still needed:",
        "ready": "Ready to sign.",
        "signed": "Signed at {t}.",
        "signedDone": "Signed."
      },
      "approval": {
        "preparer": "Preparer",
        "approver": "Approver",
        "awaiting": "No approver yet",
        "same": "The person who prepared this cannot approve it. A different approver is required.",
        "noPreparer": "No preparer recorded",
        "comment": "Approver's comment",
        "commentShort": "Comment",
        "decision": {
          "approved": "Approved",
          "rejected": "Not approved",
          "returned": "Returned for changes",
          "declined": "Left unchanged"
        }
      },
      "queue": {
        "keys": [
          [
            [
              "↑",
              "↓"
            ],
            "move"
          ],
          [
            [
              "Enter"
            ],
            "open"
          ],
          [
            [
              "Esc"
            ],
            "back"
          ],
          [
            [
              "X"
            ],
            "select"
          ]
        ],
        "selected": "selected",
        "empty": "Nothing is waiting in this queue."
      },
      "deck": {
        "pause": "Pause",
        "play": "Resume",
        "volume": "Volume",
        "position": "Position in the track",
        "upNext": "Up next",
        "later": "Later",
        "artwork": "Artwork",
        "artworkOff": "Artwork unavailable just now",
        "paused": "The music is paused",
        "previous": "Previous track",
        "next": "Next track",
        "fullscreen": "Full screen",
        "previousOff": "Previous is off: a played track returns only after the whole list has played.",
        "player": "Player",
        "sync": "Sync and storage",
        "shortcuts": "Shortcuts",
        "keyPause": "Pause or resume",
        "keyVolume": "Volume",
        "keyNext": "Next track",
        "keyFull": "Full screen",
        "of": "of",
        "doLabel": "What to do",
        "mute": "Mute",
        "unmute": "Unmute",
        "min": "minute",
        "mins": "minutes",
        "sec": "second",
        "secs": "seconds",
        "posOf": "{at} of {of}",
        "leftOf": "left of {max}",
        "leftIn": "{d} left",
        "more": "and {n} more before {until}",
        "moreAll": "and {n} more",
        "nothingNext": "Nothing else is scheduled.",
        "schedule": "Schedule",
        "offlineLeft": "Offline playing time left",
        "storage": "Storage used",
        "states": {
          "online": "Playing",
          "offline": "Offline, still playing",
          "syncing": "Syncing",
          "ceiling": "Evidence recording paused",
          "limit-reached": "Stopped",
          "cannot-continue": "Stopped",
          "stopped": "Stopped",
          "fault": "Device fault",
          "paused": "Paused",
          "unpaired": "Not paired"
        }
      },
      "timeline": {
        "corrects": "Corrects entry",
        "appendOnly": "Append-only history.",
        "current": "Current entry:"
      },
      "player": {
        "online": "Playing, in sync",
        "offline": "Offline, still playing",
        "stopped": "Playback has stopped",
        "cannot": "Nothing can play",
        "ceiling": "Evidence recording paused",
        "left": "left",
        "of": "of",
        "queued": "Evidence waiting to be sent",
        "lastContact": "Last contact",
        "none": "None",
        "limit": "The offline playing time has run out"
      },
      "now": {
        "nowPlaying": "Now playing",
        "composer": "Composer",
        "lyricist": "Lyricist",
        "performer": "Performer",
        "producer": "Producer",
        "available": "available",
        "unavailable": "unavailable just now",
        "optionalNote": "Anything unavailable here does not affect the music.",
        "none": "none"
      },
      "shell": {
        "help": "Help",
        "privacy": "Privacy",
        "contact": "Contact",
        "legal": "Legal",
        "search": "Search by device, premises or reference",
        "queue": "Queue",
        "more": "More",
        "narrow": "The console is laid out for a window at least 1,024 px wide. Widen the window or use a larger screen to see every column.",
        "language": "Language",
        "menu": "Main navigation",
        "collapse": "Collapse the rail",
        "skip": "Skip to content",
        "signOut": "Sign out",
        "fieldStatus": "Device status",
        "online": "Online",
        "offline": "Offline",
        "keyValid": "Verification key valid until {date}",
        "keyExpiring": "Verification key expires at {date}",
        "keyMissing": "No verification key",
        "keyMissingDo": "Connect to a network to download it."
      },
      "chart": {
        "category": "Category"
      },
      "empty": {
        "notStarted": "Nothing recorded for this period yet.",
        "governed": "Nothing qualified.",
        "filtered": "The filters exclude every row.",
        "clearFilters": "Clear filters",
        "noObligation": "No payable obligation for this period.",
        "waiting": "Waiting for",
        "decider": "Decided by",
        "due": "Decision due"
      },
      "stepper": {
        "done": "done",
        "current": "in progress",
        "todo": "not started",
        "blocked": "cannot start yet"
      },
      "navlist": {
        "label": "Go to"
      },
      "langs": {
        "vi": "Tiếng Việt",
        "en": "English"
      },
      "status": {
        "positive": "OK",
        "attention": "Needs attention",
        "danger": "Critical",
        "neutral": "Note",
        "info": "Information"
      },
      "badge": {
        "working": "in progress",
        "workingMark": "in progress"
      },
      "view": {
        "loaded": "Loaded."
      },
      "panel": {
        "positive": "In order",
        "attention": "Needs attention",
        "danger": "Problem",
        "info": "Information",
        "neutral": "Not applicable"
      },
      "sched": {
        "next": "continues into the next day",
        "prev": "continued from the day before"
      },
      "layout": {
        "crumbs": "Breadcrumb",
        "context": "Working on",
        "expand": "Expand the rail",
        "moreNav": "More sections",
        "keys": "Keyboard shortcuts",
        "keyHelp": "Show these shortcuts",
        "keySearch": "Open the command palette",
        "singleKeys": "Single-character keys",
        "singleKeysHelp": "Shortcuts of one character, such as / and ?. The keys that move between the rows of a table still work while you are in the table.",
        "singleKeysForced": "This application turns single-character keys off.",
        "keyOff": "off"
      },
      "copyFailed": "Not copied. The code is selected so you can copy it yourself.",
      "copyFailedShort": "Not copied",
      "noDate": "no date",
      "noId": "no reference yet",
      "qr": {
        "label": "QR code",
        "opens": "QR code that opens {url}"
      },
      "provSource": "Source:",
      "provPlain": {
        "registry-sourced": "From the register",
        "declared": "You declared",
        "evidenced": "You declared, with a document",
        "corrected": "Corrected by RightOne",
        "derived": "Worked out from the rules",
        "alternative-route": "From another source",
        "manual-override": "Decided by RightOne",
        "authoritative": "From the official source",
        "estimated": "Estimated by RightOne",
        "imputed": "Filled in by RightOne where data was missing",
        "illustrative": "For illustration only"
      },
      "idMask": {
        "show": "Show",
        "hide": "Hide",
        "showName": "Show the full reference",
        "hideName": "Hide the reference",
        "shown": "The full reference is shown.",
        "hidden": "The reference is hidden.",
        "ending": "reference ending in {tail}",
        "hiddenValue": "hidden reference",
        "copyFailed": "Not copied. Show the full reference and copy it yourself."
      },
      "valueMask": {
        "show": "Show",
        "hide": "Hide",
        "showName": "Show the value",
        "hideName": "Hide the value",
        "shown": "The value is shown.",
        "hidden": "The value is hidden.",
        "ending": "value ending in {tail}",
        "hiddenValue": "hidden value"
      },
      "facts": {
        "change": "Change"
      },
      "freshUnknown": "When these figures were computed is not known."
    }
  };
  function tx(locale) { return TX[lang(locale)]; }

  // ------------------------------------------------------------- formatting

  var TZ = 'Asia/Ho_Chi_Minh';
  var ZERO_MINOR = { VND: 1, JPY: 1, KRW: 1 };

  function nf(locale, opts) {
    return new Intl.NumberFormat(lang(locale) === 'en' ? 'en-GB' : 'vi-VN', opts || {});
  }
  // A negative figure takes the minus sign U+2212, never the hyphen, in every value component (Breakdown wrote it first).
  function minus(s) { return typeof s === 'string' ? s.replace(/^-/, '\u2212') : s; }
  function formatCount(v, locale) {
    if (isNil(v)) return null;
    return minus(nf(locale).format(v));
  }
  // A percentage: "96,4 %" in Vietnamese, with a no-break space before the sign, and "96.4%" in English, the minus sign
  // U+2212 before a negative one. Without decimals it keeps at most one decimal ("10 %", "96,4 %"), as every percent
  // kind always did; decimals fixes the count, for a figure stored to a set precision ("14,00 %", "14.00%").
  function percentDigits(v, locale, decimals) {
    var d = isNil(decimals) || decimals === '' || isNaN(Number(decimals)) ? null : Math.max(0, Math.min(20, Math.floor(Number(decimals))));
    return minus(nf(locale, d === null ? { maximumFractionDigits: 1 } : { minimumFractionDigits: d, maximumFractionDigits: d }).format(v));
  }
  function formatPercent(v, locale, opts) {
    if (isNil(v) || v === '' || isNaN(Number(v))) return null;
    var d = typeof opts === 'number' ? opts : opts && opts.decimals;
    return percentDigits(Number(v), locale, d) + (lang(locale) === 'en' ? '%' : '\u00a0%');
  }
  // The đồng is written with its code after the amount in every language: the amount, a no-break space,
  // then VND ("1.250.000 VND", "1,250,000 VND"). Other currencies follow the reader's language.
  // bare: the digits alone, for a table column that names its currency in the header.
  function formatMoney(amountMinor, currency, locale, bare) {
    if (isNil(amountMinor)) return null;
    var cur = currency || 'VND';
    var digits = ZERO_MINOR[cur] ? 0 : 2;
    var major = amountMinor / Math.pow(10, digits);
    if (bare) return minus(nf(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(major));
    if (cur === 'VND') return minus(nf(locale, { maximumFractionDigits: 0 }).format(major)) + '\u00a0VND';
    try {
      return minus(nf(locale, { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(major));
    } catch (e) {
      return minus(nf(locale).format(major)) + ' ' + cur;
    }
  }
  function toDate(v) {
    if (isNil(v) || v === '') return null;
    var d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  function dtf(locale, opts) {
    return new Intl.DateTimeFormat(lang(locale) === 'en' ? 'en-GB' : 'vi-VN', Object.assign({ timeZone: TZ }, opts));
  }
  function offsetLabel(d) {
    try {
      var parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, timeZoneName: 'shortOffset' }).formatToParts(d);
      for (var i = 0; i < parts.length; i++) if (parts[i].type === 'timeZoneName') return parts[i].value;
    } catch (e) { /* older engines */ }
    return 'GMT+7';
  }
  function formatDate(v, locale) {
    var d = toDate(v);
    return d ? dtf(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d) : null;
  }
  function formatTime(v) {
    var d = toDate(v);
    return d ? new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d) : null;
  }
  function shortMonth(s) { return s.replace(/\bSept\b/, 'Sep'); }
  function formatTimestamp(v, locale) {
    var d = toDate(v);
    if (!d) return null;
    var date = shortMonth(dtf(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d));
    return date + ', ' + formatTime(d) + ' (' + offsetLabel(d) + ')';
  }
  // For a column whose header already states the zone: "28 Sep, 12:20".
  function formatStamp(v, locale) {
    var d = toDate(v);
    if (!d) return null;
    return shortMonth(dtf(locale, { day: 'numeric', month: 'short' }).format(d)) + ', ' + formatTime(d);
  }
  // The short month, for a dense console column: "24 thg 9, 2026", "24 Sep 2026". Still never numeric-only.
  function formatDateShort(v, locale) {
    var d = toDate(v);
    return d ? shortMonth(dtf(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d)) : null;
  }
  // short: both ends with the short month ("1–30 thg 9, 2026", "28 Sep 2026 – 3 Oct 2026").
  function formatPeriod(from, to, locale, short) {
    var a = toDate(from), b = toDate(to);
    if (!a || !b) return null;
    var day = short ? formatDateShort : formatDate;
    var sameMonth = dtf('en', { month: '2-digit', year: 'numeric' }).format(a) === dtf('en', { month: '2-digit', year: 'numeric' }).format(b);
    if (!sameMonth) return day(a, locale) + ' – ' + day(b, locale);
    return dtf('en', { day: 'numeric' }).format(a) + '–' + day(b, locale);
  }

  // ------------------------------------------------------------------ icons

  function Icon(p) {
    var nodes = ICONS[p.name];
    if (!nodes) return null;
    var size = p.size || 20;
    return h('svg', {
      className: cx('r1-icon', p.spin && 'r1-spin', p.className),
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      strokeWidth: p.strokeWidth || 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      focusable: 'false', role: p.label ? 'img' : undefined,
      'aria-label': p.label || undefined, 'aria-hidden': p.label ? undefined : 'true',
      style: p.style
    }, nodes.map(function (n, i) { return h(n[0], Object.assign({ key: i }, n[1])); }));
  }

  var SEAL_POINTS = (function () {
    var pts = [];
    for (var i = 0; i < 32; i++) {
      var r = i % 2 === 0 ? 11 : 9.2;
      var a = (Math.PI * 2 * i) / 32 - Math.PI / 2;
      pts.push((12 + r * Math.cos(a)).toFixed(2) + ',' + (12 + r * Math.sin(a)).toFixed(2));
    }
    return pts.join(' ');
  })();

  // Shape carries the meaning; colour reinforces it (R1-UXD-004 §4).
  // An unknown family draws the neutral shape, so a state from a new model still shows a shape.
  var STATUS_FAMILIES = ['positive', 'attention', 'danger', 'neutral', 'info'];
  function StatusIcon(p) {
    var size = p.size || 16;
    var cut = { stroke: 'var(--' + (p.cutout || 'surface') + ')', strokeWidth: 2.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
    var cutFill = { fill: 'var(--' + (p.cutout || 'surface') + ')' };
    var solid = { fill: 'currentColor' };
    var kids;
    switch (p.family === 'seal' || STATUS_FAMILIES.indexOf(p.family) >= 0 ? p.family : 'neutral') {
      case 'positive':
        kids = [h('circle', { key: 1, cx: 12, cy: 12, r: 10, style: solid }), h('path', { key: 2, d: 'm7.5 12.5 3 3 6-6.5', style: cut })];
        break;
      case 'attention':
        kids = [h('path', { key: 1, d: 'M12 2.8 22.4 20.6H1.6Z', style: { fill: 'currentColor', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' } }),
          h('path', { key: 2, d: 'M12 9.2v4.8', style: cut }), h('circle', { key: 3, cx: 12, cy: 17.2, r: 1.35, style: cutFill })];
        break;
      case 'danger':
        kids = [h('path', { key: 1, d: 'M8.1 2h7.8L22 8.1v7.8L15.9 22H8.1L2 15.9V8.1Z', style: solid }), h('path', { key: 2, d: 'm9 9 6 6m0-6-6 6', style: cut })];
        break;
      case 'neutral':
        kids = [h('circle', { key: 1, cx: 12, cy: 12, r: 8.75, style: { fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 } })];
        break;
      case 'info':
        kids = [h('circle', { key: 1, cx: 12, cy: 12, r: 10, style: solid }), h('path', { key: 2, d: 'M12 11v6', style: cut }), h('circle', { key: 3, cx: 12, cy: 7.4, r: 1.35, style: cutFill })];
        break;
      case 'seal':
        kids = [h('polygon', { key: 1, points: SEAL_POINTS, style: solid }), h('path', { key: 2, d: 'm7.8 12.3 2.9 2.9 5.5-6', style: cut })];
        break;
      default:
        return null;
    }
    return h('svg', { className: cx('r1-status-icon', p.className), width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, kids);
  }

  // ----------------------------------------------------------- status badge

  // working: a state that is running now (an import, a recomputation). The spinning loader-circle takes the place of
  // the family's shape, at the same size and on the same line; it stands still under prefers-reduced-motion (.r1-spin).
  // A screen reader hears "in progress" after the label unless the label already says so ("Đang chạy", "Running").
  function workingWords(label, locale) {
    var t = tx(locale).badge;
    var s = String(textOf(label) || '').normalize('NFC').toLocaleLowerCase(lang(locale));
    var mark = t.workingMark.toLocaleLowerCase(lang(locale));
    var said = (' ' + s.replace(/[\s,.;:!?()–—-]+/g, ' ') + ' ').indexOf(' ' + mark + ' ') >= 0
      || (lang(locale) === 'en' && /^\s*[a-z]+ing\b/.test(s));
    return said ? null : ', ' + t.working;
  }
  // A family the badge does not know falls back to neutral, with the neutral shape and tint.
  // icon: an Icon name drawn in place of the family's shape, so two states of one family differ in shape as well as in
  // words ("Tạm đình chỉ" and "Đã thu hồi" are both danger). The badge keeps its three channels: the shape, the word and the
  // tint. A name the icon set does not hold keeps the family's shape. The seal and working keep their own marks.
  function StatusBadge(p) {
    var family = STATUS_FAMILIES.indexOf(p.family) >= 0 ? p.family : 'neutral';
    var seal = p.variant === 'seal';
    var size = p.size || 'md';
    var iconSize = size === 'xl' ? 32 : size === 'lg' ? 20 : 16;
    var label = p.label || p.children;
    var more = p.working ? workingWords(label, p.locale) : null;
    var own = !seal && p.icon && ICONS[p.icon] ? p.icon : null;
    return h('span', {
      className: cx('r1-badge', 'r1-badge--' + (seal ? 'seal' : family), 'r1-badge--' + size, p.working && 'r1-badge--working', own && 'r1-badge--icon', p.className),
      'data-family': seal ? 'authority' : family,
      style: p.style
    },
      p.working ? h(Icon, { name: 'loader-circle', size: iconSize, spin: true, className: 'r1-badge__spin' })
        : own ? h(Icon, { name: own, size: iconSize, strokeWidth: 2.5, className: 'r1-status-icon r1-badge__icon' })
        : h(StatusIcon, { family: seal ? 'seal' : family, size: iconSize, cutout: seal ? 'accent-surface' : family + '-tint' }),
      h('span', { className: 'r1-badge__label' }, label),
      more ? h('span', { className: 'r1-sr' }, more) : null);
  }

  // ----------------------------------------------------------------- button

  // Icons sit on the 4 px grid: 16 px in a sm button (text-sm), 20 px in md, lg and xl.
  // shortcut: one key ("N", or "⌘S" with a modifier) that presses the button from anywhere in its shell. Like
  // SearchField's, it is bound on the nearest .r1-shell, never on the document; a bare key never fires while the reader
  // types in a field or from inside a dialog the button is not in, nor while the button is disabled or working. Bound,
  // it sets aria-keyshortcuts; data-r1-shortcut marks it from the first render, so ConsoleShell's list of keys shows it.
  // A reference in a label that wraps stays on one line ("Mở quyết định OBD-2YDA7KMS5X" breaks before the code, never
  // after its hyphen): a word of capitals and digits joined by - / . that carries a digit is kept whole, with the
  // bracket or quote that opens or closes it ("(ARR-2026-01)", "“OBD-3FJW6NRA5C”"), so the line breaks before the bracket.
  var REF_WORD = /^[(\[{“‘«"']*[A-Z0-9]+(?:[-/.][A-Z0-9]+)+[)\]}”’»"',.;:?!]*$/;
  function keepRefs(label) {
    if (typeof label !== 'string' || label.indexOf('-') < 0 && label.indexOf('/') < 0) return label;
    // The words around a reference stay one run of text, so a label that fits is laid out exactly as a plain string.
    var out = [], run = '';
    label.split(/(\s+)/).forEach(function (w, i) {
      if (REF_WORD.test(w) && /\d/.test(w)) { if (run) out.push(run); run = ''; out.push(h('span', { key: i, className: 'r1-nowrap' }, w)); }
      else run += w;
    });
    if (run) out.push(run);
    // One inline run, so a flex parent (a fact value, a toast) lays the words and the reference out as one line of text.
    return out.length > 1 || typeof out[0] !== 'string' ? h('span', null, out) : label;
  }
  function Button(p) {
    var t = tx(p.locale);
    var reasonId = useUid('r1-why');
    var variant = p.variant || 'secondary';
    var size = p.size || 'md';
    var iconSize = size === 'sm' ? 16 : 20;
    // Disabled wins over loading: a button that cannot act is drawn disabled, one that is working keeps its look.
    var busy = !!p.loading && !p.disabled;
    var blocked = !!(p.disabled || p.loading);
    // The reason is stated only while the button is disabled; an enabled button carries no reason line.
    var why = p.disabled && p.disabledReason ? p.disabledReason : null;
    var label = busy && p.loadingLabel ? p.loadingLabel : p.children;
    var btnRef = useRef(null);
    var sc = p.shortcut ? bindableShortcut(p.shortcut, 'the button "' + textOf(p.children || p['aria-label'] || p.ariaLabel) + '"') : null;
    var scBound = useState(false);
    var isBlocked = useLatest(blocked);
    var singleOn = useSingleKeys();
    var scOff = useState(false);
    if (sc && p.variant === 'danger') warnOnce('the destructive button "' + textOf(p.children) + '" has the shortcut ' + p.shortcut + ': no key performs an act that cannot be undone (OD-19).');
    useEffect(function () {
      var scope = sc && btnRef.current && btnRef.current.closest('.r1-shell');
      var off = singleKeyOff(sc, scope, singleOn);
      if (scOff[0] !== off) scOff[1](off);
      scBound[1](!!scope && !off);
      if (!scope || off) return undefined;
      function onKey(e) {
        if (keyTaken(e)) return;
        if (!shortcutHit(e, sc)) return;
        if (!sc.mod && !sc.alt && isTyping(e.target)) return;
        holdAlt(e, sc);
        var dlg = e.target && e.target.closest && e.target.closest('[role="dialog"]');
        if ((dlg && !dlg.contains(btnRef.current)) || isBlocked.current || !btnRef.current) return;
        takeKey(e);
        btnRef.current.click();
      }
      scope.addEventListener('keydown', onKey);
      return function () { scope.removeEventListener('keydown', onKey); };
    }, [sc ? (sc.mod ? 'mod+' : '') + (sc.alt ? 'alt+' : '') + sc.key : '', singleOn]);
    var scName = sc && scBound[0] ? shortcutAria(sc) : undefined;
    // Working is said once, when it starts: the label the reader sees, else "Loading".
    var wasBusy = useRef(busy);
    useEffect(function () {
      if (busy && !wasBusy.current) announce(textOf(label) || t.loading);
      wasBusy.current = busy;
    }, [busy]);
    // A button is never wider than its container: a label too long for the space wraps onto more lines and the button grows in
    // height (bundle.css, .r1-btn and .r1-btn__label). A label that fits keeps the one-line button.
    var cls = cx('r1-btn', 'r1-btn--' + variant, 'r1-btn--' + size, p.iconOnly && 'r1-btn--icon', p.fullWidth && 'r1-btn--full', p.className);
    // The spinner takes the place of the icon the button has: the leading one, else the trailing one, so the width holds.
    var spinEnd = busy && !p.icon && !!p.iconRight && !p.iconOnly;
    var spinner = busy ? h(Icon, { key: spinEnd ? 'r' : 'l', name: 'loader-circle', size: iconSize, spin: true }) : null;
    var inner = [
      busy && !spinEnd ? spinner : p.icon ? h(Icon, { key: 'i', name: p.icon, size: iconSize }) : null,
      p.iconOnly ? null : h('span', { key: 't', className: 'r1-btn__label' }, keepRefs(label)),
      spinEnd ? spinner : p.iconRight && !p.iconOnly ? h(Icon, { key: 'r', name: p.iconRight, size: iconSize }) : null
    ];
    var common = {
      className: cls, style: p.style,
      'aria-label': p.iconOnly ? (p['aria-label'] || p.ariaLabel || p.children) : (p['aria-label'] || p.ariaLabel),
      'aria-disabled': blocked ? 'true' : undefined,
      'aria-busy': busy ? 'true' : undefined,
      'aria-describedby': [why ? reasonId : null, p['aria-describedby']].filter(Boolean).join(' ') || undefined,
      id: p.id, 'aria-haspopup': p['aria-haspopup'], 'aria-expanded': p['aria-expanded'], 'aria-controls': p['aria-controls'], 'aria-pressed': p['aria-pressed'],
      'aria-keyshortcuts': p['aria-keyshortcuts'] || scName, 'data-r1-shortcut': sc ? shortcutText(p.shortcut, sc) : undefined,
      'data-r1-shortcut-off': sc && scOff[0] ? '' : undefined, onKeyDown: p.onKeyDown, ref: btnRef
    };
    var el;
    if (p.href && !blocked) {
      // A link styled as a button still runs its onClick (a router, an analytics event) before it goes.
      var ext = p.target === '_blank';
      el = h('a', Object.assign({ href: p.href, onClick: p.onClick, target: p.target, rel: p.rel || (ext ? 'noopener noreferrer' : undefined), download: p.download }, common), inner);
    } else {
      el = h('button', Object.assign({
        type: p.type || 'button',
        onClick: blocked ? function (e) { e.preventDefault(); } : p.onClick
      }, common), inner);
    }
    if (!why) return el;
    return h('span', { className: cx('r1-btn-wrap', p.fullWidth && 'r1-btn-wrap--full') }, el,
      h('span', { id: reasonId, className: 'r1-btn__reason' }, h(Icon, { name: 'info', size: 16 }), h('span', null, why)));
  }

  // A row of two or more buttons (and links drawn as buttons), space-2 apart, wrapping onto a second line when the row
  // is too narrow. A disabled button's reason leaves its slot and goes under the whole row, in button order, so the next
  // button keeps its place; each reason stays linked to its own button (aria-describedby, set by Button). This is what a
  // Dialog footer does; ButtonRow is the same rule anywhere else. align: start (default), end, between. label: a name
  // for the group, read when focus enters it; without it the row is plain layout and has no role.
  // sticky: at or below bp-xs (480 px) the row sticks to the bottom of the window with a hairline above it, so the
  // decision stays in reach on a long form on a phone. It stays in the page's flow, so the page keeps its room and the
  // last field is never under it; the page also scrolls a focused field clear of it. Wider, it is an ordinary row.
  // While it sticks (its bottom edge held at the window's), it is marked r1-btnrow--stuck, and only then does it draw its
  // band; resting at the end of its form it looks like any other row.
  function ButtonRow(p) {
    var align = p.align === 'end' || p.align === 'between' ? p.align : null;
    var rowRef = useRef(null);
    var stuck = useState(false);
    useEffect(function () {
      if (!p.sticky || !rowRef.current || typeof IntersectionObserver === 'undefined') return undefined;
      var io = new IntersectionObserver(function (es) {
        var r = es[es.length - 1].intersectionRatio;
        stuck[1](r > 0 && r < 1);
      // It sticks space-3 above the window's bottom edge, so the watched edge is a hairline above that.
      }, { rootMargin: '0px 0px -' + (cssPx('--space-3', 12) + 1) + 'px 0px', threshold: [0, 1] });
      io.observe(rowRef.current);
      return function () { io.disconnect(); };
    }, [!!p.sticky]);
    return h('div', {
      ref: rowRef,
      className: cx('r1-btnrow', align && 'r1-btnrow--' + align, p.sticky && 'r1-btnrow--sticky', p.sticky && stuck[0] && 'r1-btnrow--stuck', p.className),
      role: p.label ? 'group' : undefined, 'aria-label': p.label || undefined, style: p.style
    }, p.children);
  }

  // ----------------------------------------------------------- form parts

  // An error is an alert. A warning that appears after the reader did something is said once through the page's
  // live region; one drawn with the page is read in order. Its acknowledgement is the R1 Checkbox.
  function FieldMessage(p) {
    var sev = p.severity || 'error';
    var family = sev === 'error' ? 'danger' : sev === 'warning' ? 'attention' : 'info';
    var t = tx(p.locale);
    var said = textOf(p.children);
    useEffect(function () { if (sev === 'warning' && said && readerActed()) announce(said, 'polite'); }, [sev, said]);
    return h('div', { id: p.id, className: cx('r1-msg', 'r1-msg--' + family, p.className), role: sev === 'error' ? 'alert' : undefined },
      h(StatusIcon, { family: family, size: 16, cutout: 'surface' }),
      h('div', { className: 'r1-msg__body' },
        h('span', null, p.children),
        sev === 'warning' && p.acknowledgeable ? h(Checkbox, { className: 'r1-ack', label: t.ack, checked: !!p.acknowledged, name: p.name, onChange: p.onAcknowledge, locale: p.locale }) : null));
  }

  // words="plain": the words a premises reads about its own facts ("Bạn khai", "Theo sổ đăng ký"), in place of the
  // officer's terms ("Tự khai", "Từ sổ đăng ký").
  // alternative-route: taken from a route other than the authoritative source (a licence list); detail names the route.
  // manual-override: an authorised person overrode the value; detail names the authority (MEMO-2026-0131).
  // The six DAT data classes (7 October 2026): authoritative, declared, derived, estimated, imputed and illustrative, each
  // with its own word and shape. declared and derived are the kinds above; the chip stays neutral for every class, since
  // a class says where a figure comes from, never whether it is good or bad.
  var PROV_ICON = { 'registry-sourced': 'database', declared: 'user', evidenced: 'file-check', corrected: 'history', derived: 'route', 'alternative-route': 'arrow-right-left', 'manual-override': 'scale',
    authoritative: 'shield-check', estimated: 'approximately-equal', imputed: 'circle-dashed', illustrative: 'image' };
  function ProvenanceChip(p) {
    var t = tx(p.locale);
    var kind = p.kind || 'declared';
    var icon = PROV_ICON[kind] || 'user';
    var words = p.words === 'plain' ? t.provPlain : t.prov;
    return h('span', { className: cx('r1-prov', 'r1-prov--' + kind, p.className) },
      h(Icon, { name: icon, size: 16 }),
      h('span', { className: 'r1-sr' }, t.provSource + ' '),
      h('span', { className: 'r1-prov__kind' }, words[kind] || t.prov[kind] || kind),
      p.detail ? h('span', { className: 'r1-prov__detail' }, p.detail) : null);
  }

  function fieldShell(p, inputId, control, extra) {
    var t = tx(p.locale);
    var helpId = inputId + '-help';
    var msgId = inputId + '-msg';
    return h('div', { className: cx('r1-field', 'r1-field--' + (p.density || 'portal'), p.readOnly && 'r1-field--readonly', p.error && 'r1-field--error', p.className), style: p.style },
      // hideLabel keeps the label for screen readers only, when a heading beside the field already says what it is.
      p.hideLabel ? h('label', { id: inputId + '-label', className: 'r1-sr', htmlFor: inputId }, p.label) : h('div', { className: 'r1-field__head' },
        h('label', { id: inputId + '-label', className: 'r1-field__label', htmlFor: inputId }, p.label),
        p.required && !p.readOnly ? h('span', { className: 'r1-field__req' }, t.required) : null,
        p.provenance ? h(ProvenanceChip, { kind: p.provenance, detail: p.provenanceDetail, words: p.provenanceWords, locale: p.locale }) : null),
      p.helper ? h('div', { id: helpId, className: 'r1-field__help' }, p.helper) : null,
      control,
      extra || null,
      p.error ? h(FieldMessage, { id: msgId, severity: 'error', locale: p.locale }, p.error) : null,
      !p.error && p.warning ? h(FieldMessage, { id: msgId, severity: 'warning', acknowledgeable: true, acknowledged: p.acknowledged, onAcknowledge: p.onAcknowledge, locale: p.locale }, p.warning) : null,
      !p.error && !p.warning && p.info ? h(FieldMessage, { id: msgId, severity: 'info', locale: p.locale }, p.info) : null,
      p.disabled && p.disabledReason ? h('div', { id: inputId + '-why', className: 'r1-field__reason' }, h(Icon, { name: 'info', size: 16 }), h('span', null, p.disabledReason)) : null);
  }
  function describedBy(p, id) {
    var ids = [];
    if (p.helper) ids.push(id + '-help');
    if (p.error || p.warning || p.info) ids.push(id + '-msg');
    if (p.disabled && p.disabledReason) ids.push(id + '-why');
    return ids.length ? ids.join(' ') : undefined;
  }
  // A value the reader may read but not change: named by the field's label, reachable by Tab.
  // A <label for> cannot name a div, so the name comes through aria-labelledby.
  function readOnlyBox(p, id, content, cls, moreIds) {
    return h('div', {
      id: id, className: cx('r1-readonly', cls), role: 'textbox', 'aria-readonly': 'true', tabIndex: 0,
      'aria-labelledby': id + '-label', 'aria-describedby': [describedBy(p, id), moreIds].filter(Boolean).join(' ') || undefined
    }, content);
  }

  // Field icons follow the field: 16 px in the console (text-sm), 20 px on the portals and the premises portal.
  function fieldIconSize(p) { return p.density === 'console' ? 16 : 20; }
  // A prefix or a unit is part of what the value means, so it joins the label in the input's name:
  // "Offline playback limit hours", "Adjustment VND".
  function affixName(id, pre, suf) {
    return [id + '-label', pre ? id + '-pre' : null, suf ? id + '-suf' : null].filter(Boolean).join(' ');
  }

  // width on a Select or a Combobox: a cap in a column, as on every field, and the field's own width inside a FilterBar,
  // where the fields sit in a row and would otherwise shrink to the box's default width and cut the chosen name. The
  // field carries the width as --r1-field-width and the r1-field--sized class; only the FilterBar's rule reads them.
  function sizedField(p) {
    if (!p.width) return p;
    return Object.assign({}, p, { className: cx('r1-field--sized', p.className), style: Object.assign({ '--r1-field-width': p.width }, p.style) });
  }
  // masked: a stored secret value (a webhook signing secret, an account number) shown masked. Read-only, every character
  // but the last four is a dot, a screen reader hears "value ending in 4F2K", and revealable adds Show / Hide. Editable,
  // the input hides what is typed (type password, autocomplete off) and revealable adds the same toggle. Copying and
  // submitting always carry the whole value.
  function maskToggle(p, shown, setShown, mt) {
    if (!p.revealable) return null;
    return h(Button, {
      variant: 'quiet', size: p.density === 'console' ? 'sm' : 'md', icon: shown ? 'eye-off' : 'eye', className: 'r1-tf__reveal',
      ariaLabel: (shown ? mt.hideName : mt.showName) + ': ' + textOf(p.label),
      onClick: function () { announce(shown ? mt.hidden : mt.shown); setShown(!shown); }, locale: p.locale
    }, shown ? mt.hide : mt.show);
  }
  function TextField(p) {
    var id = useUid('r1-tf');
    var st = useSynced(isNil(p.value) ? '' : String(p.value), '');
    var reveal = useState(false);
    var mt = tx(p.locale).valueMask;
    var hiding = !!p.masked && !reveal[0];
    var control;
    if (p.readOnly) {
      var rv = isNil(p.value) || p.value === '' ? null : String(p.value);
      var bare = rv ? idChars(rv) : '';
      // multiline: a long value with no spaces (a JSON public key) breaks anywhere when it must, never widening the page.
      control = readOnlyBox(p, id, !rv ? '–' : hiding
        ? [h('span', { key: 'm', 'aria-hidden': 'true' }, maskValue(rv)), h('span', { key: 's', className: 'r1-sr' }, bare.length > 4 ? mt.ending.replace('{tail}', bare.slice(-4)) : mt.hiddenValue)]
        : [p.prefix ? p.prefix + ' ' : null, rv, p.suffix ? ' ' + p.suffix : null], cx((p.mono || p.masked) && 'r1-mono', p.multiline && !p.masked && 'r1-readonly--multiline'));
      if (p.masked && rv) control = h('div', { className: 'r1-tf__masked' }, control, maskToggle(p, reveal[0], reveal[1], mt));
    } else {
      var attrs = {
        id: id, name: p.name, className: cx('r1-input', (p.mono || p.masked) && 'r1-mono'),
        value: st[0], placeholder: p.placeholder, disabled: p.disabled, required: p.required,
        autoComplete: p.masked ? (p.autoComplete || 'off') : p.autoComplete, maxLength: p.maxLength,
        'aria-invalid': p.error ? 'true' : undefined, 'aria-describedby': describedBy(p, id),
        'aria-labelledby': p.prefix || p.suffix ? affixName(id, p.prefix, p.suffix) : undefined,
        inputMode: p.inputMode, onBlur: p.onBlur, onChange: function (e) { st[1](e.target.value); if (p.onChange) p.onChange(e.target.value, e); }
      };
      // wrap: a one-line value shown in full over as many lines as it needs (a long legal name on a phone). Enter adds no line.
      var input = p.masked ? h('input', Object.assign({ type: hiding ? 'password' : 'text', spellCheck: false, autoCapitalize: 'off' }, attrs))
        : p.multiline ? h('textarea', Object.assign({ rows: p.rows || 3 }, attrs))
        : p.wrap ? h('textarea', Object.assign({}, attrs, { rows: p.rows || 1, className: cx('r1-input', 'r1-input--wrap', p.mono && 'r1-mono'), enterKeyHint: 'next', onKeyDown: function (e) { if (e.key === 'Enter') e.preventDefault(); } }))
        : h('input', Object.assign({ type: p.type || 'text' }, attrs));
      control = p.suffix || p.prefix
        ? h('div', { className: 'r1-affix' }, p.prefix ? h('span', { id: id + '-pre', className: 'r1-affix__part' }, p.prefix) : null, input, p.suffix ? h('span', { id: id + '-suf', className: 'r1-affix__part' }, p.suffix) : null)
        : input;
      if (p.masked) control = h('div', { className: 'r1-tf__masked' }, control, maskToggle(p, reveal[0], reveal[1], mt));
    }
    return fieldShell(p, id, h('div', { className: 'r1-field__control', style: p.width ? { maxWidth: p.width } : undefined }, control));
  }

  function Select(p) {
    var id = useUid('r1-sel');
    var sv = useSynced(isNil(p.value) ? '' : p.value, '');
    var t = tx(p.locale);
    var opts = p.options || [];
    var current = null;
    for (var i = 0; i < opts.length; i++) if (opts[i].value === p.value) current = opts[i];
    var control;
    if (p.readOnly) {
      control = readOnlyBox(p, id, current ? current.label : '–');
    } else if (p.loading) {
      // While the options load, the field says so in words and cannot be opened; nothing is chosen on the reader's behalf.
      control = h('div', { className: 'r1-select r1-select--loading' },
        h('select', { id: id, name: p.name, className: 'r1-input r1-select__native', disabled: true, 'aria-busy': 'true', 'aria-describedby': describedBy(p, id) },
          h('option', { value: '' }, t.loading)),
        h(Icon, { name: 'loader-circle', size: fieldIconSize(p), spin: true, className: 'r1-select__chev' }));
    } else {
      control = h('div', { className: 'r1-select' },
        h('select', {
          id: id, name: p.name, className: 'r1-input r1-select__native', value: sv[0], disabled: p.disabled, required: p.required,
          'aria-invalid': p.error ? 'true' : undefined, 'aria-describedby': describedBy(p, id),
          onBlur: p.onBlur, onChange: function (e) { sv[1](e.target.value); if (p.onChange) p.onChange(e.target.value, e); }
        },
          p.placeholder ? h('option', { value: '' }, p.placeholder) : null,
          opts.map(function (o) { return h('option', { key: o.value, value: o.value }, o.label); })),
        h(Icon, { name: 'chevron-down', size: fieldIconSize(p), className: 'r1-select__chev' }));
    }
    var policy = p.policy ? h('div', { className: 'r1-field__policy' }, h(Icon, { name: 'scale', size: 16 }),
      h('span', null, (p.policy.name ? p.policy.name + ', ' + t.legal.version.toLowerCase() : t.legal.version) + ' ' + p.policy.version + ', ' + t.policyFrom + ' ' + (formatDate(p.policy.effective, p.locale) || p.policy.effective))) : null;
    return fieldShell(sizedField(p), id, h('div', { className: 'r1-field__control', style: p.width ? { maxWidth: p.width } : undefined }, control), policy);
  }

  // ------------------------------------------------------------ value atoms

  // A value the system does not have: a dash read aloud as words, or the page's own words when it says why
  // ("Chưa cấp"). Never 0, never blank.
  function missingValue(missing, words, className) {
    if (!isNil(missing) && missing !== '') return h('span', { className: cx('r1-null', className) }, missing);
    return h('span', { className: cx('r1-null', className) }, h('span', { 'aria-hidden': 'true' }, '–'), h('span', { className: 'r1-sr' }, words));
  }

  function MoneyValue(p) {
    var t = tx(p.locale);
    var s = formatMoney(p.amountMinor, p.currency, p.locale, p.bare);
    if (s === null) return missingValue(p.missing, t.notCalculated, cx('r1-num', p.className));
    return h('span', { className: cx('r1-num', p.className) }, s);
  }

  // unit: the word after the number; { one, other } follows the reader's plural ("1 field", "4,120 fields").
  function unitFor(unit, v, locale) {
    if (isNil(unit) || unit === '') return null;
    if (typeof unit !== 'object') return String(unit);
    var form;
    try { form = new Intl.PluralRules(lang(locale) === 'en' ? 'en-GB' : 'vi-VN').select(v); } catch (e) { form = v === 1 ? 'one' : 'other'; }
    return unit[form] || unit.other || unit.one || null;
  }
  function CountValue(p) {
    var t = tx(p.locale);
    var s = formatCount(p.value, p.locale);
    if (s === null) return missingValue(p.missing, t.noValue, cx('r1-num', p.className));
    var u = unitFor(p.unit, p.value, p.locale);
    return h('span', { className: cx('r1-num', p.className) }, u ? s + ' ' + u : s);
  }

  // The day and the clock in Vietnam time, whatever zone the value was written in: a timestamp at 00:30 on the
  // 17th in Hà Nội is the 17th, even though it is still the 16th in UTC.
  function vnParts(d) {
    var o = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' })
      .formatToParts(d).forEach(function (x) { if (x.type !== 'literal') o[x.type] = Number(x.value); });
    return o;
  }
  // The machine value of a <time>: the Vietnam calendar day for a date, the Vietnam wall clock with its offset for a moment.
  function machineDate(d, withTime) {
    var o = vnParts(d);
    var day = o.year + '-' + pad2(o.month) + '-' + pad2(o.day);
    if (!withTime) return day;
    var z = /GMT([+-])(\d+)(?::(\d+))?/.exec(offsetLabel(d));
    return day + 'T' + pad2(o.hour % 24) + ':' + pad2(o.minute) + ':' + pad2(o.second) + (z ? z[1] + pad2(Number(z[2])) + ':' + pad2(Number(z[3] || 0)) : '+07:00');
  }
  // The Vietnamese administrative form (Nghị định 30/2020/NĐ-CP): "ngày 05 tháng 02 năm 2026", with a zero before
  // a day under 10 and before the months 1 and 2.
  function legalDate(d) {
    var o = vnParts(d);
    return 'ngày ' + pad2(o.day) + ' tháng ' + (o.month < 3 ? pad2(o.month) : o.month) + ' năm ' + o.year;
  }
  // A date never breaks inside itself ("31 / tháng 12"): a line may break only between a date and its time, and
  // between the two ends of a period.
  function keepTogether(s) {
    return s.split(' – ').map(function (part) {
      return part.replace(/ /g, '\u00a0').replace(/,\u00a0(\d{2}:\d{2})/, ', $1').replace(/\u00a0đến\u00a0/, ' đến ');
    }).join(' – ');
  }
  function DateValue(p) {
    var t = tx(p.locale);
    var mode = p.mode || 'date';
    var legal = p.form === 'legal' && lang(p.locale) === 'vi';
    var d = toDate(p.value), e = toDate(p.to);
    var s;
    if (mode === 'period') s = legal ? (d && e ? 'từ ' + legalDate(d) + ' đến ' + legalDate(e) : null) : formatPeriod(p.value, p.to, p.locale, !!p.short);
    else if (mode === 'timestamp') s = legal && d ? formatTime(d) + ' ' + legalDate(d) + ' (' + offsetLabel(d) + ')' : formatTimestamp(p.value, p.locale);
    else if (mode === 'stamp') s = formatStamp(p.value, p.locale);
    else if (mode === 'time') s = d ? formatTime(d) + (p.zone === false ? '' : ' (' + offsetLabel(d) + ')') : null;
    else s = legal && d ? legalDate(d) : p.short ? formatDateShort(p.value, p.locale) : formatDate(p.value, p.locale);
    if (s === null) return missingValue(p.missing, t.noDate, p.className);
    s = keepTogether(s);
    // A period is two days; it reads as one phrase and carries no single machine value.
    if (mode === 'period') return h('span', { className: cx('r1-date', p.className) }, s);
    return h('time', { className: cx('r1-date', p.className), dateTime: machineDate(d, mode !== 'date') }, s);
  }

  // Copying says what happened: "Đã sao chép R1-…" to a screen reader and a tick on the button, or, when the
  // browser refuses, the reference selected for the reader to copy and a line saying it was not copied.
  // mask: every character but the last four is a dot (separators keep their place, so the shape holds), and a Show
  // button reveals the whole value; copy still copies the whole value, and nothing read aloud gives it away while hidden.
  // tail: only the last n characters after an ellipsis, for a dense column; the whole value is its accessible name and
  // its title, and it shows whole while it has focus. mask wins over tail.
  var ID_SEPARATOR = /[\s\-./_:]/;
  function idChars(v) { return v.split('').filter(function (c) { return !ID_SEPARATOR.test(c); }).join(''); }
  // A value of four characters or fewer is hidden whole.
  function maskValue(v) {
    var show = idChars(v).length > 4 ? 4 : 0, out = '';
    for (var i = v.length - 1; i >= 0; i--) {
      var c = v.charAt(i);
      if (ID_SEPARATOR.test(c)) { out = c + out; continue; }
      out = (show > 0 ? c : '\u2022') + out;
      show -= 1;
    }
    return out;
  }
  function Identifier(p) {
    var t = tx(p.locale);
    var st = useState('idle');
    var revealed = useState(false);
    var focused = useState(false);
    var valueRef = useRef(null), timer = useRef(null);
    useEffect(function () { return function () { clearTimeout(timer.current); }; }, []);
    var value = isNil(p.value) || String(p.value).trim() === '' ? null : String(p.value).trim();
    if (value === null) return missingValue(p.missing, t.noId, p.className);
    var masked = !!p.mask && !revealed[0];
    var bare = idChars(value);
    var ending = bare.length > 4 ? t.idMask.ending.replace('{tail}', bare.slice(-4)) : t.idMask.hiddenValue;
    var tailN = !p.mask && p.tail > 0 && value.length > p.tail ? Math.floor(p.tail) : 0;
    var spoken = masked ? ending : value;
    function show(next) {
      st[1](next);
      clearTimeout(timer.current);
      timer.current = setTimeout(function () { st[1]('idle'); }, next === 'failed' ? 6000 : 1600);
    }
    function selectValue() {
      try {
        var r = document.createRange(); r.selectNodeContents(valueRef.current);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        return sel;
      } catch (e) { return null; }
    }
    // A hidden or shortened value is not what is on screen, so the fallback copies it from a field off screen.
    function offscreenCopy() {
      var ta = document.createElement('textarea'), ok = false;
      ta.value = value; ta.setAttribute('readonly', ''); ta.className = 'r1-sr';
      document.body.appendChild(ta);
      try { ta.select(); ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    function legacyCopy() {
      if (masked || (tailN && !focused[0])) return offscreenCopy();
      var sel = selectValue(), ok = false;
      try { ok = !!sel && document.execCommand('copy'); } catch (e) { ok = false; }
      if (ok && sel) sel.removeAllRanges();
      return ok;
    }
    function done() { show('copied'); announce(t.copied + ' ' + spoken); }
    function fail() {
      show('failed');
      if (masked) { announce(t.idMask.copyFailed); return; }
      announce(t.copyFailed);
      // A shortened value shows whole once it has focus, then it is selected for the reader to copy.
      if (tailN && valueRef.current) { focusEl(valueRef.current); setTimeout(selectValue, 0); } else selectValue();
    }
    function onCopy() {
      var c = typeof navigator !== 'undefined' ? navigator.clipboard : null;
      if (c && c.writeText) {
        try { c.writeText(value).then(done, function () { if (legacyCopy()) done(); else fail(); }); return; } catch (e) { /* fall through */ }
      }
      if (legacyCopy()) done(); else fail();
    }
    function onReveal() { announce(revealed[0] ? t.idMask.hidden : t.idMask.shown); revealed[1](!revealed[0]); }
    var text;
    if (masked) {
      text = h('span', { ref: valueRef, className: 'r1-mono r1-id__value r1-id__value--masked' },
        h('span', { 'aria-hidden': 'true' }, maskValue(value)), h('span', { className: 'r1-sr' }, ending));
    } else if (tailN) {
      var whole = focused[0];
      text = h('span', {
        ref: valueRef, className: cx('r1-mono r1-id__value r1-id__value--tail', whole && 'r1-id__value--whole'), tabIndex: 0, title: value,
        onFocus: function () { focused[1](true); }, onBlur: function () { focused[1](false); }
      }, whole ? value : [h('span', { key: 'v', 'aria-hidden': 'true' }, '\u2026' + value.slice(-tailN)), h('span', { key: 's', className: 'r1-sr' }, value)]);
    } else {
      text = h('span', { ref: valueRef, className: 'r1-mono r1-id__value' }, value);
    }
    // grouped: a long key written in blocks (an authenticator key) may break between two blocks, never inside one
    // size 'lg': a reference read aloud over the phone, at text-lg (never letter-spaced: it matches the printed record).
    return h('span', { className: cx('r1-id', 'r1-id--' + (p.size === 'sm' || p.size === 'lg' ? p.size : 'md'), p.grouped && 'r1-id--grouped', p.className) },
      text,
      p.mask ? h('button', { type: 'button', className: 'r1-id__reveal', onClick: onReveal, 'aria-label': revealed[0] ? t.idMask.hideName : t.idMask.showName },
        h(Icon, { name: revealed[0] ? 'eye-off' : 'eye', size: 16 }), h('span', { 'aria-hidden': 'true' }, revealed[0] ? t.idMask.hide : t.idMask.show)) : null,
      p.copy === false ? null : h('button', { type: 'button', className: 'r1-id__copy', onClick: onCopy, 'aria-label': t.copy + ' ' + spoken },
        h(Icon, { name: st[0] === 'copied' ? 'check' : 'copy', size: 16 })),
      st[0] === 'failed' ? h('span', { className: 'r1-id__msg' }, t.copyFailedShort) : null);
  }

  // Facts of one record. A fact the reader may change here carries its own Change action, named for the fact;
  // two columns fall back to one on a phone, and a label sits above its value when the row is too narrow for both.
  function FactList(p) {
    var t = tx(p.locale);
    var items = p.items || [];
    var acts = items.some(function (it) { return it && it.action; });
    return h('dl', { className: cx('r1-facts', p.columns === 2 && 'r1-facts--2', acts && 'r1-facts--actions', p.className), style: p.style },
      items.map(function (it, i) {
        var v = it.value;
        var none = isNil(v) || v === '' || (Array.isArray(v) && !v.length);
        var value = none ? missingValue(it.missing, t.noValue)
          : it.kind === 'id' ? h(Identifier, { value: v, locale: p.locale })
          : renderCell(it, v, p.locale);
        var a = it.action;
        return h('div', { key: i, className: 'r1-facts__row' },
          h('dt', null, it.label),
          h('dd', null, value,
            it.provenance ? h(ProvenanceChip, { kind: it.provenance, detail: it.provenanceDetail, words: p.provenanceWords, locale: p.locale }) : null,
            it.note ? h('div', { className: 'r1-facts__note' }, keepRefs(it.note)) : null),
          a ? h('dd', { className: 'r1-facts__action' }, h(Button, {
            variant: 'quiet', size: p.density === 'portal' ? 'md' : 'sm', href: a.href, onClick: a.onClick,
            disabled: a.disabled, disabledReason: a.disabledReason, locale: p.locale
          }, a.label || t.facts.change, h('span', { className: 'r1-sr' }, ' ' + textOf(it.label)))) : null);
      }));
  }

  // When a figure that is not live was worked out, in one line: the period, the time it was computed, the cadence.
  // A part that is missing is left out; with nothing known the line says so.
  function FreshnessLine(p) {
    var t = tx(p.locale);
    var period = p.period && typeof p.period === 'object' ? formatPeriod(p.period.from, p.period.to, p.locale) : p.period;
    var at = formatTimestamp(p.asOf, p.locale);
    var head = [period ? t.figures + ' ' + period : null, at ? t.asOf + ' ' + at : null].filter(Boolean).join(', ');
    var text = head && p.cadence ? head + '. ' + p.cadence : head || p.cadence || t.freshUnknown;
    return h('p', { className: cx('r1-fresh', p.className) }, h(Icon, { name: 'clock', size: 16 }), h('span', null, text.charAt(0).toUpperCase() + text.slice(1)));
  }

  // ------------------------------------------------------------------ table

  // A value missing from a cell: the dash for the eye, words for a screen reader (the cell's or the column's
  // missing text, else the shared "no value").
  function nullCell(col, locale, text) {
    return h('span', { className: 'r1-null' }, h('span', { 'aria-hidden': 'true' }, '–'), h('span', { className: 'r1-sr' }, text || (col && col.missing) || tx(locale).noValue));
  }
  function renderCell(col, v, locale, density, menuLabel) {
    var kind = col.kind || 'text';
    if (v && typeof v === 'object' && !Array.isArray(v) && !isNil(v.missing) && Object.keys(v).length === 1) return nullCell(col, locale, v.missing);
    if (kind === 'menu') return isNil(v) || !v.length ? null : h(Menu, { iconOnly: true, variant: 'quiet', size: 'sm', align: 'end', label: menuLabel || tx(locale).menu.more, items: v, locale: locale });
    if (kind === 'deadline') return isNil(v) ? nullCell(col, locale) : h(DeadlineClock, Object.assign({ size: 'sm', locale: locale }, typeof v === 'object' ? v : { due: v }));
    // decimals: a column of figures stored to a set precision ("14,00 %"); without it at most one decimal.
    if (kind === 'percent') return isNil(v) ? nullCell(col, locale) : formatPercent(v, locale, { decimals: col.decimals }) || nullCell(col, locale);
    if (kind === 'period') return isNil(v) ? nullCell(col, locale) : h(DateValue, { value: v.from, to: v.to, mode: 'period', short: !!col.short, locale: locale });
    if (kind === 'person') {
      if (isNil(v) || v === '') return nullCell(col, locale);
      var who = typeof v === 'object' ? v : { name: v };
      return h('span', { className: 'r1-person' }, h(Avatar, { name: who.name, src: who.src, size: 'sm', kind: who.kind, decorative: true }),
        h('span', { className: 'r1-stack' }, h('span', { className: 'r1-person__name' }, who.name), who.detail ? h('span', { className: 'r1-stack__detail' }, who.detail) : null));
    }
    if (kind === 'actions') {
      // an array of buttons, or { items, message, severity, code } when the row also explains why an action is refused.
      // ariaLabel: the button's accessible name when the visible label needs the row's reference ("Resolve CFU-8WN3KT6QPA").
      // code: the refusal code, on the line after the message as a Banner without a title writes it ("Code LAST_SIGNING_KEY").
      var items = isNil(v) ? [] : (Array.isArray(v) ? v : v.items || []);
      var msg = v && !Array.isArray(v) ? v.message : null;
      if (!items.length && !msg) return null;
      var btns = items.length ? h('div', { className: 'r1-table__actions' }, items.map(function (a, i) {
        return h(Button, { key: i, variant: a.variant || 'secondary', size: density === 'touch' ? 'lg' : density === 'portal' ? 'md' : 'sm', icon: a.icon, href: a.href, disabled: a.disabled, disabledReason: a.disabledReason, onClick: a.onClick, ariaLabel: a.ariaLabel, locale: locale }, a.label);
      })) : null;
      return msg ? h('div', { className: 'r1-table__actcell' }, btns, rowMsg(v.severity || 'warning', msg, undefined, v.code, locale)) : btns;
    }
    if (kind === 'entries') {
      // several short records in one cell, one per line: a code, a state and a note
      if (isNil(v) || !v.length) return nullCell(col, locale);
      return h('ul', { className: 'r1-entries' }, v.map(function (e, i) {
        return h('li', { key: i, className: 'r1-entries__item' },
          e.code ? h('span', { className: 'r1-mono r1-entries__code' }, e.code) : null,
          e.status ? h(StatusBadge, { family: e.status.family, label: e.status.label, icon: e.status.icon, size: 'sm' }) : null,
          e.text ? h('span', { className: 'r1-entries__text' }, keepRefs(e.text)) : null);
      }));
    }
    if (kind === 'stack') {
      if (isNil(v) || v === '') return nullCell(col, locale);
      if (typeof v !== 'object') return h('span', { className: 'r1-strong' }, keepRefs(v));
      var main = v.href ? h('a', { className: 'r1-link r1-link--standalone', href: v.href }, keepRefs(v.text)) : keepRefs(v.text);
      // mono: the main text is a reference (a printout or a key), in the monospace face.
      return h('span', { className: cx('r1-stack', v.muted && 'r1-stack--muted', v.plain && 'r1-stack--plain', v.struck && 'r1-stack--struck') }, h('span', { className: cx('r1-stack__text', v.mono && 'r1-mono') }, main), v.detail ? h('span', { className: cx('r1-stack__detail', v.num && 'r1-num', (col.detailSize || v.detailSize) === 'sm' && 'r1-stack__detail--sm') }, keepRefs(v.detail)) : null);
    }
    if (kind === 'status') {
      if (isNil(v)) return nullCell(col, locale);
      if (v.quiet) return h('span', { className: 'r1-quiet' }, v.label);
      // working: a state running now; the plain word and the badge show the spinner in place of the shape (StatusBadge).
      var going = v.working ? workingWords(v.label, locale) : null;
      if (v.plain) return h('span', { className: 'r1-stext r1-stext--' + (v.family || 'neutral') }, h('span', { className: 'r1-stext__line' }, v.working ? h(Icon, { name: 'loader-circle', size: 16, spin: true }) : v.icon && ICONS[v.icon] ? h(Icon, { name: v.icon, size: 16, strokeWidth: 2.5, className: 'r1-status-icon' }) : h(StatusIcon, { family: v.family || 'neutral', size: 16, cutout: 'surface' }), h('span', null, v.label), going ? h('span', { className: 'r1-sr' }, going) : null),
        isNil(v.identifier) || v.identifier === '' ? null : h('span', { className: 'r1-sbadge__id' }, v.identifierLabel ? h('span', { className: 'r1-stext__detail' }, v.identifierLabel) : null, h(Identifier, { value: v.identifier, size: 'sm', locale: locale })),
        v.detail ? h('span', { className: 'r1-stext__detail' }, keepRefs(v.detail)) : null);
      var badge = v.working ? { family: v.family, label: v.label, size: 'sm', variant: v.variant, icon: v.icon, working: true, locale: locale } : { family: v.family, label: v.label, size: 'sm', variant: v.variant, icon: v.icon };
      // identifier: the record the state points to ("Thay bằng REG-W3HN6DRZ2Q"), an Identifier with its copy button under
      // the badge, after identifierLabel when the page gives one; a detail line follows it.
      var ref = isNil(v.identifier) || v.identifier === '' ? null : h('span', { className: 'r1-sbadge__id' },
        v.identifierLabel ? h('span', { className: 'r1-stext__detail' }, v.identifierLabel) : null, h(Identifier, { value: v.identifier, size: 'sm', locale: locale }));
      // A badge with a detail: the line under it says what the state means here ("grants nothing until then").
      if (v.detail || ref) return h('span', { className: 'r1-sbadge' }, h(StatusBadge, badge), ref, v.detail ? h('span', { className: 'r1-stext__detail' }, keepRefs(v.detail)) : null);
      return h(StatusBadge, badge);
    }
    // size 'lg' on an id column: a reference read aloud over the phone, at text-lg.
    if (kind === 'id') return h(Identifier, { value: v, size: col.size === 'lg' ? 'lg' : 'sm', locale: locale });
    if (kind === 'money') return h(MoneyValue, { missing: col.missing, amountMinor: isNil(v) ? null : (typeof v === 'object' ? v.amountMinor : v), currency: v && v.currency, bare: !!col.unit && col.unit === ((v && v.currency) || 'VND'), locale: locale });
    if (kind === 'count') return h(CountValue, { missing: col.missing, value: v, locale: locale });
    // an absent date reads as the column's own words when it has them ("never used"), else as "no date"
    if ((kind === 'date' || kind === 'datetime' || kind === 'stamp') && (isNil(v) || v === '') && col.missing) return nullCell(col, locale);
    // short: the short month ("24 thg 9, 2026") for a dense console column
    if (kind === 'date') return h(DateValue, { value: v, short: !!col.short, locale: locale });
    if (kind === 'datetime') return h(DateValue, { value: v, mode: 'timestamp', locale: locale });
    if (kind === 'stamp') return h(DateValue, { value: v, mode: 'stamp', locale: locale });
    if (kind === 'unavailable') return h('span', { className: 'r1-unavail' }, h(Icon, { name: 'circle-help', size: 16 }), h('span', null, (v && v.word) || tx(locale).unavailableWord), v && v.detail ? h('span', { className: 'r1-unavail__detail' }, v.detail) : null);
    if (kind === 'link') return isNil(v) ? nullCell(col, locale) : (v.href ? h('a', { className: 'r1-link', href: v.href }, v.label) : h('span', null, v.label));
    if (isNil(v) || v === '') return nullCell(col, locale);
    if (typeof v === 'object' && v.unavailable) return renderCell({ kind: 'unavailable' }, v, locale);
    if (kind === 'strong') return h('span', { className: 'r1-strong' }, keepRefs(v));
    if (kind === 'muted') return h('span', { className: 'r1-muted' }, keepRefs(v));
    if (kind === 'mono') return h('span', { className: 'r1-mono' }, v);
    // A reference in running text (REG-W3HN6DRZ2Q, R1-CER-2026-W5HK8TQM) never breaks at its hyphen.
    return keepRefs(v);
  }

  var NOWRAP = { id: 1, status: 1, count: 1, money: 1, date: 1, datetime: 1, stamp: 1, mono: 1, link: 1, unavailable: 1, actions: 1, percent: 1, deadline: 1, menu: 1, period: 1 };
  var NUMERIC = { money: 1, count: 1, percent: 1 };
  var KEEP_UNSTRUCK = { status: 1, actions: 1, menu: 1, deadline: 1, entries: 1 };
  var SKEL_WIDTH = { id: 70, status: 50, count: 40, money: 55, percent: 35, date: 60, datetime: 75, stamp: 55, actions: 45, menu: 20, deadline: 60 };
  var TONES = { attention: 1, danger: 1, positive: 1, info: 1 };

  // A row message without a live role, so the messages already on a table are read with their rows and not
  // all at once when it loads. A message that appears later is announced by the table itself.
  function rowMsg(severity, text, id, code, locale) {
    // neutral: a plain fact under the row (the record it was merged into), with no tint and no warning
    var family = severity === 'error' ? 'danger' : severity === 'info' ? 'info' : severity === 'neutral' ? 'neutral' : 'attention';
    // code: the refusal code on the line after the sentence, small, as a Banner without a title writes it. A row's
    // _message takes it as the actions cell's {items, message, code} does: { severity, text, code }.
    return h('div', { id: id, className: cx('r1-msg', 'r1-msg--' + family) },
      h(StatusIcon, { family: family, size: 16, cutout: 'surface' }),
      h('div', { className: 'r1-msg__body' }, h('span', null, keepRefs(text)),
        code ? h('span', { className: 'r1-msg__code' }, h('span', { className: 'r1-msg__code-label' }, tx(locale).code), ' ', h('span', null, code)) : null));
  }
  // Amounts, counts and percentages align right by their kind; align 'start' keeps one on the left.
  function alignEnd(c) { return c.align === 'end' || (c.align !== 'start' && !!NUMERIC[c.kind]); }
  var SEV_TONE = { error: 'danger', warning: 'attention', info: 'info' };

  // Rows of records with typed cells, so amounts align, identifiers copy and a missing value never reads as zero.
  // Everything a table in this product needs lives here: sorting, units and definitions in the header, selection
  // with its scope, rows that wait behind an expander, row messages, totals, and the loading, empty and error states
  // drawn in the table's own shape. layout="cards" is the same table at phone width.
  // Selection: rows start ticked from _checked (or the selected keys); the boxes then work, the header box ticks
  // or clears every row that can be ticked, and onSelectionChange(keys, rows) reports each change.
  // Measured after each render: whether the table scrolls in its container (then the container takes focus and is
  // named), which truncated cells are cut (only those take focus), the offsets of the sticky columns, and the
  // heading of the panel around it when no caption is given.
  function Table(p) {
    var t = tx(p.locale);
    var tid = useUid('r1-tbl');
    var exState = useState({});
    var wrapRef = useRef(null);
    var scrolls = useState(false);
    var named = useState(null);
    var said = useRef(null);
    var measure = useRef(null);
    var SEP = '\u0001';
    function keyOf(r, i) { return isNil(r._key) ? 'row-' + i : String(r._key); }
    var density = p.density || 'portal';
    var allCols = (p.columns || []).filter(function (c) { return !c.hidden; });
    var rows = p.rows || [];
    var selectable = !!p.selectable;
    var expandable = !!p.expandable && p.layout !== 'cards';
    var hiddenCols = expandable ? allCols.filter(function (c) { return c.priority === 'low'; }) : [];
    var cols = expandable ? allCols.filter(function (c) { return c.priority !== 'low'; }) : allCols;
    var span = cols.length + (selectable ? 1 : 0) + (expandable ? 1 : 0);
    var dataRows = rows.filter(function (r) { return !r._group; });
    var loading = !!p.loading && !dataRows.length;
    var nLoading = p.loading === true ? 5 : (p.loading || 0);
    var btnSize = density === 'portal' ? 'md' : 'sm';
    // rowFocus: the rows take one tab stop between them; arrows or J and K move, Enter opens (onOpen, else the row's link),
    // X ticks. Keys are handled on the table itself, and only while a row, not a control inside it, has focus.
    var rowFocus = !!p.rowFocus && p.layout !== 'cards';
    var cur = useState(null);
    function colStyle(c) {
      var s = {};
      if (c.width) s.width = c.width;
      if (c.minWidth) s.minWidth = c.minWidth;
      if (c.maxWidth) s.maxWidth = c.maxWidth;
      return s;
    }
    function nameOf(r, i) { var v = r[cols[0] && cols[0].key]; return typeof v === 'string' ? v : v && typeof v === 'object' && typeof v.text === 'string' ? v.text : String(i + 1); }
    // link: the cell is the row's link. A link holds no other control, so a reference there (kind id) is drawn without
    // its copy button; the record it opens has the reference with its copy button.
    // truncate without maxWidth cuts at space-64 in a table, so the column does not widen to the whole text; on a card
    // the fact's own width cuts it.
    function cell(c, r, i, link) {
      var v = r[c.key];
      var content = link && c.kind === 'id' && !(v && typeof v === 'object') ? h(Identifier, { value: v, size: c.size === 'lg' ? 'lg' : 'sm', copy: false, locale: p.locale })
        : renderCell(c, v, p.locale, density, c.kind === 'menu' ? t.table.rowActions + ' ' + nameOf(r, i) : null);
      var cap = c.maxWidth || (p.layout === 'cards' ? null : 'var(--space-64)');
      if (c.truncate && typeof v === 'string') content = h('span', { className: 'r1-trunc', title: v, style: cap ? { maxWidth: cap } : undefined }, content);
      // A dropped row strikes through its values; a state, an action or a deadline keeps its own look.
      if (r._dropped && !KEEP_UNSTRUCK[c.kind]) content = h('span', { className: 'r1-dropped' }, content);
      return content;
    }
    // _dropped: the row was taken out of the set it belonged to (a line dropped from a distribution, a premises dropped
    // from a batch). It stays in the list, muted and struck through, with its reason on the line under it
    // (_droppedReason, or _dropped itself when it is a sentence) and "dropped" for a screen reader after its first cell.
    function droppedWhy(r) { return typeof r._dropped === 'string' ? r._dropped : r._droppedReason; }
    function droppedWords(r) { return r._dropped ? h('span', { className: 'r1-sr' }, ' (' + t.table.dropped + ')') : null; }
    // The tint: an explicit _tone first, else the message's severity (a message without one is a warning), else held.
    function tone(r) { return TONES[r._tone] ? r._tone : r._message ? SEV_TONE[r._message.severity || 'warning'] || null : r._quarantined ? 'attention' : null; }
    // _disabled: the row cannot be ticked or opened. _unselectable: it cannot be ticked but keeps its link.
    function noTick(r) { return !!(r._disabled || r._unselectable); }
    function msgOf(r) { return r._message || (r._dropped && droppedWhy(r) ? { severity: 'neutral', text: droppedWhy(r) } : r._disabled && r._disabledReason ? { severity: 'info', text: r._disabledReason } : r._unselectable && r._unselectableReason ? { severity: 'info', text: r._unselectableReason } : null); }
    function stateWords(r) { return r._changed ? h('span', { className: 'r1-row__changed' }, t.table.changed) : null; }
    // The record open beside the table: the tint and a heavier leading cell, and the words for screen readers.
    function openWords(r) { return r._selected ? h('span', { className: 'r1-sr' }, ' (' + t.table.open + ')') : null; }
    var keyed = rows.map(function (r, i) { return { r: r, k: keyOf(r, i) }; }).filter(function (x) { return !x.r._group; });
    var seed = p.selected ? p.selected.join(SEP) : keyed.filter(function (x) { return x.r._checked; }).map(function (x) { return x.k; }).join(SEP);
    var selSt = useSynced(seed, seed);
    var picked = {};
    selSt[0].split(SEP).forEach(function (k) { if (k) picked[k] = true; });
    function isOn(r, i) { return !!picked[keyOf(r, i)]; }
    var enabledKeys = keyed.filter(function (x) { return !noTick(x.r); }).map(function (x) { return x.k; });
    var enabled = dataRows.filter(function (r) { return !noTick(r); });
    var nChecked = enabledKeys.filter(function (k) { return picked[k]; }).length;
    var allChecked = enabledKeys.length > 0 && nChecked === enabledKeys.length;
    function setPicked(keys) {
      selSt[1](keys.join(SEP));
      if (p.onSelectionChange) p.onSelectionChange(keys, keyed.filter(function (x) { return keys.indexOf(x.k) >= 0; }).map(function (x) { return x.r; }));
    }
    function toggleRow(r, i) {
      var k = keyOf(r, i);
      var keys = keyed.map(function (x) { return x.k; }).filter(function (x) { return x === k ? !picked[k] : picked[x]; });
      setPicked(keys);
    }
    function toggleAll() { setPicked(allChecked ? keyed.filter(function (x) { return noTick(x.r) && picked[x.k]; }).map(function (x) { return x.k; }) : keyed.filter(function (x) { return picked[x.k] || !noTick(x.r); }).map(function (x) { return x.k; })); }
    var stopKey = cur[0] !== null && keyed.some(function (x) { return x.k === cur[0]; }) ? cur[0] : (keyed[0] && keyed[0].k);
    function onRowKey(e) {
      var tr = e.target;
      if (!rowFocus || !tr || tr.tagName !== 'TR' || !tr.hasAttribute('data-row') || e.ctrlKey || e.metaKey || e.altKey) return;
      var list = Array.prototype.slice.call(e.currentTarget.querySelectorAll('tbody > tr[data-row]'));
      var at = list.indexOf(tr), key = e.key, go = null;
      var hit = keyed.filter(function (x) { return x.k === tr.getAttribute('data-row'); })[0];
      if (key === 'ArrowDown' || key === 'j' || key === 'J') go = list[Math.min(list.length - 1, at + 1)];
      else if (key === 'ArrowUp' || key === 'k' || key === 'K') go = list[Math.max(0, at - 1)];
      else if (key === 'Home') go = list[0];
      else if (key === 'End') go = list[list.length - 1];
      else if (key === 'Enter' && hit) {
        e.preventDefault();
        if (p.onOpen) p.onOpen(hit.r, rows.indexOf(hit.r));
        else { var link = tr.querySelector('a.r1-rowlink'); if (link) link.click(); }
        return;
      }
      else if ((key === 'x' || key === 'X') && selectable && hit && !noTick(hit.r)) { e.preventDefault(); toggleRow(hit.r, rows.indexOf(hit.r)); return; }
      if (go) { e.preventDefault(); focusEl(go); }
    }
    function rowOpen(r, i) { var k = keyOf(r, i); return isNil(exState[0][k]) ? !!r._expanded : exState[0][k]; }

    // The name: the caption, else the heading of the panel the table sits in, else the column names.
    var caption = p.caption || null;
    var labelledBy = !caption && named[0] ? named[0] : null;
    var derived = !caption && !labelledBy ? t.table.captionFrom.replace('{cols}', allCols.map(function (c) { return typeof c.label === 'string' ? c.label : ''; }).filter(Boolean).join(', ')) : null;

    measure.current = function () {
      var wrap = wrapRef.current;
      if (!wrap) return;
      var over = p.layout !== 'cards' && (wrap.scrollWidth > wrap.clientWidth + 1 || (!!p.maxHeight && wrap.scrollHeight > wrap.clientHeight + 1));
      if (over !== scrolls[0]) scrolls[1](over);
      if (!p.caption && !named[0] && wrap.parentElement) {
        var host = wrap.parentElement.closest('[aria-labelledby]');
        var hid = host && host.getAttribute('aria-labelledby');
        if (hid && document.getElementById(hid)) named[1](hid);
      }
      Array.prototype.forEach.call(wrap.querySelectorAll('.r1-trunc'), function (el) {
        if (el === document.activeElement) return;
        if (el.scrollWidth > el.clientWidth + 1) el.setAttribute('tabindex', '0'); else el.removeAttribute('tabindex');
      });
      if (p.stickyFirst) {
        var left = 0, at = {};
        Array.prototype.forEach.call(wrap.querySelectorAll('thead > tr:first-child > [data-sticky]'), function (th) { at[th.getAttribute('data-sticky')] = left; left += th.getBoundingClientRect().width; });
        Array.prototype.forEach.call(wrap.querySelectorAll('[data-sticky]'), function (el) { el.style.left = (at[el.getAttribute('data-sticky')] || 0) + 'px'; });
      }
    };
    useLayoutEffect(function () { measure.current(); });
    useEffect(function () {
      var wrap = wrapRef.current;
      if (typeof ResizeObserver === 'undefined' || !wrap) return undefined;
      var ro = new ResizeObserver(function () { if (measure.current) measure.current(); });
      ro.observe(wrap);
      if (wrap.firstElementChild) ro.observe(wrap.querySelector('table') || wrap.firstElementChild);
      return function () { ro.disconnect(); };
    }, []);
    // Row messages: the ones present when the table loads are read with their rows; a new or changed one is said once.
    useEffect(function () {
      var now = {}, fresh = [], urgent = false;
      rows.forEach(function (r, i) { if (r._group) return; var m = msgOf(r); if (m) now[keyOf(r, i)] = m; });
      var before = said.current;
      said.current = {};
      Object.keys(now).forEach(function (k) {
        var txt = textOf(now[k].text);
        said.current[k] = txt;
        if (before && before[k] !== txt) { fresh.push(txt); if (now[k].severity === 'error') urgent = true; }
      });
      if (fresh.length) announce(fresh.join(' '), urgent ? 'assertive' : 'polite');
    });

    var foot = p.footer ? h('div', { className: 'r1-table__foot' }, p.footer) : null;
    var err = p.error || null;
    // A load that failed while rows are shown keeps the rows and says so above them, with the way to try again.
    var errorBar = err && dataRows.length ? h('div', { className: 'r1-table__error' },
      h(Banner, {
        family: 'danger', compact: true, title: t.couldNotLoad, locale: p.locale,
        actions: err.retryable === false ? null : h(Button, { icon: 'refresh-cw', size: btnSize, onClick: err.onRetry, locale: p.locale }, t.retry)
      },
        err.text ? h('span', null, err.text + ' ') : null,
        err.retryable === false ? h('span', null, t.retryNoHelp + ' ') : null,
        err.traceId ? h('span', { className: 'r1-table__trace' }, t.traceRef + ' ', h(Identifier, { value: err.traceId, size: 'sm', locale: p.locale }), ', ' + t.quoteSupport) : null)) : null;
    // Empty: nothing yet unless the page says why. A list emptied by filters offers Clear filters only when it can act.
    var em = p.empty || {};
    var emVariant = em.variant || 'not-started';
    var emAction = em.action === false ? false : em.action ? em.action
      : emVariant === 'filtered' && em.onClear ? h(Button, { variant: 'quiet', icon: 'x', size: btnSize, onClick: em.onClear, locale: p.locale }, t.empty.clearFilters) : false;
    var emTitle = em.title || (emVariant === 'filtered' ? t.table.noRows : emVariant === 'not-started' ? t.table.none : undefined);
    var stateBlock = !dataRows.length && !loading ? (err
      ? h(EmptyState, { variant: 'error', traceId: err.traceId, retryable: err.retryable, onRetry: err.onRetry, density: density, locale: p.locale }, err.text)
      : h(EmptyState, { variant: emVariant, title: emTitle, action: emAction, level: em.level, locale: p.locale }, em.text)) : null;

    // ---------------------------------------------------- phone width: a card per row
    if (p.layout === 'cards') {
      var titleCol = allCols[0];
      var statusCol = allCols.filter(function (c) { return c.kind === 'status'; })[0];
      var actionCol = allCols.filter(function (c) { return c.kind === 'actions' || c.kind === 'menu'; })[0];
      var factCols = allCols.slice(1).filter(function (c) { return c !== statusCol && c !== actionCol && !c.hideOnCards; });
      var skel = [];
      for (var s = 0; s < nLoading; s++) skel.push(h('li', { key: 's' + s, className: 'r1-card r1-card--skel', 'aria-hidden': 'true' }, h('span', { className: 'r1-skel', style: { width: '60%' } }), h('span', { className: 'r1-skel', style: { width: '40%' } }), h('span', { className: 'r1-skel', style: { width: '80%' } })));
      return h('div', { ref: wrapRef, className: cx('r1-cards', 'r1-cards--' + density, p.className), style: p.style, 'aria-busy': loading ? 'true' : undefined },
        caption || derived ? h('p', { className: 'r1-sr' }, caption || derived) : null,
        loading ? h('span', { className: 'r1-sr', role: 'status' }, t.loading) : null,
        errorBar,
        stateBlock ? h('div', { className: 'r1-cards__state' }, stateBlock) : null,
        h('ul', { className: 'r1-cards__list', 'aria-label': caption || undefined, 'aria-labelledby': labelledBy || undefined }, loading ? skel : rows.map(function (r, i) {
          if (r._group) return h('li', { key: r._key || 'g' + i, className: 'r1-cards__group' }, r._groupCode ? h('span', { className: 'r1-mono r1-table__groupcode' }, r._groupCode) : null, r._group, !isNil(r._groupCount) ? h('span', { className: 'r1-cards__groupnote r1-num' }, formatCount(r._groupCount, p.locale)) : null, r._groupNote ? h('span', { className: 'r1-cards__groupnote' }, r._groupNote) : null);
          var title = cell(titleCol, r, i, !!r._href);
          var m = msgOf(r);
          var tn = tone(r);
          return h('li', { key: keyOf(r, i), className: cx('r1-card', r._selected && 'r1-card--selected', isOn(r, i) && 'r1-card--checked', tn && 'r1-card--' + tn, r._disabled && 'r1-card--disabled', r._changed && 'r1-card--changed', r._dropped && 'r1-card--dropped'), 'aria-busy': r._busy ? 'true' : undefined, 'aria-current': r._selected ? 'true' : undefined },
            h('div', { className: 'r1-card__head' },
              selectable ? h('label', { className: 'r1-choice r1-choice--bare r1-card__check' }, choiceMark('checkbox', { checked: isOn(r, i), onChange: function () { toggleRow(r, i); }, disabled: noTick(r), 'aria-label': t.selectRow + ' ' + nameOf(r, i) })) : null,
              // The title and the status share a line while both fit; the status moves under the title when it does not,
              // and always when it carries a detail line, so neither runs over the other.
              h('div', { className: 'r1-card__main' },
                h('span', { className: cx('r1-card__title', titleCol.kind === 'id' && 'r1-card__title--id') }, r._busy ? h(Icon, { name: 'loader-circle', size: 16, spin: true, label: t.loading }) : null, r._href ? h('a', { className: 'r1-link r1-rowlink', href: r._href }, title) : title, stateWords(r), openWords(r), droppedWords(r)),
                statusCol ? h('span', { className: cx('r1-card__status', r[statusCol.key] && r[statusCol.key].detail && 'r1-card__status--below') }, cell(statusCol, r, i)) : null)),
            factCols.length ? h('dl', { className: 'r1-card__facts' }, factCols.map(function (c) {
              return h('div', { key: c.key, className: 'r1-card__fact' }, h('dt', null, c.label, c.unit ? ' (' + c.unit + ')' : ''), h('dd', { className: cx((NUMERIC[c.kind] || c.num) && 'r1-num') }, cell(c, r, i)));
            })) : null,
            m ? rowMsg(m.severity || 'warning', m.text, undefined, m.code, p.locale) : null,
            actionCol && r[actionCol.key] ? h('div', { className: 'r1-card__actions' }, renderCell(actionCol, r[actionCol.key], p.locale, density === 'portal' ? 'touch' : density, t.table.rowActions + ' ' + nameOf(r, i))) : null);
        }).concat(p.totals && !loading ? [h('li', { key: '__total', className: 'r1-card r1-card--total' },
          h('span', { className: 'r1-card__title' }, p.totals.label || t.table.total),
          h('dl', { className: 'r1-card__facts' }, allCols.filter(function (c) { return !isNil((p.totals.values || {})[c.key]); }).map(function (c) {
            return h('div', { key: c.key, className: 'r1-card__fact' }, h('dt', null, c.label), h('dd', { className: 'r1-num' }, renderCell(c, p.totals.values[c.key], p.locale, density)));
          })))] : [])),
        p.loadingMore ? h('p', { className: 'r1-table__more', role: 'status' }, h(Icon, { name: 'loader-circle', size: 16, spin: true }), h('span', null, t.table.loadingMore)) : null,
        foot);
    }

    // ---------------------------------------------------- the table
    // stickyFirst: the expander, the tick box and every column marked sticky stay at the left edge, in that order.
    var sticky = {}, nSticky = 0;
    if (p.stickyFirst) {
      if (expandable) sticky.__exp = nSticky++;
      if (selectable) sticky.__sel = nSticky++;
      cols.forEach(function (c) { if (c.sticky) sticky[c.key] = nSticky++; });
    }
    function stick(k) {
      var v = sticky[k];
      return isNil(v) ? null : { 'data-sticky': String(v), 'data-sticky-last': v === nSticky - 1 ? '' : undefined };
    }
    function att(base, k) { var st = stick(k); return st ? Object.assign(base, st) : base; }
    function header(c) {
      var sorted = p.sort && p.sort.key === c.key;
      var dir = sorted ? (p.sort.dir === 'desc' ? 'desc' : 'asc') : null;
      var label = c.kind === 'actions' || c.kind === 'menu' ? (c.label ? c.label : h('span', { className: 'r1-sr' }, t.actionsCol)) : c.label;
      var text = h('span', { className: 'r1-th__text' }, label, c.unit ? h('span', { className: 'r1-th__unit' }, c.unit) : null);
      var body = c.sortable || sorted
        ? h('button', { type: 'button', className: cx('r1-th__sort', sorted && 'r1-th__sort--on'), onClick: p.onSort ? function () { p.onSort(c.key); } : undefined },
          text, h(Icon, { name: dir === 'asc' ? 'arrow-up' : dir === 'desc' ? 'arrow-down' : 'chevrons-up-down', size: 16, className: 'r1-th__icon' }),
          sorted ? h('span', { className: 'r1-sr' }, dir === 'desc' ? t.sortDesc : t.sortAsc) : null)
        : text;
      return h('th', att({
        key: c.key, scope: 'col', style: colStyle(c),
        className: cx(alignEnd(c) && 'r1-end', c.sticky && 'r1-col--sticky', (c.sortable || sorted) && 'r1-th--sortable'),
        'aria-sort': sorted ? (dir === 'desc' ? 'descending' : 'ascending') : undefined
      }, c.key), h('span', { className: 'r1-th' }, body, c.help ? h(Toggletip, { label: t.tip.explain + ': ' + (typeof c.label === 'string' ? c.label : ''), title: typeof c.label === 'string' ? c.label : undefined, text: c.help, density: density === 'portal' ? 'portal' : 'console', locale: p.locale }) : null));
    }
    var skeletonRows = [];
    for (var k = 0; k < nLoading; k++) {
      skeletonRows.push(h('tr', { key: 'sk' + k, className: 'r1-row--skel', 'aria-hidden': 'true' },
        expandable ? h('td', att({ className: 'r1-table__exp' }, '__exp')) : null,
        selectable ? h('td', att({ className: 'r1-table__select' }, '__sel'), h('span', { className: 'r1-skel r1-skel--box' })) : null,
        cols.map(function (c, j) {
          var w = SKEL_WIDTH[c.kind] || (j === 0 ? 75 : 60 - (k % 3) * 10);
          if (c.kind === 'menu') return h('td', att({ key: c.key, className: 'r1-end' }, c.key), h('span', { className: 'r1-skel r1-skel--box' }));
          return h('td', att({ key: c.key, className: cx(alignEnd(c) && 'r1-end') }, c.key), h('span', { className: 'r1-skel', style: { width: w + '%' } }));
        })));
    }
    var selectAcross = selectable && p.selectAcross && allChecked ? h('tr', { className: 'r1-table__across' },
      h('td', { colSpan: span }, h('span', null, p.selectAcross.selected
        ? t.table.selectedAll.replace('{total}', formatCount(p.selectAcross.total, p.locale) + (p.selectAcross.noun ? ' ' + p.selectAcross.noun : ''))
        : t.table.selectPage.replace('{n}', formatCount(enabled.length, p.locale))),
        ' ', h('button', { type: 'button', className: 'r1-link r1-table__acrossbtn', onClick: p.selectAcross.onToggle },
          p.selectAcross.selected ? t.table.clearAll : t.table.selectAll.replace('{total}', formatCount(p.selectAcross.total, p.locale) + (p.selectAcross.noun ? ' ' + p.selectAcross.noun : ''))))) : null;
    var bodyRows = [];
    if (loading) bodyRows = skeletonRows;
    else if (stateBlock) bodyRows = [h('tr', { key: 'state', className: 'r1-table__state' }, h('td', { colSpan: span }, stateBlock))];
    else rows.forEach(function (r, i) {
      if (r._group) {
        bodyRows.push(h('tr', { key: r._key || 'g' + i, className: 'r1-table__group' },
          h('th', { scope: 'rowgroup', colSpan: span }, r._groupCode ? h('span', { className: 'r1-mono r1-table__groupcode' }, r._groupCode) : null, r._group,
            !isNil(r._groupCount) ? h('span', { className: 'r1-table__groupcount r1-num' }, formatCount(r._groupCount, p.locale)) : null,
            r._groupNote ? h('span', { className: 'r1-table__groupnote' }, r._groupNote) : null)));
        return;
      }
      var open = expandable && rowOpen(r, i);
      var name = nameOf(r, i);
      var m = msgOf(r);
      var tn = tone(r);
      var msgId = tid + '-m' + i;
      bodyRows.push(h('tr', {
        key: keyOf(r, i) + '-r',
        className: cx(r._selected && 'r1-row--selected', isOn(r, i) && 'r1-row--checked', tn && 'r1-row--' + tn, r._quarantined && 'r1-row--held', r._busy && 'r1-row--busy', open && 'r1-row--open', r._disabled && 'r1-row--disabled', r._changed && 'r1-row--changed', r._dropped && 'r1-row--dropped', m && 'r1-row--hasmsg'),
        'aria-current': r._selected ? 'true' : undefined, 'aria-busy': r._busy ? 'true' : undefined, 'aria-rowindex': p.rowCount ? (p.rowOffset || 0) + i + 2 : undefined,
        'aria-describedby': m ? msgId : undefined,
        'data-row': rowFocus ? keyOf(r, i) : undefined, tabIndex: rowFocus ? (keyOf(r, i) === stopKey ? 0 : -1) : undefined,
        onFocus: rowFocus ? function (e) { if (e.target === e.currentTarget) cur[1](keyOf(r, i)); } : undefined
      },
        expandable ? h('td', att({ className: 'r1-table__exp' }, '__exp'), hiddenCols.length ? h('button', {
          type: 'button', className: 'r1-table__expbtn', 'aria-expanded': open ? 'true' : 'false', 'aria-controls': tid + '-d' + i,
          'aria-label': (open ? t.table.collapse : t.table.expand) + ': ' + name,
          onClick: function () { var n = Object.assign({}, exState[0]); n[keyOf(r, i)] = !open; exState[1](n); }
        }, h(Icon, { name: 'chevron-right', size: 16 })) : null) : null,
        selectable ? h('td', att({ className: 'r1-table__select' }, '__sel'),
          h('label', { className: 'r1-choice r1-choice--bare' }, choiceMark('checkbox', { checked: isOn(r, i), onChange: function () { toggleRow(r, i); }, disabled: noTick(r), 'aria-label': t.selectRow + ' ' + name, 'aria-describedby': noTick(r) && m ? msgId : undefined }))) : null,
        cols.map(function (c, j) {
          var lead = j === 0 && r._href && !r._disabled;
          var content = cell(c, r, i, lead);
          if (lead) content = h('a', { className: 'r1-link r1-rowlink', href: r._href }, content);
          if (j === 0 && r._busy) content = h('span', { className: 'r1-row__busy' }, h(Icon, { name: 'loader-circle', size: 16, spin: true, label: t.loading }), content);
          if (j === 0 && r._changed) content = h('span', { className: 'r1-row__first' }, content, stateWords(r));
          if (j === 0 && r._selected) content = h(Fragment, null, content, openWords(r));
          if (j === 0 && r._dropped) content = h(Fragment, null, content, droppedWords(r));
          return h(j === 0 && p.rowHeaders ? 'th' : 'td', att({
            key: c.key, scope: j === 0 && p.rowHeaders ? 'row' : undefined, style: colStyle(c),
            className: cx(alignEnd(c) && 'r1-end', (NUMERIC[c.kind] || c.num) && 'r1-num', (NOWRAP[c.kind] || c.nowrap) && 'r1-nowrap', c.sticky && 'r1-col--sticky', j === 0 && 'r1-cell--lead')
          }, c.key), content);
        })));
      if (m) bodyRows.push(h('tr', { key: keyOf(r, i) + '-m', className: cx('r1-table__msgrow', tn && 'r1-row--' + tn) },
        expandable ? h('td', att({ className: 'r1-table__exp' }, '__exp')) : null,
        selectable ? h('td', att({ className: 'r1-table__select' }, '__sel')) : null,
        h('td', { colSpan: cols.length }, rowMsg(m.severity || 'warning', m.text, msgId, m.code, p.locale))));
      if (open) bodyRows.push(h('tr', { key: keyOf(r, i) + '-d', id: tid + '-d' + i, className: 'r1-table__detail' },
        h('td', { colSpan: span }, h('dl', { className: 'r1-table__facts' }, hiddenCols.map(function (c) {
          return h('div', { key: c.key, className: 'r1-table__fact' }, h('dt', null, c.label, c.unit ? ' (' + c.unit + ')' : ''), h('dd', { className: cx((NUMERIC[c.kind] || c.num) && 'r1-num') }, cell(c, r, i)));
        })))));
    });
    if (p.loadingMore && !loading) bodyRows.push(h('tr', { key: 'more', className: 'r1-table__morerow' }, h('td', { colSpan: span }, h('span', { className: 'r1-table__more', role: 'status' }, h(Icon, { name: 'loader-circle', size: 16, spin: true }), h('span', null, t.table.loadingMore)))));
    var totals = p.totals && dataRows.length && !loading ? h('tfoot', null, h('tr', { className: 'r1-table__total' },
      expandable ? h('td', att({ className: 'r1-table__exp' }, '__exp')) : null,
      selectable ? h('td', att({ className: 'r1-table__select' }, '__sel')) : null,
      cols.map(function (c, j) {
        var v = (p.totals.values || {})[c.key];
        return h(j === 0 ? 'th' : 'td', att({ key: c.key, scope: j === 0 ? 'row' : undefined, className: cx(alignEnd(c) && 'r1-end', (NUMERIC[c.kind] || c.num) && 'r1-num', 'r1-nowrap', c.sticky && 'r1-col--sticky') }, c.key),
          j === 0 && isNil(v) ? (p.totals.label || t.table.total) : isNil(v) ? null : renderCell(c, v, p.locale, density));
      }))) : null;
    var wrapStyle = Object.assign({}, p.style || {}, p.maxHeight ? { maxHeight: p.maxHeight } : {});
    var region = scrolls[0];
    return h('div', {
      ref: wrapRef, className: cx('r1-table-wrap', p.maxHeight && 'r1-table-wrap--scroll', p.className), style: wrapStyle,
      tabIndex: region ? 0 : undefined, role: region ? 'region' : undefined,
      'aria-label': region && !labelledBy ? (caption || derived) : undefined, 'aria-labelledby': region && labelledBy ? labelledBy : undefined
    },
      loading ? h('span', { className: 'r1-sr', role: 'status' }, t.loading) : null,
      errorBar,
      h('table', { className: cx('r1-table', 'r1-table--' + density, p.stickyFirst && 'r1-table--stickyfirst', rowFocus && 'r1-table--rowfocus'), 'aria-busy': loading ? 'true' : undefined, 'aria-rowcount': p.rowCount ? p.rowCount + 1 : undefined, 'aria-labelledby': labelledBy || undefined, onKeyDown: rowFocus ? onRowKey : undefined,
        'data-r1-focus-keys': rowFocus ? 'arrowup arrowdown j k home end enter' + (selectable ? ' x' : '') : undefined },
        caption || derived ? h('caption', { className: 'r1-sr' }, caption || derived, caption && p.sort && p.sortNote ? '. ' + p.sortNote : '') : null,
        h('thead', null, h('tr', { 'aria-rowindex': p.rowCount ? 1 : undefined },
          expandable ? h('th', att({ scope: 'col', className: 'r1-table__exp' }, '__exp'), h('span', { className: 'r1-sr' }, t.table.details)) : null,
          selectable ? h('th', att({ scope: 'col', className: 'r1-table__select' }, '__sel'),
            h('label', { className: 'r1-choice r1-choice--bare' }, choiceMark('checkbox', { checked: allChecked, onChange: toggleAll, disabled: loading || !enabled.length, 'aria-label': t.selectAll }, nChecked > 0 && !allChecked))) : null,
          cols.map(header)),
          selectAcross),
        h('tbody', null, bodyRows),
        totals),
      // expandable: the columns waiting behind the expander are named under the table, so a sighted reader knows what
      // opening a row shows ("Đang ẩn: Ngày nộp, Người lập. Mở một dòng để xem.").
      hiddenCols.length && dataRows.length && !loading ? h('p', { className: 'r1-table__foot r1-table__hidden' }, h(Icon, { name: 'eye-off', size: 16 }),
        h('span', null, t.table.hidden.replace('{cols}', hiddenCols.map(function (c) { return textOf(c.label); }).filter(Boolean).join(', ')))) : null,
      p.sortNote ? h('div', { className: 'r1-table__foot r1-table__sortnote' }, p.sortNote, p.footer ? h('span', null, p.footer) : null) : foot);
  }

  // ---------------------------------------------------------------- banner

  // Every family is tinted: shape, word and tint. A banner drawn with the page is read in order, not announced;
  // one that appears after the reader acted is said once through the page's live regions (assertively for
  // danger). live forces it on or off; an explicit role makes the banner its own live region instead.
  // The title is a heading (level, default 2). onDismiss adds a close button; the banner then hides itself.
  // actions: a node, or data a canvas can pass, { label, href, onClick, variant, icon, disabled, disabledReason }
  // (one, or a list; action is the one-item form), drawn as R1 Buttons: sm (32 px) in the console, md (48 px) with
  // density portal or premises, so they meet the 44 px target there. Without density the banner takes it from the
  // shell around it: md inside PortalShell or PublicShell, sm elsewhere.
  function bannerActions(a, p, size) {
    if (!a) return null;
    if (React.isValidElement(a) || typeof a !== 'object') return a;
    var list = Array.isArray(a) ? a : [a];
    return list.map(function (x, i) {
      if (!x || React.isValidElement(x) || typeof x !== 'object') return x;
      return h(Button, { key: i, size: size || 'sm', variant: x.variant, icon: x.icon, href: x.href, onClick: x.onClick, disabled: x.disabled, disabledReason: x.disabledReason, locale: p.locale }, x.label);
    });
  }
  function Banner(p) {
    var t = tx(p.locale);
    var family = STATUS_FAMILIES.indexOf(p.family) >= 0 ? p.family : 'info';
    var shown = useState(true);
    var boxRef = useRef(null);
    var shellDensity = useState(null);
    useLayoutEffect(function () {
      if (p.density) return;
      var shell = boxRef.current && boxRef.current.closest('.r1-shell');
      var d = shell && (shell.classList.contains('r1-shell--portal') || shell.classList.contains('r1-shell--public')) ? 'portal' : 'console';
      if (d !== shellDensity[0]) shellDensity[1](d);
    });
    var density = p.density || shellDensity[0] || 'console';
    var btnSize = density === 'portal' || density === 'premises' ? 'md' : 'sm';
    var said = joinSentences([textOf(p.title), textOf(p.children)]);
    useEffect(function () {
      if (p.role || p.live === false || !said) return;
      if (p.live === true || readerActed()) announce(said, family === 'danger' ? 'assertive' : 'polite');
    }, [said]);
    if (!shown[0]) return null;
    var heading = 'h' + Math.min(6, Math.max(2, p.level || 2));
    // The code sits on the title line; a banner without a title gives it the line after its text, so no line
    // carries the code alone beside the status shape.
    var code = p.code ? h(p.title ? 'span' : 'p', { className: 'r1-banner__code' }, h('span', { className: 'r1-banner__code-label' }, t.code), ' ', h('span', { className: 'r1-banner__code-value' }, p.code)) : null;
    return h('section', {
      ref: boxRef, className: cx('r1-banner', 'r1-banner--' + family, p.title && 'r1-banner--titled', p.compact && 'r1-banner--compact', p.onDismiss && 'r1-banner--dismissible', btnSize === 'md' && 'r1-banner--touch', p.className),
      role: p.role, style: p.style
    },
      h(StatusIcon, { family: family, size: p.compact ? 16 : 20, cutout: family + '-tint' }),
      h('div', { className: 'r1-banner__body' },
        p.title ? h('div', { className: 'r1-banner__head' }, h(heading, { className: 'r1-banner__title' }, p.title), code) : null,
        p.children ? h('div', { className: 'r1-banner__text' }, p.children) : null,
        p.title ? null : code,
        p.actions || p.action ? h('div', { className: 'r1-banner__actions' }, bannerActions(p.actions || p.action, p, btnSize)) : null),
      p.onDismiss ? h(Button, { className: 'r1-banner__dismiss r1-btn--close', variant: 'quiet', size: btnSize, iconOnly: true, icon: 'x', 'aria-label': t.toast.close, locale: p.locale,
        onClick: function (e) { shown[1](false); p.onDismiss(e); } }) : null);
  }

  // ---------------------------------------------------------------- dialog

  // A modal dialog manages focus once the reader opens it: focus moves to its title (decision of 7 October 2026),
  // Tab stays inside, Escape closes, and focus goes back to what opened it. placement 'viewport' fixes it
  // to the window and makes the rest of the page inert; 'overlay' covers the nearest positioned container.
  // Every dialog has a way out: the close button, the secondary action and Escape call onClose; without
  // onClose (and without a controlled open) the dialog closes itself.
  // Actions follow the form rule: the primary action first, at the bottom left, then the way out beside it.
  // A layer portalled to <body> leaves the frame that set data-theme; it reads the theme where it is mounted and carries it.
  function useHostTheme(on) {
    var markRef = useRef(null);
    var st = useState(null);
    useLayoutEffect(function () {
      if (!on || !markRef.current) return;
      var el = markRef.current.parentElement && markRef.current.parentElement.closest('[data-theme]');
      var v = el ? el.getAttribute('data-theme') : null;
      if (v !== st[0]) st[1](v);
    });
    return { ref: markRef, theme: st[0] };
  }

  function Dialog(p) {
    var t = tx(p.locale);
    var titleId = useUid('r1-dlg');
    var panelRef = useRef(null);
    var host = useHostTheme(p.placement === 'viewport');
    var dismissed = useState(false);
    var shown = p.open !== false && !(isNil(p.open) && dismissed[0]);
    var modal = p.placement !== 'inline';
    function close() { if (p.onClose) p.onClose(); if (isNil(p.open)) dismissed[1](true); }
    var latest = useLatest({ close: close });
    useEffect(function () {
      if (!shown || !modal) return undefined;
      var panel = panelRef.current;
      var opener = document.activeElement;
      var take = p.autoFocus === true || (p.autoFocus !== false && readerActed());
      if (!panel || !take) return undefined;
      // Focus opens on the title, never on a button or a field (decision of 7 October 2026): the reader hears the
      // decision and the object it names first, then the description; Enter or Space pressed out of habit acts on
      // nothing; and Tab reaches the first field or action next, in reading order.
      focusEl(panel.querySelector('.r1-dialog__title'));
      var released = [];
      if (p.placement === 'viewport') {
        Array.prototype.forEach.call(document.body.children, function (el) {
          if (!el.contains(panel) && !el.hasAttribute('inert') && !el.hasAttribute('data-r1-live')) { el.setAttribute('inert', ''); released.push(el); }
        });
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); latest.current.close(); return; }
        if (e.key !== 'Tab') return;
        var list = focusables(panel);
        if (!list.length) { e.preventDefault(); return; }
        var first = list[0], last = list[list.length - 1], at = document.activeElement, inside = panel.contains(at);
        if (e.shiftKey && (at === first || !inside)) { e.preventDefault(); focusEl(last); }
        else if (!e.shiftKey && (at === last || !inside)) { e.preventDefault(); focusEl(first); }
      }
      document.addEventListener('keydown', onKey, true);
      return function () {
        document.removeEventListener('keydown', onKey, true);
        released.forEach(function (el) { el.removeAttribute('inert'); });
        if (opener && opener.focus && document.contains(opener)) focusEl(opener);
      };
    }, [shown, modal]);
    if (!shown) return null;
    var sec = p.secondaryAction || {};
    var btnSize = p.density === 'console' ? 'sm' : undefined;
    var panel = h('div', { ref: panelRef, className: 'r1-dialog', role: 'dialog', 'aria-modal': modal ? 'true' : undefined, 'aria-labelledby': titleId, 'aria-describedby': p.description ? titleId + '-d' : undefined, style: { width: p.width || 'var(--container-lg)' } },
      h('div', { className: 'r1-dialog__head' },
        h('h2', { id: titleId, className: 'r1-dialog__title', tabIndex: -1 }, keepRefs(p.title)),
        // The close X takes the dialog's button size, as a Banner's dismiss does: 32 px on the console, the portal's field
        // height elsewhere, so on a phone it is a 44 px touch target.
        h('button', { type: 'button', className: cx('r1-btn r1-btn--quiet', p.density === 'console' && 'r1-btn--sm', 'r1-btn--icon r1-btn--close'), 'aria-label': t.close, onClick: close }, h(Icon, { name: 'x', size: p.density === 'console' ? 16 : 20 }))),
      p.description ? h('p', { id: titleId + '-d', className: 'r1-dialog__desc' }, keepRefs(p.description)) : null,
      p.children ? h('div', { className: 'r1-dialog__body' }, p.children) : null,
      h('div', { className: 'r1-dialog__foot' },
        p.primaryAction ? h(Button, { size: btnSize, variant: p.primaryAction.variant || 'primary', loading: p.primaryAction.loading, onClick: p.primaryAction.onClick, locale: p.locale, disabled: p.primaryAction.disabled, disabledReason: p.primaryAction.disabledReason, ariaLabel: p.primaryAction.ariaLabel }, p.primaryAction.label) : null,
        h(Button, { size: btnSize, variant: 'quiet', onClick: sec.onClick || close, locale: p.locale }, sec.label || t.cancel)));
    if (!modal) return panel;
    var portal = p.placement === 'viewport' && window.ReactDOM && window.ReactDOM.createPortal && typeof document !== 'undefined';
    // align 'start': the dialog sits near the top of what it covers (a tall page in a frame), the backdrop still covers it all.
    var layer = h('div', { className: cx('r1-dialog-layer', p.placement === 'viewport' && 'r1-dialog-layer--viewport', p.align === 'start' && 'r1-dialog-layer--start'), 'data-theme': portal && host.theme ? host.theme : undefined }, h('div', { className: 'r1-dialog-backdrop', 'aria-hidden': 'true' }), panel);
    if (portal) return h(Fragment, null, h('span', { ref: host.ref, hidden: true }), window.ReactDOM.createPortal(layer, document.body));
    return layer;
  }

  // ----------------------------------------------------------- view states

  // A failed load's own recovery: without onRetry, Try again reloads the page, so it never renders dead.
  function reloadPage() { if (typeof window !== 'undefined' && window.location) window.location.reload(); }
  // action is a node, false, or { label, onClick, href, icon, variant }.
  function emptyAction(a, p) {
    if (!a || React.isValidElement(a) || typeof a !== 'object' || Array.isArray(a)) return a || null;
    return h(Button, { variant: a.variant || 'secondary', icon: a.icon, href: a.href, onClick: a.onClick, size: p.density === 'console' ? 'sm' : undefined, locale: p.locale }, a.label);
  }
  // The title is a heading (level, default 3). Clear filters shows only with onClearFilters: without it, it did nothing.
  function EmptyState(p) {
    var t = tx(p.locale);
    var variant = p.variant || 'not-started';
    var heading = 'h' + Math.min(6, Math.max(2, p.level || 3));
    var size = p.density === 'console' ? 'sm' : undefined;
    var own = p.action === false ? null : emptyAction(p.action, p);
    if (variant === 'error') {
      return h('section', { className: cx('r1-empty r1-empty--error', p.className), role: 'alert', style: p.style },
        h(StatusIcon, { family: 'danger', size: 32, cutout: 'surface' }),
        h(heading, { className: 'r1-empty__title' }, p.title || t.couldNotLoad),
        p.children ? h('div', { className: 'r1-empty__text' }, p.children) : null,
        p.traceId ? h('p', { className: 'r1-empty__text' }, t.traceRef + ' ', h(Identifier, { value: p.traceId, size: 'sm', locale: p.locale }), ', ' + t.quoteSupport) : null,
        p.retryable === false ? h('p', { className: 'r1-empty__text r1-muted' }, t.retryNoHelp) : null,
        p.retryable === false && !own ? null : h('div', { className: 'r1-empty__actions' },
          p.retryable === false ? null : h(Button, { icon: 'refresh-cw', size: size, onClick: p.onRetry || reloadPage, locale: p.locale }, t.retry),
          own));
    }
    if (variant === 'no-obligation') {
      return h('section', { className: cx('r1-empty r1-empty--positive', p.className), role: 'status', style: p.style },
        h(heading, { className: 'r1-empty__head' }, h(StatusBadge, { family: 'positive', label: p.title || t.empty.noObligation, size: 'lg' })),
        p.children ? h('div', { className: 'r1-empty__text' }, p.children) : null,
        own ? h('div', { className: 'r1-empty__actions' }, own) : null);
    }
    // governed: nothing qualified is not a success, so its icon is the neutral inbox, not a check mark.
    var icon = p.icon || (variant === 'governed' ? 'inbox' : variant === 'filtered' ? 'filter' : 'clock');
    var title = p.title || (variant === 'governed' ? t.empty.governed : variant === 'filtered' ? t.empty.filtered : t.empty.notStarted);
    var clear = !own && p.action !== false && variant === 'filtered' && p.onClearFilters
      ? h(Button, { variant: 'quiet', icon: 'x', size: size, onClick: p.onClearFilters, locale: p.locale }, t.empty.clearFilters) : null;
    // governed with decision, decider or due: what is waiting, who decides and by when, as three short facts under the
    // explanation. due is a date or a timestamp (written in the shared format) or the page's own words.
    var gov = variant === 'governed' ? [
      isNil(p.decision) || p.decision === '' ? null : { label: t.empty.waiting, value: p.decision },
      isNil(p.decider) || p.decider === '' ? null : { label: t.empty.decider, value: p.decider },
      isNil(p.due) || p.due === '' ? null : (toDate(p.due) && !/^\d{4}-\d{2}-\d{2}$/.test(String(p.due)) ? { label: t.empty.due, value: p.due, kind: 'datetime' }
        : toDate(p.due) ? { label: t.empty.due, value: p.due, kind: 'date' } : { label: t.empty.due, value: p.due })
    ].filter(Boolean) : [];
    return h('section', { className: cx('r1-empty', 'r1-empty--' + variant, p.className), role: 'status', style: p.style },
      h(Icon, { name: icon, size: 32, className: 'r1-empty__icon' }),
      h(heading, { className: 'r1-empty__title' }, title),
      p.children ? h('div', { className: 'r1-empty__text' }, p.children) : null,
      gov.length ? h(FactList, { className: 'r1-empty__facts', items: gov, locale: p.locale }) : null,
      own || clear ? h('div', { className: 'r1-empty__actions' }, own || clear) : null);
  }

  // The loading state in the shape of what replaces it: table rows, lines of text, a fact list, a card or a chart.
  // It is not a live region (its busy flag could never clear, since it leaves when the data comes): a load the
  // reader started is said once, and ViewState says when it has finished.
  var SKEL_BARS = [62, 84, 48, 72, 56, 90, 40, 66];
  function Skeleton(p) {
    var t = tx(p.locale);
    var rows = p.rows || 4;
    var variant = p.variant || 'table';
    useEffect(function () { if (readerActed()) announce(t.loading, 'polite'); }, []);
    function line(i, cls) { return h('span', { key: i, className: 'r1-skel__line' }, h('span', { className: cx('r1-skel', cls || 'r1-skel--text'), style: { width: (92 - (i % 3) * 14) + '%' } })); }
    var list = [];
    if (variant === 'chart') {
      var bars = [];
      for (var b = 0; b < (p.columns || 6); b++) bars.push(h('span', { key: b, className: 'r1-skel r1-skel--bar', style: { height: SKEL_BARS[b % SKEL_BARS.length] + '%' } }));
      list.push(h('div', { key: 'c', className: 'r1-skel__chart' }, bars));
    } else if (variant === 'card') {
      list.push(h('span', { key: 't', className: 'r1-skel__line r1-skel__line--title' }, h('span', { className: 'r1-skel r1-skel--title', style: { width: '40%' } })));
      for (var c = 0; c < rows; c++) list.push(line(c));
    } else {
      for (var i = 0; i < rows; i++) {
        if (variant === 'text') list.push(line(i));
        else if (variant === 'facts') {
          list.push(h('div', { key: i, className: 'r1-skel__fact' },
            h('span', { className: 'r1-skel__line' }, h('span', { className: 'r1-skel r1-skel--label', style: { width: (70 - (i % 2) * 20) + '%' } })),
            line(i)));
        } else {
          // columns: as many cells as the table that will arrive, so the page does not shift when it does
          var widths = p.columns ? [] : [18, 34, 14, 20];
          for (var j = 0; p.columns && j < p.columns; j++) widths.push(j === 0 ? 18 : Math.max(8, Math.round(72 / p.columns) - (j % 3) * 4));
          var cells = widths.map(function (w, j) { return h('span', { key: j, className: 'r1-skel r1-skel--cell', style: { width: w + '%' } }); });
          list.push(h('div', { key: i, className: 'r1-skel__row r1-skel__row--' + (p.density || 'portal') }, cells));
        }
      }
    }
    return h('div', { className: cx('r1-skeleton', 'r1-skeleton--' + variant, p.className), style: p.style },
      h('span', { className: 'r1-sr' }, t.loading), list);
  }

  // ---------------------------------------------------------------- stepper

  // Each step says its state in words as well as by its mark. A done step with href or onClick is a way back to
  // change it; a blocked step states its reason under the label. The saved line is a status, read when it changes.
  function Stepper(p) {
    var t = tx(p.locale);
    var steps = p.steps || [];
    return h('nav', { className: cx('r1-stepper', p.className), 'aria-label': p.label || t.step, style: p.style },
      h('ol', { className: 'r1-stepper__list' }, steps.map(function (s, i) {
        var state = s.state || 'todo';
        var mark = state === 'done' ? h(Icon, { name: 'check', size: 16 }) : state === 'blocked' ? h(Icon, { name: 'ban', size: 16 }) : h('span', null, String(i + 1));
        // aria-current already says "current step"; the other states are said in words.
        var words = [s.label, state === 'current' ? null : h('span', { key: 'sr', className: 'r1-sr' }, ', ' + t.stepper[state])];
        var back = state === 'done' && (s.href || s.onClick);
        var label = back ? h(s.href ? 'a' : 'button', { className: 'r1-step__label r1-step__link', href: s.href, type: s.href ? undefined : 'button', onClick: s.onClick }, words)
          : h('span', { className: 'r1-step__label' }, words);
        return h('li', { key: i, className: cx('r1-step', 'r1-step--' + state), 'aria-current': state === 'current' ? 'step' : undefined },
          h('span', { className: 'r1-step__mark', 'aria-hidden': 'true' }, mark),
          state === 'blocked' && s.reason ? h('span', { className: 'r1-step__text' }, label, h('span', { className: 'r1-step__reason' }, s.reason)) : label);
      })),
      // The date, the time and the zone, so a draft saved on another day is not read as saved today.
      p.savedAt ? h('p', { className: 'r1-stepper__saved', role: 'status' }, h(Icon, { name: 'check', size: 16 }), t.savedAt + ' ' + (formatTimestamp(p.savedAt, p.locale) || p.savedAt)) : null);
  }

  // ------------------------------------------------------------ file upload

  // Before a file: a drop zone whose chooser takes the keyboard (the zone shows the focus ring). disabled keeps the
  // zone in view, greyed, with disabledReason under it. After a file: its stages, each with its state in words;
  // every change of stage is said once. The file can be replaced (onReplace, else onFiles) or removed (onRemove);
  // density 'portal' or 'premises' draws those two at the portal's field height with 20 px icons, 'console' (the
  // default) at 32 px with 16 px icons. The chooser before a file is a link in every density.
  // Label, helper, required marker and error stay in every state, so a refusal after the upload still shows.
  function FileUpload(p) {
    var t = tx(p.locale);
    var id = useUid('r1-up');
    var drag = useState(false);
    var off = !!p.disabled;
    var stages = p.stages || [];
    var key = stages.map(function (s) { return s.label + ':' + (s.state || 'todo'); }).join('|');
    var first = useRef(true);
    useEffect(function () {
      var mount = first.current; first.current = false;
      if (!p.fileName || !stages.length || (mount && !readerActed())) return;
      var failed = stages.filter(function (s) { return s.state === 'failed'; })[0];
      var now = stages.filter(function (s) { return s.state === 'current'; })[0];
      var done = stages.every(function (s) { return s.state === 'done'; });
      var text = failed ? failed.label + ': ' + t.upload.states.failed + (failed.detail ? '. ' + failed.detail : '')
        : done ? t.upload.ready : now ? now.label + ': ' + t.upload.states.current + (now.detail ? '. ' + now.detail : '') : '';
      if (text) announce(text, failed ? 'assertive' : 'polite');
    }, [key, p.fileName]);
    var why = off && p.disabledReason ? h('div', { id: id + '-why', className: 'r1-field__reason' }, h(Icon, { name: 'info', size: 16 }), h('span', null, p.disabledReason)) : null;
    var msg = p.error ? h(FieldMessage, { id: id + '-msg', severity: 'error', locale: p.locale }, p.error) : null;
    var req = p.required ? h('span', { className: 'r1-field__req' }, ' ' + t.required) : null;
    var help = p.helper ? h('div', { id: id + '-help', className: 'r1-field__help' }, p.helper) : null;
    var replace = off ? null : p.onReplace || p.onFiles;
    var big = p.density === 'portal' || p.density === 'premises';
    if (!p.fileName) {
      // over: a file is being dragged across the zone. rejected: the last file was refused, and error says why.
      var over = !off && (p.state === 'dragover' || drag[0]);
      var rejected = !off && (p.state === 'rejected' || !!p.error);
      var zoneEvents = off ? {} : {
        onDragOver: function (e) { e.preventDefault(); if (!drag[0]) drag[1](true); },
        onDragLeave: function () { drag[1](false); },
        onDrop: function (e) { e.preventDefault(); drag[1](false); if (p.onFiles) p.onFiles(e.dataTransfer.files); }
      };
      return h('div', { className: cx('r1-upload', rejected && 'r1-upload--rejected', off && 'r1-upload--disabled', p.className), style: p.style },
        p.label ? h('label', { className: 'r1-field__label', htmlFor: id }, p.label, req) : null,
        help,
        h('div', Object.assign({ className: cx('r1-upload__zone', over && 'r1-upload__zone--over') }, zoneEvents),
          h(Icon, { name: 'upload', size: 24 }),
          over ? h('span', null, t.upload.release) : [h('span', { key: 'd' }, t.upload.drop + ' '), h('label', { key: 'c', className: off ? 'r1-upload__choose' : 'r1-link', htmlFor: id }, t.upload.choose)],
          h('input', {
            id: id, type: 'file', className: 'r1-sr r1-upload__input', accept: p.accept, disabled: off, required: p.required, 'aria-invalid': rejected ? 'true' : undefined,
            'aria-describedby': [p.helper && id + '-help', p.error && id + '-msg', why && id + '-why'].filter(Boolean).join(' ') || undefined,
            onChange: p.onFiles ? function (e) { p.onFiles(e.target.files); } : undefined
          })),
        msg, why);
    }
    var mark = { done: 'positive', failed: 'danger', current: 'info' };
    return h('div', { className: cx('r1-upload r1-upload--active', p.error && 'r1-upload--rejected', p.className), style: p.style, role: 'group', 'aria-labelledby': p.label ? id + '-label' : undefined, 'aria-describedby': [p.helper && id + '-help', p.error && id + '-msg'].filter(Boolean).join(' ') || undefined },
      p.label ? h('span', { id: id + '-label', className: 'r1-field__label' }, p.label, req) : null,
      help,
      h('div', { className: 'r1-upload__file' }, h(Icon, { name: 'file-text', size: 20 }),
        h('span', { className: 'r1-upload__name r1-strong' }, p.fileName), p.fileSize ? h('span', { className: 'r1-upload__size r1-muted' }, p.fileSize) : null),
      stages.length ? h('ol', { className: 'r1-pipeline', 'aria-label': t.upload.pipeline }, stages.map(function (s, i) {
        var state = s.state || 'todo';
        return h('li', { key: i, className: cx('r1-pipeline__stage', 'r1-pipeline__stage--' + state), 'aria-current': state === 'current' ? 'step' : undefined },
          state === 'current' ? h(Icon, { name: 'loader-circle', size: 16, spin: true }) : h(StatusIcon, { family: mark[state] || 'neutral', size: 16, cutout: 'surface' }),
          h('span', { className: 'r1-pipeline__label' }, s.label, h('span', { className: 'r1-sr' }, ', ' + (t.upload.states[state] || t.upload.states.todo))),
          s.detail ? h('span', { className: 'r1-pipeline__detail r1-muted' }, s.detail) : null);
      })) : null,
      msg,
      replace || p.onRemove ? h('div', { className: 'r1-upload__actions' },
        replace ? h('span', { className: 'r1-upload__replace' },
          h('input', { id: id + '-again', type: 'file', className: 'r1-sr r1-upload__input', accept: p.accept, onChange: function (e) { replace(e.target.files); } }),
          h('label', { className: cx('r1-btn r1-btn--secondary', big ? 'r1-btn--md' : 'r1-btn--sm'), htmlFor: id + '-again' }, h(Icon, { name: 'upload', size: big ? 20 : 16 }), h('span', { className: 'r1-btn__label' }, t.upload.replace))) : null,
        p.onRemove ? h(Button, { variant: 'quiet', size: big ? 'md' : 'sm', icon: 'trash-2', onClick: p.onRemove, locale: p.locale }, t.files.remove) : null) : null,
      why);
  }

  // ------------------------------------------------------- legal + signing

  // Progress is measured from the reader's scrolling and never goes back; onReachEnd fires once, when the
  // end of the text has been on screen. Text that fits without scrolling counts as read to the end.
  function LegalTextViewer(p) {
    var t = tx(p.locale);
    var sections = p.sections || [];
    var pr = useState(Math.max(0, Math.min(100, p.progress || 0)));
    var progress = pr[0];
    var boxRef = useRef(null);
    var ended = useRef(false);
    var latest = useLatest(p);
    var showProgress = p.showProgress !== false;
    function measure() {
      var el = boxRef.current;
      if (!el) return;
      var room = el.scrollHeight - el.clientHeight;
      var pct = room <= 1 || el.scrollTop >= room - 4 ? 100 : Math.round((el.scrollTop / room) * 100);
      pr[1](function (v) { return Math.max(v, pct); });
      if (pct >= 100 && !ended.current) { ended.current = true; if (latest.current.onReachEnd) latest.current.onReachEnd(); }
    }
    useEffect(measure, []);
    return h('article', { className: cx('r1-legal', p.className), style: p.style },
      h('header', { className: 'r1-legal__head' },
        h('h2', { className: 'r1-legal__title' }, p.title),
        h('p', { className: 'r1-legal__meta' }, [p.version ? t.legal.version + ' ' + p.version : null, p.effective ? t.legal.effective.charAt(0).toLowerCase() + t.legal.effective.slice(1) + ' ' + keepTogether(formatDate(p.effective, p.locale) || String(p.effective)) : null].filter(Boolean).join(', ')),
        showProgress ? h('div', { className: 'r1-meter', role: 'progressbar', 'aria-valuenow': progress, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': t.legal.read },
          h('span', { className: 'r1-meter__fill', style: { width: progress + '%' } })) : null,
        showProgress ? h('p', { className: 'r1-legal__meta' }, t.legal.read + ' ' + progress + (lang(p.locale) === 'en' ? '%' : '\u00a0%')) : null),
      h('div', { className: 'r1-legal__cols' },
        h('nav', { className: 'r1-legal__toc', 'aria-label': t.legal.contents },
          h('p', { className: 'r1-legal__toc-title' }, t.legal.contents),
          h('ol', null, sections.map(function (s, i) { return h('li', { key: i }, h('a', { className: 'r1-link', href: '#' + s.id }, s.heading)); }))),
        h('div', { ref: boxRef, className: cx('r1-legal__text', p.height && 'r1-legal__text--scroll'), role: 'region', 'aria-label': textOf(p.title), tabIndex: 0, onScroll: measure, style: p.height ? { maxHeight: p.height } : undefined },
          sections.map(function (s, i) { return h('section', { key: i, id: s.id }, h('h3', null, s.heading), (Array.isArray(s.body) ? s.body : [s.body]).map(function (b, j) { return h('p', { key: j }, b); })); }))));
  }

  // Names match however they were typed: Unicode composed or decomposed, spacing and letter case.
  function sameName(a, b) {
    function norm(s) { return String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi'); }
    return norm(a) !== '' && norm(a) === norm(b);
  }
  function SignatureBlock(p) {
    var t = tx(p.locale);
    var id = useUid('r1-sig');
    var typedSt = useSynced(p.typedName, '');
    var nameOk = sameName(typedSt[0], p.legalName);
    var remaining = [];
    if (!p.scrolledToEnd) remaining.push(t.sign.mustScroll);
    if (!nameOk) remaining.push(t.sign.mustType);
    var ready = remaining.length === 0;
    // Signed: the name stays as it was signed and the button goes, so nothing can be signed twice.
    // loading: the signature is on its way; the name is held and the button says it is busy.
    var locked = !!(p.signed || p.loading);
    var state = p.signed
      ? h('p', { className: 'r1-sign__state r1-positive-text', role: 'status' }, h(StatusIcon, { family: 'positive', size: 16 }),
        p.signedAt ? t.sign.signed.replace('{t}', formatTimestamp(p.signedAt, p.locale)) : t.sign.signedDone)
      : ready ? h('p', { className: 'r1-sign__state r1-positive-text', role: 'status' }, h(StatusIcon, { family: 'positive', size: 16 }), t.sign.ready)
      : h('div', { id: id + '-left', className: 'r1-sign__state' }, h('p', null, t.sign.remaining), h('ul', null, remaining.map(function (r, i) { return h('li', { key: i }, r); })));
    return h('section', { className: cx('r1-sign', p.signed && 'r1-sign--signed', p.className), style: p.style },
      h('div', { className: 'r1-field' },
        h('label', { className: 'r1-field__label', htmlFor: id }, t.sign.typeName),
        h('input', {
          id: id, name: p.name, className: 'r1-input', value: typedSt[0], autoComplete: 'name', readOnly: locked,
          // What is still missing is said by the list under the field, which also describes it; no silent invalid state.
          'aria-describedby': !ready && !locked ? id + '-left' : undefined,
          onChange: function (e) { if (locked) return; typedSt[1](e.target.value); if (p.onType) p.onType(e.target.value, e); }
        })),
      state,
      p.signed ? null : h(Button, { variant: 'primary', size: 'lg', disabled: !ready, loading: !!p.loading, 'aria-describedby': ready ? undefined : id + '-left', onClick: p.onSign, locale: p.locale }, p.signLabel || t.sign.sign),
      p.error && !p.signed ? h(FieldMessage, { severity: 'error', locale: p.locale }, p.error) : null);
  }

  // The decision is written in words beside its status shape; the approver's comment follows it in the approver's card.
  // While nobody has approved, awaiting names who acts next. The same person in both places is refused in a Banner:
  // sameActor={ code, text, family } carries the code the service returned, the family catalogue's sentence and the
  // family the rule deserves; sameActor={true} keeps SOD_PREPARER_IS_APPROVER, the built-in sentence and danger.
  // sameActor.title: a refusal of two sentences is split as a Banner splits it, the first as the title with the code
  // on its line, the second as the text under it.
  // declined: the approver considered the proposal and left things as they were (an entitlement left in place), an
  // ordinary outcome in the neutral family, never danger. preparerLabel and approverLabel rename the two roles for a
  // family that says "Người đề xuất" / "Proposer"; with approverLabel the comment is headed "Nhận xét" / "Comment".
  var APPROVAL_FAMILY = { approved: 'positive', rejected: 'danger', returned: 'attention', declined: 'neutral' };
  function ApprovalPair(p) {
    var t = tx(p.locale);
    function card(role, person, empty, extra) {
      return h('div', { className: 'r1-approval__card' },
        h('p', { className: 'r1-approval__role' }, role),
        person ? h(Fragment, null, h('p', { className: 'r1-strong' }, person.name), person.role ? h('p', { className: 'r1-muted' }, person.role) : null,
          person.at ? h('p', { className: 'r1-muted' }, h(DateValue, { value: person.at, mode: 'timestamp', locale: p.locale })) : null, extra)
          : h('p', { className: 'r1-muted' }, empty));
    }
    var family = p.approver && APPROVAL_FAMILY[p.decision];
    var decided = family ? h(Fragment, null,
      h('p', { className: 'r1-approval__decision r1-approval__decision--' + p.decision }, h(StatusIcon, { family: family, size: 16, cutout: 'surface' }), h('span', null, t.approval.decision[p.decision])),
      p.comment ? h('div', { className: 'r1-approval__comment' }, h('p', { className: 'r1-approval__role' }, p.approverLabel ? t.approval.commentShort : t.approval.comment), h('p', null, p.comment)) : null) : null;
    var same = p.sameActor && typeof p.sameActor === 'object' ? p.sameActor : {};
    return h('div', { className: cx('r1-approval', p.className), style: p.style },
      h('div', { className: 'r1-approval__pair' }, card(p.preparerLabel || t.approval.preparer, p.preparer, t.approval.noPreparer), card(p.approverLabel || t.approval.approver, p.approver, p.awaiting || t.approval.awaiting, decided)),
      p.sameActor ? h(Banner, {
        family: same.family || 'danger', compact: true, code: same.code || p.code || 'SOD_PREPARER_IS_APPROVER', locale: p.locale,
        // The pair sits inside a section, so its title is a level 3 heading unless sameActor.level says otherwise.
        title: same.title || undefined, level: same.title ? same.level || 3 : undefined
      }, same.title && !same.text ? null : same.text || t.approval.same) : null);
  }

  // --------------------------------------------------------------- queue

  // Arrows move, Enter or a click opens (onOpen), X or a click on the box ticks for a bulk decision (onToggle),
  // Escape goes back (onBack). The boxes appear only when the queue is selectable (by default: with onToggle or a
  // ticked item), and the key legend lists only the keys that do something here. Empty and loading are said in words.
  function QueueList(p) {
    var t = tx(p.locale);
    var uid = useUid('r1-q');
    var items = p.items || [];
    var st = useSynced(p.activeIndex, 0);
    var active = st[0], setActive = st[1];
    var seed = items.map(function (it) { return it.checked ? '1' : '0'; }).join('');
    var ck = useSynced(seed, seed);
    var selectable = isNil(p.selectable) ? (!!p.onToggle || items.some(function (it) { return it.checked; })) : !!p.selectable;
    var legend = t.queue.keys.filter(function (k, i) { return i === 0 || (i === 1 && !!p.onOpen) || (i === 2 && !!p.onBack) || (i === 3 && selectable); });
    function tick(i) {
      var on = ck[0].charAt(i) !== '1';
      ck[1](ck[0].slice(0, i) + (on ? '1' : '0') + ck[0].slice(i + 1));
      if (p.onToggle) p.onToggle(i, on, items[i]);
    }
    function onKey(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(items.length - 1, Math.max(-1, active) + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, active - 1)); }
      else if (e.key === 'Enter' && active >= 0 && p.onOpen) { e.preventDefault(); p.onOpen(items[active], active); }
      else if ((e.key === 'x' || e.key === 'X') && selectable && active >= 0 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); tick(active); }
      else if (e.key === 'Escape' && p.onBack) { e.preventDefault(); p.onBack(); }
    }
    var body;
    if (p.loading && !items.length) {
      body = h('div', { className: 'r1-queue__state', 'aria-busy': 'true' }, h('span', { className: 'r1-sr', role: 'status' }, t.loading),
        [0, 1, 2].map(function (i) { return h('span', { key: i, className: 'r1-queue__skel', 'aria-hidden': 'true' }, h('span', { className: 'r1-skel', style: { width: (70 - i * 12) + '%' } }), h('span', { className: 'r1-skel', style: { width: (45 + i * 8) + '%' } })); }));
    } else if (!items.length) {
      body = h('p', { className: 'r1-queue__empty', role: 'status' }, p.emptyText || t.queue.empty);
    } else {
      body = h('ul', { className: cx('r1-queue__list', !selectable && 'r1-queue__list--plain'), role: 'listbox', 'aria-label': p.label, 'aria-multiselectable': selectable ? 'true' : undefined, tabIndex: 0, onKeyDown: onKey, 'aria-activedescendant': active >= 0 ? uid + '-' + active : undefined,
        'data-r1-focus-keys': 'arrowup arrowdown' + (p.onOpen ? ' enter' : '') + (p.onBack ? ' escape' : '') + (selectable ? ' x' : '') },
        items.map(function (it, i) {
          var on = ck[0].charAt(i) === '1';
          return h('li', { key: i, id: uid + '-' + i, role: 'option', 'aria-selected': (selectable ? on : i === active) ? 'true' : 'false', className: cx('r1-queue__item', i === active && 'r1-queue__item--active', on && 'r1-queue__item--checked'),
            onClick: function () { setActive(i); if (p.onOpen) p.onOpen(it, i); } },
            selectable ? h('span', { className: 'r1-queue__check', 'aria-hidden': 'true', onClick: function (e) { e.stopPropagation(); setActive(i); tick(i); } }, on ? h(Icon, { name: 'check', size: 12, strokeWidth: 3 }) : null) : null,
            h('span', { className: 'r1-queue__main' },
              h('span', { className: 'r1-queue__line' },
                h('span', { className: 'r1-queue__title' }, it.title),
                it.age ? h('span', { className: 'r1-queue__age r1-num' }, it.age) : null),
              h('span', { className: 'r1-queue__line' },
                it.meta ? h('span', { className: 'r1-queue__meta' }, it.meta) : h('span', null),
                it.status ? h(StatusBadge, { family: it.status.family, label: it.status.label, icon: it.status.icon, size: 'sm' }) : null)));
        }));
    }
    return h('div', { className: cx('r1-queue', p.className), style: p.style },
      body,
      p.showKeys === false || !items.length ? null : h('p', { className: 'r1-queue__keys' }, legend.map(function (k, i) {
        return h('span', { key: i, className: 'r1-queue__key' }, k[0].map(function (x, j) { return h('kbd', { key: j }, x); }), h('span', null, k[1]));
      })));
  }

  // ------------------------------------------------------------- timeline

  // An append-only history, newest first. The current entry is marked in words for screen readers and with
  // aria-current, as well as by its filled mark. loading with no entries yet draws placeholder lines.
  function Timeline(p) {
    var t = tx(p.locale);
    var entries = p.entries || [];
    if (p.loading && !entries.length) return h('div', { className: cx('r1-timeline', p.className), style: p.style }, h(Skeleton, { variant: 'text', rows: 3, locale: p.locale }));
    return h('div', { className: cx('r1-timeline', p.className), style: p.style },
      h('ol', { className: 'r1-timeline__list' }, entries.map(function (e, i) {
        return h('li', { key: i, id: e.id, className: cx('r1-timeline__entry', e.kind === 'correction' && 'r1-timeline__entry--correction', e.current && 'r1-timeline__entry--current'), 'aria-current': e.current ? 'true' : undefined },
          h('span', { className: 'r1-timeline__dot', 'aria-hidden': 'true' }),
          h('div', { className: 'r1-timeline__body' },
            h('p', { className: 'r1-timeline__head' },
              e.current ? h('span', { className: 'r1-sr' }, t.timeline.current + ' ') : null,
              e.status ? h(StatusBadge, { family: e.status.family, label: e.status.label, icon: e.status.icon, size: 'sm' }) : null,
              h('span', { className: 'r1-strong' }, e.title)),
            h('p', { className: 'r1-timeline__meta' },
              e.at ? h(DateValue, { value: e.at, mode: 'timestamp', locale: p.locale }) : null,
              e.actor ? h('span', { className: 'r1-timeline__actor' }, e.actor) : null),
            e.detail ? h('p', { className: 'r1-timeline__detail' }, e.detail) : null,
            e.corrects ? h('p', { className: 'r1-timeline__link' }, h(Icon, { name: 'link', size: 16 }), h('a', { className: 'r1-link', href: '#' + e.corrects }, t.timeline.corrects + ' ' + e.corrects)) : null));
      })),
      p.showRule === true ? h('p', { className: 'r1-timeline__rule' }, t.timeline.appendOnly) : null);
  }

  // ----------------------------------------------------------- player

  // One list of Player conditions and their families, shared by PlayerStatusBlock, PlayerRail and PlayerAlert.
  var PLAYER_FAMILY = { online: 'positive', offline: 'info', 'limit-reached': 'danger', stopped: 'danger', 'cannot-continue': 'danger', ceiling: 'attention', syncing: 'info', fault: 'danger', paused: 'neutral', unpaired: 'neutral' };
  var PLAYER_HEADLINE = { online: 'online', offline: 'offline', 'limit-reached': 'limit', stopped: 'stopped', 'cannot-continue': 'cannot', ceiling: 'ceiling' };

  // A value on the Player: a string passes through; a Date or a timestamp becomes a time or a stamp, a number a count.
  function playerValue(v, locale, kind) {
    if (isNil(v) || typeof v === 'string' || React.isValidElement(v)) return v;
    if (kind === 'time') return formatTime(v) || v;
    if (v instanceof Date) return formatStamp(v, locale);
    return typeof v === 'number' ? formatCount(v, locale) : v;
  }
  // A span of hours in words, in hours and minutes only, as the licence counts it: "18 giờ 12 phút", "72 giờ".
  function hoursText(hours, locale) {
    var u = tx(locale).units, mins = Math.max(0, Math.round((hours || 0) * 60)), hr = Math.floor(mins / 60), mn = mins % 60;
    function part(n, one, many) { return formatCount(n, locale) + ' ' + (n === 1 ? one : many); }
    return hr && mn ? part(hr, u.hour, u.hours) + ' ' + part(mn, u.minute, u.minutes) : hr ? part(hr, u.hour, u.hours) : part(mn, u.minute, u.minutes);
  }
  // A line with its values apart, so they follow the locale: { text: 'Đồng bộ lúc {at:time}', at: new Date(...) }.
  // {key} formats a Date as a stamp and a number as a count; {key:time}, {key:date} and {key:duration} (ms) say how.
  function playerLine(line, locale) {
    if (isNil(line) || typeof line !== 'object' || React.isValidElement(line)) return line;
    return String(line.text || '').replace(/\{(\w+)(?::(\w+))?\}/g, function (m, k, f) {
      var v = line[k];
      if (isNil(v)) return m;
      if (f === 'time') return formatTime(v) || String(v);
      if (f === 'date') return formatDate(v, locale) || String(v);
      if (f === 'duration') return formatDuration(v, locale);
      return String(playerValue(v, locale));
    });
  }

  function PlayerStatusBlock(p) {
    var t = tx(p.locale);
    var cond = p.condition || 'online';
    var family = PLAYER_FAMILY[cond] || 'info';
    var headline = p.headline || t.player[PLAYER_HEADLINE[cond] || 'stopped'];
    var size = p.size || 'compact';
    var rem = p.remaining;
    var pct = rem && rem.total ? Math.max(0, Math.min(100, Math.round((rem.value / rem.total) * 100))) : null;
    // remaining is in hours: without a label the component says the time left in words, in the reader's language.
    var remLabel = rem ? (isNil(rem.label) ? hoursText(rem.value, p.locale) : rem.label) : null;
    var remTotal = rem ? (isNil(rem.totalLabel) && rem.total ? hoursText(rem.total, p.locale) : rem.totalLabel) : null;
    return h('section', {
      className: cx('r1-player', 'r1-player--' + cond, 'r1-player--' + size, p.className),
      'data-theme': p.surface === 'player' ? 'player' : undefined,
      role: family === 'danger' ? 'alert' : 'status', style: p.style
    },
      h('div', { className: 'r1-player__head' },
        h(StatusIcon, { family: family, size: size === 'device' ? 44 : 28, cutout: 'surface' }),
        h('div', null,
          h('p', { className: 'r1-player__headline' }, headline),
          p.subject ? h('p', { className: 'r1-player__subject' }, p.subject) : null)),
      rem ? h('div', { className: 'r1-player__remain' },
        h('p', { className: 'r1-player__big r1-num' }, remLabel),
        h('p', { className: 'r1-player__of' }, t.player.left + (remTotal ? ' ' + t.player.of + ' ' + remTotal : '')),
        pct === null ? null : h('div', { className: 'r1-meter r1-meter--' + family, role: 'meter', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuetext': remLabel + ' ' + t.player.left, 'aria-label': headline },
          h('span', { className: 'r1-meter__fill', style: { width: pct + '%' } }))) : null,
      p.children ? h('div', { className: 'r1-player__detail' }, p.children) : null,
      p.facts ? h('dl', { className: 'r1-player__facts' }, p.facts.map(function (f, i) {
        return h('div', { key: i }, h('dt', null, f.label), h('dd', { className: 'r1-num' }, playerValue(f.value, p.locale)));
      })) : null,
      p.action ? h('div', { className: 'r1-player__action' }, h(Button, { variant: family === 'danger' ? 'primary' : 'secondary', size: size === 'device' ? 'xl' : 'lg', icon: p.action.icon, href: p.action.href, onClick: p.action.onClick, locale: p.locale }, p.action.label)) : null);
  }

  // Four static bars: says "playing" by shape. Static on purpose: the Player runs on old hardware.
  function PlayingGlyph(p) {
    var paused = p && p.paused;
    var bars = paused ? [[5, 3, 18], [13, 3, 18]] : [[1, 9, 15], [7, 2, 22], [13, 12, 12], [19, 6, 18]];
    return h('svg', { className: 'r1-now__glyph', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
      bars.map(function (b, i) {
        return h('rect', { key: i, x: b[0], y: b[1], width: paused ? 6 : 4, height: b[2], rx: 1.5, style: { fill: 'var(--on-surface-muted)' } });
      }));
  }

  function NowPlaying(p) {
    var t = tx(p.locale);
    var c = p.credits || {};
    var scale = p.scale || 'display';
    var roles = [['composer', t.now.composer], ['lyricist', t.now.lyricist], ['performer', t.now.performer], ['producer', t.now.producer]];
    var optional = p.optional || [];
    var anyDown = optional.some(function (o) { return o.state === 'unavailable'; });
    return h('section', { className: cx('r1-now', 'r1-now--' + scale, p.layout === 'poster' && 'r1-now--poster', p.layout === 'cover' && 'r1-now--cover', p.className), 'data-theme': scale === 'display' ? 'player' : undefined, 'aria-live': 'polite', style: p.style },
      h('p', { className: 'r1-now__eyebrow' }, h(PlayingGlyph, { paused: p.paused }), h('span', null, p.eyebrow || (p.paused ? t.deck.paused : t.now.nowPlaying))),
      h(p.level === 1 ? 'h1' : 'h2', { className: 'r1-now__title' }, p.title),
      p.byline ? h('p', { className: 'r1-now__byline' }, p.byline) : null,
      (function () {
        var dl = h('dl', { className: 'r1-now__credits' }, roles.map(function (r) {
          // A role with no one in it (an instrumental has no lyricist) is a dash on screen and "none" to a screen reader.
          var v = c[r[0]];
          var who = typeof v === 'string' && v.indexOf(', ') > 0 ? v.split(', ').map(function (x, j) { return h('span', { key: j, className: 'r1-now__person' }, x); })
            : v ? v : [h('span', { key: 'd', 'aria-hidden': 'true' }, '–'), h('span', { key: 's', className: 'r1-sr' }, t.now.none)];
          return h('div', { key: r[0], className: 'r1-now__credit' }, h('dt', null, r[1]), h('dd', null, who));
        }));
        return p.children ? h('div', { className: 'r1-now__pair' }, dl, h('div', { className: 'r1-now__aside' }, p.children)) : dl;
      })(),
      optional.length ? h('div', { className: 'r1-now__optional' },
        h('ul', null, optional.map(function (o, i) {
          return h('li', { key: i, className: 'r1-now__opt r1-now__opt--' + o.state },
            h(StatusIcon, { family: o.state === 'available' ? 'positive' : 'neutral', size: scale === 'display' ? 32 : 16, cutout: 'page' }),
            // Available is the label with its check; only a surface that is down says so in words, in the same run of
            // text, so a narrow column wraps it as one sentence.
            h('span', null, o.label, o.state === 'available' ? null : [' ', h('span', { key: 's', className: 'r1-now__opt-state' }, t.now.unavailable)]));
        })),
        anyDown && p.note ? h('p', { className: 'r1-now__note' }, p.note) : null) : null);
  }

  // ----------------------------------------------------------------- chart

  function Chart(p) {
    var t = tx(p.locale);
    var series = p.series || [];
    var cats = p.categories || [];
    var W = p.width || 560, H = p.height || 220, padL = 48, padB = 28, padT = 8;
    var top = 0;
    series.forEach(function (s) { s.values.forEach(function (v) { if (!isNil(v) && v > top) top = v; }); });
    // The axis runs to a round number, so the gridlines read 0, 200, 400 rather than 0, 178, 355.
    var half = Math.max(top, 1) / 2, mag = Math.pow(10, Math.floor(Math.log10(half))), step = mag;
    [1, 2, 2.5, 5, 10].some(function (f) { step = f * mag; return half <= step; });
    if (step < 1) step = 1;
    var max = step * 2;
    var plotW = W - padL - 8, plotH = H - padB - padT;
    var groupW = plotW / Math.max(1, cats.length);
    var barW = Math.min(28, (groupW - 12) / Math.max(1, series.length));
    var ticks = [0, step, max];
    // The series colours are chart-1 to chart-3, which the Player theme re-points at its light hues, so a chart on the
    // dark Player surface keeps its bars legible (every series clears 3:1 against the ground on both themes).
    return h('figure', { className: cx('r1-chart', p.className), style: p.style },
      p.title ? h('figcaption', { className: 'r1-chart__title' }, p.title) : null,
      h('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': p.summary || p.title },
        ticks.map(function (v, i) {
          var y = padT + plotH - (v / max) * plotH;
          return h('g', { key: 't' + i },
            h('line', { x1: padL, x2: W - 8, y1: y, y2: y, style: { stroke: 'var(--border)' } }),
            h('text', { x: padL - 8, y: y + 4, textAnchor: 'end', className: 'r1-chart__tick' }, formatCount(v, p.locale)));
        }),
        cats.map(function (c, ci) {
          var gx = padL + ci * groupW + (groupW - barW * series.length) / 2;
          return h('g', { key: 'c' + ci },
            series.map(function (s, si) {
              var v = s.values[ci];
              if (isNil(v)) return null;
              var bh = (v / max) * plotH;
              return h('rect', { key: si, x: gx + si * barW, y: padT + plotH - bh, width: barW - 4, height: bh, rx: 2, style: { fill: 'var(--chart-' + ((si % 3) + 1) + ')' } });
            }),
            h('text', { x: padL + ci * groupW + groupW / 2, y: H - 8, textAnchor: 'middle', className: 'r1-chart__tick' }, c));
        })),
      h('ul', { className: 'r1-chart__legend' }, series.map(function (s, si) {
        return h('li', { key: si }, h('span', { className: 'r1-chart__swatch', style: { background: 'var(--chart-' + ((si % 3) + 1) + ')' } }), s.name);
      })),
      // The same figures as a table: read by screen readers, and shown on screen with showTable.
      h('table', { className: p.showTable ? 'r1-chart__table' : 'r1-sr' },
        h('caption', null, p.title || p.summary),
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, t.chart.category), series.map(function (s, si) { return h('th', { key: si, scope: 'col', className: 'r1-end' }, s.name); }))),
        h('tbody', null, cats.map(function (c, ci) {
          return h('tr', { key: ci }, h('th', { scope: 'row' }, c), series.map(function (s, si) {
            var v = s.values[ci];
            return h('td', { key: si, className: 'r1-end r1-num' }, isNil(v) ? missingValue(null, t.noValue) : formatCount(v, p.locale));
          }));
        }))),
      p.freshness ? h(FreshnessLine, Object.assign({ locale: p.locale }, p.freshness)) : null);
  }

  // ---------------------------------------------------------------- panel

  // A titled region of a console or portal page. A Table inside it runs to its edges.
  // The head carries what belongs to the whole region: a status shape, a badge, a short note on the right, actions.
  // The status shape is said in words inside the heading (familyLabel, or the family's word); the head wraps
  // when the title and the actions do not fit on one line.
  function Panel(p) {
    var id = useUid('r1-pnl');
    var actions = p.actions || (p.action ? [p.action] : []);
    var Heading = p.level === 3 ? 'h3' : 'h2';
    var small = p.density !== 'portal';
    var hasHead = p.title || p.description || p.meta || p.status || actions.length;
    var familyWord = p.family ? (p.familyLabel || tx(p.locale).panel[p.family] || '') : '';
    var head = hasHead ? h('div', { className: 'r1-panel__head' },
      h('div', { className: 'r1-panel__titles' },
        p.title ? h('div', { className: 'r1-panel__titleline' },
          p.family ? h('span', { className: 'r1-panel__icon r1-panel__icon--' + p.family, 'aria-hidden': 'true' }, h(StatusIcon, { family: p.family, size: 20, cutout: p.variant === 'sunken' ? 'surface-sunken' : 'surface' })) : null,
          h(Heading, { id: id, className: 'r1-panel__title' }, familyWord ? h('span', { className: 'r1-sr' }, familyWord + ': ') : null, p.title),
          p.status ? h(StatusBadge, { family: p.status.family, label: p.status.label, icon: p.status.icon, size: 'sm', variant: p.status.variant, working: p.status.working, locale: p.locale }) : null) : null,
        p.description ? h('p', { className: 'r1-panel__desc' }, p.description) : null),
      p.meta || actions.length ? h('div', { className: 'r1-panel__end' },
        p.meta ? h('span', { className: 'r1-panel__meta' }, p.meta) : null,
        actions.map(function (a, i) {
          if (a.kind === 'link') return h(Link, { key: i, href: a.href, variant: 'standalone', size: small ? 'sm' : undefined, icon: a.icon, locale: p.locale }, a.label);
          return h(Button, { key: i, variant: a.variant || 'quiet', size: small ? 'sm' : 'md', icon: a.icon, href: a.href, disabled: a.disabled, disabledReason: a.disabledReason, onClick: a.onClick, locale: p.locale }, a.label);
        })) : null) : null;
    return h(p.as === 'aside' || p.as === 'nav' || p.as === 'div' || p.as === 'fieldset' ? p.as : 'section', {
      className: cx('r1-panel', p.variant && p.variant !== 'default' && 'r1-panel--' + p.variant, p.compact && 'r1-panel--compact',
        p.layout === 'strip' && 'r1-panel--strip', p.gap && p.gap !== 'md' && 'r1-panel--gap-' + p.gap, p.align === 'center' && 'r1-panel--center', p.inset === 'sm' && 'r1-panel--inset-sm', p.className),
      'aria-labelledby': p.title ? id : undefined, style: p.style
    }, head, p.children);
  }

  // A hairline between the sections of one panel. Decorative: the section headings carry the structure.
  function Divider(p) {
    return h('hr', { className: cx('r1-divider', p.className), 'aria-hidden': 'true', style: p.style });
  }

  // ------------------------------------------------------ choice controls

  // The mark every checkbox and radio draws: the real input stays in place for the keyboard and screen readers.
  function choiceMark(type, attrs, indeterminate) {
    return [
      h('input', Object.assign({ key: 'i', type: type, className: 'r1-check__input', ref: type === 'checkbox' ? function (el) { if (el) el.indeterminate = !!indeterminate; } : undefined }, attrs)),
      h('span', { key: 'b', className: type === 'radio' ? 'r1-radio__dot' : 'r1-check__box', 'aria-hidden': 'true' },
        type === 'radio' ? null : h(Icon, { name: indeterminate ? 'minus' : 'check', size: 12, strokeWidth: 3 }))
    ];
  }

  // Ticked and "some ticked" are the box's own state, reset whenever the page passes a new value: a click clears
  // "some ticked", and a later render does not bring it back. readOnly shows a registry fact: named by its label,
  // reached by Tab, never a disabled box.
  function Checkbox(p) {
    var t = tx(p.locale);
    var id = useUid('r1-cb');
    var on = useSynced(!!p.checked, false);
    var some = useSynced(!!p.indeterminate, false);
    var help = isNil(p.helper) ? p.hint : p.helper;
    var ids = [help && id + '-hint', p.error && id + '-msg', p.disabled && p.disabledReason && id + '-why'].filter(Boolean).join(' ') || undefined;
    var text = h('span', { className: 'r1-check__text' },
      h('span', { id: id + '-label', className: 'r1-check__label' }, p.label || p.children, p.required && !p.readOnly ? h('span', { className: 'r1-field__req' }, t.required) : null),
      help ? h('span', { id: id + '-hint', className: 'r1-check__hint' }, help) : null);
    var body = p.readOnly
      ? h('div', { className: 'r1-choice r1-choice--readonly' },
          h('span', { id: id, className: 'r1-check__ro', role: 'checkbox', tabIndex: 0, 'aria-readonly': 'true', 'aria-checked': some[0] ? 'mixed' : on[0] ? 'true' : 'false', 'aria-labelledby': id + '-label', 'aria-describedby': ids },
            h('span', { className: 'r1-check__box', 'aria-hidden': 'true' }, on[0] || some[0] ? h(Icon, { name: some[0] ? 'minus' : 'check', size: 12, strokeWidth: 3 }) : null)),
          text)
      : h('label', { className: 'r1-choice', htmlFor: id },
          choiceMark('checkbox', {
            id: id, name: p.name, value: p.value, checked: on[0], disabled: p.disabled, required: p.required,
            'aria-invalid': p.error ? 'true' : undefined, 'aria-describedby': ids,
            onChange: function (e) { some[1](false); on[1](e.target.checked); if (p.onChange) p.onChange(e); }
          }, some[0]),
          text);
    return h('div', { className: cx('r1-check', 'r1-check--' + (p.density || 'console'), p.layout === 'card' && 'r1-check--card', (on[0] || some[0]) && 'r1-check--on', p.readOnly && 'r1-check--readonly', p.error && 'r1-check--error', p.disabled && 'r1-check--disabled', p.className), style: p.style },
      body,
      p.error ? h(FieldMessage, { id: id + '-msg', severity: 'error', locale: p.locale }, p.error) : null,
      p.disabled && p.disabledReason ? h('div', { id: id + '-why', className: 'r1-field__reason' }, h(Icon, { name: 'info', size: 16 }), h('span', null, p.disabledReason)) : null);
  }

  // One choice from a short list (radios), or several with multiple (checkboxes). Five or more options: use Select.
  // The chosen options are the list's own state, reset whenever the page passes a new value, so chips and cards
  // show the reader's pick. Each input carries aria-invalid and its own hint and reason; the group carries the
  // helper and the error. readOnly shows the chosen labels as a value named by the legend.
  function ChoiceList(p) {
    var t = tx(p.locale);
    var id = useUid('r1-cl');
    var multiple = !!p.multiple;
    var opts = p.options || [];
    var st = useSynced(multiple ? JSON.stringify(p.value || []) : p.value, multiple ? '[]' : null);
    var chosen = multiple ? JSON.parse(st[0] || '[]') : [st[0]];
    if (p.readOnly) {
      var picked = opts.filter(function (o) { return chosen.indexOf(o.value) >= 0; }).map(function (o) { return o.label; });
      var shown = Object.assign({}, p, { label: p.legend, readOnly: true, error: undefined, warning: undefined, info: undefined, density: p.density || 'console' });
      return fieldShell(shown, id, h('div', { className: 'r1-field__control' }, readOnlyBox(shown, id, picked.length ? picked.join(', ') : '–')));
    }
    function pick(e) {
      var v = e.target.value;
      if (multiple) {
        var next = opts.map(function (o) { return o.value; }).filter(function (x) { return x === v ? e.target.checked : chosen.indexOf(x) >= 0; });
        st[1](JSON.stringify(next));
      } else st[1](v);
      if (p.onChange) p.onChange(e);
    }
    return h('fieldset', {
      className: cx('r1-choices', 'r1-choices--' + (p.density || 'console'), p.layout && p.layout !== 'list' && 'r1-choices--' + p.layout, p.error && 'r1-choices--error', p.className),
      'aria-describedby': [p.helper && id + '-help', p.error && id + '-msg', p.disabled && p.disabledReason && id + '-why'].filter(Boolean).join(' ') || undefined, style: p.style
    },
      p.legend ? h('legend', { className: 'r1-choices__legend' }, p.legend, p.required ? h('span', { className: 'r1-field__req' }, t.required) : null) : null,
      p.helper ? h('p', { id: id + '-help', className: 'r1-field__help' }, p.helper) : null,
      h('div', { className: 'r1-choices__list' }, opts.map(function (o, i) {
        var oid = id + '-' + i;
        var on = chosen.indexOf(o.value) >= 0;
        var off = o.disabled || p.disabled;
        var why = off && o.reason;
        var oh = isNil(o.helper) ? o.hint : o.helper;
        // family: the option is a state (Đạt, Không đạt, Cần bổ sung): its status shape leads the label in the family's
        // colour, and once chosen a card or a chip takes the family's tint and edge in place of the accent.
        var fam = STATUS_FAMILIES.indexOf(o.family) >= 0 ? o.family : null;
        return h('label', { key: o.value, htmlFor: oid, className: cx('r1-choice', on && 'r1-choice--on', off && 'r1-choice--disabled', fam && 'r1-choice--fam r1-choice--' + fam) },
          choiceMark(multiple ? 'checkbox' : 'radio', {
            id: oid, name: p.name || id, value: o.value, checked: on, disabled: off, onChange: pick,
            'aria-invalid': p.error ? 'true' : undefined,
            'aria-describedby': [oh && oid + '-hint', why && oid + '-why'].filter(Boolean).join(' ') || undefined
          }),
          h('span', { className: 'r1-check__text' },
            h('span', { className: 'r1-check__label' }, fam ? h(StatusIcon, { family: fam, size: 16, cutout: on && (p.layout === 'cards' || p.layout === 'chips') ? fam + '-tint' : 'surface', className: 'r1-choice__shape' }) : null, o.label),
            oh ? h('span', { id: oid + '-hint', className: 'r1-check__hint' }, oh) : null,
            why ? h('span', { id: oid + '-why', className: 'r1-check__hint' }, o.reason) : null));
      })),
      p.error ? h(FieldMessage, { id: id + '-msg', severity: 'error', locale: p.locale }, p.error) : null,
      p.disabled && p.disabledReason ? h('div', { id: id + '-why', className: 'r1-field__reason' }, h(Icon, { name: 'info', size: 16 }), h('span', null, p.disabledReason)) : null);
  }

  // Two to seven mutually exclusive views of the same list. Arrow keys move between options; the chosen one is
  // the tab stop, or the first enabled one when no option matches the value. A disabled option says why in a
  // line under the control. The choice is the control's own state, reset whenever the page passes a new value.
  function SegmentedControl(p) {
    var id = useUid('r1-seg');
    var opts = p.options || [];
    var st = useSynced(p.value, null);
    var current = st[0];
    var enabled = opts.filter(function (o) { return !o.disabled; });
    var stop = enabled.some(function (o) { return o.value === current; }) ? current : (enabled[0] && enabled[0].value);
    function pick(v) { st[1](v); if (p.onChange) p.onChange(v); }
    function onKey(e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) < 0) return;
      e.preventDefault();
      var btns = e.currentTarget.querySelectorAll('.r1-seg__opt:not([disabled])');
      var list = Array.prototype.slice.call(btns);
      var at = list.indexOf(document.activeElement);
      var next = list[(at + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? list.length - 1 : 1)) % list.length];
      if (next) { next.focus(); next.click(); }
    }
    var why = [];
    var group = h('div', {
      className: cx('r1-seg', 'r1-seg--' + (p.density || 'console')), role: 'radiogroup', onKeyDown: onKey,
      'aria-labelledby': p.label && !p.hideLabel ? id : undefined, 'aria-label': p.hideLabel ? p.label : undefined
    }, opts.map(function (o, i) {
      var on = o.value === current;
      var rid = o.disabled && o.reason ? id + '-why-' + i : undefined;
      if (rid) why.push(h('p', { key: i, id: rid, className: 'r1-field__reason' }, h(Icon, { name: 'info', size: 16 }), h('span', null, o.label + ': ' + o.reason)));
      return h('button', {
        key: o.value, type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', tabIndex: o.value === stop ? 0 : -1,
        className: 'r1-seg__opt', disabled: o.disabled, 'aria-describedby': rid, onClick: function () { pick(o.value); }
      }, h('span', null, o.label), isNil(o.count) ? null : h('span', { className: 'r1-seg__count r1-num' }, formatCount(o.count, p.locale)));
    }));
    return h('div', { className: cx('r1-field r1-seg-field', p.className), style: p.style },
      p.label && !p.hideLabel ? h('span', { id: id, className: 'r1-field__label' }, p.label) : null, group,
      why.length ? h('div', { className: 'r1-seg__why' }, why) : null);
  }

  // The row of filters above a list: fields bottom-aligned, the result count and a way back to everything.
  // The count is a live region from the first render, so a new count is said. When a chip or Clear filters
  // goes away under the reader's focus, focus moves to the next chip, then Clear filters, then the first field.
  // shortcut: one key ("/") that puts focus in the bar's first field from anywhere in its shell. It is bound as
  // SearchField's and Button's are, on the nearest .r1-shell and never on the document; a bare key never fires while
  // the reader types in a field, nor from inside a dialog the bar is not in. data-r1-shortcut marks the bar from the
  // first render, so ConsoleShell's list of keys shows it with the bar's label; bound, the bar sets aria-keyshortcuts.
  function FilterBar(p) {
    var t = tx(p.locale);
    var rootRef = useRef(null);
    var refocus = useRef(null);
    var chips = p.chips || [];
    var sc = p.shortcut ? bindableShortcut(p.shortcut, 'the filter bar "' + (p.label || t.filters) + '"') : null;
    var scBound = useState(false);
    var singleOn = useSingleKeys();
    var scOff = useState(false);
    useEffect(function () {
      var scope = sc && rootRef.current && rootRef.current.closest('.r1-shell');
      var off = singleKeyOff(sc, scope, singleOn);
      if (scOff[0] !== off) scOff[1](off);
      if (scBound[0] !== (!!scope && !off)) scBound[1](!!scope && !off);
      if (!scope || off) return undefined;
      function onKey(e) {
        if (keyTaken(e)) return;
        if (!shortcutHit(e, sc)) return;
        if (!sc.mod && !sc.alt && isTyping(e.target)) return;
        holdAlt(e, sc);
        var root = rootRef.current;
        var dlg = e.target && e.target.closest && e.target.closest('[role="dialog"]');
        if (!root || (dlg && !dlg.contains(root))) return;
        var field = focusables(root.querySelector('.r1-filterbar__fields'))[0];
        if (!field) return;
        takeKey(e); e.stopPropagation();
        focusEl(field);
        if (field.select && /^(INPUT|TEXTAREA)$/.test(field.tagName)) field.select();
      }
      scope.addEventListener('keydown', onKey);
      return function () { scope.removeEventListener('keydown', onKey); };
    }, [sc ? (sc.mod ? 'mod+' : '') + (sc.alt ? 'alt+' : '') + sc.key : '', singleOn]);
    var scName = sc && scBound[0] ? shortcutAria(sc) : undefined;
    // Escape in a text filter clears that filter and does nothing else (OD-19, 7 October 2026): the value is emptied the
    // way typing would empty it, so the field's onChange and the page's filtering run, focus stays in the field, and the
    // key goes no further. An empty field, a select or a combobox lets Escape pass, so a dialog or a list closes as usual;
    // a SearchField has already cleared itself.
    function clearOnEscape(e) {
      var el = e.target;
      if (e.key !== 'Escape' || (e.nativeEvent || e).defaultPrevented || !el || !el.value) return;
      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : el.tagName === 'INPUT' && /^(text|search|email|tel|url|number|)$/.test(el.type || '') ? window.HTMLInputElement : null;
      if (!proto || el.readOnly || el.disabled || el.getAttribute('role') === 'combobox') return;
      var set = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set;
      set.call(el, '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      e.preventDefault(); e.stopPropagation();
    }
    useEffect(function () {
      var root = rootRef.current, want = refocus.current;
      if (!root || want === null) return;
      var at = document.activeElement;
      if (at && at !== document.body && root.contains(at)) return;
      refocus.current = null;
      if (at && at !== document.body) return;
      var list = root.querySelectorAll('.r1-chip');
      var next = typeof want === 'number' && list.length ? list[Math.min(want, list.length - 1)] : null;
      focusEl(next || root.querySelector('.r1-filterbar__end .r1-btn') || focusables(root.querySelector('.r1-filterbar__fields'))[0]);
    });
    return h('div', { ref: rootRef, className: cx('r1-filterbar', p.className), role: 'group', 'aria-label': p.label || t.filters, style: p.style, 'data-r1-shortcut': sc ? shortcutText(p.shortcut, sc) : undefined, 'data-r1-shortcut-off': sc && scOff[0] ? '' : undefined, 'aria-keyshortcuts': scName },
      h('div', { className: 'r1-filterbar__fields', onKeyDown: clearOnEscape }, p.children),
      chips.length ? h('ul', { className: 'r1-filterbar__chips', 'aria-label': t.filters }, chips.map(function (c, i) {
        return h('li', { key: i }, h('button', { type: 'button', className: 'r1-chip', 'aria-label': t.chip.remove + ': ' + c.label, onClick: function (e) { refocus.current = i; if (c.onRemove) c.onRemove(e); } }, h('span', null, c.label), h(Icon, { name: 'x', size: 16 })));
      })) : null,
      h('div', { className: 'r1-filterbar__end' },
        h('span', { className: 'r1-filterbar__summary', role: 'status' }, p.summary),
        p.active ? h(Button, { variant: 'quiet', size: 'sm', icon: 'x', onClick: function (e) { refocus.current = 'fields'; if (p.onClear) p.onClear(e); }, locale: p.locale }, t.empty.clearFilters) : null));
  }

  // A text link. back puts the arrow first; external opens a new tab and says so.
  // onClick, target, rel, id and every aria-* and data-* prop reach the anchor, so a router can drive it.
  function linkPass(p) {
    var out = {};
    Object.keys(p).forEach(function (k) { if (/^(aria|data)-/.test(k)) out[k] = p[k]; });
    return out;
  }
  function Link(p) {
    var t = tx(p.locale);
    var ext = !!p.external || p.target === '_blank';
    var lead = p.back ? 'arrow-left' : p.icon;
    var current = p.current === true ? 'page' : p.current || undefined;
    return h('a', Object.assign(linkPass(p), {
      className: cx('r1-link', (lead || ext) && 'r1-link--icon', p.variant && 'r1-link--' + p.variant, p.size && 'r1-link--' + p.size, p.className),
      href: p.href, target: ext ? '_blank' : p.target, rel: p.rel || (ext ? 'noopener noreferrer' : undefined),
      id: p.id, onClick: p.onClick, onKeyDown: p.onKeyDown, download: p.download, hrefLang: p.hrefLang, lang: p.lang,
      'aria-current': p['aria-current'] || current, style: p.style
    }),
      lead ? h(Icon, { name: lead, size: 16 }) : null,
      // A reference in the words stays whole on a phone ("Xem quyết định OBD-3FJW6NRA5C" breaks before the code).
      h('span', null, keepRefs(p.children || p.label)),
      ext ? h(Icon, { name: 'external-link', size: 16, label: t.newTab }) : null);
  }


  // Where the reader can go from here: one link per row with its icon, a chevron, and a reason when a row is closed.
  // The landmark is always named: by the title, else label, else "Go to". The current place is tinted and
  // carries aria-current; an entry with onClick and no href is a button that looks like the links beside it.
  function NavList(p) {
    var id = useUid('r1-nav');
    var t = tx(p.locale);
    var items = p.items || [];
    return h('nav', { className: cx('r1-navlist', p.className), 'aria-labelledby': p.title ? id : undefined, 'aria-label': p.title ? undefined : (p.label || t.navlist.label), style: p.style },
      p.title ? h('h2', { id: id, className: 'r1-navlist__title' }, p.title) : null,
      h('ul', { className: 'r1-navlist__list' }, items.map(function (it, i) {
        var inner = [
          it.icon ? h(Icon, { key: 'i', name: it.icon, size: 20 }) : null,
          h('span', { key: 't', className: 'r1-navlist__text' }, h('span', { className: 'r1-navlist__label' }, it.label), it.detail ? h('span', { className: 'r1-navlist__detail' }, it.detail) : null),
          it.disabled || it.current ? null : h(Icon, { key: 'c', name: 'chevron-right', size: 20, className: 'r1-navlist__chev' })
        ];
        var cls = cx('r1-navlist__item', it.current && 'r1-navlist__item--current');
        var cur = it.current ? 'page' : undefined;
        return h('li', { key: i }, it.disabled
          ? h('span', { className: 'r1-navlist__item r1-navlist__item--disabled', 'aria-disabled': 'true' }, inner, it.reason ? h('span', { className: 'r1-navlist__reason' }, it.reason) : null)
          : it.href || !it.onClick ? h('a', { className: cls, href: it.href, 'aria-current': cur, onClick: it.onClick }, inner)
            : h('button', { type: 'button', className: cls, 'aria-current': cur, onClick: it.onClick }, inner));
      })));
  }


  // A short list of things, one per row: an optional position and lead word, a title with a detail line, a status,
  // row actions and a message under the row. reorder adds move up, move down and remove, each named for its row.
  // Without onMove or onRemove the list keeps its own order; either way the move is said and focus follows the
  // item. readOnly leaves out the controls that would change the list.
  function ItemList(p) {
    var t = tx(p.locale);
    var rootRef = useRef(null);
    var follow = useRef(null);
    var base = p.items || [];
    var sig = base.map(function (it, i) { return isNil(it.key) ? textOf(it.title) + '\u0002' + i : String(it.key); }).join('\u0001');
    var own = useState({ sig: sig, order: null });
    var order = own[0].sig === sig && own[0].order ? own[0].order : base.map(function (x, i) { return i; });
    var items = order.map(function (i) { return base[i]; });
    var numbered = p.numbered || p.reorder;
    var hasLead = items.some(function (it) { return it.lead; });
    var checks = items.some(function (it) { return it.family; });
    var size = p.density === 'console' ? 'sm' : 'md';
    var editable = p.reorder && !p.readOnly;
    useEffect(function () {
      var f = follow.current, root = rootRef.current;
      if (!f || !root) return;
      follow.current = null;
      var rows = root.children;
      var row = rows[Math.min(f.pos, rows.length - 1)];
      if (!row) { focusEl(root); return; }
      var btn = row.querySelector('button[aria-label^="' + f.label + '"]') || row.querySelector('button');
      focusEl(btn || root);
    });
    function titleOf(it) { return textOf(it.title); }
    function move(i, to, it) {
      if (to < 0 || to >= items.length) return;
      if (p.onMove) p.onMove(order[i], order[to], it);
      else { var n = order.slice(); n.splice(i, 1); n.splice(to, 0, order[i]); own[1]({ sig: sig, order: n }); }
      follow.current = { pos: to, label: to < i ? t.itemList.up : t.itemList.down };
      announce(t.itemList.moved.replace('{title}', titleOf(it)).replace('{n}', String(to + 1)));
    }
    function remove(i, it) {
      if (p.onRemove) p.onRemove(order[i], it);
      else { var n = order.slice(); n.splice(i, 1); own[1]({ sig: sig, order: n }); }
      follow.current = { pos: i, label: t.itemList.remove };
      announce(t.itemList.removed.replace('{title}', titleOf(it)));
    }
    if (!items.length) return h('p', { className: cx('r1-items__empty', p.className), style: p.style }, p.emptyText || t.itemList.empty);
    return h(numbered ? 'ol' : 'ul', {
      ref: rootRef, tabIndex: -1,
      className: cx('r1-items', 'r1-items--' + (p.density || 'portal'), numbered && 'r1-items--numbered', hasLead && 'r1-items--lead', checks && 'r1-items--checks', p.className),
      role: 'list', 'aria-label': p.label, style: p.style
    }, items.map(function (it, i) {
      var name = typeof it.title === 'string' ? ': ' + it.title : '';
      // Read-only keeps the links and any action that states why it cannot run; the rest is left out.
      var acts = (it.actions || []).filter(function (a) { return !p.readOnly || a.href || a.disabledReason; }).map(function (a, k) {
        // ariaLabel: the accessible name when the visible words need the item to make sense out of the row ("Gỡ" is
        // named "Gỡ Then Cửa Bakery – Hai Bà Trưng"); it starts with the visible label (WCAG 2.5.3).
        return h(Button, { key: 'a' + k, variant: a.variant || 'secondary', size: size, icon: a.icon, iconOnly: a.iconOnly, 'aria-label': a.ariaLabel || (a.iconOnly ? a.label + name : undefined), href: a.href, disabled: a.disabled || (p.readOnly && !a.href), disabledReason: a.disabledReason, onClick: a.onClick ? function (e) { a.onClick(it, order[i], e); } : undefined, locale: p.locale }, a.label);
      });
      if (editable) {
        acts = acts.concat([
          h(Button, { key: 'u', size: size, iconOnly: true, icon: 'chevron-up', 'aria-label': t.itemList.up + name, disabled: i === 0, onClick: function () { move(i, i - 1, it); }, locale: p.locale }),
          h(Button, { key: 'd', size: size, iconOnly: true, icon: 'chevron-down', 'aria-label': t.itemList.down + name, disabled: i === items.length - 1, onClick: function () { move(i, i + 1, it); }, locale: p.locale }),
          h(Button, { key: 'r', size: size, iconOnly: true, icon: 'x', 'aria-label': t.itemList.remove + name, onClick: function () { remove(i, it); }, locale: p.locale })
        ]);
      }
      return h('li', { key: isNil(it.key) ? order[i] : it.key, role: 'listitem', className: cx('r1-item', it.selected && 'r1-item--selected'), 'aria-current': it.selected ? 'true' : undefined },
        h('div', { className: 'r1-item__row' },
          numbered ? h('span', { className: 'r1-item__pos r1-num', 'aria-hidden': 'true' }, String(i + 1)) : null,
          hasLead ? h('span', { className: 'r1-item__lead' }, it.lead || '') : null,
          checks ? h('span', { className: 'r1-item__icon r1-item__icon--' + (it.family || 'neutral') }, it.family ? h(StatusIcon, { family: it.family, size: 16, cutout: 'surface' }) : null) : null,
          h('span', { className: 'r1-item__main' },
            it.href ? h('a', { className: 'r1-link r1-item__title', href: it.href }, it.title) : h('span', { className: 'r1-item__title' }, it.title),
            it.detail ? h('span', { className: 'r1-item__detail' }, it.detail) : null),
          it.meta ? h('span', { className: 'r1-item__meta r1-num' }, it.meta) : null,
          it.status ? h(StatusBadge, { family: it.status.family, label: it.status.label, icon: it.status.icon, size: 'sm' }) : null,
          acts.length ? h('span', { className: 'r1-item__actions' }, acts) : null),
        it.message ? h('div', { className: 'r1-item__msg' }, h(FieldMessage, { severity: it.message.severity || 'warning', locale: p.locale }, it.message.text)) : null);
    }));
  }


  // ------------------------------------------------------------ navigation

  // Sections of one page. Arrow keys, Home and End move between tabs; the panel is labelled by its tab.
  function Tabs(p) {
    var id = useUid('r1-tabs');
    var tabs = p.tabs || [];
    var firstOpen = tabs.filter(function (tb) { return !tb.disabled; })[0] || tabs[0];
    // The tab keeps its own choice and follows value whenever the page passes one, so onChange without value
    // still moves. A value that names no tab falls back to the first open tab, so the list always has its tab stop.
    var st = useSynced(p.value, firstOpen && firstOpen.id);
    var cur = tabs.some(function (tb) { return tb.id === st[0]; }) ? st[0] : firstOpen && firstOpen.id;
    function pick(v) { st[1](v); if (p.onChange) p.onChange(v); }
    function onKey(e) {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
      e.preventDefault();
      var list = Array.prototype.slice.call(e.currentTarget.querySelectorAll('[role="tab"]'));
      var at = list.indexOf(document.activeElement);
      var next = e.key === 'Home' ? list[0] : e.key === 'End' ? list[list.length - 1] : list[(at + (e.key === 'ArrowLeft' ? list.length - 1 : 1)) % list.length];
      if (next) { next.focus(); next.click(); }
    }
    var hint = useState(null);
    // Link tabs: when the tabs carry href, each is a page of its own (a queue, a register), so the list is a
    // navigation landmark of links, the current one marked aria-current, and the content below is the page.
    if (tabs.some(function (tb) { return !!tb.href; })) {
      return h('div', { className: cx('r1-tabs', 'r1-tabs--' + (p.density || 'portal'), 'r1-tabs--links', p.className), style: p.style },
        h('nav', { className: 'r1-tabs__list', 'aria-label': p.label }, tabs.map(function (tb) {
          var on = tb.id === cur;
          return h('a', { key: tb.id, href: tb.href, className: 'r1-tabs__tab', 'aria-current': on ? 'page' : undefined },
            h('span', null, tb.label), isNil(tb.count) ? null : h('span', { className: 'r1-tabs__count r1-num' }, formatCount(tb.count, p.locale)));
        })),
        p.children ? h('div', { className: 'r1-tabs__panel' }, p.children) : null);
    }
    return h('div', { className: cx('r1-tabs', 'r1-tabs--' + (p.density || 'portal'), p.className), style: p.style },
      h('div', { className: 'r1-tabs__list', role: 'tablist', 'aria-label': p.label, onKeyDown: onKey }, tabs.map(function (tb) {
        var on = tb.id === cur;
        var why = tb.disabled && tb.reason ? id + '-why-' + tb.id : undefined;
        return h('button', {
          key: tb.id, id: id + '-t-' + tb.id, type: 'button', role: 'tab', className: cx('r1-tabs__tab', tb.disabled && 'r1-tabs__tab--off'),
          'aria-selected': on ? 'true' : 'false', 'aria-controls': id + '-p', tabIndex: on ? 0 : -1, 'aria-disabled': tb.disabled ? 'true' : undefined,
          'aria-describedby': why, onClick: function () { if (!tb.disabled) pick(tb.id); },
          onFocus: why ? function () { hint[1](tb.id); } : undefined, onBlur: why ? function () { hint[1](null); } : undefined,
          onMouseEnter: why ? function () { hint[1](tb.id); } : undefined, onMouseLeave: why ? function () { hint[1](null); } : undefined
        }, h('span', null, tb.label), isNil(tb.count) ? null : h('span', { className: 'r1-tabs__count r1-num' }, formatCount(tb.count, p.locale)));
      })),
      tabs.filter(function (tb) { return tb.disabled && tb.reason; }).map(function (tb) {
        return h('p', { key: tb.id, id: id + '-why-' + tb.id, className: 'r1-tabs__why', hidden: hint[0] !== tb.id }, h(Icon, { name: 'info', size: 16 }), h('span', null, tb.reason));
      }),
      p.children ? h('div', { id: id + '-p', role: 'tabpanel', className: 'r1-tabs__panel', 'aria-labelledby': id + '-t-' + cur, tabIndex: 0 }, p.children) : null);
  }

  // Cursor paging: what is shown, a way back to the start, previous and next. No page numbers,
  // because a cursor cannot jump; a button that cannot act is left out rather than disabled, and when the
  // button the reader pressed leaves (Next on the last page), focus moves to the one that stays.
  // loading: the pressed button spins and the range says a page is loading; presses wait until it arrives.
  function Pagination(p) {
    var t = tx(p.locale).pager;
    var size = p.density === 'portal' ? 'md' : 'sm';
    var sizeId = useUid('r1-pgs');
    var ps = useSynced(isNil(p.pageSize) ? '' : String(p.pageSize), '');
    var rootRef = useRef(null);
    var pressed = useRef(null);
    var loading = !!p.loading;
    var busy = typeof p.loading === 'string' ? p.loading : loading ? pressed.current : null;
    useEffect(function () {
      var root = rootRef.current, was = pressed.current;
      if (!root || !was || loading) return;
      pressed.current = null;
      var at = document.activeElement;
      if (at && at !== document.body) return;
      var labels = { next: t.next, prev: t.prev, first: t.first };
      var pref = was === 'next' ? ['prev', 'first'] : ['next'];
      var btns = Array.prototype.slice.call(root.querySelectorAll('.r1-pager__actions .r1-btn'));
      for (var i = 0; i < pref.length; i++) {
        for (var j = 0; j < btns.length; j++) if (btns[j].textContent.trim() === labels[pref[i]]) { focusEl(btns[j]); return; }
      }
      focusEl(root.querySelector('.r1-pager__range'));
    });
    function go(which, fn) {
      return function (e) {
        if (loading) { if (e && e.preventDefault) e.preventDefault(); return; }
        pressed.current = which;
        if (fn) fn(e);
      };
    }
    return h('nav', { ref: rootRef, className: cx('r1-pager', 'r1-pager--' + (p.density || 'console'), p.className), 'aria-label': p.label || t.label, style: p.style },
      h('p', { className: 'r1-pager__range', role: 'status', tabIndex: -1, 'aria-busy': loading ? 'true' : undefined },
        h('span', null, p.summary),
        loading ? h('span', { className: 'r1-pager__loading' }, h(Icon, { name: 'loader-circle', size: 16, spin: true }), h('span', null, t.loading)) : null,
        !loading && !p.hasNext && p.endNote !== false ? h('span', { className: 'r1-pager__end-note' }, p.endNote || t.end) : null),
      h('div', { className: 'r1-pager__actions' },
        p.pageSizes ? h('span', { className: 'r1-pager__size' },
          h('label', { htmlFor: sizeId }, t.perPage),
          h('span', { className: 'r1-select r1-pager__select' },
            h('select', { id: sizeId, name: p.name, className: 'r1-input r1-select__native', value: ps[0], disabled: loading, onChange: function (e) {
              ps[1](e.target.value);
              if (p.onPageSize) p.onPageSize(e);
              if (p.onPageSizeChange) p.onPageSizeChange(Number(e.target.value), e);
            } }, p.pageSizes.map(function (n) { return h('option', { key: n, value: n }, formatCount(n, p.locale)); })),
            h(Icon, { name: 'chevron-down', size: 16, className: 'r1-select__chev' }))) : null,
        p.hasPrev ? h(Button, { variant: 'quiet', size: size, href: p.firstHref, loading: busy === 'first', onClick: go('first', p.onFirst), locale: p.locale }, t.first) : null,
        p.hasPrev ? h(Button, { size: size, icon: 'chevron-left', href: p.prevHref, loading: busy === 'prev', onClick: go('prev', p.onPrev), locale: p.locale }, t.prev) : null,
        p.hasNext ? h(Button, { size: size, iconRight: 'chevron-right', href: p.nextHref, loading: busy === 'next', onClick: go('next', p.onNext), locale: p.locale }, t.next) : null));
  }

  // --------------------------------------------------------- search and pick

  // Search on Enter (onSearch) or as the reader types (onChange). loading (busy in older frames) and resultCount
  // are said to screen readers when they change; clearing empties the box and puts focus back in it.
  function resultWords(n, words) {
    if (n === 0) return words.noResults;
    if (n === 1 && words.oneResult) return words.oneResult;
    return words.results.replace('{n}', String(n));
  }
  // The shortcut as drawn ("⌘K", "Ctrl+K", "/", "Alt+R", "⌥R"): a modifier (Cmd or Ctrl) or none, Alt (Option) or not,
  // and one key.
  function parseShortcut(s) {
    var str = String(s || '');
    var key = str.replace(/\u2318|\u21e7|\u2325|cmd|ctrl|control|meta|mod|shift|alt|option|\+|\s/gi, '').toLowerCase();
    return key ? { mod: /\u2318|cmd|ctrl|control|meta|mod/i.test(str), alt: /\u2325|alt|option/i.test(str), key: key } : null;
  }
  // Apple keyboards name Alt Option and draw it as the sign U+2325.
  function applePlatform() {
    try {
      var nav = window.navigator || {};
      return /mac|iphone|ipad|ipod/i.test((nav.userAgentData && nav.userAgentData.platform) || nav.platform || nav.userAgent || '');
    } catch (e) { return false; }
  }
  // Whether a keydown is the shortcut. Cmd or Ctrl must match the shortcut's own modifier; a shortcut without one fires
  // only with neither held. Alt is required when the shortcut names it and refused on a bare key. Option with a letter
  // types another character on a Mac (Option+R is the registered sign), so with Alt the physical key (KeyR, Digit1) is
  // compared too.
  function shortcutHit(e, sc) {
    if (sc.mod ? !(e.metaKey || e.ctrlKey) : (e.metaKey || e.ctrlKey)) return false;
    if (sc.alt ? !e.altKey : (!sc.mod && e.altKey)) return false;
    if (String(e.key).toLowerCase() === sc.key) return true;
    return sc.alt && sc.key.length === 1 && e.code === (/\d/.test(sc.key) ? 'Digit' : 'Key') + sc.key.toUpperCase();
  }
  // What aria-keyshortcuts says: "N"; "Control+S Meta+S" with a modifier; "Alt+R"; "Control+Alt+R Meta+Alt+R".
  function shortcutAria(sc) {
    var k = sc.key.length === 1 ? sc.key.toUpperCase() : sc.key;
    var a = sc.alt ? 'Alt+' : '';
    return sc.mod ? 'Control+' + a + k + ' Meta+' + a + k : a + k;
  }
  // A shortcut with Alt is drawn the platform's way: Option's sign and the key on a Mac, an iPhone or an iPad ("⌥R"),
  // "Alt+R" elsewhere (with Cmd or Ctrl: "⌘⌥R", "Ctrl+Alt+R"). Every other shortcut is drawn as the page wrote it.
  function shortcutText(raw, sc) {
    if (!sc || !sc.alt) return raw;
    var k = sc.key.length === 1 ? sc.key.toUpperCase() : sc.key;
    return applePlatform() ? (sc.mod ? '\u2318' : '') + '\u2325' + k : (sc.mod ? 'Ctrl+' : '') + 'Alt+' + k;
  }

  // ------------------------------------------------------- keyboard rules (OD-18, OD-19, 7 October 2026)

  // A single-character key bound on a shell ("/", "?", a bare letter on a Button or a FilterBar) fires from anywhere in
  // that shell, so a reader who types by voice or slips on the keyboard can set it off without meaning to (WCAG 2.1.4).
  // The reader turns these keys off in the shell's key list, and the choice is kept in this browser. A page turns them
  // off for everyone with ConsoleShell singleKeys="off" (the shell carries data-r1-single-keys="off"). Keys that act only
  // while their own component has focus (a table's J and K, a queue's arrows) are not shell keys and stay on.
  var SINGLE_KEY_STORE = 'r1-single-keys';
  var singleKeys = { on: true, subs: [] };
  try { singleKeys.on = window.localStorage.getItem(SINGLE_KEY_STORE) !== 'off'; } catch (e) { /* storage refused: keys stay on */ }
  function setSingleKeys(on) {
    singleKeys.on = !!on;
    try { window.localStorage.setItem(SINGLE_KEY_STORE, on ? 'on' : 'off'); } catch (e) { /* storage refused: the choice lasts for this page */ }
    singleKeys.subs.slice().forEach(function (f) { f(singleKeys.on); });
  }
  function useSingleKeys() {
    var st = useState(singleKeys.on);
    useEffect(function () {
      function follow(v) { st[1](v); }
      singleKeys.subs.push(follow);
      if (st[0] !== singleKeys.on) st[1](singleKeys.on);
      return function () { var i = singleKeys.subs.indexOf(follow); if (i >= 0) singleKeys.subs.splice(i, 1); };
    }, []);
    return st[0];
  }
  function isSingleKey(sc) { return !!sc && !sc.mod && !sc.alt && sc.key.length === 1; }
  // Whether a shell key is off: the reader's choice, or the page's for the shell it sits in.
  function singleKeyOff(sc, scope, on) {
    return isSingleKey(sc) && (!on || (!!scope && scope.getAttribute('data-r1-single-keys') === 'off'));
  }
  // Alt+D, Alt+E and Alt+F belong to the browser (the address bar; Chrome and Edge open their menu on E as on F):
  // a binding asking for one is refused, says so once in the console, and is neither bound, drawn nor listed.
  var ALT_OWNED = { d: 'Alt+D', e: 'Alt+E', f: 'Alt+F' };
  function bindableShortcut(raw, owner) {
    var sc = parseShortcut(raw);
    if (sc && sc.alt && !sc.mod && ALT_OWNED[sc.key]) {
      warnOnce(ALT_OWNED[sc.key] + ' is not bound on ' + owner + ': the browser uses it. Choose another Alt+letter (Alt+N opens a new form, Alt+S saves a draft).');
      return null;
    }
    return sc;
  }
  // An Alt+letter that matches stops the browser's menu even when the action declines (disabled, working, or in another
  // dialog), so defaultPrevented alone no longer means another binding took the key: r1Took says that.
  function keyTaken(e) { return !!e.r1Took || (e.defaultPrevented && !e.r1Alt); }
  function holdAlt(e, sc) { if (sc.alt && !e.defaultPrevented) { e.preventDefault(); e.r1Alt = true; } }
  function takeKey(e) { e.preventDefault(); e.r1Took = true; }
  // One spelling per key, for comparing a key list with what the page binds: "\u2318K" and "Ctrl+K" are mod+k, "\u2193" is arrowdown.
  var KEY_NAMES = { '\u2191': 'arrowup', '\u2193': 'arrowdown', '\u2190': 'arrowleft', '\u2192': 'arrowright', esc: 'escape', up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright', spacebar: 'space', return: 'enter', pgup: 'pageup', pgdn: 'pagedown' };
  function keyId(raw) {
    var s = String(raw || '').trim();
    if (s === ' ' || /^space$/i.test(s)) return 'space';
    var sc = parseShortcut(s);
    if (!sc) return null;
    return (sc.mod ? 'mod+' : '') + (sc.alt ? 'alt+' : '') + (KEY_NAMES[sc.key] || sc.key);
  }
  // Keys the browser and every component handle without a binding of their own: never reported as unbound.
  var NATIVE_KEYS = { tab: 1, escape: 1, space: 1 };
  function SearchField(p) {
    var t = tx(p.locale);
    var id = useUid('r1-search');
    var st = useSynced(p.value, '');
    var val = st[0];
    var busy = !!(p.loading || p.busy);
    var inputRef = useRef(null);
    var first = useRef(true);
    // The shortcut is bound on the nearest shell (PublicShell, PortalShell, ConsoleShell), never on the document:
    // it works while focus is anywhere in that shell. With no shell around the field it stays a drawn hint.
    // A bare key ("/") never takes over typing in another box.
    var sc = p.shortcut ? bindableShortcut(p.shortcut, 'the search field "' + textOf(p.label) + '"') : null;
    var bound = useState(false);
    var singleOn = useSingleKeys();
    var scOff = useState(false);
    useEffect(function () {
      var scope = sc && inputRef.current && inputRef.current.closest('.r1-shell');
      var off = singleKeyOff(sc, scope, singleOn);
      if (scOff[0] !== off) scOff[1](off);
      bound[1](!!scope && !off);
      if (!scope || off) return undefined;
      function onKey(e) {
        if (keyTaken(e)) return;
        if (!shortcutHit(e, sc)) return;
        if (!sc.mod && !sc.alt && isTyping(e.target)) return;
        takeKey(e); e.stopPropagation();
        focusEl(inputRef.current); if (inputRef.current) inputRef.current.select();
      }
      scope.addEventListener('keydown', onKey);
      return function () { scope.removeEventListener('keydown', onKey); };
    }, [sc ? (sc.mod ? 'mod+' : '') + (sc.alt ? 'alt+' : '') + sc.key : '', singleOn]);
    useEffect(function () {
      if (first.current) { first.current = false; return; }
      if (busy) announce(t.search.searching);
      else if (!isNil(p.resultCount)) announce(resultWords(p.resultCount, t.search));
    }, [busy, p.resultCount]);
    function set(v, e) { st[1](v); if (p.onChange) p.onChange(v, e); }
    var size = fieldIconSize(p);
    var control = h('div', { className: cx('r1-search', 'r1-search--' + (p.density || 'portal')), role: 'search' },
      h(Icon, { name: 'search', size: size, className: 'r1-search__icon' }),
      h('input', {
        ref: inputRef, id: id, name: p.name, type: 'search', className: 'r1-input r1-search__input', value: val, placeholder: p.placeholder, autoComplete: 'off',
        disabled: p.disabled, required: p.required, 'aria-invalid': p.error ? 'true' : undefined, 'aria-busy': busy ? 'true' : undefined,
        'aria-keyshortcuts': bound[0] ? (sc.mod || sc.alt ? shortcutAria(sc) : sc.key) : undefined,
        'data-r1-shortcut': sc ? shortcutText(p.shortcut, sc) : undefined, 'data-r1-shortcut-label': sc ? textOf(p.label) : undefined,
        'data-r1-shortcut-off': sc && scOff[0] ? '' : undefined,
        'aria-describedby': describedBy(p, id), onBlur: p.onBlur,
        onChange: function (e) { set(e.target.value, e); },
        onKeyDown: function (e) {
          if (e.key === 'Enter' && p.onSearch) { e.preventDefault(); p.onSearch(val, e); }
          else if (e.key === 'Escape' && val) { e.preventDefault(); set('', e); }
        }
      }),
      busy ? h('span', { className: 'r1-search__end' }, h(Icon, { name: 'loader-circle', size: size, spin: true, label: t.search.searching }))
        : val && !p.disabled ? h('button', { type: 'button', className: 'r1-search__clear', 'aria-label': t.search.clear, onClick: function (e) { set('', e); focusEl(inputRef.current); } }, h(Icon, { name: 'x', size: size }))
        : sc && !scOff[0] ? h('kbd', { className: 'r1-search__kbd', 'aria-hidden': 'true' }, shortcutText(p.shortcut, sc)) : null);
    var box = h('div', { className: 'r1-field__control', style: p.width ? { maxWidth: p.width } : undefined }, control);
    return fieldShell(p, id, box);
  }

  // Type to narrow a long list, then pick one. The ARIA 1.2 combobox pattern: the input keeps focus,
  // the active option is announced through aria-activedescendant. Loading and the number of matches are said
  // once typing settles. multiple picks several: each pick keeps the list open, the choices show as removable
  // chips under the field (or, with chips={false}, as a count inside it), and Backspace in an empty box removes
  // the last one. onChange(value, option), or onChange(values, options) with multiple.
  function Combobox(p) {
    var t = tx(p.locale);
    var id = useUid('r1-combo');
    var listId = id + '-list';
    var opts = p.options || [];
    var multi = !!p.multiple;
    var vs = useSynced(multi ? undefined : p.value, null);
    // The values of a multiple choice are compared by a string key, since the page builds the array afresh.
    var ks = useSynced(multi && !isNil(p.value) ? JSON.stringify(Array.isArray(p.value) ? p.value : [p.value]) : undefined, '[]');
    var values = multi ? JSON.parse(ks[0]) : [];
    // allowCustom: a value the reader typed that is no option is still a value; it reads as itself.
    var custom = !!p.allowCustom;
    function byValue(v) {
      var o = opts.filter(function (x) { return x.value === v; })[0];
      if (o || !custom || isNil(v) || v === '') return o;
      return { value: v, label: String(v), custom: true };
    }
    function customWords(text) {
      var w = p.customLabel || t.combo.custom;
      return w.indexOf('{text}') >= 0 ? w.replace('{text}', text) : w + ' \u201c' + text + '\u201d';
    }
    var sel = multi ? null : byValue(vs[0]);
    var picked = values.map(byValue).filter(Boolean);
    var q = useSynced(p.query, sel ? sel.label : '');
    var lastVal = useRef(vs[0]);
    if (!multi && lastVal.current !== vs[0]) { lastVal.current = vs[0]; if (sel && q[0] !== sel.label) q[1](sel.label); }
    var open = useState(!!p.open);
    var act = useState(isNil(p.activeIndex) ? -1 : p.activeIndex);
    var inputRef = useRef(null);
    var chipsRef = useRef(null);
    var refocus = useRef(null);
    var query = q[0];
    var needle = query && !(sel && query === sel.label) ? fold(query).trim() : '';
    var shown = needle ? opts.filter(function (o) { return fold(o.label + ' ' + (o.detail || '')).indexOf(needle) >= 0; }) : opts;
    // The typed text as the last option, while it is no option's label and not already chosen.
    var typed = String(query || '').trim();
    var customOpt = custom && needle && !opts.some(function (o) { return fold(o.label) === fold(typed); }) && !(multi && values.indexOf(typed) >= 0)
      ? { value: typed, label: typed, custom: true } : null;
    var items = customOpt ? shown.concat([customOpt]) : shown;
    var isOpen = open[0] && !p.disabled && !p.readOnly;
    // wrap (one choice): while the field is not focused and the chosen label is wider than the field, the field shows
    // the whole label over as many lines as it needs and grows in height; focus brings back the one-line box to type
    // in. The input stays the one control and keeps the value; the wrapped copy is drawn for the eye only.
    var wrapOn = !!p.wrap && !multi;
    var focused = useState(false);
    var over = useState(false);
    var showWhole = wrapOn && over[0] && !focused[0] && !isOpen && !!sel && query === sel.label;
    // The label is measured only while the one-line box is drawn. In the whole form the input lies over the label drawn in
    // flow, so its width follows that label wherever the field is sized by its content: measured there, a label that fits
    // the grown box would switch the whole form off, the box would shrink, and the two would trade places without end.
    // Kept on, the whole form of a label that fits draws the same one line. The observer is made once per state, not per
    // render, and state is set only when the answer changes.
    var overNow = useRef(over[0]); overNow.current = over[0];
    var wholeNow = useRef(showWhole); wholeNow.current = showWhole;
    useLayoutEffect(function () {
      var el = inputRef.current;
      if (!wrapOn || !el) return undefined;
      function measure() {
        if (wholeNow.current) return;
        var o = el.scrollWidth > el.clientWidth;
        if (o !== overNow.current) { overNow.current = o; over[1](o); }
      }
      measure();
      if (typeof ResizeObserver === 'undefined') return undefined;
      var ro = new ResizeObserver(measure);
      ro.observe(el);
      return function () { ro.disconnect(); };
    }, [wrapOn, showWhole, query]);
    var first = useRef(true);
    useEffect(function () {
      if (first.current) { first.current = false; return undefined; }
      if (!isOpen) return undefined;
      var tm = setTimeout(function () {
        announce(p.loading ? t.loading : shown.length ? resultWords(shown.length, t.combo) : customOpt ? customWords(typed) : (p.noResults || t.combo.noResults));
      }, 400);
      return function () { clearTimeout(tm); };
    }, [isOpen, !!p.loading, shown.length, needle]);
    // After a chip is removed, focus goes to the chip that took its place, else the one before, else the box.
    useEffect(function () {
      if (refocus.current === null) return;
      var at = refocus.current;
      refocus.current = null;
      var chips = chipsRef.current ? chipsRef.current.querySelectorAll('.r1-combo__chip') : [];
      focusEl(chips.length ? chips[Math.min(at, chips.length - 1)] : inputRef.current);
    });
    function setValues(next, e) {
      ks[1](JSON.stringify(next));
      if (p.onChange) p.onChange(next, next.map(byValue).filter(Boolean), e);
    }
    function toggle(o, e) {
      var on = values.indexOf(o.value) >= 0;
      setValues(on ? values.filter(function (v) { return v !== o.value; }) : values.concat([o.value]), e);
      announce((on ? t.combo.unpicked : t.combo.picked).replace('{label}', o.label));
    }
    function choose(o, e) {
      if (multi) { toggle(o, e); if (o.custom) { q[1](''); act[1](-1); } return; }
      vs[1](o.value); q[1](o.label); open[1](false); act[1](-1); if (p.onChange) p.onChange(o.value, o, e);
    }
    // Leaving the field never leaves text that disagrees with the choice: an exact match is taken,
    // an emptied field clears the choice, anything else goes back to the chosen label.
    // With multiple, the typed text is only a filter and is cleared.
    function settle() {
      open[1](false); act[1](-1);
      if (multi) { if (query) q[1](''); return; }
      if (sel && query === sel.label) return;
      if (!query.trim()) { if (sel) { vs[1](null); if (p.onChange) p.onChange(null, null); } q[1](''); return; }
      var same = opts.filter(function (o) { return fold(o.label) === fold(query).trim(); })[0];
      var exact = same && !same.disabled ? same : null;
      // With allowCustom, text that is no option is taken as typed; the label of an option that cannot be picked is not.
      if (exact) choose(exact); else if (custom && !same) choose({ value: query.trim(), label: query.trim(), custom: true }); else q[1](sel ? sel.label : '');
    }
    function onKey(e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); open[1](true);
        var n = items.length; if (!n) return;
        act[1]((act[0] + (e.key === 'ArrowDown' ? 1 : n - 1) + (act[0] < 0 && e.key === 'ArrowUp' ? 1 : 0)) % n);
      } else if (e.key === 'Enter' && isOpen && act[0] >= 0 && items[act[0]] && !items[act[0]].disabled) {
        e.preventDefault(); choose(items[act[0]], e);
      } else if (e.key === 'Enter' && isOpen && act[0] < 0 && customOpt) {
        e.preventDefault(); choose(customOpt, e);
      } else if (e.key === 'Escape') {
        if (isOpen) open[1](false); else if (multi && query) q[1]('');
      } else if (e.key === 'Backspace' && multi && !query && picked.length) {
        toggle(picked[picked.length - 1], e);
      }
    }
    // selectedDetail (one choice): the chosen option's detail stays under the field once it is picked (a decision's amount
    // and due date), as the open list showed it, and is read with the field. While the reader types something else, the
    // field no longer shows that choice and the line waits until it does again.
    var chosenId = id + '-chosen';
    var chosenDetail = p.selectedDetail && !multi && sel && !isNil(sel.detail) && sel.detail !== '' && (p.readOnly || query === sel.label)
      ? h('div', { id: chosenId, className: 'r1-combo__chosen' }, keepRefs(sel.detail)) : null;
    if (p.readOnly) {
      var shownValue = multi ? (picked.length ? picked.map(function (o) { return o.label; }).join(', ') : '–') : (sel ? sel.label : '–');
      return fieldShell(p, id, h('div', { className: 'r1-field__control' }, readOnlyBox(p, id, shownValue, null, chosenDetail ? chosenId : null)), chosenDetail);
    }
    var size = fieldIconSize(p);
    var countMode = multi && p.chips === false;
    var list = isOpen ? h('ul', { id: listId, role: 'listbox', className: cx('r1-combo__list', multi && 'r1-combo__list--multi'), 'aria-label': p.label, 'aria-multiselectable': multi ? 'true' : undefined },
      p.loading ? h('li', { className: 'r1-combo__note', role: 'presentation' }, h(Icon, { name: 'loader-circle', size: 16, spin: true }), h('span', null, t.loading))
        : items.length ? items.map(function (o, i) {
          if (o.custom) {
            return h('li', {
              key: '\u0001custom', id: listId + '-' + i, role: 'option', 'aria-selected': 'false',
              className: cx('r1-combo__opt r1-combo__opt--custom', i === act[0] && 'r1-combo__opt--active'),
              onMouseDown: function (e) { e.preventDefault(); choose(o, e); }
            }, h(Icon, { name: 'plus', size: 16, className: 'r1-combo__plus' }), h('span', { className: 'r1-combo__text' }, h('span', { className: 'r1-combo__label' }, customWords(o.value))));
          }
          var on = multi ? values.indexOf(o.value) >= 0 : o.value === vs[0];
          return h('li', {
            key: o.value, id: listId + '-' + i, role: 'option', 'aria-selected': on ? 'true' : 'false', 'aria-disabled': o.disabled ? 'true' : undefined,
            className: cx('r1-combo__opt', i === act[0] && 'r1-combo__opt--active', on && 'r1-combo__opt--selected', o.disabled && 'r1-combo__opt--disabled'),
            onMouseDown: function (e) { e.preventDefault(); if (!o.disabled) choose(o, e); }
          },
            multi ? h('span', { className: 'r1-combo__box', 'aria-hidden': 'true' }, on ? h(Icon, { name: 'check', size: 12, strokeWidth: 3 }) : null) : null,
            h('span', { className: 'r1-combo__text' }, h('span', { className: 'r1-combo__label' }, o.label), o.detail ? h('span', { className: 'r1-combo__detail' }, o.disabled && o.reason ? o.reason : o.detail) : o.disabled && o.reason ? h('span', { className: 'r1-combo__detail' }, o.reason) : null),
            on && !multi ? h(Icon, { name: 'check', size: 16, className: 'r1-combo__check' }) : null);
        }) : h('li', { className: 'r1-combo__note', role: 'presentation' }, p.noResults || t.combo.noResults)) : null;
    var countText = t.combo.count.replace('{n}', String(picked.length));
    var control = h('div', { className: cx('r1-combo', isOpen && 'r1-combo--open', countMode && picked.length && 'r1-combo--count', showWhole && 'r1-combo--whole') },
      h('input', {
        ref: inputRef, id: id, type: 'text', role: 'combobox', className: 'r1-input r1-combo__input', value: query, placeholder: p.placeholder, disabled: p.disabled,
        autoComplete: 'off', 'aria-autocomplete': 'list', 'aria-expanded': isOpen ? 'true' : 'false', 'aria-controls': listId,
        'aria-activedescendant': isOpen && act[0] >= 0 ? listId + '-' + act[0] : undefined, 'aria-invalid': p.error ? 'true' : undefined,
        'aria-busy': p.loading ? 'true' : undefined,
        'aria-describedby': [describedBy(p, id), countMode && picked.length ? id + '-count' : null, chosenDetail ? chosenId : null].filter(Boolean).join(' ') || undefined,
        required: p.required && !(multi && picked.length),
        onChange: function (e) { q[1](e.target.value); open[1](true); act[1](-1); },
        onFocus: function () { open[1](true); if (wrapOn) focused[1](true); }, onBlur: function (e) { if (wrapOn) focused[1](false); settle(e); }, onKeyDown: onKey
      }),
      showWhole ? h('span', { className: 'r1-combo__whole', 'aria-hidden': 'true' }, sel.label) : null,
      p.name ? (multi ? values.map(function (v) { return h('input', { key: v, type: 'hidden', name: p.name, value: v }); })
        : h('input', { type: 'hidden', name: p.name, value: isNil(vs[0]) ? '' : vs[0] })) : null,
      countMode && picked.length ? h('span', { className: 'r1-combo__end' },
        h('span', { id: id + '-count', className: 'r1-combo__count r1-num' }, countText),
        p.disabled ? null : h('button', { type: 'button', className: 'r1-combo__clear', 'aria-label': t.combo.clearAll, onClick: function (e) { setValues([], e); announce(t.combo.count.replace('{n}', '0')); focusEl(inputRef.current); } }, h(Icon, { name: 'x', size: size }))) : null,
      h(Icon, { name: 'chevron-down', size: size, className: 'r1-select__chev' }),
      list);
    var chips = multi && !countMode && picked.length ? h('ul', { ref: chipsRef, className: 'r1-combo__chips', 'aria-label': t.combo.chosen },
      picked.map(function (o, i) {
        return h('li', { key: o.value }, h('button', {
          type: 'button', className: 'r1-chip r1-combo__chip', disabled: p.disabled, 'aria-label': t.combo.remove.replace('{label}', o.label),
          onClick: function (e) { refocus.current = i; toggle(o, e); }
        }, h('span', null, o.label), h(Icon, { name: 'x', size: 16 })));
      }),
      picked.length > 1 && !p.disabled ? h('li', { key: '*' }, h('button', {
        type: 'button', className: 'r1-combo__clearall', onClick: function (e) { setValues([], e); announce(t.combo.count.replace('{n}', '0')); focusEl(inputRef.current); }
      }, t.combo.clearAll)) : null) : null;
    return fieldShell(sizedField(p), id, h('div', { className: 'r1-field__control', style: p.width ? { maxWidth: p.width } : undefined }, control, chips), chosenDetail);
  }

  // ------------------------------------------------------------------ dates

  function ymd(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  function ymdKey(o) { return o.y + '-' + (o.m < 10 ? '0' : '') + o.m + '-' + (o.d < 10 ? '0' : '') + o.d; }
  function daysIn(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function addDays(k, n) { var o = ymd(k); var d = new Date(Date.UTC(o.y, o.m - 1, o.d + n)); return ymdKey({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }); }
  function addMonths(k, n) { var o = ymd(k); var d = new Date(Date.UTC(o.y, o.m - 1 + n, 1)); var y = d.getUTCFullYear(), m = d.getUTCMonth() + 1; return ymdKey({ y: y, m: m, d: Math.min(o.d, daysIn(y, m)) }); }
  function weekday(k) { return (new Date(k + 'T00:00:00Z').getUTCDay() + 6) % 7; }

  // One month, weeks from Monday. Days outside min and max cannot be picked; a range tints the days between.
  // One day is the tab stop: the focused day, else the chosen day, else today, else the first day that can
  // be picked. Arrows move by a day or a week and cross into the next month; Page Up and Page Down move by a
  // month; Home and End go to the start and end of the week.
  function Calendar(p) {
    var t = tx(p.locale).date;
    var first = p.month ? p.month + '-01' : ymd(p.value) ? p.value : ymd(p.today) ? p.today : '2026-01-01';
    var ms = useSynced(p.month, first.slice(0, 7));
    var month = ms[0];
    var fk = useState(null);
    var gridRef = useRef(null);
    var pending = useRef(null);
    var base = ymd(month + '-01');
    var y = base.y, m = base.m;
    var lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    var n = daysIn(y, m);
    var from = p.value || '', to = p.to || '';
    var cells = [];
    for (var i = 0; i < lead; i++) cells.push(null);
    for (var d = 1; d <= n; d++) cells.push(ymdKey({ y: y, m: m, d: d }));
    while (cells.length % 7) cells.push(null);
    var weeks = [];
    for (var w = 0; w < cells.length; w += 7) weeks.push(cells.slice(w, w + 7));
    var title = dtf(p.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
    title = title.charAt(0).toUpperCase() + title.slice(1);
    var heads = lang(p.locale) === 'en' ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    function allowed(k) { return !((p.min && k < p.min) || (p.max && k > p.max)); }
    function inMonth(k) { return !!k && String(k).slice(0, 7) === month; }
    var firstOk = null;
    for (var dd = 1; dd <= n && !firstOk; dd++) { var kk = ymdKey({ y: y, m: m, d: dd }); if (allowed(kk)) firstOk = kk; }
    var stop = [fk[0], p.value, p.today].filter(function (k) { return inMonth(k) && allowed(k); })[0] || firstOk;
    function goMonth(mk) { ms[1](mk); if (p.onMonthChange) p.onMonthChange(mk); }
    useEffect(function () {
      if (!pending.current || !gridRef.current) return;
      var b = gridRef.current.querySelector('[data-day="' + pending.current + '"]');
      pending.current = null;
      focusEl(b);
    });
    function onKey(e) {
      var at = document.activeElement && document.activeElement.getAttribute('data-day');
      if (!at) return;
      var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      var next = step ? addDays(at, step) : e.key === 'PageUp' ? addMonths(at, -1) : e.key === 'PageDown' ? addMonths(at, 1)
        : e.key === 'Home' ? addDays(at, -weekday(at)) : e.key === 'End' ? addDays(at, 6 - weekday(at)) : null;
      if (!next) return;
      e.preventDefault();
      if (!allowed(next)) return;
      fk[1](next);
      pending.current = next;
      if (next.slice(0, 7) !== month) goMonth(next.slice(0, 7));
    }
    // On the premises portal every day and both month buttons are 44 px targets or more.
    var touch = p.density === 'premises';
    return h('div', { className: cx('r1-cal', touch && 'r1-cal--premises', p.className), role: 'group', 'aria-label': title, style: p.style },
      h('div', { className: 'r1-cal__head' },
        h(Button, { variant: 'quiet', size: touch ? 'md' : 'sm', iconOnly: true, icon: 'chevron-left', 'aria-label': t.prevMonth, onClick: function () { goMonth(addMonths(month + '-01', -1).slice(0, 7)); if (p.onPrevMonth) p.onPrevMonth(); }, locale: p.locale }),
        h('span', { className: 'r1-cal__title', 'aria-live': 'polite' }, title),
        h(Button, { variant: 'quiet', size: touch ? 'md' : 'sm', iconOnly: true, icon: 'chevron-right', 'aria-label': t.nextMonth, onClick: function () { goMonth(addMonths(month + '-01', 1).slice(0, 7)); if (p.onNextMonth) p.onNextMonth(); }, locale: p.locale })),
      h('table', { ref: gridRef, className: 'r1-cal__grid', onKeyDown: onKey },
        h('thead', null, h('tr', null, heads.map(function (x) { return h('th', { key: x, scope: 'col' }, x); }))),
        h('tbody', null, weeks.map(function (wk, wi) {
          return h('tr', { key: wi }, wk.map(function (k, di) {
            if (!k) return h('td', { key: di });
            var off = !allowed(k);
            var start = k === from, end = to && k === to, inside = to && from && k > from && k < to;
            var label = formatDate(k, p.locale);
            return h('td', { key: di, className: cx(inside && 'r1-cal__in', (start && to) && 'r1-cal__from', end && 'r1-cal__to') },
              h('button', {
                type: 'button', className: cx('r1-cal__day', (start || end) && 'r1-cal__day--on', k === p.today && 'r1-cal__day--today'),
                disabled: off, 'aria-pressed': start || end ? 'true' : 'false', 'aria-label': label + (k === p.today ? ', ' + t.today : ''), 'data-day': k,
                tabIndex: k === stop ? 0 : -1, onClick: function () { fk[1](k); if (p.onPick) p.onPick(k); }
              }, String(+k.slice(8))));
          }));
        }))));
  }

  function dmy(v) { var o = ymd(v); return o ? pad2(o.d) + '/' + pad2(o.m) + '/' + o.y : ''; }
  // Day/month/year as people type it: 3/10/2026, 03.10.2026, 03-10-2026, or 03102026 from a number pad.
  function parseDmy(s) {
    var str = String(isNil(s) ? '' : s).trim();
    var m = /^(\d{1,2})\s*[\/.\-\s]\s*(\d{1,2})\s*[\/.\-\s]\s*(\d{4})$/.exec(str) || /^(\d{2})(\d{2})(\d{4})$/.exec(str);
    if (!m) return null;
    var d = +m[1], mo = +m[2], y = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > daysIn(y, mo)) return null;
    return ymdKey({ y: y, m: mo, d: d });
  }

  // A date typed as day/month/year or picked. range=true asks for a start and an end in one group.
  // onChange gets 'YYYY-MM-DD' (or { from, to } for a range) once the text is a whole date, and null when emptied.
  // withTime adds a time on the 24-hour clock in the same group, with one label and one helper, and the zone
  // stated once beside the time. Everything is Vietnam time (+07:00, no daylight saving): onChange then gets
  // 'YYYY-MM-DDTHH:MM+07:00' once both parts are whole, else null.
  function DateField(p) {
    var t = tx(p.locale);
    var id = useUid('r1-df');
    var open = useState(!!p.open);
    var from = useSynced(isNil(p.value) ? p.value : String(p.value).slice(0, 10), null);
    var timeText = useSynced(p.time || (/T(\d{2}:\d{2})/.exec(String(p.value || '')) || [])[1], '');
    var withTime = !!p.withTime && !p.range;
    var step = p.step > 1 ? Math.round(p.step) : 0;
    var to = useSynced(p.to, null);
    var textA = useSynced(isNil(p.value) ? undefined : dmy(p.value), '');
    var textB = useSynced(isNil(p.to) ? undefined : dmy(p.to), '');
    var month = useSynced(p.month, String(from[0] || p.today || '2026-01-01').slice(0, 7));
    var side = useRef('a');
    var byReader = useRef(false);
    var rootRef = useRef(null);
    var latest = useLatest(p);
    var isOpen = open[0] && !p.disabled && !p.readOnly;
    useEffect(function () {
      if (!isOpen || !byReader.current) return undefined;
      function onDown(e) { if (rootRef.current && !rootRef.current.contains(e.target)) open[1](false); }
      document.addEventListener('mousedown', onDown);
      return function () { document.removeEventListener('mousedown', onDown); };
    }, [isOpen]);
    function emit(a, b, e) {
      var q = latest.current;
      if (!q.onChange) return;
      if (q.range) q.onChange({ from: a, to: b }, e);
      else if (withTime) emitAt(a, parseTime(timeText[0]), e);
      else q.onChange(a, e);
    }
    function emitAt(dk, tv, e) {
      var q = latest.current;
      if (q.onChange) q.onChange(dk && tv ? dk + 'T' + tv + '+07:00' : null, e);
    }
    var dtHelp = withTime ? Object.assign({}, p, { helper: p.helper === false ? null : (p.helper || (step ? t.date.helpDateTimeStep.replace('{n}', String(step)) : t.date.helpDateTime)) }) : p;
    function close(focusSel) { open[1](false); if (rootRef.current) focusEl(rootRef.current.querySelector(focusSel)); }
    function pick(k) {
      if (p.onPick) p.onPick(k);
      if (!p.range) { from[1](k); textA[1](dmy(k)); emit(k, null); close('#' + id + '-a'); return; }
      if (side.current === 'a' || !from[0] || k < from[0]) {
        from[1](k); textA[1](dmy(k));
        if (to[0] && k > to[0]) { to[1](null); textB[1](''); }
        side.current = 'b';
        emit(k, to[0] && k <= to[0] ? to[0] : null);
        return;
      }
      to[1](k); textB[1](dmy(k)); side.current = 'a'; emit(from[0], k); close('#' + id + '-b');
    }
    function typed(which, v, e) {
      var k = parseDmy(v);
      if (which === 'a') { textA[1](v); if (k || !v.trim()) { from[1](k); if (k) month[1](k.slice(0, 7)); emit(k, to[0], e); } }
      else { textB[1](v); if (k || !v.trim()) { to[1](k); emit(from[0], k, e); } }
    }
    function input(which, label) {
      var iid = id + '-' + which;
      return h('div', { className: 'r1-datef__part' },
        label ? h('label', { className: 'r1-datef__sublabel', htmlFor: iid }, label) : null,
        h('div', { className: 'r1-datef__box' },
          h('input', {
            id: iid, name: p.name && !withTime ? (p.range ? p.name + (which === 'a' ? '-from' : '-to') : p.name) : undefined,
            type: 'text', inputMode: 'numeric', className: 'r1-input r1-datef__input', value: which === 'a' ? textA[0] : textB[0],
            // A range may say something else in its end box ("Không thời hạn" for an open end): toPlaceholder.
            placeholder: (which === 'b' && p.toPlaceholder) || p.placeholder || t.date.placeholder, disabled: p.disabled, required: p.required, autoComplete: 'off',
            'aria-invalid': p.error ? 'true' : undefined, 'aria-describedby': describedBy(dtHelp, p.range || withTime ? id : id + '-a'),
            onChange: function (e) { typed(which, e.target.value, e); }, onBlur: p.onBlur
          }),
          h('button', {
            type: 'button', className: 'r1-datef__pick', disabled: p.disabled, 'data-side': which,
            'aria-label': t.date.choose + ': ' + (label || textOf(p.label)),
            'aria-expanded': isOpen ? 'true' : 'false', 'aria-controls': id + '-cal',
            onClick: function () { side.current = which; byReader.current = true; open[1](!open[0]); }
          }, h(Icon, { name: 'calendar', size: fieldIconSize(p) }))));
    }
    var cal = isOpen ? h('div', {
      id: id + '-cal', className: 'r1-datef__pop',
      onKeyDown: function (e) { if (e.key === 'Escape') { e.preventDefault(); close('[data-side="' + side.current + '"]'); } }
    }, h(Calendar, { value: from[0], to: p.range ? to[0] : null, month: month[0], onMonthChange: month[1], today: p.today, min: p.min, max: p.max, onPick: pick, density: p.density, locale: p.locale })) : null;
    var tv = parseTime(timeText[0]);
    if (p.readOnly) {
      var shown = p.range ? formatPeriod(p.value, p.to, p.locale)
        : withTime && from[0] && tv ? formatTimestamp(from[0] + 'T' + tv + ':00+07:00', p.locale) : formatDate(from[0], p.locale);
      return fieldShell(p, id, h('div', { className: 'r1-field__control' }, readOnlyBox(p, id, shown || '–')));
    }
    if (withTime) {
      var tid = id + '-t';
      var zone = offsetLabel(new Date());
      return h('div', { role: 'group', 'aria-labelledby': id + '-label', className: cx('r1-field r1-datef-range r1-datef-dt', 'r1-field--' + (p.density || 'portal'), p.error && 'r1-field--error', p.className), style: p.style },
        h('div', { className: 'r1-field__head' },
          h('span', { id: id + '-label', className: 'r1-field__label' }, p.label),
          p.required ? h('span', { className: 'r1-field__req' }, t.required) : null),
        dtHelp.helper ? h('div', { id: id + '-help', className: 'r1-field__help' }, dtHelp.helper) : null,
        h('div', { ref: rootRef, className: 'r1-datef r1-datef--range' },
          input('a', p.dateLabel || t.date.day),
          h('div', { className: 'r1-datef__part r1-datef__part--time' },
            h('label', { id: tid + '-lbl', className: 'r1-datef__sublabel', htmlFor: tid }, p.timeLabel || t.date.time),
            h('div', { className: 'r1-datef__timebox' },
              h('div', { className: 'r1-time' },
                h(Icon, { name: 'clock', size: fieldIconSize(p), className: 'r1-time__icon' }),
                h('input', {
                  id: tid, type: 'text', inputMode: 'numeric', className: 'r1-input r1-num r1-time__input', value: timeText[0], placeholder: 'hh:mm', maxLength: 5,
                  disabled: p.disabled, required: p.required, autoComplete: 'off', 'aria-invalid': p.error ? 'true' : undefined,
                  // The zone is part of the time's name: "Giờ GMT+7".
                  'aria-labelledby': tid + '-lbl ' + tid + '-zone', 'aria-describedby': describedBy(dtHelp, id),
                  onChange: function (e) { timeText[1](e.target.value); emitAt(from[0], parseTime(e.target.value), e); },
                  onBlur: function (e) {
                    var v = parseTime(timeText[0]);
                    var sn = snapTime(v, step, false);
                    if (sn && sn !== v) { announce(t.time.rounded.replace('{t}', sn)); timeText[1](sn); emitAt(from[0], sn, e); }
                    else if (v) timeText[1](v);
                    if (p.onBlur) p.onBlur(e);
                  }
                })),
              h('span', { id: tid + '-zone', className: 'r1-datef__zone' }, zone))),
          cal),
        p.name ? h('input', { type: 'hidden', name: p.name, value: from[0] && tv ? from[0] + 'T' + tv + '+07:00' : '' }) : null,
        p.error ? h(FieldMessage, { id: id + '-msg', severity: 'error', locale: p.locale }, p.error) : null,
        p.disabled && p.disabledReason ? h('div', { id: id + '-why', className: 'r1-field__reason' }, h(Icon, { name: 'info', size: 16 }), h('span', null, p.disabledReason)) : null);
    }
    if (!p.range) return fieldShell(p, id + '-a', h('div', { ref: rootRef, className: 'r1-field__control r1-datef', style: p.width ? { maxWidth: p.width } : undefined }, input('a'), cal));
    // A range is one group named by its label; the required mark sits beside the label, outside the name, as on
    // every other field, and each input carries required itself.
    return h('div', { role: 'group', 'aria-labelledby': id + '-label', className: cx('r1-field r1-datef-range', 'r1-field--' + (p.density || 'portal'), p.error && 'r1-field--error', p.className), style: p.style },
      h('div', { className: 'r1-field__head' },
        h('span', { id: id + '-label', className: 'r1-field__label' }, p.label),
        p.required ? h('span', { className: 'r1-field__req' }, t.required) : null),
      p.helper ? h('div', { id: id + '-help', className: 'r1-field__help' }, p.helper) : null,
      h('div', { ref: rootRef, className: 'r1-datef r1-datef--range' }, input('a', p.fromLabel || t.date.from), input('b', p.toLabel || t.date.to), cal),
      p.error ? h(FieldMessage, { id: id + '-msg', severity: 'error', locale: p.locale }, p.error) : null,
      p.disabled && p.disabledReason ? h('div', { id: id + '-why', className: 'r1-field__reason' }, h(Icon, { name: 'info', size: 16 }), h('span', null, p.disabledReason)) : null);
  }

  // A password with a way to see it, and, for a new one, the rules it must meet.
  function PasswordField(p) {
    var t = tx(p.locale);
    var id = useUid('r1-pw');
    var shown = useState(!!p.revealed);
    var pv = useSynced(isNil(p.value) ? '' : String(p.value), '');
    var rules = p.rules || [];
    var describe = [describedBy(p, id), rules.length ? id + '-rules' : null].filter(Boolean).join(' ') || undefined;
    var control = h('div', { className: 'r1-pw' },
      h('input', {
        id: id, name: p.name, type: shown[0] ? 'text' : 'password', className: 'r1-input r1-pw__input', value: pv[0], spellCheck: false,
        autoComplete: p.autoComplete || 'current-password', required: p.required, disabled: p.disabled,
        onChange: function (e) { pv[1](e.target.value); if (p.onChange) p.onChange(e.target.value, e); }, onBlur: p.onBlur,
        'aria-invalid': p.error ? 'true' : undefined, 'aria-describedby': describe
      }),
      h('button', {
        // The name says what a press will do, and the new state is said once: a pressed state on top of a
        // changing name would say it twice.
        type: 'button', className: 'r1-pw__toggle', 'aria-controls': id, disabled: p.disabled,
        'aria-label': shown[0] ? t.password.hide : t.password.show, onClick: function () { announce(shown[0] ? t.password.hidden : t.password.visible); shown[1](!shown[0]); }
      }, h(Icon, { name: shown[0] ? 'eye-off' : 'eye', size: fieldIconSize(p) }), h('span', { 'aria-hidden': 'true' }, shown[0] ? t.password.hideShort : t.password.showShort)));
    var list = rules.length ? h('ul', { id: id + '-rules', className: 'r1-pw__rules' }, rules.map(function (r, i) {
      return h('li', { key: i, className: cx('r1-pw__rule', r.met && 'r1-pw__rule--met') },
        h(StatusIcon, { family: r.met ? 'positive' : 'neutral', size: 16, cutout: 'surface' }),
        h('span', null, r.text), h('span', { className: 'r1-sr' }, ', ' + (r.met ? t.password.met : t.password.notMet)));
    })) : null;
    return fieldShell(p, id, h('div', { className: 'r1-field__control', style: p.width ? { maxWidth: p.width } : undefined }, control), list);
  }

  // ------------------------------------------------------------ amounts

  // How an amount is reached, line by line: what each line is, its basis, the rule it comes from, and the total.
  function Breakdown(p) {
    var t = tx(p.locale).breakdown;
    var id = useUid('r1-bd');
    var lines = p.lines || [];
    var cur = p.currency || 'VND';
    // A reduction and a negative amount take the minus sign U+2212 from formatMoney, as every value component does.
    function amount(ln) {
      var v = ln.amountMinor;
      if (isNil(v) || typeof v !== 'number' || isNaN(v)) return missingValue(ln.missing, tx(p.locale).notCalculated);
      return formatMoney(ln.kind === 'subtract' ? -Math.abs(v) : v, cur, p.locale);
    }
    return h('section', { className: cx('r1-breakdown', p.className), 'aria-labelledby': id, style: p.style },
      h('div', { className: 'r1-breakdown__head' },
        h(p.level === 3 ? 'h3' : 'h2', { id: id, className: 'r1-breakdown__title' }, p.title),
        p.indicative ? h(StatusBadge, { family: 'attention', label: t.indicative, size: 'sm' }) : null),
      p.description ? h('p', { className: 'r1-breakdown__desc' }, p.description) : null,
      h('table', { className: 'r1-breakdown__table' },
        h('caption', { className: 'r1-sr' }, p.title),
        h('thead', { className: 'r1-sr' }, h('tr', null, h('th', { scope: 'col' }, t.item), h('th', { scope: 'col' }, t.basis), h('th', { scope: 'col' }, t.amount))),
        h('tbody', null, lines.map(function (ln, i) {
          return h('tr', { key: i, className: cx('r1-breakdown__row', 'r1-breakdown__row--' + (ln.kind || 'line')) },
            h('th', { scope: 'row' },
              h('span', { className: 'r1-breakdown__label' }, ln.label),
              ln.detail ? h('span', { className: 'r1-breakdown__detail' }, ln.detail) : null,
              ln.source ? h('span', { className: 'r1-breakdown__source' }, h(Icon, { name: 'scale', size: 16 }), h('span', null, ln.source)) : null),
            h('td', { className: 'r1-breakdown__basis r1-num' }, ln.basis || ''),
            h('td', { className: 'r1-breakdown__amount r1-num' }, amount(ln)));
        }))),
      p.note ? h('p', { className: 'r1-breakdown__note' }, p.note) : null);
  }

  // A figure and what kind of figure it is: observed, derived from others, a real zero, or no data yet.
  function formatMetric(p) {
    var v = p.value;
    if (p.kind === 'money') return formatMoney(v, p.currency, p.locale);
    if (p.kind === 'percent') return formatPercent(v, p.locale, { decimals: p.decimals });
    return formatCount(v, p.locale);
  }
  function MetricValue(p) {
    var t = tx(p.locale).metric;
    var state = p.state || 'observed';
    var none = state === 'no-data' || isNil(p.value);
    var words = !isNil(p.missing) && p.missing !== '' ? p.missing : null;
    var low = p.interval ? Object.assign({}, p, { value: p.interval[0] }) : null, high = p.interval ? Object.assign({}, p, { value: p.interval[1] }) : null;
    return h('div', { className: cx('r1-metric', 'r1-metric--' + (p.size || 'md'), 'r1-metric--' + (none ? 'no-data' : state), p.className), style: p.style },
      h('span', { className: 'r1-metric__label' }, p.label),
      h('span', { className: 'r1-metric__line' },
        // No data: a dash read as "No data yet" when a note follows it; without a note the note line says it.
        // missing: the page's words in place of the dash ("Không đọc được"), as MoneyValue and CountValue write them.
        none ? (words ? h('span', { className: 'r1-metric__value r1-metric__value--none r1-metric__value--words' }, words)
          : h('span', { className: 'r1-metric__value r1-metric__value--none' }, h('span', { 'aria-hidden': 'true' }, '–'), p.note ? h('span', { className: 'r1-sr' }, t.noData) : null))
          : h('span', { className: 'r1-metric__value r1-num' }, formatMetric(p)),
        !none && p.unit ? h('span', { className: 'r1-metric__unit' }, p.unit) : null),
      !none && p.interval ? h('span', { className: 'r1-metric__interval r1-num' }, t.interval + ' ' + (p.kind === 'percent'
        ? percentDigits(p.interval[0], p.locale, p.decimals) + '–' + formatMetric(high)
        : formatMetric(low) + '–' + formatMetric(high))) : null,
      none && (p.note || !words) ? h('span', { className: 'r1-metric__note' }, p.note || t.noData) : null,
      // A derived figure says what it was worked out from, beside the route shape of the derived provenance;
      // with no basis on record it says it was worked out, and never leaves "Worked out from" hanging.
      !none && state === 'derived' ? h('span', { className: 'r1-metric__note r1-metric__note--derived' }, h(Icon, { name: 'route', size: 16 }), h('span', null, p.basis ? t.derived + ' ' + p.basis : t.derivedNoBasis)) : null,
      !none && p.note ? h('span', { className: 'r1-metric__note' }, p.note) : null,
      p.freshness ? h(FreshnessLine, Object.assign({ locale: p.locale }, p.freshness)) : null);
  }

  // ------------------------------------------------------------ time limits

  function formatDuration(ms, locale) {
    var u = tx(locale).units;
    var mins = Math.max(1, Math.round(Math.abs(ms) / 60000));
    var d = Math.floor(mins / 1440), hr = Math.floor((mins % 1440) / 60), mn = mins % 60;
    function part(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
    if (d) return part(d, u.day, u.days) + (hr ? ' ' + part(hr, u.hour, u.hours) : '');
    if (hr) return part(hr, u.hour, u.hours) + (mn ? ' ' + part(mn, u.minute, u.minutes) : '');
    return part(mn, u.minute, u.minutes);
  }
  var DEADLINE_FAMILY = { 'on-track': 'neutral', soon: 'attention', overdue: 'danger', met: 'positive', late: 'attention', paused: 'info', none: 'neutral' };
  // Time left to a deadline, in words and a shape, with the deadline itself. Colour is never the only signal.
  // No due date: "No deadline set", never a countdown. Without a fixed now it ticks once a minute. The small size
  // keeps the deadline on a second line, not only in a tooltip.
  function DeadlineClock(p) {
    var t = tx(p.locale).deadline;
    var tick = useState(0);
    useEffect(function () {
      if (p.now) return undefined;
      var timer = setInterval(function () { tick[1](function (n) { return n + 1; }); }, 60000);
      return function () { clearInterval(timer); };
    }, [!!p.now]);
    var due = toDate(p.due), now = toDate(p.now) || new Date(), met = toDate(p.metAt);
    var left = due ? due - now : 0;
    var state = !due ? 'none' : met ? (met > due ? 'late' : 'met') : p.paused ? 'paused' : left < 0 ? 'overdue' : left <= (p.soonHours || 24) * 3600000 ? 'soon' : 'on-track';
    // announceAt (minutes, [30, 5]): each mark is said once through the polite live region as the time left reaches it.
    // Marks already passed when the clock appears are not said: nothing drawn with the page is announced on load.
    // A clock that is done, paused or past due says nothing. Without a fixed now the clock ticks once a minute.
    var marks = (Array.isArray(p.announceAt) ? p.announceAt : isNil(p.announceAt) ? [] : [p.announceAt]).map(Number).filter(function (m) { return m > 0; });
    var said = useRef(null);
    var dueKey = due ? due.getTime() : 0;
    useEffect(function () {
      if (!marks.length) return;
      var counting = state === 'soon' || state === 'on-track';
      if (!said.current || said.current.due !== dueKey) {
        said.current = { due: dueKey, done: {} };
        marks.forEach(function (m) { if (!counting || left <= m * 60000) said.current.done[m] = true; });
        return;
      }
      if (!counting) return;
      var reached = marks.filter(function (m) { return !said.current.done[m] && left <= m * 60000; });
      if (!reached.length) return;
      reached.forEach(function (m) { said.current.done[m] = true; });
      var d = formatDuration(left, p.locale);
      announce(p.label ? t.announce.replace('{label}', textOf(p.label)).replace('{d}', d) : t.announceBare.replace('{d}', d), 'polite');
    });
    var main = state === 'none' ? t.none : state === 'met' ? t.met : state === 'late' ? t.late.replace('{d}', formatDuration(met - due, p.locale))
      : state === 'paused' ? t.paused : (state === 'overdue' ? t.overdue : t.left).replace('{d}', formatDuration(left, p.locale));
    var start = toDate(p.start);
    var pct = start && due && !met ? Math.max(0, Math.min(100, Math.round(((now - start) / (due - start)) * 100))) : null;
    var fam = DEADLINE_FAMILY[state];
    if (p.size === 'sm') {
      return h('span', { className: cx('r1-deadline r1-deadline--sm', 'r1-deadline--' + state, p.className), style: p.style },
        h('span', { className: 'r1-deadline__main' }, h(StatusIcon, { family: fam, size: 16, cutout: 'surface' }), h('span', null, main)),
        due ? h('time', { className: 'r1-deadline__due', dateTime: due.toISOString(), title: t.due + ' ' + formatTimestamp(due, p.locale) }, t.due + ' ' + formatStamp(due, p.locale)) : null);
    }
    return h('div', { className: cx('r1-deadline', 'r1-deadline--' + state, p.className), role: 'group', 'aria-label': p.label, style: p.style },
      p.label ? h('span', { className: 'r1-deadline__label' }, p.label) : null,
      h('span', { className: 'r1-deadline__main' }, h(StatusIcon, { family: fam, size: 20, cutout: 'surface' }), h('span', null, main)),
      state === 'paused' && p.pausedReason ? h('span', { className: 'r1-deadline__why' }, p.pausedReason) : null,
      pct !== null && state !== 'paused' ? h('span', { className: 'r1-deadline__bar', 'aria-hidden': 'true' }, h('span', { className: 'r1-deadline__fill', style: { width: pct + '%' } })) : null,
      due || met ? h('span', { className: 'r1-deadline__due' }, (met ? t.doneAt + ' ' + formatTimestamp(met, p.locale) + (due ? '. ' : '') : '') + (due ? t.due + ' ' + formatTimestamp(due, p.locale) : '')) : null);
  }

  // ------------------------------------------------------- repeated fields

  // A group of rows the reader adds to and removes from. Each FieldRow names itself, so "Xoá" says which row.
  // After the reader adds a row, focus goes to its first field; after a remove, to the add button. Both are said.
  function FieldRows(p) {
    var t = tx(p.locale);
    var id = useUid('r1-rows');
    var root = useRef(null);
    var acted = useRef(null);
    // count: how many rows there are, when the rows are rendered by a template and cannot be counted here
    var n = isNil(p.count) ? React.Children.toArray(p.children).length : p.count;
    var before = useRef(n);
    useEffect(function () {
      var was = before.current, why = acted.current;
      before.current = n; acted.current = null;
      if (!root.current || !why || n === was) return;
      if (n > was) {
        var rows = root.current.querySelectorAll('.r1-rows__list .r1-frow');
        var last = rows[rows.length - 1];
        if (!last) return;
        focusEl(focusables(last.querySelector('.r1-frow__fields'))[0]);
        var title = last.querySelector('.r1-frow__title');
        announce(t.rows.added.replace('{title}', title ? title.textContent : ''), 'polite');
      } else {
        focusEl(focusables(root.current.querySelector('.r1-rows__foot'))[0]);
        announce(t.rows.removed.replace('{n}', n), 'polite');
      }
    }, [n]);
    var full = p.max && n >= p.max;
    var size = p.density === 'console' ? 'sm' : 'md';
    return h('fieldset', { ref: root, className: cx('r1-rows', 'r1-rows--' + (p.density || 'portal'), p.error && 'r1-rows--error', p.className), style: p.style, 'aria-describedby': [p.helper && id + '-help', p.error && id + '-msg'].filter(Boolean).join(' ') || undefined },
      h('legend', { className: 'r1-rows__legend' }, p.legend, p.required ? h('span', { className: 'r1-field__req' }, t.required) : null),
      p.helper ? h('p', { id: id + '-help', className: 'r1-field__help' }, p.helper) : null,
      h('div', { className: 'r1-rows__list', onClickCapture: function (e) { if (e.target.closest && e.target.closest('.r1-frow__head .r1-btn')) acted.current = 'remove'; } }, p.children),
      h('div', { className: 'r1-rows__foot' },
        h(Button, { variant: 'secondary', size: size, icon: 'plus', disabled: !!full, disabledReason: full ? t.rows.max.replace('{n}', p.max) : undefined, onClick: function (e) { acted.current = 'add'; if (p.onAdd) p.onAdd(e); }, locale: p.locale }, p.addLabel || t.rows.add),
        p.max && !full ? h('span', { className: 'r1-rows__count' }, t.rows.count.replace('{n}', n).replace('{max}', p.max)) : null),
      p.error ? h(FieldMessage, { id: id + '-msg', severity: 'error', locale: p.locale }, p.error) : null);
  }
  // Its fields sit in 2 to 4 columns and fold to two, then one, as the row narrows (at 640 and 448 px).
  function FieldRow(p) {
    var t = tx(p.locale);
    var id = useUid('r1-row');
    return h('div', { className: cx('r1-frow', p.className), role: 'group', 'aria-labelledby': id, style: p.style },
      h('div', { className: 'r1-frow__head' },
        h('span', { id: id, className: 'r1-frow__title' }, p.title),
        p.removable === false ? null : h(Button, { variant: 'quiet', size: p.density === 'premises' || p.density === 'portal' ? 'md' : 'sm', icon: 'x', onClick: p.onRemove, 'aria-label': t.rows.remove + ': ' + p.title, locale: p.locale }, t.rows.removeShort)),
      h('div', { className: cx('r1-frow__fields', p.columns && 'r1-frow__fields--' + p.columns) }, p.children));
  }

  // ------------------------------------------------------------ media

  // A short listen to a track in a portal: play, where it is, how long it is. Not the Player.
  // With src it plays the file; without, it is driven by the page through playing and elapsed.
  // onToggle(playing) and onSeek(seconds, event) report what the reader did.
  function AudioPreview(p) {
    var t = tx(p.locale).audio;
    var playing = useSynced(isNil(p.playing) ? undefined : !!p.playing, false);
    var pos = useSynced(p.elapsed, 0);
    var len = useSynced(p.duration, 0);
    var fl = useState(false);
    var audioRef = useRef(null);
    var dur = len[0] || 0, el = Math.min(pos[0] || 0, dur);
    var pct = dur ? Math.round((el / dur) * 1000) / 10 : 0;
    // A file that will not play says so under the title, and the button stays to try again. error: the page's own
    // playback failure (true for the standard sentence, or its own sentence).
    var errorText = fl[0] ? t.failed : p.error ? (typeof p.error === 'string' ? p.error : t.failed) : null;
    function failed() { playing[1](false); fl[1](true); announce(t.failed); if (p.onToggle) p.onToggle(false); }
    function toggle() {
      var next = !playing[0];
      playing[1](next);
      fl[1](false);
      var a = audioRef.current;
      if (a) { if (next) { var r = a.play(); if (r && r.catch) r.catch(failed); } else a.pause(); }
      if (p.onToggle) p.onToggle(next);
    }
    function seek(e) {
      var v = Number(e.target.value);
      pos[1](v);
      if (audioRef.current) audioRef.current.currentTime = v;
      if (p.onSeek) p.onSeek(v, e);
    }
    if (p.unavailable) {
      return h('div', { className: cx('r1-audio r1-audio--off', p.className), style: p.style },
        h('span', { className: 'r1-audio__play r1-audio__play--off', 'aria-hidden': 'true' }, h(Icon, { name: 'music', size: 16 })),
        h('div', { className: 'r1-audio__body' },
          h('div', { className: 'r1-audio__line' }, h('span', { className: 'r1-audio__title' }, p.title), p.by ? h('span', { className: 'r1-audio__by' }, p.by) : null),
          h('span', { className: 'r1-audio__clip' }, typeof p.unavailable === 'string' ? p.unavailable : t.unavailable)));
    }
    return h('div', { className: cx('r1-audio', playing[0] && 'r1-audio--playing', errorText && 'r1-audio--failed', p.className), role: 'group', 'aria-label': t.label + ': ' + p.title, style: p.style },
      p.src ? h('audio', {
        ref: audioRef, src: p.src, preload: 'metadata',
        onLoadedMetadata: function (e) { if (isFinite(e.target.duration)) len[1](e.target.duration); },
        onTimeUpdate: function (e) { pos[1](e.target.currentTime); }, onEnded: function () { playing[1](false); if (p.onToggle) p.onToggle(false); },
        onError: failed
      }) : null,
      h('button', { type: 'button', className: 'r1-audio__play', 'aria-label': (playing[0] ? t.pause : t.play) + ': ' + p.title, 'aria-pressed': playing[0] ? 'true' : 'false', onClick: toggle },
        h(Icon, { name: playing[0] ? 'pause' : 'play', size: 16 })),
      h('div', { className: 'r1-audio__body' },
        h('div', { className: 'r1-audio__line' }, h('span', { className: 'r1-audio__title' }, p.title), p.by ? h('span', { className: 'r1-audio__by' }, p.by) : null),
        h('div', { className: 'r1-audio__track' },
          h('span', { className: 'r1-audio__bar', 'aria-hidden': 'true' }, h('span', { className: 'r1-audio__fill', style: { width: pct + '%' } })),
          h('input', { type: 'range', className: 'r1-audio__range', min: 0, max: dur, step: 1, value: Math.round(el), onChange: seek, 'aria-label': t.position, 'aria-valuetext': clockOf(el) + ' / ' + clockOf(dur) }),
          h('span', { className: 'r1-audio__time r1-num' }, clockOf(el) + ' / ' + clockOf(dur))),
        errorText ? h('span', { className: 'r1-audio__msg' }, errorText) : p.clip ? h('span', { className: 'r1-audio__clip' }, p.clip) : null));
  }

  // --------------------------------------------------- records and checks

  // A record laid out on an A4 sheet for printing and PDF, black on white only (Layout §7): the legal name of the
  // record, the issuer, the reference, the facts, and the verification route beside a code at least 30 mm wide.
  // variant 'entitlement' is the Player service entitlement: a visibly different layout and heading (C-UI-09).
  // The address a printed code opens: the route as printed, with https:// in front when it has no scheme.
  function verifyHref(u) { return !u ? null : /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : 'https://' + u; }
  // The printed route never breaks inside its reference: a route too long for its column breaks after its last slash
  // ("rightone.vn/v/" then "R1-CER-2026-T7QM4BWJ"), never at a hyphen of the reference.
  function routeText(u) {
    var s = String(u), at = s.lastIndexOf('/');
    if (at < 0 || at === s.length - 1) return s;
    return [s.slice(0, at + 1), h('wbr', { key: 'w' }), h('span', { key: 'r', className: 'r1-nowrap' }, s.slice(at + 1))];
  }
  function PrintableRecord(p) {
    var t = tx(p.locale).print;
    var ent = p.variant === 'entitlement';
    // The sheets are counted from the laid-out record: its height over one A4 sheet, margins taken off both.
    // page and pages, when passed, still win (a sheet that is part of a longer print run).
    var sheetRef = useRef(null);
    var counted = useState(1);
    useLayoutEffect(function () {
      var el = sheetRef.current;
      if (!el || typeof getComputedStyle === 'undefined') return;
      var cs = getComputedStyle(el), sheet = parseFloat(cs.minHeight) || 0, pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      var n = sheet > pad ? Math.max(1, Math.ceil((el.scrollHeight - pad - 1) / (sheet - pad))) : 1;
      if (n !== counted[0]) counted[1](n);
    });
    var pages = p.pages || counted[0], page = p.page || pages;
    var href = verifyHref(p.verifyUrl);
    // The entitlement never borrows the status record's words: its ID is a reference and the sheet is a document.
    // recordNoun names the record in the reference and the verification line ("Mã giấy xác nhận", "Kiểm tra giấy xác
    // nhận này tại"); without it the sheet names no document type ("Mã tham chiếu", "Kiểm tra mã này tại").
    var noun = !ent && p.recordNoun ? String(p.recordNoun) : null;
    var refLabel = ent ? t.refEnt : nounText(t.ref, t.refNoun, noun), verifyLabel = ent ? t.verifyEnt : nounText(t.verify, t.verifyNoun, noun);
    // The code is made from the verification route unless the page passes its modules.
    // codeLines ([{label, value}]): short lines printed with the code, under the reference (the printout reference, the
    // signing key), each value in monospace, so a failed scan can still be checked by hand.
    var lines = (p.codeLines || []).filter(function (l) { return l && !isNil(l.value) && l.value !== ''; });
    var hasCode = !!(p.qr || href);
    var code = hasCode || lines.length ? h('div', { className: 'r1-print__code' },
      hasCode ? h(QrCode, { modules: p.qr, value: p.qr ? undefined : href, size: 160, quiet: 4, label: verifyLabel + ' ' + (p.verifyUrl || ''), locale: p.locale }) : null,
      hasCode && p.recordId ? h('span', { className: 'r1-mono r1-print__code-id' }, p.recordId) : null,
      lines.length ? h('dl', { className: 'r1-print__code-lines' }, lines.map(function (l, i) {
        return h('div', { key: i, className: 'r1-print__code-line' }, l.label ? h('dt', null, l.label) : null, h('dd', { className: 'r1-mono' }, l.value));
      })) : null) : null;
    var verify = h('div', { className: 'r1-print__verify' },
      p.verifyUrl ? h('span', null, verifyLabel) : null,
      p.verifyUrl ? h('span', { className: 'r1-mono r1-print__url' }, routeText(p.verifyUrl)) : null,
      p.issued ? h('span', null, t.issued + ' ' + formatTimestamp(p.issued, p.locale)) : null);
    // statusAt: the instant the printed status was true, after the status words in the shared timestamp format
    // ("…: Đang có hiệu lực, lúc 19 thg 9, 2026, 08:30 (GMT+7)"); the instant keeps to one line. statusNote: the caveat
    // printed under it ("Tình trạng có thể đã thay đổi. …"). With either, the status is a block of the two.
    var at = p.status && p.statusAt ? formatTimestamp(p.statusAt, p.locale) : null;
    var pill = p.status ? h('p', { className: cx('r1-print__status', ent && 'r1-print__status--rect', at && 'r1-print__status--at') },
      // The entitlement's own state shape (a check in a circle while it is active); only the status record carries the seal.
      h(StatusIcon, { family: ent ? p.status.family || 'neutral' : 'seal', size: 24, cutout: 'code-paper' }),
      at ? h('span', null, p.status.label + ', ', h('span', { className: 'r1-print__status-at' }, t.statusAt + ' ' + at)) : h('span', null, p.status.label)) : null;
    var status = at || p.statusNote ? h('div', { className: 'r1-print__statusblock' }, pill,
      p.statusNote ? h('p', { className: 'r1-print__status-note' }, p.statusNote) : null) : pill;
    // statusPlacement 'after-facts' (a status record): the status block follows the facts, before the code, as the
    // record's reading order has it (title, reference and issuer, premises, period and scope, status, code).
    var late = !ent && p.statusPlacement === 'after-facts';
    var facts = p.facts ? h(FactList, { items: p.facts, columns: ent ? 1 : 2, locale: p.locale }) : null;
    var head = h('header', { className: 'r1-print__head' },
      h('span', { className: 'r1-print__issuer' }, p.issuer),
      p.recordId ? h('span', { className: 'r1-print__ref' }, h('span', null, refLabel), h('span', { className: 'r1-mono' }, p.recordId)) : null);
    var titles = h('div', { className: 'r1-print__titles' },
      h('h1', { className: 'r1-print__title' }, p.title),
      p.subtitle ? h('p', { className: 'r1-print__subtitle' }, p.subtitle) : null);
    var pageNo = h('span', { className: 'r1-print__page r1-num' }, t.page + ' ' + page + '/' + pages);
    if (ent) {
      return h('article', { ref: sheetRef, className: cx('r1-print r1-print--entitlement', p.fit && 'r1-print--fit', p.className), style: p.style, 'data-theme': 'light' },
        head,
        h('div', { className: 'r1-print__band' }, h('div', { className: 'r1-print__band-text' }, titles, status), code),
        facts,
        p.children ? h('div', { className: 'r1-print__body' }, p.children) : null,
        h('footer', { className: 'r1-print__foot' }, verify, pageNo));
    }
    return h('article', { ref: sheetRef, className: cx('r1-print', p.fit && 'r1-print--fit', p.className), style: p.style, 'data-theme': 'light' },
      head, titles, late ? null : status, facts, late ? status : null,
      p.children ? h('div', { className: 'r1-print__body' }, p.children) : null,
      h('footer', { className: 'r1-print__foot' }, code, verify, pageNo));
  }

  var VERIFY_FAMILY = { valid: 'seal', revoked: 'danger', expired: 'neutral', superseded: 'attention', 'not-found': 'neutral', unavailable: 'info', checking: 'info' };
  // danger (7 October 2026): a service suspended or revoked; attention: a record no longer current.
  var ANSWER_FAMILIES = ['positive', 'attention', 'neutral', 'danger'];
  // The answer to "is this record genuine and current?" on the public verification route.
  // result 'answer': a register's answer that is no verdict on a status record (an authority to collect, for one
  // premises at one moment). family is positive, attention or neutral, never the seal: the seal answers for a premises
  // status record only. title is the answer, in the verdict's type; recordedAt is written after recordedLabel, the
  // page's own words ("This read has been recorded. Asked at").
  function VerificationResult(p) {
    var t = tx(p.locale).verify;
    var r = p.result || 'valid';
    var checking = r === 'checking';
    var answer = r === 'answer';
    var fam = answer ? (ANSWER_FAMILIES.indexOf(p.family) >= 0 ? p.family : 'neutral') : null;
    // recordNoun names what the code stands for in every default verdict ("Giấy xác nhận hợp lệ…"); without it the
    // verdict speaks of the code ("Mã này hợp lệ…"). checkedLabel replaces "Kiểm tra lúc" / "Checked at".
    var noun = p.recordNoun ? String(p.recordNoun) : null;
    var verdict = t[r] ? nounText(t[r], t.noun[r] || t[r], noun) : null;
    var when = answer && p.recordedAt ? h('p', { className: 'r1-verify__checked' }, (p.recordedLabel || t.recordedAt) + ' ' + formatTimestamp(p.recordedAt, p.locale))
      : p.checkedAt && !checking ? h('p', { className: 'r1-verify__checked' }, (p.checkedLabel || t.checkedAt) + ' ' + formatTimestamp(p.checkedAt, p.locale)) : null;
    // checking: the register is being asked. The verdict line says so and the shape turns; nothing is concluded yet.
    return h('section', { className: cx('r1-verify', 'r1-verify--' + r, fam && 'r1-verify--answer-' + fam, p.className), role: 'status', 'aria-busy': checking ? 'true' : undefined, style: p.style },
      h('div', { className: 'r1-verify__head' },
        checking ? h('span', { className: 'r1-verify__spin' }, h(Icon, { name: 'loader-circle', size: 32, spin: true }))
          : h(StatusIcon, { family: fam || VERIFY_FAMILY[r] || 'neutral', size: 32, cutout: 'surface' }),
        h('div', { className: 'r1-verify__titles' },
          h(p.level === 1 ? 'h1' : 'h2', { className: 'r1-verify__title' }, answer ? keepRefs(p.title) : p.title || verdict),
          p.recordId ? h('p', { className: 'r1-verify__id' }, h('span', null, t.code + ' '), h('span', { className: 'r1-mono' }, p.recordId)) : null)),
      p.children ? h('div', { className: 'r1-verify__text' }, p.children) : null,
      p.facts && !checking ? h(FactList, { items: p.facts, locale: p.locale }) : null,
      when);
  }

  // ------------------------------------------------------ menus and notices

  // Where an open list goes: fixed to the window from the trigger's box, so a scrolling table or a clipped card
  // cannot cut it; below the trigger, or above when there is more room there; its start (or, with align end, its
  // end) lined up with the trigger and kept inside the window; scrolling inside when neither side has room.
  // Measured after the list is placed at 0,0, so a transformed ancestor does not throw it off.
  function cssPx(name, fallback) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }
  function placeList(list, anchor, alignEnd) {
    if (!list || !anchor) return;
    var gap = cssPx('--space-1', 4), edge = cssPx('--space-2', 8);
    list.style.top = '0px'; list.style.left = '0px'; list.style.maxHeight = '';
    var o = list.getBoundingClientRect(), b = anchor.getBoundingClientRect();
    var vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight;
    var hgt = list.scrollHeight + (o.height - list.clientHeight);
    var below = vh - b.bottom - gap - edge, above = b.top - gap - edge;
    var up = hgt > below && above > below;
    var room = Math.max(up ? above : below, 0);
    var top = up ? b.top - gap - Math.min(hgt, room) : b.bottom + gap;
    var left = alignEnd ? b.right - o.width : b.left;
    left = Math.max(edge, Math.min(left, vw - o.width - edge));
    list.style.top = (top - o.top) + 'px';
    list.style.left = (left - o.left) + 'px';
    if (hgt > room) list.style.maxHeight = room + 'px';
    list.setAttribute('data-side', up ? 'top' : 'bottom');
  }

  // More actions behind one button. Arrow keys move, Escape closes and returns focus to the button.
  // The ARIA menu button: opening moves focus to the first item (ArrowUp: the last); arrows, Home, End and a
  // first letter move; Escape closes and returns to the button; Tab or a click outside closes.
  function Menu(p) {
    var t = tx(p.locale).menu;
    var id = useUid('r1-menu');
    var open = useState(!!p.open);
    var goTo = useRef(null);
    var byReader = useRef(false);
    var rootRef = useRef(null);
    var items = p.items || [];
    function listItems() { return rootRef.current ? Array.prototype.slice.call(rootRef.current.querySelectorAll('[role^="menuitem"]')) : []; }
    function trigger() { return document.getElementById(id + '-btn'); }
    function setOpen(v, where) { byReader.current = true; goTo.current = v ? where : null; open[1](v); }
    var listRef = useRef(null);
    // Opened by the reader, the list escapes any clipping container and follows the trigger while the page scrolls
    // or resizes. A menu drawn open by the page (a specimen on a canvas) stays in place under its button.
    var floating = open[0] && byReader.current;
    useLayoutEffect(function () {
      if (!floating) return undefined;
      function place() { placeList(listRef.current, trigger(), p.align === 'end'); }
      place();
      window.addEventListener('resize', place);
      document.addEventListener('scroll', place, true);
      return function () { window.removeEventListener('resize', place); document.removeEventListener('scroll', place, true); };
    }, [floating, p.align]);
    useEffect(function () {
      if (!open[0] || !byReader.current) return undefined;
      if (goTo.current) { var list = listItems(); focusEl(goTo.current === 'last' ? list[list.length - 1] : list[0]); goTo.current = null; }
      function onDown(e) { if (rootRef.current && !rootRef.current.contains(e.target)) open[1](false); }
      document.addEventListener('mousedown', onDown);
      return function () { document.removeEventListener('mousedown', onDown); };
    }, [open[0]]);
    function onButtonKey(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true, 'first'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setOpen(true, 'last'); }
    }
    function onKey(e) {
      var list = listItems();
      var at = list.indexOf(document.activeElement);
      var go = null;
      if (e.key === 'ArrowDown') go = list[(at + 1) % list.length];
      else if (e.key === 'ArrowUp') go = list[(at - 1 + list.length) % list.length];
      else if (e.key === 'Home') go = list[0];
      else if (e.key === 'End') go = list[list.length - 1];
      else if (e.key === 'Escape') { e.preventDefault(); open[1](false); focusEl(trigger()); return; }
      else if (e.key === 'Tab') { open[1](false); return; }
      else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        for (var i = 1; i <= list.length; i++) { var c = list[(at + i) % list.length]; if (fold(c.textContent).charAt(0) === fold(e.key)) { go = c; break; } }
      }
      if (go) { e.preventDefault(); focusEl(go); }
    }
    return h('div', { ref: rootRef, className: cx('r1-menu', p.className), style: p.style },
      h(Button, {
        id: id + '-btn', variant: p.variant || 'secondary', size: p.size || 'sm', icon: p.iconOnly ? 'ellipsis-vertical' : p.icon, iconRight: p.iconOnly ? null : 'chevron-down',
        iconOnly: p.iconOnly, 'aria-label': p.iconOnly ? (p.label || t.more) : undefined, 'aria-haspopup': 'menu', 'aria-expanded': open[0] ? 'true' : 'false',
        'aria-controls': id, onClick: function () { setOpen(!open[0], 'first'); }, onKeyDown: onButtonKey, locale: p.locale
      }, p.iconOnly ? null : (p.label || t.more)),
      open[0] ? h('ul', { ref: listRef, id: id, role: 'menu', className: cx('r1-menu__list', p.align === 'end' && 'r1-menu__list--end', floating && 'r1-menu__list--float'), 'aria-labelledby': id + '-btn', onKeyDown: onKey },
        items.map(function (it, i) {
          if (it.separator) return h('li', { key: i, role: 'separator', className: 'r1-menu__sep' });
          var off = !!it.disabled;
          var check = !isNil(it.checked);
          return h('li', { key: i, role: 'none' },
            h(it.href && !off && !check ? 'a' : 'button', {
              role: check ? 'menuitemcheckbox' : 'menuitem', 'aria-checked': check ? (it.checked ? 'true' : 'false') : undefined,
              type: it.href && !off && !check ? undefined : 'button', href: it.href && !off && !check ? it.href : undefined, tabIndex: -1,
              className: cx('r1-menu__item', it.danger && 'r1-menu__item--danger', off && 'r1-menu__item--off', check && 'r1-menu__item--check'), 'aria-disabled': off ? 'true' : undefined,
              onClick: off ? function (e) { e.preventDefault(); } : function () { if (!check) { open[1](false); focusEl(trigger()); } if (it.onClick) it.onClick(); }
            },
              check ? h('span', { className: 'r1-menu__box' }, it.checked ? h(Icon, { name: 'check', size: 12, strokeWidth: 3 }) : null)
                : it.icon ? h(Icon, { name: it.icon, size: 16 }) : h('span', { className: 'r1-menu__noicon' }),
              h('span', { className: 'r1-menu__text' }, h('span', null, it.label), (off && it.reason) || it.detail ? h('span', { className: 'r1-menu__detail' }, off && it.reason ? it.reason : it.detail) : null)));
        })) : null);
  }

  // Messages for the reader: what happened, when, and where to act. Unread ones say so in words too.
  // Mark all as read works on its own (onMarkAll is told), says so, and leaves focus on the list's heading.
  // loading with no items yet draws placeholder lines and says so.
  function NoticeList(p) {
    var t = tx(p.locale).notices;
    var id = useUid('r1-notices');
    var read = useState(false);
    var toHead = useRef(false);
    var sig = (p.items || []).map(function (it, i) { return (it.id || i) + (it.unread ? '1' : '0'); }).join('|');
    var seen = useRef(sig);
    if (seen.current !== sig) { seen.current = sig; if (read[0]) read[1](false); }
    var items = (p.items || []).map(function (it) { return read[0] && it.unread ? Object.assign({}, it, { unread: false }) : it; });
    var unread = items.filter(function (it) { return it.unread; }).length;
    useEffect(function () { if (toHead.current) { toHead.current = false; focusEl(document.getElementById(id)); } });
    function markAll() {
      if (typeof p.onMarkAll === 'function') p.onMarkAll();
      read[1](true);
      toHead.current = true;
      announce(t.markedAll);
    }
    return h('section', { className: cx('r1-notices', 'r1-notices--' + (p.density || 'portal'), p.className), 'aria-labelledby': id, style: p.style },
      h('div', { className: 'r1-notices__head' },
        h(p.level === 3 ? 'h3' : 'h2', { id: id, className: 'r1-notices__title', tabIndex: -1 }, p.title || t.title,
          unread ? h('span', { className: 'r1-notices__count' }, t.unreadCount.replace('{n}', formatCount(unread, p.locale))) : null),
        unread && p.onMarkAll !== false ? h(Button, { variant: 'quiet', size: 'sm', onClick: markAll, locale: p.locale }, t.markAll) : null),
      items.length ? h('ul', { className: 'r1-notices__list' }, items.map(function (it, i) {
        return h('li', { key: it.id || i, className: cx('r1-notice', 'r1-notice--' + (it.family || 'info'), it.unread && 'r1-notice--unread') },
          h(StatusIcon, { family: it.family || 'info', size: 20, cutout: 'surface' }),
          h('div', { className: 'r1-notice__body' },
            h('div', { className: 'r1-notice__line' },
              it.href ? h('a', { className: 'r1-link r1-notice__title', href: it.href }, it.title) : h('span', { className: 'r1-notice__title' }, it.title),
              it.at ? h(DateValue, { value: it.at, mode: 'timestamp', locale: p.locale, className: 'r1-notice__at' }) : null),
            it.body ? h('p', { className: 'r1-notice__text' }, it.body) : null,
            it.unread ? h('span', { className: 'r1-sr' }, t.unread) : null),
          it.unread ? h('span', { className: 'r1-notice__dot', 'aria-hidden': 'true' }) : null);
      })) : p.loading ? h(Skeleton, { variant: 'text', rows: 3, locale: p.locale }) : h(EmptyState, { variant: 'not-started', title: p.emptyText || t.empty, locale: p.locale }));
  }

  // ---------------------------------------------------------- more inputs

  // A setting that takes effect the moment it is switched. A choice saved with a form is a Checkbox.
  // loading: the change is being saved; the switch holds, a line under it says "Đang lưu", and clicks wait. error: the change
  // did not save; the page puts the switch back and the message says what to do. A disabled switch reads as
  // disabled whether it is on or off: a pale track, a grey knob on its side, and the word.
  function Switch(p) {
    var t = tx(p.locale);
    var id = useUid('r1-sw');
    var st = useState(!!p.checked);
    var on = p.onChange ? !!p.checked : st[0];
    var off = !!p.disabled;
    var busy = !!p.loading && !off;
    useEffect(function () { if (busy && readerActed()) announce(t.sw.saving, 'polite'); }, [busy]);
    var help = isNil(p.helper) ? p.hint : p.helper;
    var ids = [help && id + '-hint', p.error && id + '-msg', off && p.disabledReason && id + '-why'].filter(Boolean).join(' ') || undefined;
    return h('div', { className: cx('r1-switch', 'r1-switch--' + (p.density || 'portal'), off && 'r1-switch--disabled', busy && 'r1-switch--busy', p.error && 'r1-switch--error', p.className), style: p.style },
      h('div', { className: 'r1-switch__row' },
        h('span', { className: 'r1-switch__text' },
          h('label', { className: 'r1-switch__label', htmlFor: id }, p.label),
          help ? h('span', { id: id + '-hint', className: 'r1-switch__hint' }, help) : null),
        h('button', {
          id: id, type: 'button', role: 'switch', className: 'r1-switch__control', 'aria-checked': on ? 'true' : 'false',
          'aria-describedby': ids, 'aria-busy': busy ? 'true' : undefined, 'aria-disabled': busy ? 'true' : undefined, disabled: off,
          onClick: function () { if (busy) return; if (p.onChange) p.onChange(!on); else st[1](!on); }
        }, h('span', { className: 'r1-switch__track', 'aria-hidden': 'true' }, h('span', { className: 'r1-switch__knob' })),
          h('span', { className: 'r1-switch__state', 'aria-hidden': 'true' }, on ? t.sw.on : t.sw.off))),
      busy ? h('p', { className: 'r1-switch__busy' }, h(Icon, { name: 'loader-circle', size: 16, spin: true }), h('span', null, t.sw.saving)) : null,
      p.error ? h(FieldMessage, { id: id + '-msg', severity: 'error', locale: p.locale }, p.error) : null,
      off && p.disabledReason ? h('div', { id: id + '-why', className: 'r1-field__reason' }, h(Icon, { name: 'info', size: 16 }), h('span', null, p.disabledReason)) : null);
  }

  // An amount typed in whole units with grouped digits; the value travels in minor units, like MoneyValue.
  // Whole units as people type them, in the reader's grouping: "1.250.000" in Vietnamese, "1,250,000" in English.
  // Returns the minor units, the digits before the decimal separator and those after it (null when none was typed).
  function parseMoney(text, digits, locale) {
    var s = String(isNil(text) ? '' : text).replace(/\s/g, '');
    if (!digits) { var only = s.replace(/\D/g, ''); return only ? { minor: Number(only), whole: only, frac: null } : null; }
    var dec = lang(locale) === 'en' ? '.' : ',';
    var at = s.lastIndexOf(dec);
    var whole = (at < 0 ? s : s.slice(0, at)).replace(/\D/g, '');
    var frac = at < 0 ? null : s.slice(at + 1).replace(/\D/g, '').slice(0, digits);
    if (!whole && !frac) return null;
    return { minor: Number(whole || 0) * Math.pow(10, digits) + Number(((frac || '') + '0000').slice(0, digits)), whole: whole, frac: frac };
  }
  function moneyText(m, locale) {
    var dec = lang(locale) === 'en' ? '.' : ',';
    var whole = m.whole ? nf(locale, { maximumFractionDigits: 0 }).format(Number(m.whole)) : (m.frac !== null ? '0' : '');
    return whole + (m.frac !== null ? dec + m.frac : '');
  }

  // The amount groups as the reader types and travels in minor units: onChange(amountMinor | null, event).
  function MoneyField(p) {
    var id = useUid('r1-money');
    var cur = p.currency || 'VND';
    var digits = ZERO_MINOR[cur] ? 0 : 2;
    var fixed = function (minor) { return isNil(minor) ? '' : nf(p.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(minor / Math.pow(10, digits)); };
    var shown = fixed(p.amountMinor);
    var symbol = cur;
    var text = useState(shown);
    var emitted = useRef(p.amountMinor);
    var lastProp = useRef(p.amountMinor);
    if (p.amountMinor !== lastProp.current) { lastProp.current = p.amountMinor; if (p.amountMinor !== emitted.current) text[1](shown); }
    var inputRef = useRef(null);
    var caret = useRef(null);
    useLayoutEffect(function () {
      if (caret.current === null || !inputRef.current) return;
      var el = inputRef.current, want = caret.current, pos = 0, seen = 0;
      caret.current = null;
      while (pos < el.value.length && seen < want) { if (/\d/.test(el.value.charAt(pos))) seen++; pos++; }
      if (document.activeElement === el) el.setSelectionRange(pos, pos);
    });
    if (p.readOnly) return fieldShell(p, id, h('div', { className: 'r1-field__control' }, readOnlyBox(p, id, h(MoneyValue, { amountMinor: p.amountMinor, currency: cur, locale: p.locale }), 'r1-num')));
    var input = h('input', {
      ref: inputRef, id: id, name: p.name, type: 'text', inputMode: digits ? 'decimal' : 'numeric', className: 'r1-input r1-num r1-money__input', value: text[0], placeholder: p.placeholder,
      disabled: p.disabled, required: p.required, autoComplete: 'off', 'aria-invalid': p.error ? 'true' : undefined, 'aria-describedby': describedBy(p, id),
      // The currency is part of the name, so it is read with the amount: "Adjustment VND, 12,500,000".
      'aria-labelledby': affixName(id, null, true),
      onChange: function (e) {
        var raw = e.target.value;
        var at = isNil(e.target.selectionStart) ? raw.length : e.target.selectionStart;
        var m = parseMoney(raw, digits, p.locale);
        caret.current = raw.slice(0, at).replace(/\D/g, '').length;
        text[1](m ? moneyText(m, p.locale) : '');
        emitted.current = m ? m.minor : null;
        if (p.onChange) p.onChange(emitted.current, e);
      },
      onBlur: function (e) { var m = parseMoney(text[0], digits, p.locale); if (m && digits) text[1](fixed(m.minor)); if (p.onBlur) p.onBlur(e); }
    });
    return fieldShell(p, id, h('div', { className: 'r1-field__control', style: p.width ? { maxWidth: p.width } : undefined },
      h('div', { className: 'r1-affix' }, input, h('span', { id: id + '-suf', className: 'r1-affix__part' }, symbol))));
  }

  // A time as people type it: 18:30, 18h30, 18.30, or 1830 from a number pad that has no colon.
  function parseTime(s, endOfDay) {
    var str = String(isNil(s) ? '' : s).trim();
    if (!str) return null;
    var hh, mm, m = /^(\d{1,2})\s*[:hH.,\s]\s*(\d{1,2})?$/.exec(str);
    if (m) { hh = +m[1]; mm = m[2] ? +m[2] : 0; }
    else if (/^\d{1,4}$/.test(str)) { if (str.length <= 2) { hh = +str; mm = 0; } else { hh = +str.slice(0, -2); mm = +str.slice(-2); } }
    else return null;
    if (mm > 59) return null;
    if (hh === 24 && mm === 0) return endOfDay ? '24:00' : null;
    if (hh > 23) return null;
    return pad2(hh) + ':' + pad2(mm);
  }

  // A time on a step of minutes (step 15: 18:00, 18:15 ...): the nearest step, never past the end of the day.
  function snapTime(v, step, endOfDay) {
    if (!v || !step || step <= 1) return v;
    var x = v.split(':'), mins = Number(x[0]) * 60 + Number(x[1]);
    var last = endOfDay ? 1440 : Math.floor(1439 / step) * step;
    var r = Math.min(Math.round(mins / step) * step, last);
    return pad2(Math.floor(r / 60)) + ':' + pad2(r % 60);
  }

  // A time of day on the 24-hour clock. endOfDay allows 24:00 for a period that runs to midnight.
  // onChange gets 'HH:MM' or null while the text is not a time; leaving the field writes the time out in full.
  // step (minutes) keeps the time on that step: leaving the field rounds to the nearest one and says so, and
  // ArrowUp and ArrowDown move by one step.
  function TimeField(p) {
    var t = tx(p.locale);
    var id = useUid('r1-time');
    var text = useSynced(p.value, '');
    var step = p.step > 1 ? Math.round(p.step) : 0;
    if (p.readOnly) return fieldShell(p, id, h('div', { className: 'r1-field__control' }, readOnlyBox(p, id, p.value || '–', 'r1-num')));
    var example = step && 30 % step !== 0 ? '18:00' : '18:30';
    var auto = step ? (p.endOfDay ? t.time.helpStepEnd : t.time.helpStep).replace('{n}', String(step)).replace('{e}', example) : (p.endOfDay ? t.time.helpEnd : t.time.help);
    var helpP = Object.assign({}, p, { helper: p.helper === false ? null : (p.helper || auto) });
    function put(v, e) { text[1](v); if (p.onChange) p.onChange(v, e); }
    function onKey(e) {
      if (!step || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();
      var cur = parseTime(text[0], p.endOfDay);
      var last = p.endOfDay ? 1440 : Math.floor(1439 / step) * step;
      var mins;
      if (!cur) mins = e.key === 'ArrowUp' ? 0 : last;
      else {
        var x = snapTime(cur, step, p.endOfDay).split(':');
        mins = Number(x[0]) * 60 + Number(x[1]) + (e.key === 'ArrowUp' ? step : -step);
        mins = Math.max(0, Math.min(mins, last));
      }
      put(pad2(Math.floor(mins / 60)) + ':' + pad2(mins % 60), e);
    }
    return fieldShell(helpP, id, h('div', { className: 'r1-field__control r1-time', style: { maxWidth: p.width || 'var(--space-40)' } },
      h(Icon, { name: 'clock', size: fieldIconSize(p), className: 'r1-time__icon' }),
      h('input', {
        id: id, name: p.name, type: 'text', inputMode: 'numeric', className: 'r1-input r1-num r1-time__input', value: text[0], placeholder: 'hh:mm', maxLength: 5,
        disabled: p.disabled, required: p.required, autoComplete: 'off', 'aria-invalid': p.error ? 'true' : undefined, 'aria-describedby': describedBy(helpP, id),
        onChange: function (e) { text[1](e.target.value); if (p.onChange) p.onChange(parseTime(e.target.value, p.endOfDay), e); },
        onKeyDown: onKey,
        onBlur: function (e) {
          var v = parseTime(text[0], p.endOfDay);
          var s = snapTime(v, step, p.endOfDay);
          if (s && s !== v) { announce(t.time.rounded.replace('{t}', s)); put(s, e); }
          else if (v) text[1](v);
          if (p.onBlur) p.onBlur(e);
        }
      })));
  }

  // ----------------------------------------------------- reveal on demand

  // A section the reader opens when they need it: a help answer, the working behind a figure.
  // It keeps its own open state and follows open whenever the page passes a new value. With onToggle and open
  // both given, the page decides: a press only reports the wish.
  function Disclosure(p) {
    var st = useSynced(isNil(p.open) ? undefined : !!p.open, false);
    var held = !!p.onToggle && !isNil(p.open);
    var open = held ? !!p.open : st[0];
    var id = useUid('r1-disc');
    return h('div', { className: cx('r1-disc', 'r1-disc--' + (p.density || 'portal'), open && 'r1-disc--open', p.className), style: p.style },
      h(p.level === 2 ? 'h2' : p.level === 4 ? 'h4' : 'h3', { className: 'r1-disc__heading' },
        h('button', {
          type: 'button', className: 'r1-disc__button', 'aria-expanded': open ? 'true' : 'false', 'aria-controls': id,
          onClick: function () { if (!held) st[1](!open); if (p.onToggle) p.onToggle(!open); }
        }, h(Icon, { name: 'chevron-right', size: p.density === 'console' ? 16 : 20, className: 'r1-disc__chev' }), h('span', { className: 'r1-disc__title' }, p.title),
          p.meta ? h('span', { className: 'r1-disc__meta' }, p.meta) : null)),
      h('div', { id: id, className: 'r1-disc__body', hidden: !open }, p.children));
  }

  // A small button that shows a definition in place. Opens on click or Enter, closes on Escape, a second press
  // or a click outside; never on hover alone. The button draws at 24 px (20 in a table header) and takes the
  // target size of its density: 44 px on portal pages, 24 in the console.
  function Toggletip(p) {
    var t = tx(p.locale);
    var id = useUid('r1-tt');
    var st = useState(!!p.open);
    var open = st[0];
    var rootRef = useRef(null);
    useEffect(function () {
      if (!open) return undefined;
      function onDown(e) { if (rootRef.current && !rootRef.current.contains(e.target)) st[1](false); }
      document.addEventListener('mousedown', onDown);
      document.addEventListener('touchstart', onDown);
      return function () { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); };
    }, [open]);
    return h('span', { ref: rootRef, className: cx('r1-toggletip', 'r1-toggletip--' + (p.density === 'console' ? 'console' : 'portal'), p.align === 'end' && 'r1-toggletip--end', p.className), style: p.style,
      onKeyDown: function (e) { if (e.key === 'Escape' && open) { e.stopPropagation(); st[1](false); } } },
      h('button', { type: 'button', className: 'r1-toggletip__button', 'aria-label': p.label || t.tip.explain, 'aria-expanded': open ? 'true' : 'false', 'aria-controls': id, onClick: function () { st[1](!open); } },
        h(Icon, { name: 'circle-help', size: 16 })),
      h('span', { id: id, role: 'status', className: 'r1-toggletip__live' },
        open ? h('span', { className: 'r1-toggletip__bubble' },
          p.title ? h('span', { className: 'r1-toggletip__title' }, p.title) : null,
          h('span', { className: 'r1-toggletip__text' }, p.children || p.text)) : null));
  }

  // The name of an icon-only control, shown on pointer over and on keyboard focus. Never holds anything else.
  function Tooltip(p) {
    var id = useUid('r1-tip');
    var engaged = useState(0);
    var gone = useState(false);
    var child = p.children;
    var trigger = React.isValidElement(child) ? React.cloneElement(child, { 'aria-describedby': [child.props['aria-describedby'], id].filter(Boolean).join(' ') }) : child;
    useEffect(function () {
      if (!engaged[0]) { gone[1](false); return undefined; }
      function onKey(e) { if (e.key === 'Escape') gone[1](true); }
      document.addEventListener('keydown', onKey);
      return function () { document.removeEventListener('keydown', onKey); };
    }, [engaged[0] > 0]);
    function bump(n) { return function () { engaged[1](function (v) { return Math.max(0, v + n); }); }; }
    return h('span', {
      className: cx('r1-tip', 'r1-tip--' + (p.placement || 'top'), p.open && 'r1-tip--open', gone[0] && 'r1-tip--dismissed', p.className), style: p.style,
      onMouseEnter: bump(1), onMouseLeave: bump(-1), onFocus: bump(1), onBlur: bump(-1)
    }, trigger, h('span', { id: id, role: 'tooltip', className: 'r1-tip__bubble' }, p.label));
  }

  // --------------------------------------------------------- confirmations

  // A short confirmation after an action that did not leave the page. It never carries the only copy of an error.
  // floating: it joins one stack at the bottom right of the window, newest at the bottom, three in view.
  // A positive, info or neutral toast that appeared after the reader acted closes itself after duration ms
  // (floating: 8 s by default; never under 6 s), and not while the pointer or focus is on it. attention and
  // danger toasts stay until closed. Close always works: the toast hides itself and then calls onClose.
  function toastStack() {
    if (typeof document === 'undefined' || !document.body) return null;
    var el = document.querySelector('[data-r1-toasts]');
    if (!el) { el = document.createElement('div'); el.setAttribute('data-r1-toasts', ''); el.className = 'r1-toasts'; document.body.appendChild(el); }
    return el;
  }
  function Toast(p) {
    var t = tx(p.locale);
    var family = p.family || 'positive';
    var host = useHostTheme(!!p.floating);
    var shown = useState(true);
    var held = useRef(false);
    var latest = useLatest(p);
    var said = joinSentences([textOf(p.title), textOf(p.children)]);
    useEffect(function () {
      announce(said, family === 'danger' ? 'assertive' : 'polite');
    }, [said]);
    var lasting = family === 'attention' || family === 'danger';
    var ms = lasting ? 0 : !isNil(p.duration) ? (p.duration ? Math.max(6000, p.duration) : 0) : p.floating ? 8000 : 0;
    function close(e) { shown[1](false); if (latest.current.onClose) latest.current.onClose(e); }
    useEffect(function () {
      if (!ms || !readerActed()) return undefined;
      var used = 0;
      var timer = setInterval(function () {
        if (held.current) return;
        used += 250;
        if (used >= ms) { clearInterval(timer); close(); }
      }, 250);
      return function () { clearInterval(timer); };
    }, [ms, said]);
    if (!shown[0]) return null;
    function hold(v) { return function () { held.current = v; }; }
    var el = h('div', {
      className: cx('r1-toast', 'r1-toast--' + family, p.floating && 'r1-toast--floating', p.className), style: p.style, lang: p.floating ? lang(p.locale) : undefined, 'data-theme': p.floating && host.theme ? host.theme : undefined,
      onMouseEnter: hold(true), onMouseLeave: hold(false), onFocus: hold(true), onBlur: hold(false)
    },
      h(StatusIcon, { family: family, size: 20, cutout: 'surface' }),
      h('div', { className: 'r1-toast__body' },
        p.title ? h('p', { className: 'r1-toast__title' }, keepRefs(p.title)) : null,
        p.children ? h('p', { className: 'r1-toast__text' }, keepRefs(p.children)) : null,
        p.action ? h('div', { className: 'r1-toast__actions' }, h(Button, { variant: 'quiet', size: 'sm', onClick: p.action.onClick, href: p.action.href, locale: p.locale }, p.action.label)) : null),
      h(Button, { className: 'r1-btn--close', variant: 'quiet', size: 'sm', iconOnly: true, icon: 'x', 'aria-label': t.toast.close, onClick: close, locale: p.locale }));
    var stack = p.floating && window.ReactDOM && window.ReactDOM.createPortal ? toastStack() : null;
    return stack ? h(Fragment, null, h('span', { ref: host.ref, hidden: true }), window.ReactDOM.createPortal(el, stack)) : el;
  }

  // --------------------------------------------------------------- people

  function initialsOf(name) {
    var w = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '?';
    var a = w[0].charAt(0), b = w.length > 1 ? w[w.length - 1].charAt(0) : '';
    return (a + b).toUpperCase();
  }
  // A person or an organisation, by photo when one is on record, otherwise by initials (one at sm, 24 px). Never a stock face.
  function Avatar(p) {
    var shape = p.shape || (p.kind === 'org' ? 'square' : 'circle');
    // A photo that does not load falls back to the initials, and tries again when the page passes another photo.
    var broken = useState(null);
    var showImg = p.src && broken[0] !== p.src;
    return h('span', {
      className: cx('r1-avatar', 'r1-avatar--' + (p.size || 'md'), 'r1-avatar--' + shape, p.className), style: p.style,
      role: p.decorative ? undefined : 'img', 'aria-label': p.decorative ? undefined : (p.alt || p.name), 'aria-hidden': p.decorative ? 'true' : undefined
    }, showImg ? h('img', { src: p.src, alt: '', className: 'r1-avatar__img', onError: function () { broken[1](p.src); } })
      : h('span', { className: 'r1-avatar__initials', 'aria-hidden': 'true' }, p.size === 'sm' ? initialsOf(p.name).charAt(0) : initialsOf(p.name)));
  }

  // --------------------------------------------------------- rights shares

  // Shares that must add up to 100 %: holders of one rights layer, parties to a claim. The bar shows what is left.
  function parseShare(s) { var v = parseFloat(String(isNil(s) ? '' : s).replace(/\s/g, '').replace(',', '.')); return isNaN(v) ? null : v; }

  // onChange(parties with their new shares, index, event) as the reader types; the total follows.
  // A row's error sits under its input, as every field's does.
  function ShareSplit(p) {
    var t = tx(p.locale).split;
    var id = useUid('r1-split');
    var given = p.parties || [];
    var fmtShare = function (v) { return nf(p.locale, { maximumFractionDigits: 2 }).format(Number(v) || 0); };
    var seed = given.map(function (x) { return fmtShare(x.share); }).join('\u0001');
    var st = useSynced(seed, seed);
    var texts = st[0].split('\u0001');
    var parties = given.map(function (x, i) {
      var v = p.readOnly || x.locked ? Number(x.share) || 0 : parseShare(texts[i]);
      return Object.assign({}, x, { share: isNil(v) ? 0 : v });
    });
    function edit(i, e) {
      var next = texts.slice(); next[i] = e.target.value;
      st[1](next.join('\u0001'));
      if (p.onChange) p.onChange(given.map(function (x, j) { var v = j === i ? parseShare(e.target.value) : parties[j].share; return Object.assign({}, x, { share: isNil(v) ? null : v }); }), i, e);
    }
    var total = parties.reduce(function (s, x) { return s + (Number(x.share) || 0); }, 0);
    total = Math.round(total * 100) / 100;
    var rest = Math.round((100 - total) * 100) / 100;
    var state = rest === 0 ? 'complete' : rest > 0 ? 'short' : 'over';
    var pct = function (n) { return nf(p.locale, { maximumFractionDigits: 2 }).format(n) + (lang(p.locale) === 'en' ? '%' : '\u00a0%'); };
    var summary = state === 'complete' ? t.complete : (state === 'short' ? t.short : t.over).replace('{n}', pct(Math.abs(rest)));
    return h('fieldset', { className: cx('r1-split', 'r1-split--' + state, p.className), style: p.style, 'aria-describedby': [p.helper && id + '-help', id + '-sum'].filter(Boolean).join(' ') },
      p.legend ? h('legend', { className: 'r1-split__legend' }, p.legend) : null,
      p.helper ? h('p', { id: id + '-help', className: 'r1-field__help' }, p.helper) : null,
      h('div', { className: 'r1-split__bar', 'aria-hidden': 'true' },
        parties.map(function (x, i) { return h('span', { key: i, className: 'r1-split__seg', style: { width: Math.max(0, Math.min(100, Number(x.share) || 0)) + '%' } }); }),
        state === 'short' ? h('span', { className: 'r1-split__rest', style: { width: rest + '%' } }) : null),
      h('ul', { className: 'r1-split__list' }, parties.map(function (x, i) {
        var iid = id + '-' + i;
        return h('li', { key: i, className: cx('r1-split__row', x.error && 'r1-split__row--error') },
          h('span', { className: 'r1-split__who' },
            h('label', { className: 'r1-split__name', htmlFor: iid }, x.name),
            x.detail ? h('span', { className: 'r1-split__detail' }, x.detail) : null),
          p.readOnly || x.locked ? h('span', { id: iid, className: 'r1-split__value r1-num' }, pct(Number(x.share) || 0))
            : h('span', { className: 'r1-affix r1-split__input' },
              h('input', { id: iid, type: 'text', inputMode: 'decimal', className: 'r1-input r1-num', value: texts[i], onChange: function (e) { edit(i, e); }, 'aria-invalid': x.error ? 'true' : undefined, 'aria-describedby': x.error ? iid + '-err' : undefined }),
              h('span', { className: 'r1-affix__part', 'aria-hidden': 'true' }, '%')),
          x.error ? h(FieldMessage, { id: iid + '-err', severity: 'error', className: 'r1-split__error', locale: p.locale }, x.error) : null);
      })),
      h('p', { id: id + '-sum', className: 'r1-split__sum', role: 'status' },
        h(StatusIcon, { family: state === 'complete' ? 'positive' : state === 'short' ? 'attention' : 'danger', size: 16, cutout: 'surface' }),
        h('span', null, t.total + ' ' + pct(total) + '. ' + summary)));
  }

  // ----------------------------------------------------- side by side, lineage

  // A value by its kind, drawn by the same atoms as everywhere else (MoneyValue, CountValue, DateValue), so a comparison
  // and a trace write amounts, counts, dates and percentages the way the rest of the screen does. o: { currency, unit, missing }.
  function typedValue(kind, v, o, locale) {
    if (isNil(v) || v === '') return missingValue(o.missing, tx(locale).noValue);
    if (kind === 'money') return h(MoneyValue, { amountMinor: v, currency: o.currency, bare: !!o.bareMoney, locale: locale });
    if (kind === 'count') return h(CountValue, { value: v, unit: o.unit, locale: locale });
    if (kind === 'percent') return h('span', { className: 'r1-num' }, formatPercent(v, locale, { decimals: o.decimals }) || v);
    if (kind === 'date') return h(DateValue, { value: v, locale: locale });
    if (kind === 'datetime') return h(DateValue, { value: v, mode: 'timestamp', locale: locale });
    if (kind === 'period') return h(DateValue, { value: v.from, to: v.to, mode: 'period', locale: locale });
    if (kind === 'id') return h(Identifier, { value: v, size: 'sm', copy: false, locale: locale });
    return o.unit ? v + ' ' + o.unit : v;
  }
  // Two or three versions or records side by side, with the fields that differ marked in words.
  function Comparison(p) {
    var t = tx(p.locale).compare;
    var cols = p.columns || [];
    var all = p.rows || [];
    var rows = all.filter(function (r) { return !p.onlyChanges || r.changed; });
    var nChanged = all.filter(function (r) { return r.changed; }).length;
    // A figure row ends at the right of its cells unless it asks for align: 'start', as a Table column may.
    function atEnd(r) { return !!NUMERIC[r.kind] && r.align !== 'start'; }
    // unit (opt-in, on the comparison or on a money row): the currency is written once, after the row's label, and the
    // amounts in its cells are bare, as a Table money column with a unit in its header draws them.
    function moneyUnit(r) { return r.kind === 'money' ? (r.unit || p.unit || null) : null; }
    var allNum = rows.length > 0 && rows.every(atEnd);
    return h('div', { className: cx('r1-compare', p.className), style: p.style },
      // summary and rowLabel: the screen's own words for the summary line and the first column's header.
      h('p', { className: 'r1-compare__summary' }, !isNil(p.summary) ? p.summary : nChanged === 1 ? t.changedOne : nChanged ? t.changed.replace('{n}', formatCount(nChanged, p.locale)) : t.same),
      // Only the changes, and nothing changed: the summary says so and no empty table is drawn under it.
      rows.length ? h('div', { className: 'r1-table-wrap' },
        h('table', { className: cx('r1-table', 'r1-table--' + (p.density || 'console'), 'r1-compare__table') },
          p.caption ? h('caption', { className: 'r1-sr' }, p.caption) : null,
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, p.rowLabel || t.field), cols.map(function (c) {
            // When every row shown is a figure, the version headers end where the figures end.
            return h('th', { key: c.key, scope: 'col', className: allNum ? 'r1-end' : undefined }, h('span', { className: 'r1-compare__col' }, c.label), c.meta ? h('span', { className: 'r1-compare__colmeta' }, c.meta) : null);
          }))),
          h('tbody', null, rows.map(function (r, i) {
            return h('tr', { key: r.key || i, className: cx(r.changed && 'r1-compare__row--changed') },
              h('th', { scope: 'row' }, h('span', { className: 'r1-compare__label' }, r.label, moneyUnit(r) ? h('span', { className: 'r1-th__unit' }, ' ' + moneyUnit(r)) : null), r.changed ? h('span', { className: 'r1-compare__mark' }, h(Icon, { name: 'arrow-right-left', size: 16 }), t.differs) : null),
              // Amounts, counts and percentages sit at the end of their cell, tabular and on one line, as a Table's numeric
              // columns do, so the figures of two versions line up digit under digit.
              cols.map(function (c) { return h('td', { key: c.key, className: cx(NUMERIC[r.kind] && 'r1-num r1-nowrap', atEnd(r) && 'r1-end') }, typedValue(r.kind, (r.values || {})[c.key], moneyUnit(r) ? Object.assign({}, r, { bareMoney: true }) : r, p.locale)); }));
          })))) : null);
  }

  // Where a figure comes from, step by step: input, class, band, rule, amount. Each step can open its source.
  // Each step keeps its own width and the path wraps between steps, never squeezing a step's words: the chevron that
  // leads to the next step ends the step before it, so a row that wraps ends on a chevron and the next row starts with
  // a step. state (opt-in): 'gap', a link that is missing (a dashed connector into it, the attention shape, its words in
  // attention-text), or 'pending', a link not reached yet (the neutral hollow ring, its words in secondary text); the
  // words themselves say what is missing or what it waits for. A reference that opens its record (kind 'id' with href)
  // is drawn as text inside the link, so it takes the link's underline and holds no copy control.
  function TracePath(p) {
    var t = tx(p.locale);
    var steps = p.steps || [];
    return h('ol', { className: cx('r1-trace', p.className), 'aria-label': p.label || t.trace.label, style: p.style }, steps.map(function (s, i) {
      var state = s.state === 'gap' || s.state === 'pending' ? s.state : null;
      var next = steps[i + 1];
      var intoGap = !!next && next.state === 'gap';
      var linkedRef = !!s.href && s.kind === 'id' && !isNil(s.value) && s.value !== '';
      var value = linkedRef ? h('span', { className: 'r1-mono r1-nowrap' }, s.value) : typedValue(s.kind, s.value, s, p.locale);
      var shown = s.href ? h('a', { className: 'r1-link r1-trace__value', href: s.href }, value) : h('span', { className: 'r1-trace__value' }, value);
      return h('li', { key: i, className: cx('r1-trace__step', state && 'r1-trace__step--' + state) },
        h('span', { className: 'r1-trace__body' },
          h('span', { className: 'r1-trace__kind' }, s.label),
          state ? h('span', { className: 'r1-trace__line' }, h(StatusIcon, { family: state === 'gap' ? 'attention' : 'neutral', size: 16, cutout: 'surface' }), shown) : shown,
          s.detail ? h('span', { className: 'r1-trace__detail' }, keepRefs(s.detail)) : null),
        next ? h('span', { className: cx('r1-trace__sep', intoGap && 'r1-trace__sep--gap'), 'aria-hidden': 'true' },
          intoGap ? h('span', { className: 'r1-trace__dash' }) : null,
          h(Icon, { name: 'chevron-right', size: 16 })) : null);
    }));
  }

  // ------------------------------------------------------------- documents

  var FILE_ICON = { pdf: 'file-text', image: 'file-image', audio: 'music', sheet: 'file-spreadsheet', other: 'file' };
  // Files attached to a record: name, kind, size, who added it and when, and whether it can be opened yet.
  // uploading shows its progress and a way to stop it; a failed file offers to upload it again.
  function FileList(p) {
    var t = tx(p.locale).files;
    var items = p.items || [];
    if (!items.length) return h('p', { className: 'r1-files__empty' }, p.emptyText || t.none);
    return h('ul', { className: cx('r1-files', 'r1-files--' + (p.density || 'portal'), p.className), 'aria-label': p.label, style: p.style }, items.map(function (f, i) {
      var st = f.state || 'ready';
      var ready = st === 'ready';
      var up = st === 'uploading';
      var pct = isNil(f.progress) ? null : Math.max(0, Math.min(100, Math.round(f.progress)));
      var pctText = pct === null ? null : nf(p.locale).format(pct) + (lang(p.locale) === 'en' ? '%' : '\u00a0%');
      return h('li', { key: f.key || i, className: cx('r1-file', 'r1-file--' + st) },
        h(Icon, { name: FILE_ICON[f.type] || 'file', size: p.density === 'console' ? 16 : 20, className: 'r1-file__icon' }),
        h('span', { className: 'r1-file__main' },
          ready && f.href ? h('a', { className: 'r1-link r1-file__name', href: f.href }, f.name) : h('span', { className: 'r1-file__name' }, f.name),
          h('span', { className: 'r1-file__meta' },
            f.size ? h('span', null, f.size) : null,
            f.at ? h(DateValue, { value: f.at, mode: 'stamp', locale: p.locale }) : null,
            f.by ? h('span', null, f.by) : null),
          up ? h('span', { className: 'r1-file__progress' },
            h('span', { className: 'r1-file__bar', role: 'progressbar', 'aria-label': t.uploading + ': ' + f.name, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct === null ? undefined : pct, 'aria-valuetext': pctText || undefined },
              h('span', { className: 'r1-file__fill', style: { width: (pct || 0) + '%' } })),
            pctText ? h('span', { className: 'r1-file__pct r1-num' }, pctText) : null) : null,
          !ready && f.reason ? h('span', { className: 'r1-file__reason' }, f.reason) : null,
          st === 'failed' && f.onRetry ? h('span', { className: 'r1-file__again' }, h(Button, { variant: 'secondary', size: 'sm', icon: 'refresh-cw', onClick: f.onRetry, 'aria-label': t.retry + ': ' + f.name, locale: p.locale }, t.retry)) : null),
        !ready ? h(StatusBadge, { family: up || st === 'scanning' ? 'info' : st === 'quarantined' ? 'attention' : 'danger', label: t[st], size: 'sm' }) : null,
        up && f.onCancel ? h(Button, { variant: 'quiet', size: 'sm', iconOnly: true, icon: 'x', 'aria-label': t.cancel + ': ' + f.name, onClick: f.onCancel, locale: p.locale }) : null,
        ready && f.href ? h(Button, { variant: 'quiet', size: 'sm', iconOnly: true, icon: 'download', href: f.href, 'aria-label': t.download + ': ' + f.name, locale: p.locale }) : null,
        f.removable && !up ? h(Button, { variant: 'quiet', size: 'sm', iconOnly: true, icon: 'trash-2', 'aria-label': t.remove + ': ' + f.name, onClick: f.onRemove, locale: p.locale }) : null);
    }));
  }

  // A document page beside the facts it supports, with its own page and zoom controls. The page is the children.
  // Page and zoom work on their own; the page is told through onPageChange(page) and onZoomChange(percent),
  // and onPrev, onNext, onZoomIn, onZoomOut still fire. Zoom runs from 50 to 200 % in steps of 25; the text
  // scales with the sheet. A file that cannot be shown keeps only its download.
  function DocumentPreview(p) {
    var t = tx(p.locale).doc;
    var pages = p.pages || 1;
    var pg = useSynced(p.page, 1);
    var zm = useSynced(p.zoom, 100);
    var page = pg[0], zoom = zm[0];
    function toPage(n, cb) { var v = Math.max(1, Math.min(pages, n)); pg[1](v); if (p.onPageChange) p.onPageChange(v); if (cb) cb(); }
    function toZoom(n, cb) { var v = Math.max(50, Math.min(200, n)); zm[1](v); if (p.onZoomChange) p.onZoomChange(v); if (cb) cb(); }
    var f = zoom / 100;
    return h('section', { className: cx('r1-docview', p.className), 'aria-label': p.title, style: p.style },
      h('div', { className: 'r1-docview__bar' },
        h('span', { className: 'r1-docview__name' }, h(Icon, { name: FILE_ICON[p.type] || 'file-text', size: 16 }), h('span', null, p.title)),
        h('span', { className: 'r1-docview__tools' },
          !p.unavailable && pages > 1 ? h(Button, { variant: 'quiet', size: 'sm', iconOnly: true, icon: 'chevron-left', 'aria-label': t.prev, disabled: page <= 1, onClick: function () { toPage(page - 1, p.onPrev); }, locale: p.locale }) : null,
          !p.unavailable ? h('span', { className: 'r1-docview__page r1-num', 'aria-live': 'polite' }, t.page.replace('{n}', page).replace('{of}', pages)) : null,
          !p.unavailable && pages > 1 ? h(Button, { variant: 'quiet', size: 'sm', iconOnly: true, icon: 'chevron-right', 'aria-label': t.next, disabled: page >= pages, onClick: function () { toPage(page + 1, p.onNext); }, locale: p.locale }) : null,
          !p.unavailable ? h('span', { className: 'r1-docview__sep', 'aria-hidden': 'true' }) : null,
          !p.unavailable ? h(Button, { variant: 'quiet', size: 'sm', iconOnly: true, icon: 'minus', 'aria-label': t.zoomOut, disabled: zoom <= 50, onClick: function () { toZoom(zoom - 25, p.onZoomOut); }, locale: p.locale }) : null,
          !p.unavailable ? h('span', { className: 'r1-docview__zoom r1-num', 'aria-live': 'polite' }, zoom + (lang(p.locale) === 'en' ? '%' : '\u00a0%')) : null,
          !p.unavailable ? h(Button, { variant: 'quiet', size: 'sm', iconOnly: true, icon: 'plus', 'aria-label': t.zoomIn, disabled: zoom >= 200, onClick: function () { toZoom(zoom + 25, p.onZoomIn); }, locale: p.locale }) : null,
          p.href ? h(Button, { variant: 'quiet', size: 'sm', iconOnly: true, icon: 'download', href: p.href, 'aria-label': t.download + ': ' + p.title, locale: p.locale }) : null)),
      h('div', { className: 'r1-docview__stage' },
        p.unavailable ? h('div', { className: 'r1-docview__off' }, h(StatusIcon, { family: 'info', size: 20, cutout: 'surface-sunken' }), h('span', null, typeof p.unavailable === 'string' ? p.unavailable : t.unavailable))
          // loading: the page is on its way; a blank sheet says which page, so the tools above keep their place.
          : p.loading ? h('div', { className: 'r1-docview__sheet r1-docview__sheet--loading', role: 'status', 'data-theme': 'light' }, h(Icon, { name: 'loader-circle', size: 20, spin: true }), h('span', null, t.loading.replace('{n}', page)))
          : h('div', { className: 'r1-docview__sheet', 'data-theme': 'light', style: zoom !== 100 ? { width: 'calc(var(--container-lg) * ' + f + ')', maxWidth: 'none', fontSize: 'calc(var(--text-xs) * ' + f + ')', lineHeight: 'calc(var(--leading-xs) * ' + f + ')' } : undefined }, p.children)));
  }

  // ------------------------------------------------------------ bulk work

  // Focus that was in a control that has just gone moves to the next control on the page, or the last one before.
  function focusAfter(anchor) {
    var all = focusables(document.body);
    for (var i = 0; i < all.length; i++) if (anchor.compareDocumentPosition(all[i]) & 4) { focusEl(all[i]); return; }
    if (all.length) focusEl(all[all.length - 1]);
  }
  // What is selected and what can be done to all of it at once. The bar appears only while something is
  // selected; its live region is there from the start, so the first count is said, and so is a cleared selection.
  function BulkBar(p) {
    var t = tx(p.locale).bulk;
    var liveRef = useRef(null);
    var wasOn = useRef(false);
    var cleared = useRef(false);
    var size = p.density === 'portal' ? 'md' : 'sm';
    var countText = p.count ? (isNil(p.total) ? t.count : t.countOf).replace('{n}', formatCount(p.count, p.locale)).replace('{total}', formatCount(p.total, p.locale)) : '';
    var liveText = p.count ? countText : wasOn.current ? t.cleared : '';
    useEffect(function () {
      if (!p.count && cleared.current && liveRef.current) {
        var at = document.activeElement;
        if (!at || at === document.body) focusAfter(liveRef.current);
      }
      cleared.current = false;
      wasOn.current = !!p.count;
    });
    var live = h('span', { key: 'live', ref: liveRef, className: 'r1-sr', role: 'status' }, liveText);
    return h(Fragment, null, live,
      p.count ? h('div', { key: 'bar', className: cx('r1-bulk', p.sticky && 'r1-bulk--sticky', p.className), role: 'region', 'aria-label': p.label || t.label, style: p.style },
        h('span', { className: 'r1-bulk__count', 'aria-hidden': 'true' }, countText),
        h('span', { className: 'r1-bulk__actions' }, (p.actions || []).map(function (a, i) {
          return h(Button, { key: i, variant: a.variant || 'secondary', size: size, icon: a.icon, href: a.href, disabled: a.disabled, disabledReason: a.disabledReason, onClick: a.onClick, locale: p.locale }, a.label);
        })),
        h(Button, { variant: 'quiet', size: size, onClick: function (e) { cleared.current = true; if (p.onClear) p.onClear(e); }, locale: p.locale }, t.clear)) : null);
  }

  // A record opened beside a queue or a form. It does not block the page behind it. When the reader opens it,
  // focus moves to its title; Escape or the close button closes it and focus goes back to what opened it.
  // Without onClose (and without a controlled open) it closes itself; onClose={false} keeps it with no close.
  function SidePanel(p) {
    var t = tx(p.locale);
    var id = useUid('r1-side');
    var ref = useRef(null);
    var size = p.density === 'portal' ? 'md' : 'sm';
    var dismissed = useState(false);
    var shown = p.open !== false && !(isNil(p.open) && dismissed[0]);
    var closable = p.onClose !== false;
    function close() { if (typeof p.onClose === 'function') p.onClose(); if (isNil(p.open)) dismissed[1](true); }
    useEffect(function () {
      if (!shown) return undefined;
      var opener = document.activeElement;
      var take = p.autoFocus === true || (p.autoFocus !== false && readerActed());
      if (take && ref.current) focusEl(ref.current.querySelector('.r1-side__title'));
      return function () {
        var at = document.activeElement;
        if (take && opener && opener.focus && document.contains(opener) && (!at || at === document.body || (ref.current && ref.current.contains(at)))) focusEl(opener);
      };
    }, [shown]);
    if (!shown) return null;
    return h('aside', { ref: ref, className: cx('r1-side', 'r1-side--' + (p.density || 'console'), p.className), 'aria-labelledby': id, style: p.style,
      onKeyDown: closable ? function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } } : undefined },
      h('div', { className: 'r1-side__head' },
        h('div', { className: 'r1-side__titles' },
          p.eyebrow ? h('span', { className: 'r1-side__eyebrow' }, p.eyebrow) : null,
          h('h2', { id: id, className: 'r1-side__title', tabIndex: -1 }, p.title),
          p.status ? h(StatusBadge, { family: p.status.family, label: p.status.label, icon: p.status.icon, size: 'sm' }) : null),
        closable ? h(Button, { className: 'r1-btn--close', variant: 'quiet', size: size, iconOnly: true, icon: 'x', 'aria-label': t.side.close + ': ' + (typeof p.title === 'string' ? p.title : textOf(p.title)), onClick: close, 'aria-keyshortcuts': 'Escape', locale: p.locale }) : null),
      h('div', { className: 'r1-side__body' }, p.children),
      p.actions && p.actions.length ? h('div', { className: 'r1-side__foot' }, p.actions.map(function (a, i) {
        return h(Button, { key: i, variant: a.variant || (i ? 'secondary' : 'primary'), size: size, icon: a.icon, href: a.href, disabled: a.disabled, disabledReason: a.disabledReason, onClick: a.onClick, locale: p.locale }, a.label);
      })) : null);
  }

  // ----------------------------------------------------------- inspection

  // The camera view for scanning a record's code, with typing the code as the way out at every step.
  // recordNoun names what is scanned ("Quét mã giấy xác nhận"); without it the words name no document type.
  // labels: the page's own words per state and per control ({asking, scanning, found, denied, unsupported, unavailable,
  // allow, torch, manual, help}), each falling back to the default. unavailable: scanning cannot be used just now for a
  // reason the page states (reason, or labels.unavailable); typing the code becomes the primary action, as when denied.
  function ScanView(p) {
    var d = tx(p.locale).scan;
    var noun = p.recordNoun ? String(p.recordNoun) : null;
    var t = Object.assign({}, d, { label: nounText(d.label, d.labelNoun, noun), asking: nounText(d.asking, d.askingNoun, noun) }, p.labels || {});
    var state = p.state || 'scanning';
    var words = { asking: t.asking, scanning: t.scanning, found: t.found, denied: t.denied, unsupported: t.unsupported, unavailable: p.reason || t.unavailable }[state];
    var blocked = state === 'denied' || state === 'unsupported' || state === 'unavailable';
    return h('section', { className: cx('r1-scan', 'r1-scan--' + state, p.className), 'aria-label': p.label || t.label, style: p.style },
      // The view is a dark surface in any light: it takes the Player's dark set, so its words and shapes use that
      // set's tokens and a status shape is cut out of the page it sits on.
      h('div', { className: 'r1-scan__view', 'data-theme': 'player' },
        p.children ? h('div', { className: 'r1-scan__feed' }, p.children) : null,
        state === 'scanning' || state === 'found' ? h('span', { className: 'r1-scan__frame', 'aria-hidden': 'true' },
          h('span', { className: 'r1-scan__corner r1-scan__corner--tl' }), h('span', { className: 'r1-scan__corner r1-scan__corner--tr' }),
          h('span', { className: 'r1-scan__corner r1-scan__corner--bl' }), h('span', { className: 'r1-scan__corner r1-scan__corner--br' })) : null,
        h('p', { className: 'r1-scan__status', role: 'status' },
          state === 'found' ? h(StatusIcon, { family: 'positive', size: 20, cutout: 'page' }) : blocked ? h(StatusIcon, { family: 'info', size: 20, cutout: 'page' }) : null,
          h('span', null, words), state === 'found' && p.code ? h('span', { className: 'r1-mono r1-scan__code' }, p.code) : null)),
      h('div', { className: 'r1-scan__actions' },
        state === 'asking' ? h(Button, { variant: 'primary', size: 'lg', icon: 'qr-code', onClick: p.onAllow, locale: p.locale }, t.allow) : null,
        state === 'denied' && p.helpHref ? h(Button, { variant: 'secondary', size: 'lg', href: p.helpHref, locale: p.locale }, t.help) : null,
        state === 'scanning' && p.torch !== false ? h(Button, { variant: 'secondary', size: 'lg', icon: 'flashlight', 'aria-pressed': p.torch ? 'true' : 'false', onClick: p.onTorch, locale: p.locale }, t.torch) : null,
        h(Button, { variant: state === 'unsupported' || state === 'unavailable' || (state === 'denied' && !p.helpHref) ? 'primary' : 'quiet', size: 'lg', icon: 'keyboard', onClick: p.onManual, href: p.manualHref, locale: p.locale }, t.manual)));
  }

  // A short recording made on the spot, with its length limit, its level and what happens to it stated before it starts.
  function AudioRecorder(p) {
    var t = tx(p.locale).rec;
    var state = p.state || 'idle';
    var max = p.max || 30, el = Math.min(p.elapsed || 0, max);
    var levels = p.levels || [];
    return h('section', { className: cx('r1-rec', 'r1-rec--' + state, p.className), 'aria-label': p.label || t.label, style: p.style },
      h('div', { className: 'r1-rec__main' },
        state === 'recording'
          ? h('button', { type: 'button', className: 'r1-rec__button r1-rec__button--stop', 'aria-label': t.stop, onClick: p.onStop }, h(Icon, { name: 'square', size: 20 }))
          : h('button', { type: 'button', className: 'r1-rec__button', 'aria-label': state === 'recorded' ? t.again : state === 'denied' ? t.retry : t.start, onClick: p.onStart }, h(Icon, { name: state === 'denied' ? 'refresh-cw' : 'mic', size: 20 })),
        h('div', { className: 'r1-rec__readout' },
          h('span', { className: 'r1-rec__state', role: 'status' }, { idle: t.idle, recording: t.recording, recorded: t.recorded, denied: t.denied }[state]),
          h('span', { className: 'r1-rec__time r1-num' }, clockOf(el) + ' / ' + clockOf(max)),
          state === 'recording' || state === 'recorded' ? h('span', { className: 'r1-rec__levels', 'aria-hidden': 'true' }, levels.map(function (v, i) {
            return h('span', { key: i, className: 'r1-rec__lvl', style: { height: Math.max(8, Math.round(v * 100)) + '%' } });
          })) : null)),
      p.note ? h('p', { className: 'r1-rec__note' }, p.note) : null,
      state === 'recorded' ? h('div', { className: 'r1-rec__actions' },
        // loading: the recording is being kept, and Keep says it is busy.
        h(Button, { variant: 'primary', size: 'lg', loading: !!p.loading, onClick: p.onKeep, locale: p.locale }, p.keepLabel || t.keep),
        h(Button, { variant: 'quiet', size: 'lg', onClick: p.onDiscard, locale: p.locale }, t.discard)) : null);
  }

  // A week of the resolved schedule: one row per day, 24 hours across, each stretch coloured by what plays.
  // kinds: scheduled (a schedule plays), default (the default playlist), fallback (a schedule cannot play, the default does), none (nothing plays).
  var SLOT_KINDS = ['scheduled', 'default', 'fallback', 'none'];
  function slotOf(hm) { var x = String(hm).split(':'); return Math.round((Number(x[0]) * 60 + Number(x[1] || 0)) / 15); }
  // Each stretch is named by what plays there (the kind's word), then its title, so a fallback or an empty hour
  // is said even when the stretch has a title. A stretch that runs past midnight ends at 24:00 on its day and
  // carries on from 00:00 on the next row. Fallback and nothing-can-play also differ by edge and shape.
  function ScheduleGrid(p) {
    var t = tx(p.locale).sched;
    var raw = p.days || [];
    var names = p.kinds || {};
    var ticks = ['00:00', '06:00', '12:00', '18:00', '24:00'];
    var days = raw.map(function (d) { return { label: d.label, current: d.current, segments: [] }; });
    raw.forEach(function (d, i) {
      (d.segments || []).forEach(function (g) {
        var a = slotOf(g.from), b = slotOf(g.to);
        if (b === a) return;
        if (b > a) { days[i].segments.push(g); return; }
        days[i].segments.push(Object.assign({}, g, { to: '24:00', cont: 'next' }));
        if (b > 0 && days[i + 1]) days[i + 1].segments.unshift(Object.assign({}, g, { from: '00:00', cont: 'prev' }));
      });
    });
    var used = {};
    days.forEach(function (d) { d.segments.forEach(function (g) { used[g.kind] = true; }); });
    function words(g) {
      var kind = names[g.kind] || '';
      var own = g.title || g.label || '';
      var parts = [kind];
      if (own && fold(kind).indexOf(fold(own)) < 0) parts.push(own);
      if (g.cont) parts.push(t[g.cont]);
      return g.from + '–' + g.to + ' ' + parts.filter(Boolean).join(', ');
    }
    var mark = { fallback: 'attention', none: 'danger' };
    return h('figure', { className: cx('r1-sched', p.className), style: p.style },
      p.caption ? h('figcaption', { className: 'r1-sr' }, p.caption) : null,
      h('div', { className: 'r1-sched__row r1-sched__row--ticks', 'aria-hidden': 'true' }, h('span', null), h('div', { className: 'r1-sched__ticks r1-num' }, ticks.map(function (x, i) { return h('span', { key: x, className: 'r1-sched__tick', style: { left: (i * 100 / (ticks.length - 1)) + '%' } }, x); }))),
      days.map(function (d, i) {
        var segs = d.segments;
        return h('div', { key: i, className: cx('r1-sched__row', d.current && 'r1-sched__row--current') },
          h('span', { className: 'r1-sched__day' }, d.label),
          h('div', { className: 'r1-sched__track', role: 'img', 'aria-label': d.label + ': ' + segs.map(words).join('; ') }, segs.map(function (g, k) {
            var a = slotOf(g.from), b = slotOf(g.to);
            var fam = mark[g.kind];
            return h('span', { key: k, className: cx('r1-sched__seg', 'r1-sched__seg--' + (g.kind || 'default'), g.cont && 'r1-sched__seg--' + g.cont), style: { gridColumn: (a + 1) + ' / ' + (b + 1) }, title: words(g) },
              b - a >= 6 && g.label ? h('span', { className: 'r1-sched__label' }, fam ? h(StatusIcon, { family: fam, size: 16, cutout: fam + '-tint' }) : null, h('span', null, g.label)) : null);
          })));
      }),
      h('ul', { className: 'r1-sched__legend' }, SLOT_KINDS.filter(function (k) { return used[k] && names[k]; }).map(function (k) {
        return h('li', { key: k }, h('span', { className: 'r1-sched__swatch r1-sched__seg--' + k, 'aria-hidden': 'true' }), names[k]);
      })));
  }

  // ------------------------------------------------- codes and short lists

  // A short numeric code in one box per digit: pairing a device, confirming a contact channel.
  // Inside a Player frame the boxes take the frame's --code-digit-* sizes.
  // One box per digit that behaves as one field: typing moves on, Backspace in an empty box goes back,
  // arrows move, and a pasted or autofilled code fills every box. onChange(code), onComplete(code).
  // loading: the code is being checked; the boxes turn read-only and keep focus, and a line says so.
  // disabled states its reason with disabledReason.
  function CodeInput(p) {
    var t = tx(p.locale);
    var id = useUid('r1-code');
    var busy = !!p.loading;
    useEffect(function () { if (busy && readerActed()) announce(t.codeInput.checking, 'polite'); }, [busy]);
    var described = [p.helper && id + '-help', p.error && id + '-msg', busy && id + '-busy', p.disabled && p.disabledReason && id + '-why'].filter(Boolean).join(' ') || undefined;
    var n = p.length || 6;
    // chars="alnum": letters and digits, written in capitals (a pairing code). group: boxes per block, so a long code
    // reads in blocks and wraps between them, never inside one.
    var alnum = p.chars === 'alnum';
    var per = p.group > 0 && p.group < n ? p.group : 0;
    function clean(v) { v = String(v || '').replace(alnum ? /[^0-9a-z]/gi : /\D/g, ''); return alnum ? v.toUpperCase() : v; }
    var given = p.digits ? p.digits.map(function (d) { return d || ' '; }).join('') : isNil(p.value) ? undefined : String(p.value);
    var st = useSynced(given, '');
    var refs = useRef([]);
    var goTo = useRef(null);
    var latest = useLatest(p);
    var boxes = [];
    for (var i = 0; i < n; i++) { var ch = st[0].charAt(i); boxes.push(ch && ch !== ' ' ? ch : ''); }
    var focus = isNil(p.focus) ? -1 : p.focus;
    useEffect(function () { if (goTo.current !== null) { focusEl(refs.current[goTo.current]); goTo.current = null; } });
    function commit(next, focusAt, e) {
      st[1](next.map(function (d) { return d || ' '; }).join('').replace(/\s+$/, ''));
      if (!isNil(focusAt)) goTo.current = Math.max(0, Math.min(n - 1, focusAt));
      var code = next.join('');
      if (latest.current.onChange) latest.current.onChange(code, e);
      if (code.length === n && latest.current.onComplete) latest.current.onComplete(code);
    }
    function fill(at, digits, e) {
      var next = boxes.slice();
      for (var k = 0; k < digits.length && at + k < n; k++) next[at + k] = digits.charAt(k);
      commit(next, at + digits.length, e);
    }
    function onChange(i) {
      return function (e) {
        if (latest.current.loading) return;
        var d = clean(e.target.value);
        if (!d) { var next = boxes.slice(); next[i] = ''; commit(next, null, e); return; }
        if (d.length >= n) { fill(0, d.slice(0, n), e); return; }
        if (boxes[i] && d.length === 2 && d.charAt(0) === boxes[i]) d = d.charAt(1);
        fill(i, d, e);
      };
    }
    function onKey(i) {
      return function (e) {
        if (e.key === 'Backspace' && !boxes[i] && i > 0 && !latest.current.loading) { e.preventDefault(); var next = boxes.slice(); next[i - 1] = ''; commit(next, i - 1, e); }
        else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); focusEl(refs.current[i - 1]); }
        else if (e.key === 'ArrowRight' && i < n - 1) { e.preventDefault(); focusEl(refs.current[i + 1]); }
      };
    }
    function blocks(inputs) {
      if (!per) return inputs;
      var out = [];
      for (var b = 0; b < inputs.length; b += per) out.push(h('span', { key: 'b' + b, className: 'r1-code__group' }, inputs.slice(b, b + per)));
      return out;
    }
    function onPaste(i) {
      return function (e) {
        if (latest.current.loading) { e.preventDefault(); return; }
        var d = clean((e.clipboardData && e.clipboardData.getData('text')) || '');
        if (!d) return;
        e.preventDefault();
        fill(d.length >= n ? 0 : i, d.slice(0, n), e);
      };
    }
    return h('div', { className: cx('r1-code', p.error && 'r1-code--error', busy && 'r1-code--busy', p.className), style: p.style },
      h('label', { id: id + '-label', className: 'r1-code__label', htmlFor: id + '-0' }, p.label),
      p.helper ? h('p', { id: id + '-help', className: 'r1-field__help' }, p.helper) : null,
      h('div', { className: cx('r1-code__boxes', per && 'r1-code__boxes--grouped'), role: 'group', 'aria-labelledby': id + '-label', 'aria-busy': busy ? 'true' : undefined },
        blocks(boxes.map(function (v, i) {
          return h('input', {
            key: i, id: id + '-' + i, className: cx('r1-code__box', i === focus && 'r1-code__box--focus'),
            ref: function (el) { refs.current[i] = el; }, value: v, onChange: onChange(i), onKeyDown: onKey(i), onPaste: onPaste(i),
            onFocus: function (e) { e.target.select(); },
            inputMode: alnum ? 'text' : 'numeric', autoCapitalize: alnum ? 'characters' : undefined, spellCheck: false,
            autoComplete: i === 0 && !alnum ? 'one-time-code' : 'off', maxLength: n, disabled: p.disabled, readOnly: busy,
            'aria-label': (alnum ? t.codeInput.char : t.codeInput.digit) + ' ' + (i + 1) + ' ' + t.codeInput.of + ' ' + n,
            'aria-invalid': p.error ? 'true' : undefined, 'aria-describedby': described
          });
        }))),
      busy ? h('p', { id: id + '-busy', className: 'r1-code__busy' }, h(Icon, { name: 'loader-circle', size: 16, spin: true }), h('span', null, t.codeInput.checking)) : null,
      p.error ? h(FieldMessage, { id: id + '-msg', severity: 'error', locale: p.locale }, p.error) : null,
      p.disabled && p.disabledReason ? h('div', { id: id + '-why', className: 'r1-field__reason' }, h(Icon, { name: 'info', size: 16 }), h('span', null, p.disabledReason)) : null);
  }

  // Instructions in order, each a sentence. On the Player the sizes follow the frame.
  function NumberedSteps(p) {
    var steps = p.steps || [];
    return h('section', { className: cx('r1-nsteps', p.className), style: p.style },
      p.title ? h(p.level === 3 ? 'h3' : 'h2', { className: 'r1-nsteps__title' }, p.title) : null,
      h('ol', { className: 'r1-nsteps__list' }, steps.map(function (s, i) {
        return h('li', { key: i, className: 'r1-nsteps__item' },
          h('span', { className: 'r1-nsteps__n r1-num', 'aria-hidden': 'true' }, String(i + 1)),
          h('span', { className: 'r1-nsteps__text' }, s));
      })));
  }

  // One status in a line of text: the shape, the words, and one line of detail. Lighter than a Banner.
  // Not a live region: a line drawn with the page is read in order. When its text changes, or it appears after
  // the reader acted, it is said once with its family in words ("Cần chú ý: ..."); live forces it on or off,
  // and an explicit role makes the line its own live region instead.
  function StatusLine(p) {
    var t = tx(p.locale);
    var family = STATUS_FAMILIES.indexOf(p.family) >= 0 ? p.family : 'info';
    var text = textOf(p.text || p.children);
    var first = useRef(true);
    useEffect(function () {
      var mount = first.current; first.current = false;
      if (p.role || p.live === false || !text) return;
      if (p.live === true || !mount || readerActed()) announce(t.status[family] + ': ' + joinSentences([text, textOf(p.detail)]), family === 'danger' ? 'assertive' : 'polite');
    }, [text]);
    return h('p', { className: cx('r1-sline', 'r1-sline--' + family, p.className), role: p.role, style: p.style },
      h(StatusIcon, { family: family, size: 20, cutout: p.cutout || 'page' }),
      h('span', { className: 'r1-sline__body' },
        h('span', { className: 'r1-sline__text' }, h('span', { className: 'r1-sr' }, t.status[family] + ': '), p.text || p.children),
        p.detail ? h('span', { className: 'r1-sline__detail' }, p.detail) : null));
  }

  // ----------------------------------------------------------------- shells

  // VI | EN on screen, "Tiếng Việt" and "English" to a screen reader, each name in its own language.
  // density: portal and premises (the default) are 44 px touch targets; console is 32 px.
  function LangToggle(p) {
    var t = tx(p.locale);
    var cur = lang(p.locale);
    return h('div', { className: cx('r1-lang', 'r1-lang--' + (p.density || 'portal'), p.className), role: 'group', 'aria-label': t.shell.language, style: p.style },
      ['vi', 'en'].map(function (l) {
        return h('button', { key: l, type: 'button', className: 'r1-lang__btn', 'aria-pressed': cur === l ? 'true' : 'false', lang: l, 'aria-label': t.langs[l], onClick: p.onChange ? function () { p.onChange(l); } : undefined }, l.toUpperCase());
      }));
  }

  // A shell follows the theme of the page it sits on (the nearest data-theme above it, else dark) unless the app passes
  // `theme`. There is no switch for the reader: every screen is dark; light is for paper (1 Oct 2026).
  function useShellTheme(p, rootRef) {
    var inherited = useState('dark');
    useLayoutEffect(function () {
      var el = rootRef.current && rootRef.current.parentElement && rootRef.current.parentElement.closest('[data-theme]');
      var v = el && el.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      if (v !== inherited[0]) inherited[1](v);
    });
    var own = p.theme === 'light' || p.theme === 'dark' ? p.theme : null;
    return {
      attr: own || undefined,
      value: own || inherited[0]
    };
  }

  // The wordmark. RightOne by default; a shell drawn for the identity service (RightOne ID) passes brand.
  function Mark(p) {
    return h('span', { className: 'r1-mark' }, p.name || 'RightOne', p.suffix ? h('span', { className: 'r1-mark__suffix' }, p.suffix) : null);
  }

  function SkipLink(p) { return h('a', { className: 'r1-skip', href: '#' + p.to }, tx(p.locale).shell.skip); }
  // Where a nav entry leads: a link with its address, or a button with its handler. Never a link to "#".
  function navTarget(n, cls, content) {
    if (n.href) return h('a', { className: cls, href: n.href, 'aria-current': n.current ? 'page' : undefined }, content);
    return h('button', { type: 'button', className: cls, 'aria-current': n.current ? 'page' : undefined, onClick: n.onClick }, content);
  }
  var PUBLIC_LINKS = { help: '/help', privacy: '/privacy', contact: '/contact', legal: '/legal' };

  // variant 'field': the inspector's field app on a phone (390 and 320). Under the bar a status strip says whether the
  // phone is online and the state of the verification key it checks codes with: network ('online' | 'offline') and
  // verificationKey ({state: 'valid' | 'expiring' | 'missing', until}). The strip is a polite status region, so a change
  // is said once; drawn with the page it is read in order. Every target in the field frame is at least 44 px
  // (target-premises), and the footer keeps the one contact link, as on the verification routes.
  var FIELD_KEY_FAMILY = { valid: 'positive', expiring: 'attention', missing: 'danger' };
  function fieldStrip(p, t) {
    var net = p.network === 'offline' ? 'offline' : p.network === 'online' ? 'online' : null;
    var key = p.verificationKey || null;
    var ks = key && FIELD_KEY_FAMILY[key.state] ? key.state : null;
    if (!net && !ks) return null;
    var until = key && key.until ? (ks === 'expiring' ? formatTimestamp(key.until, p.locale) : formatDate(key.until, p.locale)) : null;
    var keyText = ks === 'valid' ? (until ? t.shell.keyValid.replace('{date}', until) : null)
      : ks === 'expiring' ? (until ? t.shell.keyExpiring.replace('{date}', until) : null)
      : ks === 'missing' ? t.shell.keyMissing + '. ' + t.shell.keyMissingDo : null;
    return h('div', { className: 'r1-public__field', role: 'status', 'aria-label': t.shell.fieldStatus },
      net ? h('p', { className: 'r1-public__fielditem r1-public__fielditem--' + (net === 'online' ? 'positive' : 'info') },
        h(Icon, { name: net === 'online' ? 'wifi' : 'wifi-off', size: 20, className: 'r1-public__fieldicon' }), h('span', null, t.shell[net])) : null,
      ks && keyText ? h('p', { className: 'r1-public__fielditem r1-public__fielditem--' + FIELD_KEY_FAMILY[ks] },
        h(StatusIcon, { family: FIELD_KEY_FAMILY[ks], size: 20, cutout: 'surface' }), h('span', null, keyText)) : null);
  }
  function PublicShell(p) {
    var t = tx(p.locale);
    var mainId = useUid('r1-main');
    var field = p.variant === 'field';
    var verification = p.variant === 'verification' || field;
    var links = Object.assign({}, PUBLIC_LINKS, p.links || {});
    var foot = verification ? ['contact'] : ['help', 'privacy', 'contact', 'legal'];
    var rootRef = useRef(null);
    var theme = useShellTheme(p, rootRef);
    return h('div', { ref: rootRef, className: cx('r1-shell r1-shell--public', field && 'r1-shell--field', p.fill && 'r1-shell--fill', p.className), style: p.style, lang: lang(p.locale), 'data-theme': theme.attr },
      h(SkipLink, { to: mainId, locale: p.locale }),
      h('header', { className: 'r1-public__bar' }, h(Mark, { name: p.brand }), p.langSwitch === false ? null : h('span', { className: 'r1-shell__switches' },
        h(LangToggle, { locale: p.locale, onChange: p.onLocale }))),
      field ? fieldStrip(p, t) : null,
      h('main', { id: mainId, tabIndex: -1, className: 'r1-public__main', style: p.maxWidth ? { maxWidth: p.maxWidth } : undefined }, p.children),
      // A product with none of these pages passes them empty: no footer is drawn rather than an empty strip.
      (function () {
        var shown = foot.filter(function (k) { return links[k]; });
        return shown.length ? h('footer', { className: 'r1-public__foot' }, shown.map(function (k) {
          return h('a', { key: k, className: 'r1-link', href: links[k] }, t.shell[k]);
        })) : null;
      })());
  }

  // At phone width the bottom bar holds five places. With six sections or more it shows four and Thêm, which opens
  // the rest above the bar (Escape or a click outside closes it). The current section always stays in the bar: when it
  // is not among the first four it takes the fourth place, and the others keep their order in Thêm. moreOpen draws the
  // list open, for a specimen. The language switch sits in
  // the bar beside the account.
  function PortalShell(p) {
    var t = tx(p.locale);
    var mainId = useUid('r1-main');
    var moreId = useUid('r1-more');
    var more = useState(!!p.moreOpen);
    var moreRef = useRef(null);
    var shellRef = useRef(null);
    var theme = useShellTheme(p, shellRef);
    var nav = (p.nav || []).filter(function (n) { return !n.hidden; });
    var phone = p.layout === 'phone';
    var overflow = phone && nav.length > 5;
    var cur = overflow ? nav.filter(function (n) { return n.current; })[0] : null;
    var late = cur && nav.indexOf(cur) >= 4;
    var shown = !overflow ? nav : late ? nav.slice(0, 3).concat([cur]) : nav.slice(0, 4);
    var rest = !overflow ? [] : nav.filter(function (n) { return shown.indexOf(n) < 0; });
    var restCurrent = rest.some(function (n) { return n.current; });
    var restIcons = rest.some(function (n) { return n.icon || n.disabled; });
    useEffect(function () {
      if (!more[0]) return undefined;
      function onDown(e) { if (moreRef.current && !moreRef.current.contains(e.target)) more[1](false); }
      document.addEventListener('mousedown', onDown);
      document.addEventListener('touchstart', onDown);
      return function () { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); };
    }, [more[0]]);
    // At phone width every place in the bar has a 20 px icon slot, so the labels share one line whether or not an
    // entry has an icon; 20 px leaves a two-line label room in the 64 px bar. A section that cannot be used yet shows
    // the lock: in place of its icon on a phone, before its name on the desktop bar (16 px, as the text is text-sm).
    function content(n, withIcon) {
      var icon = n.disabled ? 'lock' : n.icon;
      return [withIcon ? (icon ? h(Icon, { key: 'i', name: icon, size: 20 }) : h('span', { key: 'i', className: 'r1-portal__noicon', 'aria-hidden': 'true' }))
        : n.disabled ? h(Icon, { key: 'i', name: 'lock', size: 16 }) : null, h('span', { key: 't' }, n.label)];
    }
    var items = shown.map(function (n, i) {
      // A section the premises cannot use yet stays in the nav, reachable, and says why on pointer over and focus.
      return h('li', { key: i },
        n.disabled ? h(Tooltip, { label: n.reason, placement: phone ? 'top' : 'bottom' }, h('span', { className: 'r1-portal__link r1-portal__link--disabled', 'aria-disabled': 'true', tabIndex: 0 }, content(n, phone)))
          : navTarget(n, 'r1-portal__link', content(n, phone)));
    });
    if (overflow) {
      items.push(h('li', { key: 'more', ref: moreRef, className: 'r1-portal__moreitem',
        onKeyDown: function (e) { if (e.key === 'Escape' && more[0]) { e.stopPropagation(); more[1](false); focusEl(document.getElementById(moreId + '-btn')); } } },
        h('button', { type: 'button', id: moreId + '-btn', className: cx('r1-portal__link', restCurrent && 'r1-portal__link--within'), 'aria-expanded': more[0] ? 'true' : 'false', 'aria-controls': moreId, onClick: function () { more[1](!more[0]); } },
          h(Icon, { name: 'ellipsis', size: 20 }), h('span', null, t.shell.more)),
        more[0] ? h('ul', { id: moreId, className: 'r1-portal__more', 'aria-label': t.layout.moreNav, onClick: function (e) { if (e.target.closest && e.target.closest('a, button')) more[1](false); } }, rest.map(function (n, i) {
          // When any entry here has an icon (a closed one has the lock), an entry without one keeps the slot, so the names line up.
          var inner = [n.disabled ? h(Icon, { key: 'i', name: 'lock', size: 20 }) : n.icon ? h(Icon, { key: 'i', name: n.icon, size: 20 })
            : restIcons ? h('span', { key: 'i', className: 'r1-portal__moreslot', 'aria-hidden': 'true' }) : null,
            h('span', { key: 't', className: 'r1-portal__moretext' }, h('span', null, n.label), n.disabled && n.reason ? h('span', { className: 'r1-portal__morewhy' }, n.reason) : null)];
          return h('li', { key: i }, n.disabled
            ? h('span', { className: 'r1-portal__morelink r1-portal__morelink--disabled', 'aria-disabled': 'true', tabIndex: 0 }, inner)
            : navTarget(n, 'r1-portal__morelink', inner));
        })) : null));
    }
    // No sections, no navigation landmark: a page with only the account (RightOne ID's account pages put their own list beside the content).
    var navEl = nav.length ? h('nav', { className: phone ? 'r1-portal__bottom' : 'r1-portal__nav', 'aria-label': t.shell.menu }, h('ul', null, items)) : null;
    return h('div', { ref: shellRef, className: cx('r1-shell r1-shell--portal', phone && 'r1-shell--phone', p.fill && 'r1-shell--fill', p.className), style: p.style, lang: lang(p.locale), 'data-theme': theme.attr },
      h(SkipLink, { to: mainId, locale: p.locale }),
      h('header', { className: 'r1-portal__bar' },
        h(Mark, { name: p.brand, suffix: p.surfaceLabel }),
        phone ? null : navEl,
        h('div', { className: 'r1-portal__account' },
          h('span', { className: 'r1-shell__switches' },
            p.langSwitch === false ? null : h(LangToggle, { locale: p.locale, onChange: p.onLocale })),
          p.account ? h('span', { className: 'r1-portal__acct' }, h(Icon, { name: 'user', size: 16 }), h('span', { className: 'r1-portal__acctname' }, p.account)) : null,
          signOutControl(p, phone ? 'phone' : 'md'))),
      p.context ? h('div', { className: 'r1-portal__context', role: 'region', 'aria-label': p.context.label || t.layout.context },
        h(Icon, { name: 'building-2', size: 16 }),
        h('span', { className: 'r1-portal__ctx-name' }, p.context.premises),
        p.context.period ? h('span', { className: 'r1-portal__ctx-period' }, p.context.period) : null) : null,
      h('main', { id: mainId, tabIndex: -1, className: 'r1-portal__main' }, p.children),
      phone ? navEl : null);
  }

  // The rail collapses to its icons and back from the button at its foot (aria-expanded). The choice is kept:
  // the page's collapsed prop wins, and without it the rail remembers the last choice in this browser.
  // Collapsed, each entry shows its name and count beside it on pointer over and keyboard focus; Escape hides it.
  // keyMap ({keys, label} per line) gives the console its list of shortcuts: "?" opens it from anywhere in the shell
  // (the key is handled on the shell's own element), and so does any control inside it that declares
  // aria-keyshortcuts="?", such as a screen's Keys button. keysOpen draws it open.
  var RAIL_KEY = 'r1-console-rail';
  // signOut ({label, href, onClick}): the way out of the session, at the end of the bar beside the account. On a phone
  // it is the icon alone, named for a screen reader. A shell without it draws none: the product decides where signing out lives.
  function signOutControl(p, size) {
    var s = p.signOut;
    if (!s) return null;
    var label = s.label || tx(p.locale).shell.signOut;
    return size === 'phone'
      ? h(Button, { variant: 'quiet', size: 'md', icon: 'log-out', iconOnly: true, 'aria-label': label, href: s.href, onClick: s.onClick, locale: p.locale })
      : h(Button, { variant: 'quiet', size: size, icon: 'log-out', href: s.href, onClick: s.onClick, locale: p.locale }, label);
  }
  // A secret shown once: a personal token, an agent's credential, recovery codes, a client secret, a short-lived token.
  // The value in full and wrapping, in monospace; one copy control; and the sentence that it will not be shown again.
  // values (a list, such as recovery codes) draws them in two columns with one control that copies them all.
  function SecretValue(p) {
    var t = tx(p.locale);
    var st = useState('idle');
    var timer = useRef(null), boxRef = useRef(null);
    var labelId = useUid('r1-secret');
    useEffect(function () { return function () { clearTimeout(timer.current); }; }, []);
    var values = (p.values || (isNil(p.value) ? [] : [p.value])).map(String);
    var many = values.length > 1;
    var spell = !!p.spell;
    function show(next) { st[1](next); clearTimeout(timer.current); timer.current = setTimeout(function () { st[1]('idle'); }, next === 'failed' ? 6000 : 1600); }
    function copied() { show('copied'); announce(t.secret.copied); }
    function selectValue() {
      try {
        var r = document.createRange(); r.selectNodeContents(boxRef.current);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        return sel;
      } catch (e) { return null; }
    }
    function legacyCopy() {
      // A spelled value carries its spoken form in the box, so the fallback copies the value from a field off screen.
      if (spell) {
        var ta = document.createElement('textarea'), done = false;
        ta.value = values.join('\n'); ta.setAttribute('readonly', ''); ta.className = 'r1-sr';
        document.body.appendChild(ta);
        try { ta.select(); done = document.execCommand('copy'); } catch (e) { done = false; }
        document.body.removeChild(ta);
        return done;
      }
      var sel = selectValue(), ok = false;
      try { ok = !!sel && document.execCommand('copy'); } catch (e) { ok = false; }
      if (ok && sel) sel.removeAllRanges();
      return ok;
    }
    // A copy the browser refuses is said, and the value is left selected for the reader to copy.
    function failed() { selectValue(); show('failed'); announce(t.copyFailed); }
    function onCopy() {
      var c = typeof navigator !== 'undefined' ? navigator.clipboard : null;
      if (c && c.writeText) {
        try { c.writeText(values.join('\n')).then(copied, function () { if (legacyCopy()) copied(); else failed(); }); return; } catch (e) { /* fall through */ }
      }
      if (legacyCopy()) copied(); else failed();
    }
    var label = st[0] === 'copied' ? t.secret.copied : many ? t.secret.copyAll.replace('{n}', formatCount(values.length, p.locale)) : (p.copyLabel || t.secret.copy);
    // spell: a code read aloud or typed from the screen (a recovery code, a pairing code). The value is drawn in groups
    // (at its own separators, else every four characters) and a line breaks only between two groups; a screen reader
    // hears the characters one by one, a pause between groups. The copy and the selection are the value as it is.
    function spelled(v, i) {
      // A value with its own separators keeps them as the gap between groups; one without is cut every four
      // characters, and the groups stand space-2 apart.
      var own = /[\s\-./_:]/.test(v);
      var groups = own ? v.match(/[^\s\-./_:]+[\s\-./_:]*/g) || [v] : v.match(/.{1,4}/g) || [v];
      var said = groups.map(function (g) { return g.replace(/[\s\-./_:]+$/, '').split('').join(' '); }).join(', ');
      var parts = [];
      groups.forEach(function (g, k) { if (k) parts.push(h('wbr', { key: 'w' + k })); parts.push(h('span', { key: 'g' + k, className: cx('r1-secret__group', !own && 'r1-secret__group--gap') }, g)); });
      return [h('span', { key: 'v' + i, className: 'r1-secret__spell', 'aria-hidden': 'true' }, parts), h('span', { key: 's' + i, className: 'r1-sr r1-secret__said' }, said)];
    }
    return h('div', { className: cx('r1-secret', p.size === 'lg' && 'r1-secret--lg', spell && 'r1-secret--spell', p.className), style: p.style },
      p.label ? h('p', { id: labelId, className: 'r1-secret__label' }, p.label) : null,
      h('div', { className: 'r1-secret__box' },
        many ? h('ol', { ref: boxRef, className: 'r1-secret__list', 'aria-labelledby': p.label ? labelId : undefined }, values.map(function (v, i) { return h('li', { key: i }, spell ? spelled(v, i) : v); }))
          : h('code', { ref: boxRef, className: 'r1-secret__value', tabIndex: 0, 'aria-labelledby': p.label ? labelId : undefined }, spell ? spelled(values[0] || '', 0) : values[0] || ''),
        h(Button, { variant: 'secondary', size: p.density === 'console' ? 'sm' : undefined, icon: st[0] === 'copied' ? 'check' : 'copy', onClick: onCopy, locale: p.locale }, label)),
      st[0] === 'failed' ? h('p', { className: 'r1-secret__msg' }, t.copyFailedShort) : null,
      p.once === false ? null : h(StatusLine, { family: 'attention', text: p.note || t.secret.once, live: false, locale: p.locale }));
  }

  // A mode the reader must not forget, across the top of the console and sticky with its bar: acting as another person,
  // a maintenance window. It says what the mode is, when it ends and how long is left, and offers the way out.
  function ShellNotice(p) {
    var t = tx(p.locale);
    var family = p.family === 'danger' ? 'danger' : 'attention';
    var until = p.until ? toDate(p.until) : null;
    var now = p.now ? toDate(p.now) : new Date();
    var at = until ? formatTime(until) + ' (' + offsetLabel(until) + ')' : null;
    var when = until ? (until - now > 0 ? t.notice.until.replace('{at}', at).replace('{left}', formatDuration(until - now, p.locale)) : t.notice.ended.replace('{at}', at)) : null;
    var a = p.action;
    return h('div', { ref: p.innerRef, className: cx('r1-shell-notice', 'r1-shell-notice--' + family), role: 'status' },
      h(Icon, { name: p.icon || 'eye', size: 16 }),
      h('p', { className: 'r1-shell-notice__text' }, p.title ? h('strong', null, p.title) : null, p.title && p.text ? ' ' : null, p.text || null),
      when ? h('span', { className: 'r1-shell-notice__when r1-num' }, when) : null,
      a ? h(Button, { variant: 'secondary', size: 'sm', icon: a.icon, href: a.href, onClick: a.onClick, locale: p.locale }, a.label) : null);
  }

  function ConsoleShell(p) {
    var t = tx(p.locale);
    var mainId = useUid('r1-main');
    var railId = useUid('r1-rail');
    var rail = p.rail || [];
    var latest = useLatest(p);
    var searchLabel = p.searchLabel || t.shell.search;
    var fold = useState(function () {
      if (!isNil(p.collapsed)) return !!p.collapsed;
      try { return window.localStorage.getItem(RAIL_KEY) === 'collapsed'; } catch (e) { return false; }
    });
    var quiet = useState(false);
    var keys = useSynced(p.keysOpen, false);
    // singleKeys="off": the page turns the shell's single-character keys off for everyone; otherwise the reader's choice,
    // kept in this browser, decides. "?" is one of them; the list still opens from a control that declares
    // aria-keyshortcuts="?" and, while the keys are off, from the Keys button the bar then shows.
    var singleOn = useSingleKeys();
    var forcedOff = p.singleKeys === 'off';
    var keysLive = singleOn && !forcedOff;
    function showKeys(v) { keys[1](v); if (p.onKeys) p.onKeys(v); }
    function onRootKey(e) {
      if (!p.keyMap || keys[0] || !keysLive || e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      e.preventDefault(); showKeys(true);
    }
    function onRootClick(e) {
      if (!p.keyMap || keys[0] || !e.target.closest) return;
      var b = e.target.closest('[aria-keyshortcuts]');
      if (b && e.currentTarget.contains(b) && /(^|\s)\?(\s|$)/.test(b.getAttribute('aria-keyshortcuts'))) showKeys(true);
    }
    // Buttons in the shell that carry a shortcut join the list when it opens, named by their label.
    var rootRef = useRef(null);
    var theme = useShellTheme(p, rootRef);
    var noticeRef = useRef(null);
    // The bar sticks under the notice: it sits as far down as the notice is tall, whatever its text wraps to.
    useLayoutEffect(function () {
      if (!rootRef.current) return;
      rootRef.current.style.setProperty('--r1-notice-h', (noticeRef.current ? noticeRef.current.offsetHeight : 0) + 'px');
    });
    // What the page binds, read from the components inside the shell: shell keys (data-r1-shortcut on a Button, a
    // FilterBar or a SearchField, listed by data-r1-shortcut-label, else the aria-label, else the text) and keys a
    // component handles while it has focus (data-r1-focus-keys).
    function boundKeys(root) {
      var shell = {}, focus = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-r1-shortcut]'), function (el) {
        var id = keyId(el.getAttribute('data-r1-shortcut'));
        if (id) shell[id] = true;
      });
      Array.prototype.forEach.call(root.querySelectorAll('[data-r1-focus-keys]'), function (el) {
        el.getAttribute('data-r1-focus-keys').split(/\s+/).forEach(function (k) { if (k) focus[k] = true; });
      });
      if (p.keyMap) shell['?'] = true;
      shell['mod+k'] = true;
      return { shell: shell, focus: focus };
    }
    var found = useState({ lines: [], focus: {} });
    useLayoutEffect(function () {
      if (!keys[0] || !rootRef.current) return;
      var seen = {};
      found[1]({ focus: boundKeys(rootRef.current).focus, lines: Array.prototype.map.call(rootRef.current.querySelectorAll('[data-r1-shortcut]'), function (el) {
        return { keys: [el.getAttribute('data-r1-shortcut')], label: el.getAttribute('data-r1-shortcut-label') || el.getAttribute('aria-label') || el.textContent.trim() };
      }).filter(function (k) { var id = k.keys[0] + '\u0001' + k.label; if (seen[id] || !k.label) return false; seen[id] = true; return true; }) });
    }, [keys[0]]);
    // A key the list names that nothing on the page binds is said once in the console (OD-18): a listed key must work.
    var warnedKeys = useRef({});
    useEffect(function () {
      if (!p.keyMap || !rootRef.current) return;
      var b = boundKeys(rootRef.current);
      p.keyMap.forEach(function (line) {
        (line.keys || []).forEach(function (k) {
          var id = keyId(k);
          if (!id || NATIVE_KEYS[id] || b.shell[id] || b.focus[id] || warnedKeys.current[id]) return;
          warnedKeys.current[id] = true;
          warnOnce('the key list names "' + k + '" (' + textOf(line.label) + '), but no component in this ConsoleShell binds it.');
        });
      });
    });
    // While the shell's single-character keys are off, every line whose keys are all single characters and are not a
    // component's focus keys says so: the list still names them, so the reader knows what turning them on gives back.
    function lineOff(line) {
      if (keysLive) return false;
      var ks = (line.keys || []).map(keyId).filter(Boolean);
      return ks.length > 0 && ks.every(function (id) { return id.length === 1 && !found[0].focus[id]; });
    }
    var keyLines = (p.keyMap || []).concat(found[0].lines, [{ keys: ['Ctrl+K', '⌘K'], label: t.layout.keySearch }], [{ keys: ['?'], label: t.layout.keyHelp }]);
    var lastProp = useRef(p.collapsed);
    if (lastProp.current !== p.collapsed) { lastProp.current = p.collapsed; if (!isNil(p.collapsed) && !!p.collapsed !== fold[0]) fold[1](!!p.collapsed); }
    var collapsed = fold[0];
    function toggle() {
      var v = !collapsed;
      fold[1](v);
      if (isNil(p.collapsed)) { try { window.localStorage.setItem(RAIL_KEY, v ? 'collapsed' : 'open'); } catch (e) { /* storage refused: the choice lasts for this page */ } }
      if (p.onCollapse) p.onCollapse(v);
    }
    // Ctrl+K and Cmd+K reach the command palette from anywhere in the console, as the key cap beside it says: always
    // bound (7 October 2026), whether or not the page passes onSearch. The key puts focus on the palette button and,
    // with onSearch, opens the palette. A field in the shell that takes the key itself (SearchField shortcut "⌘K")
    // has it first.
    var searchRef = useRef(null);
    useEffect(function () {
      function onKey(e) {
        if (keyTaken(e) || !(e.ctrlKey || e.metaKey) || e.altKey || !(e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) return;
        takeKey(e);
        focusEl(searchRef.current);
        if (latest.current.onSearch) latest.current.onSearch();
      }
      document.addEventListener('keydown', onKey);
      return function () { document.removeEventListener('keydown', onKey); };
    }, []);
    var queue = isNil(p.queueCount) ? null : [h(Icon, { key: 'i', name: 'inbox', size: 16 }), h('span', { key: 't' }, t.shell.queue), h('span', { key: 'n', className: 'r1-console__count r1-num' }, formatCount(p.queueCount, p.locale))];
    // Below bp-lg the stylesheet folds the rail whatever the reader chose, so Escape quiets a name shown on focus there too.
    function railFolded() {
      if (collapsed) return true;
      try { return window.matchMedia('(max-width: 1023px)').matches; } catch (e) { return false; }
    }
    return h('div', { ref: rootRef, className: cx('r1-shell r1-shell--console', collapsed && 'r1-shell--collapsed', p.fill && 'r1-shell--fill', p.notice && 'r1-shell--notice', p.className), style: p.style, lang: lang(p.locale), 'data-theme': theme.attr, 'data-r1-single-keys': forcedOff ? 'off' : undefined, onKeyDown: p.keyMap ? onRootKey : undefined, onClick: p.keyMap ? onRootClick : undefined },
      h(SkipLink, { to: mainId, locale: p.locale }),
      p.notice ? h(ShellNotice, Object.assign({ locale: p.locale }, p.notice, { innerRef: noticeRef })) : null,
      h('header', { className: 'r1-console__bar' },
        h(Mark, { name: p.brand, suffix: p.area || 'Ops' }),
        h('button', { ref: searchRef, type: 'button', className: 'r1-console__search', 'aria-label': searchLabel, 'aria-keyshortcuts': 'Control+K Meta+K', onClick: p.onSearch },
          h(Icon, { name: 'search', size: 16 }), h('span', { 'aria-hidden': 'true' }, searchLabel), h('kbd', { 'aria-hidden': 'true' }, '⌘K')),
        h('span', { className: 'r1-console__spacer' }),
        queue ? (p.queueHref ? h('a', { className: 'r1-console__queue', href: p.queueHref }, queue) : h('button', { type: 'button', className: 'r1-console__queue', onClick: p.onQueue }, queue)) : null,
        // While the single-character keys are off, "?" no longer opens the key list, so the bar offers it as a button.
        p.keyMap && !keysLive ? h(Button, { variant: 'quiet', size: 'sm', icon: 'keyboard', className: 'r1-console__keysbtn', onClick: function () { showKeys(true); }, locale: p.locale }, t.layout.keys) : null,
        h('span', { className: 'r1-shell__switches' },
          p.langSwitch === false ? null : h(LangToggle, { locale: p.locale, onChange: p.onLocale, density: 'console' })),
        p.account ? h('span', { className: 'r1-portal__acct' }, h(Icon, { name: 'user', size: 16 }), h('span', { className: 'r1-console__acctname' }, p.account)) : null,
        signOutControl(p, 'sm')),
      // Below 1,024 px (bp-lg) the console names the width it is designed for, under its bar, and reflows (OD-17): the
      // rail folds to its icons, the work stacks in one column and a table scrolls inside its own frame.
      h('p', { className: 'r1-console__narrow', role: 'note' }, h(Icon, { name: 'triangle-alert', size: 16 }), h('span', null, t.shell.narrow)),
      h('div', { className: 'r1-console__body' },
        h('nav', { id: railId, className: cx('r1-console__rail', quiet[0] && 'r1-console__rail--quiet'), 'aria-label': t.shell.menu,
          onKeyDown: function (e) { if (e.key === 'Escape' && railFolded()) quiet[1](true); }, onFocus: function () { if (quiet[0]) quiet[1](false); }, onMouseLeave: function () { if (quiet[0]) quiet[1](false); } },
          h('ul', null, rail.map(function (r, i) {
            return h('li', { key: i }, navTarget(r, 'r1-console__item', [
              r.icon ? h(Icon, { key: 'i', name: r.icon, size: 16 }) : null,
              h('span', { key: 't', className: 'r1-console__item-text' },
                h('span', { className: 'r1-console__item-label' }, r.label),
                isNil(r.count) ? null : h('span', { className: 'r1-console__item-count r1-num' }, formatCount(r.count, p.locale)))]));
          })),
          h('button', { type: 'button', className: 'r1-console__fold', 'aria-expanded': collapsed ? 'false' : 'true', 'aria-controls': railId, 'aria-label': collapsed ? t.layout.expand : undefined, onClick: toggle },
            h(Icon, { name: collapsed ? 'chevron-right' : 'chevron-left', size: 16 }), collapsed ? null : h('span', null, t.shell.collapse))),
        h('main', { id: mainId, tabIndex: -1, className: 'r1-console__main' }, p.children)),
      p.keyMap && keys[0] ? h(Dialog, { title: t.layout.keys, placement: 'overlay', width: 'var(--container-md)', density: 'console', secondaryAction: { label: t.close }, onClose: function () { showKeys(false); }, locale: p.locale },
        h('dl', { className: 'r1-keys' }, keyLines.map(function (k, i) {
          var off = lineOff(k);
          return h('div', { key: i, className: cx('r1-keys__row', off && 'r1-keys__row--off') },
            h('dt', { className: 'r1-keys__keys' }, (k.keys || []).map(function (x, j) { return h('kbd', { key: j }, x); })),
            h('dd', { className: 'r1-keys__label' }, k.label, off ? h('span', { className: 'r1-keys__off' }, ' (' + t.layout.keyOff + ')') : null));
        })),
        h(Switch, {
          className: 'r1-keys__switch', density: 'console', label: t.layout.singleKeys, helper: t.layout.singleKeysHelp,
          checked: keysLive, disabled: forcedOff, disabledReason: forcedOff ? t.layout.singleKeysForced : undefined,
          onChange: function (v) { setSingleKeys(v); }, locale: p.locale
        })) : null);
  }

  // ----------------------------------------------------------- page parts

  // Crumbs are a nav with an ordered list; the page itself closes the list for screen readers, marked current,
  // since the title below already shows it.
  function PageHeader(p) {
    var t = tx(p.locale);
    var crumbs = p.crumbs || [];
    var here = textOf(p.title);
    return h('header', { className: cx('r1-pagehead', p.className), style: p.style },
      crumbs.length || p.eyebrow ? h('div', { className: 'r1-pagehead__eyebrow' },
        crumbs.length ? h('nav', { className: 'r1-pagehead__crumbs', 'aria-label': t.layout.crumbs },
          h('ol', null, crumbs.map(function (c, i) {
            var last = i === crumbs.length - 1 && !p.eyebrow;
            return h('li', { key: i }, c.href ? h('a', { className: 'r1-link', href: c.href }, c.label) : h('span', null, c.label), last ? null : h('span', { className: 'r1-pagehead__sep', 'aria-hidden': 'true' }, '/'));
          }), here ? h('li', { className: 'r1-sr', 'aria-current': 'page' }, here) : null)) : null,
        p.eyebrow ? h('p', { className: 'r1-pagehead__kicker' }, p.eyebrow) : null) : null,
      h('div', { className: 'r1-pagehead__row' },
        h('div', { className: 'r1-pagehead__titles' },
          h('div', { className: 'r1-pagehead__titleline' },
            h('h1', { className: cx('r1-pagehead__title', p.size === 'public' && 'r1-pagehead__title--public') }, keepRefs(p.title)),
            p.status ? h(StatusBadge, { family: p.status.family, label: p.status.label, icon: p.status.icon, variant: p.status.variant, working: p.status.working, size: 'md', locale: p.locale }) : null),
          p.meta ? h('p', { className: 'r1-pagehead__meta' }, p.meta) : null),
        p.children ? h('div', { className: 'r1-pagehead__actions' }, p.children) : null));
  }

  // Counts that decide what the reader does next. A number is written in the reader's grouping; a count that is not
  // known is a dash read as words; family adds the status shape before the label; emphasis keeps one value at full
  // strength and steps the others back. The strip wraps onto more rows when the screen is narrow.
  function StatStrip(p) {
    var t = tx(p.locale);
    var items = p.items || [];
    var lead = items.some(function (it) { return it && it.emphasis; });
    // Over several rows, the last count takes the cells left empty on its row, so the strip has no open cell.
    var left = p.columns ? (p.columns - (items.length % p.columns)) % p.columns : 0;
    return h('dl', { className: cx('r1-stats', p.columns && 'r1-stats--grid r1-stats--cols-' + p.columns, lead && 'r1-stats--lead', p.className), style: p.style },
      items.map(function (it, i) {
        var v = it.value;
        var value = isNil(v) || v === '' ? missingValue(it.missing, t.noValue) : typeof v === 'number' ? formatCount(v, p.locale) : v;
        return h('div', { key: i, className: cx('r1-stats__item', it.emphasis && 'r1-stats__item--emphasis', it.family && 'r1-stats__item--' + it.family), style: left && i === items.length - 1 ? { '--stats-span': left + 1 } : undefined },
          h('dt', { className: 'r1-stats__label' },
            it.family ? h('span', { className: 'r1-stats__icon' }, h(StatusIcon, { family: it.family, size: 16, cutout: 'surface' })) : null,
            h('span', null, it.label)),
          h('dd', { className: 'r1-stats__value r1-num' }, value),
          it.note ? h('dd', { className: 'r1-stats__note' }, it.note) : null);
      }));
  }

  // A measured amount beside its absolute numbers. A missing value is not zero: no fill, a dashed track, and it
  // is said as "no value". The fill is the family's fill token with an edge in its text token, so the filled part
  // stands at least 3:1 from the track in every family (amber-400 alone is 1.5:1 on it). valueText is what a
  // screen reader says; by default the ring's centre text or the bar's caption.
  function meterTokens(family) { return family === 'accent' ? ['accent', 'accent-strong'] : [family + '-fill', family + '-text']; }
  function Meter(p) {
    var t = tx(p.locale);
    var max = p.max || 100;
    var none = isNil(p.value) || isNaN(Number(p.value));
    var pct = none ? 0 : Math.max(0, Math.min(100, Math.round((Number(p.value) / max) * 100)));
    var family = p.family === 'accent' || STATUS_FAMILIES.indexOf(p.family) >= 0 ? p.family : 'info';
    var said = p.valueText || [p.centerLabel, p.centerSub].filter(Boolean).join(' ') || p.caption || undefined;
    // marker (bar): a ceiling or a floor, { value, label }, a tick across the track with its label under it. The label is
    // read after the value ("…, Mức sàn 85 %"), so the drawn copy is hidden from a screen reader.
    var mk = p.variant !== 'ring' && p.marker && !isNil(p.marker.value) && !isNaN(Number(p.marker.value)) ? p.marker : null;
    var mpct = mk ? Math.max(0, Math.min(100, (Number(mk.value) / max) * 100)) : 0;
    var heard = mk && mk.label ? [said, textOf(mk.label)].filter(Boolean).join(said && /[.!?]$/.test(said) ? ' ' : '. ') : said;
    var a11y = none
      ? { role: 'img', 'aria-label': (p.label ? p.label + ': ' : '') + t.noValue + (mk && mk.label ? '. ' + textOf(mk.label) : '') }
      : { role: 'meter', 'aria-valuenow': Number(p.value), 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuetext': heard, 'aria-label': p.label };
    if (p.variant === 'ring') {
      var size = p.size || 240, stroke = p.stroke || Math.max(10, Math.round(size / 16));
      var r = (size - stroke) / 2, c = 2 * Math.PI * r, mid = size / 2, tok = meterTokens(family);
      var arc = function (key, colour, width) {
        return h('circle', { key: key, cx: mid, cy: mid, r: r, transform: 'rotate(-90 ' + mid + ' ' + mid + ')', style: { fill: 'none', stroke: 'var(--' + colour + ')', strokeWidth: width, strokeLinecap: 'round', strokeDasharray: (c * pct / 100) + ' ' + c } });
      };
      return h('div', Object.assign({ className: cx('r1-ring', none && 'r1-ring--none', p.className), style: Object.assign({ width: size, height: size }, p.style) }, a11y),
        h('svg', { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, 'aria-hidden': 'true' },
          h('circle', { cx: mid, cy: mid, r: r, style: { fill: 'none', stroke: 'var(--surface-sunken)', strokeWidth: stroke } }),
          none || !pct ? null : [arc('e', tok[1], stroke), arc('f', tok[0], Math.max(1, stroke - 2))]),
        h('div', { className: 'r1-ring__center', 'aria-hidden': 'true' },
          p.centerLabel ? h('span', { className: 'r1-ring__value r1-num' }, none ? '–' : p.centerLabel) : none ? h('span', { className: 'r1-ring__value r1-num' }, '–') : null,
          p.centerSub ? h('span', { className: 'r1-ring__sub' }, p.centerSub) : null));
    }
    var track = h('div', Object.assign({ className: cx('r1-meter', 'r1-meter--' + family, none && 'r1-meter--none'), style: p.thickness ? { height: p.thickness } : undefined }, a11y),
      none ? null : h('span', { className: 'r1-meter__fill', style: { width: pct + '%' } }));
    // The label starts at the tick, or ends at it past the middle of the track, so it never runs out of the bar's width.
    var past = mpct > 50;
    return h('div', { className: cx('r1-meterbox', mk && 'r1-meterbox--marked', p.className), style: p.style },
      p.caption ? h('div', { className: 'r1-meterbox__caption', 'aria-hidden': said === p.caption ? 'true' : undefined }, p.caption) : null,
      mk ? h('div', { className: 'r1-meter__frame' }, track, h('span', { className: 'r1-meter__tick', style: { left: mpct + '%' }, 'aria-hidden': 'true' })) : track,
      mk && mk.label ? h('div', { className: cx('r1-meter__mark', past && 'r1-meter__mark--end'), style: past ? { paddingRight: (100 - mpct) + '%' } : { paddingLeft: mpct + '%' }, 'aria-hidden': 'true' },
        h('span', { className: 'r1-meter__mark-label' }, mk.label)) : null);
  }

  // One switch for a data region's state. The error view says what happened (errorTitle), what the reader can do
  // (Try again, and errorAction when there is another way), and its reference. The loading view takes the shape
  // of the result (skeleton, columns). When a load the reader started finishes, that is said once.
  function ViewState(p) {
    var t = tx(p.locale);
    var view = p.view || 'populated';
    var prev = useRef(view);
    useEffect(function () {
      var was = prev.current; prev.current = view;
      if (was === 'loading' && view !== 'loading' && view !== 'error' && readerActed()) announce(t.view.loaded, 'polite');
    }, [view]);
    if (view === 'loading') return h(Skeleton, { rows: p.rows || 5, variant: p.skeleton, columns: p.columns, density: p.density, locale: p.locale });
    if (view === 'error') return h(EmptyState, { variant: 'error', title: p.errorTitle, action: p.errorAction, level: p.level, traceId: p.traceId, retryable: p.retryable !== false, onRetry: p.onRetry, density: p.density, locale: p.locale }, p.errorText);
    if (view === 'empty') {
      var e = p.empty || {};
      return h(EmptyState, { variant: e.variant || 'not-started', title: e.title, icon: e.icon, action: e.action, onClearFilters: e.onClearFilters, level: p.level, density: p.density, locale: p.locale }, e.text);
    }
    if (view === 'refused') {
      var r = p.refusal || {};
      // With nothing passed, the refusal is the catalogue's NOT_AUTHORISED entry, its sentence and its code together.
      // A screen that writes its own sentence passes its own code; none is added for it.
      var own = r.title || r.text;
      // action ({label, onClick, href, icon}): the way on when the refusal replaces the page (a 503 read: "Try again"),
      // a secondary button under the sentence, at the size of the page's density.
      var a = r.action;
      var go = a && typeof a === 'object' && !React.isValidElement(a) ? { label: a.label, href: a.href, onClick: a.onClick, icon: a.icon, variant: 'secondary' } : a;
      return h(Banner, { family: r.family || 'neutral', title: r.title || t.refusedTitle, code: r.code || (own ? undefined : 'NOT_AUTHORISED'), level: p.level, action: go || undefined, density: go ? (p.density === 'console' ? 'console' : p.density ? 'portal' : undefined) : undefined, locale: p.locale }, r.text || t.refusedText);
    }
    return h(Fragment, null, p.children);
  }

  function DeviceBar(p) {
    var family = p.family || 'positive';
    var time = typeof p.time === 'string' ? p.time : formatTime(p.time);
    var day = typeof p.day === 'string' ? p.day : (!isNil(p.day) || (!isNil(p.time) && typeof p.time !== 'string')) ? dayOf(toDate(isNil(p.day) ? p.time : p.day), p.locale) : null;
    return h('header', { className: cx('r1-devbar', p.className), style: p.style },
      h('div', { className: 'r1-devbar__where' },
        h('span', { className: 'r1-devbar__premises' }, p.premises || 'RightOne Player'),
        p.device ? h('span', { className: 'r1-devbar__device r1-mono' }, p.device) : null),
      p.state || p.detail ? h('div', { className: 'r1-devbar__health' },
        p.state ? h('span', { className: 'r1-devbar__state r1-devbar__state--' + family, role: 'status' },
          h(StatusIcon, { family: family, size: 24, cutout: family + '-tint' }), h('span', null, p.state)) : null,
        p.detail ? h('span', { className: 'r1-devbar__detail' }, p.detail) : null) : null,
      time ? h('div', { className: 'r1-devbar__clock' },
        h('span', { className: 'r1-devbar__time r1-num' }, time),
        day ? h('span', { className: 'r1-devbar__day' }, day) : null) : null);
  }

  // --------------------------------------------------------- player parts

  // Track tones. Named apart from the Table's row TONES above: both are var in one scope, and the later one won.
  // Since 1 Oct 2026 the two tones come from the RightOne logo: teal and blue. A title keeps the place it had: the
  // titles that drew lime now draw teal, the ones that drew stone draw blue. The retired names (lime, stone, sky)
  // still work as a tone prop and map to the brand tone that replaced them.
  var TRACK_TONES = ['teal', 'blue'];
  var RETIRED_TONES = { lime: 'teal', stone: 'blue', sky: 'blue' };
  function toneOf(title) {
    var x = hashOf(title || ''), k = x % 4;
    var was = k === 1 ? ['teal', 'lime', 'stone'][(x >>> 2) % 3] : ['teal', '', 'lime', 'stone'][k];
    var kept = was === 'lime' || was === 'stone' ? was : ['lime', 'stone'][(x >>> 8) % 2];
    return RETIRED_TONES[kept];
  }

  function hashOf(s) {
    var x = 2166136261;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    return x >>> 0;
  }

  // A small state mark in the cover's corner, never a centred glyph that reads as a button. The guest display, where
  // nothing is a control and the title line already says the music is paused, shows none.
  function pauseMark(display) { return display ? null : h('span', { className: 'r1-art__pause r1-art__pause--over', 'aria-hidden': 'true' }, h('span', null), h('span', null)); }

  function Artwork(p) {
    var t = tx(p.locale);
    // A catalogue image that fails to load is a missing cover: it says so instead of showing a broken image.
    // It remembers which src failed, so a new src is tried again without an effect racing the error.
    var failSt = useState(null);
    var size = p.size || 320;
    var state = p.state || 'shown';
    var src = p.src && failSt[0] !== p.src ? p.src : null;
    if (p.src && !src && state !== 'paused') state = 'unavailable';
    var box = Object.assign({ width: size, height: size }, p.style);
    var display = p.scale === 'display';
    var cls = cx('r1-art', display && 'r1-art--display', p.className);
    var onError = function () { failSt[1](p.src); };
    // An image can fail before React is listening (the first render yields to the browser): check it once mounted.
    var checkImg = function (el) { if (el && el.complete && el.naturalWidth === 0 && el.currentSrc) failSt[1](p.src); };
    if (state === 'unavailable') {
      return h('div', { className: cx(cls, 'r1-art--off'), style: box, role: 'img', 'aria-label': t.deck.artworkOff },
        h(Icon, { name: 'disc-3', size: Math.round(size / 5), strokeWidth: 1.5 }),
        h('span', { className: 'r1-art__offtext' }, t.deck.artworkOff));
    }
    if (src && state === 'paused') {
      // The paused track keeps its cover, dimmed, under the pause mark.
      return h('div', { className: cx(cls, 'r1-art--image', 'r1-art--dim'), style: box, role: 'img', 'aria-label': t.deck.paused + (p.alt ? ': ' + p.alt : '') },
        h('img', { ref: checkImg, className: 'r1-art__img', src: src, alt: '', width: size, height: size, onError: onError }),
        pauseMark(display));
    }
    if (state === 'paused' && !p.title) {
      return h('div', { className: cx(cls, 'r1-art--paused'), style: box, role: 'img', 'aria-label': t.deck.paused },
        display ? h(Icon, { name: 'disc-3', size: Math.round(size / 5), strokeWidth: 1.5 })
          : h('span', { className: 'r1-art__pause', 'aria-hidden': 'true' }, h('span', null), h('span', null)));
    }
    if (src) return h('img', { ref: checkImg, className: cls, src: src, alt: p.alt || '', width: size, height: size, style: p.style, onError: onError });
    // Stand-in drawn from the audio file itself, for places that already set the title beside it:
    // grooves from the rim inwards, each as heavy as that stretch of the track is loud.
    if (p.variant === 'groove') {
      var c = size / 2, n = Math.round(size / 11), r0 = size * 0.15, r1 = size * 0.45, pitch = (r1 - r0) / n;
      var loud = loudOf(p.title, n), grooves = [];
      for (var g = 0; g < n; g++) {
        grooves.push(h('circle', { key: g, cx: c, cy: c, r: r1 - pitch * (g + 0.5), className: 'r1-art__groove', style: { strokeWidth: Math.max(1, pitch * (0.2 + 0.6 * loud[g])), opacity: 0.3 + 0.65 * loud[g] } }));
      }
      var still = state === 'paused';
      return h('div', { className: cx(cls, 'r1-art--groove', 'r1-art--tone-' + toneOf(p.title), still && 'r1-art--dim'), style: box, role: 'img', 'aria-label': still ? t.deck.paused : (p.alt || (t.deck.artwork + (p.title ? ': ' + p.title : ''))) },
        h('svg', { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, 'aria-hidden': 'true', focusable: 'false' },
          h('g', { className: 'r1-art__grooves' }, grooves),
          h('circle', { cx: c, cy: c, r: size * 0.1, className: 'r1-art__label' }),
          h('circle', { cx: c, cy: c, r: size * 0.015, className: 'r1-art__hole' })),
        still ? pauseMark(display) : null);
    }
    // Stand-in for the release image until the catalogue supplies one: the title set as a plain cover.
    // Its type is a sixth of the cover, never below text-lg.
    box['--art-type'] = 'max(var(--text-lg), calc(var(--spacing) * ' + (size / 26).toFixed(2) + '))';
    var paused = state === 'paused';
    return h('div', { className: cx(cls, 'r1-art--cover', 'r1-art--tone-' + toneOf(p.title), paused && 'r1-art--dim'), style: box, role: 'img', 'aria-label': paused ? t.deck.paused : (p.alt || (t.deck.artwork + (p.title ? ': ' + p.title : ''))) },
      h('span', { className: 'r1-art__title' }, p.title),
      p.by ? h('span', { className: 'r1-art__by' }, p.by) : null,
      paused ? pauseMark(display) : null);
  }

  // A QR code encoder (ISO/IEC 18004, byte mode, UTF-8), so a code is made from the address it opens instead of
  // being pasted in as a picture. Versions 1 to 40, error correction L, M, Q or H, the mask with the lowest penalty.
  var QR_BLOCKS = {
    L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  };
  var QR_ECC = {
    L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  };
  var QR_FORMAT = { L: 1, M: 0, Q: 3, H: 2 };
  function qrRawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function qrMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
    return z;
  }
  function qrEcc(data, degree) {
    var div = [], i, j, root = 1;
    for (i = 0; i < degree; i++) div.push(0);
    div[degree - 1] = 1;
    for (i = 0; i < degree; i++) {
      for (j = 0; j < degree; j++) { div[j] = qrMul(div[j], root); if (j + 1 < degree) div[j] ^= div[j + 1]; }
      root = qrMul(root, 2);
    }
    var rem = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ rem.shift();
      rem.push(0);
      for (var k = 0; k < degree; k++) rem[k] ^= qrMul(div[k], f);
    });
    return rem;
  }
  function qrEncode(text, level) {
    var ecl = QR_FORMAT.hasOwnProperty(level) ? level : 'M';
    var bytes = [], i;
    if (typeof TextEncoder !== 'undefined') bytes = Array.prototype.slice.call(new TextEncoder().encode(String(text)));
    else { var s = unescape(encodeURIComponent(String(text))); for (i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i)); }
    var ver = 0, cap = 0;
    for (var v = 1; v <= 40; v++) {
      cap = Math.floor(qrRawModules(v) / 8) - QR_ECC[ecl][v - 1] * QR_BLOCKS[ecl][v - 1];
      if (4 + (v < 10 ? 8 : 16) + 8 * bytes.length <= cap * 8) { ver = v; break; }
    }
    if (!ver) return null;
    var bits = [];
    function put(val, len) { for (var b = len - 1; b >= 0; b--) bits.push((val >>> b) & 1); }
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, cap * 8 - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    var data = [];
    for (i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (var pad = 0xec; data.length < cap; pad ^= 0xec ^ 0x11) data.push(pad);
    // Split into blocks, add the error correction to each, and interleave.
    var nb = QR_BLOCKS[ecl][ver - 1], ecLen = QR_ECC[ecl][ver - 1], raw = Math.floor(qrRawModules(ver) / 8);
    var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), blocks = [], k = 0;
    for (i = 0; i < nb; i++) {
      var dat = data.slice(k, k + shortLen - ecLen + (i < nShort ? 0 : 1));
      k += dat.length;
      var ecc = qrEcc(dat, ecLen);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var words = [];
    for (i = 0; i < blocks[0].length; i++) for (var j = 0; j < nb; j++) if (i !== shortLen - ecLen || j >= nShort) words.push(blocks[j][i]);
    // The function patterns.
    var n = ver * 4 + 17, m = [], fn = [];
    for (i = 0; i < n; i++) { m.push([]); fn.push([]); for (j = 0; j < n; j++) { m[i].push(false); fn[i].push(false); } }
    function set(x, y, dark) { m[y][x] = !!dark; fn[y][x] = true; }
    for (i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [n - 4, 3], [3, n - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), x = c[0] + dx, y = c[1] + dy;
        if (x >= 0 && x < n && y >= 0 && y < n) set(x, y, d !== 2 && d !== 4);
      }
    });
    var align = [];
    if (ver > 1) {
      var na = Math.floor(ver / 7) + 2, step = Math.floor((ver * 8 + na * 3 + 5) / (na * 4 - 4)) * 2;
      for (var pos = n - 7; align.length < na - 1; pos -= step) align.unshift(pos);
      align.unshift(6);
    }
    align.forEach(function (ay, ai) {
      align.forEach(function (ax, aj) {
        if ((ai === 0 && aj === 0) || (ai === 0 && aj === align.length - 1) || (ai === align.length - 1 && aj === 0)) return;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      });
    });
    function format(mask) {
      var d = QR_FORMAT[ecl] << 3 | mask, r = d;
      for (var b = 0; b < 10; b++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      var f = (d << 10 | r) ^ 0x5412, bit = function (q) { return (f >>> q) & 1; };
      for (b = 0; b <= 5; b++) set(8, b, bit(b));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (b = 9; b < 15; b++) set(14 - b, 8, bit(b));
      for (b = 0; b < 8; b++) set(n - 1 - b, 8, bit(b));
      for (b = 8; b < 15; b++) set(8, n - 15 + b, bit(b));
      set(8, n - 8, true);
    }
    format(0);
    if (ver >= 7) {
      var r = ver;
      for (i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
      var vb = ver << 12 | r;
      for (i = 0; i < 18; i++) { var bt = (vb >>> i) & 1, a = n - 11 + i % 3, b2 = Math.floor(i / 3); set(a, b2, bt); set(b2, a, bt); }
    }
    // The codewords, in two-column zigzags from the bottom right.
    var bi = 0;
    for (var right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < n; vert++) for (j = 0; j < 2; j++) {
        var x = right - j, y = ((right + 1) & 2) === 0 ? n - 1 - vert : vert;
        if (!fn[y][x] && bi < words.length * 8) { m[y][x] = ((words[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; }
      }
    }
    var MASKS = [
      function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; },
      function (x) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; },
      function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; }, function (x, y) { return x * y % 2 + x * y % 3 === 0; },
      function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; }, function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }
    ];
    function applyMask(q) { for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (!fn[y][x] && MASKS[q](x, y)) m[y][x] = !m[y][x]; }
    function penalty() {
      var score = 0, x, y, dark = 0;
      function lines(get) {
        for (var a = 0; a < n; a++) {
          var run = 0, color = false, hist = [0, 0, 0, 0, 0, 0, 0];
          var add = function (len) { if (hist[0] === 0) len += n; hist.pop(); hist.unshift(len); };
          var count = function () {
            var c = hist[1], core = c > 0 && hist[2] === c && hist[3] === c * 3 && hist[4] === c && hist[5] === c;
            return (core && hist[0] >= c * 4 && hist[6] >= c ? 1 : 0) + (core && hist[6] >= c * 4 && hist[0] >= c ? 1 : 0);
          };
          for (var b = 0; b < n; b++) {
            if (get(a, b) === color) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
            else { add(run); if (!color) score += count() * 40; color = get(a, b); run = 1; }
          }
          if (color) { add(run); run = 0; }
          add(run + n);
          score += count() * 40;
        }
      }
      lines(function (a, b) { return m[a][b]; });
      lines(function (a, b) { return m[b][a]; });
      for (y = 0; y < n - 1; y++) for (x = 0; x < n - 1; x++) { var c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3; }
      for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (m[y][x]) dark++;
      return score + (Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10;
    }
    var best = 0, bestScore = Infinity;
    for (var q = 0; q < 8; q++) {
      applyMask(q); format(q);
      var sc = penalty();
      if (sc < bestScore) { best = q; bestScore = sc; }
      applyMask(q);
    }
    applyMask(best); format(best);
    return m.map(function (row) { return row.map(function (d) { return d ? '1' : '0'; }).join(''); });
  }
  var QR_CACHE = {}, QR_CACHED = 0;

  // A QR code, from its module matrix (modules: one string per row, "1" for a dark module) or made here from value.
  // The quiet zone is four modules, as ISO/IEC 18004 requires. A code always has a name: label, or "QR code that
  // opens <value>" when the page gives none.
  function QrCode(p) {
    var t = tx(p.locale).qr;
    var rows = p.modules;
    if ((!rows || !rows.length) && !isNil(p.value) && p.value !== '') {
      var key = (p.level || 'M') + '|' + p.value;
      if (!QR_CACHE[key]) { if (QR_CACHED > 64) { QR_CACHE = {}; QR_CACHED = 0; } QR_CACHE[key] = qrEncode(p.value, p.level) || []; QR_CACHED++; }
      rows = QR_CACHE[key];
    }
    rows = rows || [];
    if (!rows.length) return null;
    var n = rows.length, quiet = isNil(p.quiet) ? 4 : p.quiet, total = n + quiet * 2;
    var size = p.size || 160;
    var label = p.label || (!isNil(p.value) && p.value !== '' ? t.opens.replace('{url}', p.value) : t.label);
    var rects = [];
    rows.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) if (row.charAt(x) === '1') rects.push(h('rect', { key: y * 1000 + x, x: x + quiet, y: y + quiet, width: 1.02, height: 1.02 }));
    });
    return h('svg', { className: cx('r1-qr', p.className), width: size, height: size, viewBox: '0 0 ' + total + ' ' + total, role: 'img', 'aria-label': label, style: p.style, shapeRendering: 'crispEdges' },
      h('rect', { width: total, height: total, className: 'r1-qr__paper' }),
      h('g', { className: 'r1-qr__ink' }, rects));
  }

  function clockOf(s) {
    s = Math.max(0, Math.round(s || 0));
    var m = Math.floor(s / 60), r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }
  // The position as a person says it, for screen readers: "1 phút 24 giây trên 4 phút 36 giây".
  function spokenClock(s, locale) {
    var d = tx(locale).deck;
    s = Math.max(0, Math.round(s || 0));
    var m = Math.floor(s / 60), r = s % 60, out = [];
    if (m) out.push(m + ' ' + (m === 1 ? d.min : d.mins));
    if (r || !m) out.push(r + ' ' + (r === 1 ? d.sec : d.secs));
    return out.join(' ');
  }
  function positionText(at, dur, locale) {
    return tx(locale).deck.posOf.replace('{at}', spokenClock(at, locale)).replace('{of}', spokenClock(dur, locale));
  }

  // Previous stays visible but off: FR-PLR-019 bars a repeat within the premises local day, and a
  // previous track has by definition played today. Next asks ALG-195 for the next track now.
  function PlayerControls(p) {
    var t = tx(p.locale);
    var reasonId = useUid('r1-prev');
    var dur = p.duration || 0, at = Math.min(dur, p.elapsed || 0);
    var volSt = useSynced(p.volume, 70);
    var muteSt = useSynced(isNil(p.muted) ? undefined : !!p.muted, false);
    var vol = volSt[0];
    var muted = muteSt[0];
    var latest = useLatest(p);
    var trackRef = useRef(null);
    function setVol(v) { var x = Math.max(0, Math.min(100, Math.round(v))); volSt[1](x); if (latest.current.onVolume) latest.current.onVolume(x); }
    function toggleMute() { var m = !muted; muteSt[1](m); if (p.onMute) p.onMute(m); }
    function onSliderKey(e) {
      var d = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 10, PageDown: -10 }[e.key];
      if (!isNil(d)) { e.preventDefault(); setVol(vol + d); }
      else if (e.key === 'Home') { e.preventDefault(); setVol(0); }
      else if (e.key === 'End') { e.preventDefault(); setVol(100); }
    }
    function fromPointer(e) {
      var box = trackRef.current && trackRef.current.getBoundingClientRect();
      if (box && box.width) setVol(((e.clientX - box.left) / box.width) * 100);
    }
    // On the staff screen, while music plays: Space pauses or resumes, arrows set the volume, N skips, F fills the screen.
    useEffect(function () {
      if (!p.shortcuts) return undefined;
      function onKey(e) {
        if (e.ctrlKey || e.metaKey || e.altKey || isControl(e.target)) return;
        var q = latest.current;
        if (e.key === ' ' && q.onToggle) { e.preventDefault(); q.onToggle(); }
        else if ((e.key === 'n' || e.key === 'N') && q.onNext) q.onNext();
        else if ((e.key === 'f' || e.key === 'F') && q.fullscreen && q.onFullscreen) q.onFullscreen();
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setVol(volRef.current + (e.key === 'ArrowUp' ? 5 : -5)); }
      }
      document.addEventListener('keydown', onKey);
      return function () { document.removeEventListener('keydown', onKey); };
    }, [!!p.shortcuts]);
    var volRef = useLatest(vol);
    var paused = !!p.paused;
    var transport = !!p.transport;
    // Previous is always off, whatever `previous` says: turning it on would break the once-a-day rule.
    var prevOff = transport;
    var play = h('button', { type: 'button', className: 'r1-deck__play', 'aria-label': paused ? t.deck.play : t.deck.pause, onClick: p.onToggle },
      h(Icon, { name: paused ? 'play' : 'pause', size: 32, strokeWidth: 2 }));
    return h('div', { className: cx('r1-deck', paused && 'r1-deck--paused', transport && 'r1-deck--transport', p.className), style: p.style },
      // The position is drawn by WaveBar everywhere, so it reads and sounds the same on every screen.
      p.progress === false ? null : h(WaveBar, { elapsed: at, duration: dur, paused: paused, title: p.title, bars: p.bars, locale: p.locale }),
      transport ? h('div', { className: 'r1-deck__transport' },
        h('div', { className: 'r1-deck__buttons' },
          h('button', { type: 'button', className: 'r1-deck__skip', 'aria-label': t.deck.previous, 'aria-disabled': prevOff ? 'true' : undefined, 'aria-describedby': prevOff ? reasonId : undefined, onClick: prevOff ? undefined : p.onPrevious },
            h(Icon, { name: 'skip-back', size: 28, strokeWidth: 2 })),
          play,
          h('button', { type: 'button', className: 'r1-deck__skip', 'aria-label': t.deck.next, onClick: p.onNext },
            h(Icon, { name: 'skip-forward', size: 28, strokeWidth: 2 }))),
        prevOff ? h('p', { id: reasonId, className: 'r1-deck__reason' }, p.previousReason || t.deck.previousOff) : null) : null,
      h('div', { className: 'r1-deck__row' },
        transport ? null : play,
        h('div', { className: cx('r1-deck__volume', muted && 'r1-deck__volume--muted') },
          h('button', { type: 'button', className: 'r1-deck__mute', 'aria-label': muted ? t.deck.unmute : t.deck.mute, 'aria-pressed': muted ? 'true' : 'false', onClick: toggleMute },
            h(Icon, { name: muted ? 'volume-x' : 'volume-2', size: 28 })),
          h('div', {
            ref: trackRef, className: 'r1-deck__slider', role: 'slider', tabIndex: 0, 'aria-label': t.deck.volume, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': vol, 'aria-valuetext': vol + (lang(p.locale) === 'en' ? '%' : '\u00a0%'),
            onKeyDown: onSliderKey,
            onPointerDown: function (e) { if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); },
            onPointerMove: function (e) { if (e.buttons) fromPointer(e); }
          },
            h('span', { className: 'r1-deck__fill', style: { width: vol + '%' } }),
            h('span', { className: 'r1-deck__knob', style: { left: vol + '%' } })),
          h('span', { className: 'r1-deck__vol r1-num', 'aria-hidden': 'true' }, vol + (lang(p.locale) === 'en' ? '%' : '\u00a0%'))),
        p.fullscreen ? h('button', { type: 'button', className: 'r1-deck__full', onClick: p.onFullscreen },
          h(Icon, { name: 'maximize', size: 24 }), h('span', null, t.deck.fullscreen)) : null));
  }

  // The track position: the track's waveform lit up to the play position, with elapsed and total time under its ends.
  // The gap between bars is a share of the width, so the bars always fit the frame they are in.
  function WaveBar(p) {
    var t = tx(p.locale);
    var dur = p.duration || 0, at = Math.min(dur, p.elapsed || 0), f = dur ? at / dur : 0;
    var n = p.bars || 96, seed = hashOf(p.title || 'r1'), bars = [];
    for (var i = 0; i < n; i++) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      var env = 0.35 + 0.65 * Math.pow(Math.sin(Math.PI * (i + 0.5) / n), 0.6);
      bars.push({ h: Math.round(100 * env * (0.35 + ((seed >>> 8) % 1000) / 1000 * 0.65)), lit: (i + 0.5) / n <= f });
    }
    return h('div', { className: cx('r1-wavebar', p.paused && 'r1-wavebar--paused', p.className), style: p.style, role: 'progressbar', 'aria-label': t.deck.position, 'aria-valuemin': 0, 'aria-valuemax': dur, 'aria-valuenow': at, 'aria-valuetext': positionText(at, dur, p.locale) },
      h('div', { className: 'r1-wavebar__bars', 'aria-hidden': 'true', style: { columnGap: 'calc(50% / ' + n + ')' } }, bars.map(function (b, k) {
        return h('span', { key: k, className: b.lit ? 'r1-wavebar__bar r1-wavebar__bar--lit' : 'r1-wavebar__bar', style: { height: Math.max(8, b.h) + '%' } });
      })),
      h('div', { className: 'r1-wavebar__times r1-num', 'aria-hidden': 'true' }, h('span', null, clockOf(at)), h('span', null, clockOf(dur))));
  }

  // A smooth loudness curve for a track, seeded by its title: the same track always draws the same shape.
  function loudOf(title, n) {
    var seed = hashOf(title || 'r1'), rnd = function () { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return ((seed >>> 8) % 1000) / 1000; };
    var p1 = rnd(), p2 = rnd(), p3 = rnd(), out = [];
    for (var i = 0; i < n; i++) {
      var x = (i + 0.5) / n;
      var v = 0.55 + 0.22 * Math.sin(2 * Math.PI * (x * 1.4 + p1)) + 0.14 * Math.sin(2 * Math.PI * (x * 3.3 + p2)) + 0.08 * Math.sin(2 * Math.PI * (x * 7.1 + p3)) + 0.12 * (rnd() - 0.5);
      v *= 0.45 + 0.55 * Math.pow(Math.sin(Math.PI * x), 0.5);
      out.push(Math.max(0.08, Math.min(1, v)));
    }
    return out;
  }

  // The same position drawn around a square slot. Its times never fall below text-lg, whatever the size.
  function WaveRing(p) {
    var t = tx(p.locale);
    var S = p.size || 256, c = S / 2;
    var dur = p.duration || 0, at = Math.min(dur, p.elapsed || 0), f = dur ? at / dur : 0;
    var stroke = Math.max(3, Math.round(S / 85));
    var ro = c - stroke * 3;
    var rw = ro - Math.round(S * 0.07);
    var rc = Math.round(S * 0.26);
    var seed = hashOf(p.title || 'r1'), lines = [];
    var nr = Math.round(S / 4.4), r0 = rc + Math.round(S * 0.035), band = rw - r0;
    for (var i = 0; i < nr; i++) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      var a = (-90 + 360 * (i + 0.5) / nr) * Math.PI / 180;
      var env = 0.3 + 0.7 * Math.pow(Math.sin(Math.PI * ((i * 7) % nr) / nr), 2);
      var len = Math.max(3, band * env * (0.45 + ((seed >>> 8) % 1000) / 1000 * 0.55));
      lines.push({ x1: c + r0 * Math.cos(a), y1: c + r0 * Math.sin(a), x2: c + (r0 + len) * Math.cos(a), y2: c + (r0 + len) * Math.sin(a), lit: (i + 0.5) / nr <= f });
    }
    var ang = (-90 + 360 * f) * Math.PI / 180;
    var circ = 2 * Math.PI * ro;
    function typeAt(share) { return 'max(var(--text-lg), calc(var(--spacing) * ' + (S * share / 4).toFixed(2) + '))'; }
    return h('div', { className: cx('r1-wave', p.paused && 'r1-wave--paused', p.className), style: Object.assign({ width: S, height: S }, p.style), role: 'progressbar', 'aria-label': t.deck.position, 'aria-valuemin': 0, 'aria-valuemax': dur, 'aria-valuenow': at, 'aria-valuetext': positionText(at, dur, p.locale) },
      h('svg', { width: S, height: S, viewBox: '0 0 ' + S + ' ' + S, 'aria-hidden': 'true', focusable: 'false' },
        h('circle', { cx: c, cy: c, r: ro, className: 'r1-wave__track', style: { strokeWidth: stroke } }),
        lines.map(function (l, i) {
          return h('line', { key: i, x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, className: l.lit ? 'r1-wave__bar r1-wave__bar--lit' : 'r1-wave__bar', style: { strokeWidth: Math.max(2, S / 120) } });
        }),
        h('circle', { cx: c, cy: c, r: rc, className: 'r1-wave__disc' }),
        h('circle', { cx: c, cy: c, r: ro, className: 'r1-wave__arc', transform: 'rotate(-90 ' + c + ' ' + c + ')', style: { strokeWidth: stroke + 1, strokeDasharray: (circ * f) + ' ' + circ } }),
        h('circle', { cx: c + ro * Math.cos(ang), cy: c + ro * Math.sin(ang), r: stroke * 2.4, className: 'r1-wave__knob' })),
      h('div', { className: 'r1-wave__time r1-num', 'aria-hidden': 'true' },
        h('span', { className: 'r1-wave__at', style: { fontSize: typeAt(0.1) } }, clockOf(at)),
        h('span', { className: 'r1-wave__rule' }),
        h('span', { className: 'r1-wave__dur', style: { fontSize: typeAt(0.075) } }, clockOf(dur))));
  }

  // The day under the clock, the way the reader's language writes it: "Thứ Hai, 28 thg 9", "Mon 28 Sep".
  function dayOf(d, locale) {
    if (!d) return null;
    return lang(locale) === 'en'
      ? shortMonth(dtf('en', { weekday: 'short', day: 'numeric', month: 'short' }).format(d))
      : dtf('vi', { weekday: 'long', day: 'numeric', month: 'short' }).format(d);
  }

  // The device clock, in Vietnam time. Pass a Date or a timestamp and it writes the time and the day for the
  // locale; with live and no time it follows the device clock. Strings still pass through as they are.
  function Clock(p) {
    var nowSt = useState(function () { return new Date(); });
    var live = !!p.live && isNil(p.time);
    useEffect(function () {
      if (!live) return undefined;
      var id = setInterval(function () { nowSt[1](new Date()); }, 15000);
      return function () { clearInterval(id); };
    }, [live]);
    var v = live ? nowSt[0] : p.time;
    var d = typeof v === 'string' ? null : toDate(v);
    var time = d ? formatTime(d) : v;
    var day = typeof p.day === 'string' ? p.day : dayOf(isNil(p.day) ? d : toDate(p.day), p.locale);
    return h('div', { className: cx('r1-clock', p.className), style: p.style },
      h('time', { className: 'r1-clock__time r1-num', dateTime: d ? d.toISOString() : undefined }, time),
      day ? h('span', { className: 'r1-clock__day' }, day) : null);
  }

  var RAIL_FAMILIES = { positive: 1, attention: 1, danger: 1, neutral: 1, info: 1 };

  // The left column of the landscape Player: where, what state, what the device holds. Always visible.
  // condition names the state the way PlayerStatusBlock and PlayerAlert do, and sets the family and the word;
  // a family outside the five falls back to neutral rather than painting a state it does not have.
  function PlayerRail(p) {
    var t = tx(p.locale);
    var cond = PLAYER_FAMILY[p.condition] ? p.condition : null;
    var family = cond ? PLAYER_FAMILY[cond] : RAIL_FAMILIES[p.family] ? p.family : p.family ? 'neutral' : 'positive';
    var state = isNil(p.state) && cond ? t.deck.states[cond] : p.state;
    // Shortcuts belong to the staff screen, the only size with a keyboard; a tablet or a phone lists none.
    var keyboard = !p.size || p.size === 'lg';
    var latest = useLatest(p);
    // When nothing plays the rail is all there is: it binds the one key it lists, F for full screen.
    var bindF = keyboard && p.shortcuts === 'stopped' && !!p.onFullscreen;
    useEffect(function () {
      if (!bindF) return undefined;
      function onKey(e) {
        if (e.ctrlKey || e.metaKey || e.altKey || isControl(e.target)) return;
        if ((e.key === 'f' || e.key === 'F') && latest.current.onFullscreen) latest.current.onFullscreen();
      }
      document.addEventListener('keydown', onKey);
      return function () { document.removeEventListener('keydown', onKey); };
    }, [bindF]);
    var keys = !keyboard ? null : p.shortcuts === true ? [
      { keys: ['Space'], label: t.deck.keyPause }, { keys: ['↑', '↓'], label: t.deck.keyVolume },
      { keys: ['N'], label: t.deck.keyNext }, { keys: ['F'], label: t.deck.keyFull }
    ] : p.shortcuts === 'stopped' ? [{ keys: ['F'], label: t.deck.keyFull }] : (Array.isArray(p.shortcuts) ? p.shortcuts : null);
    // The offline countdown in hours; without a caption the rail writes the time left in words.
    var m = p.meter;
    var caption = m ? (isNil(m.caption) ? hoursText(m.value, p.locale) : m.caption) : null;
    var sub = m ? (isNil(m.caption) && isNil(m.sub) ? t.deck.leftOf.replace('{max}', hoursText(m.max, p.locale)) : m.sub) : null;
    return h('aside', { className: cx('r1-rail', p.className), style: p.style },
      h('p', { className: 'r1-rail__brand' }, h('span', null, 'RightOne'), h('span', { className: 'r1-rail__product' }, 'Player')),
      !isNil(p.time) ? h('div', { className: 'r1-rail__clock' }, h(Clock, { time: p.time, day: p.day, locale: p.locale })) : null,
      h('div', { className: 'r1-rail__block r1-rail__where' },
        h('p', { className: 'r1-rail__premises' }, (function (n) { var k = n.indexOf(' – '); return k < 0 ? n : [h('span', { key: 'b', className: 'r1-rail__brandname' }, n.slice(0, k)), h('span', { key: 'r', className: 'r1-rail__branch' }, n.slice(k + 3))]; })(p.premises || 'RightOne Player')),
        p.place ? h('p', { className: 'r1-rail__place' }, p.place.indexOf(', ') > 0 ? p.place.split(', ').map(function (x, j) { return h('span', { key: j, className: 'r1-rail__placeline' }, x); }) : p.place) : null),
      h('div', { className: 'r1-rail__block r1-rail__status', role: 'status' },
        h('p', { className: 'r1-rail__state r1-rail__state--' + family },
          h(StatusIcon, { family: family, size: 24, cutout: 'surface' }), h('span', null, state)),
        (p.detail || []).map(function (d, i) { return h('p', { key: i, className: 'r1-rail__line' }, playerLine(d, p.locale)); }),
        m ? h('div', { className: 'r1-rail__meter' },
          h(Meter, { value: m.value, max: m.max, family: m.family || family, label: m.label || t.deck.offlineLeft }),
          h('p', { className: 'r1-rail__meterline' }, h('strong', { className: 'r1-num' }, caption), sub ? ' ' + sub : null),
          m.note ? h('p', { className: 'r1-rail__line' }, m.note) : null) : null),
      p.device ? h('div', { className: 'r1-rail__block r1-rail__device' },
        h('p', { className: 'r1-rail__label' }, h('span', null, t.deck.player), h('span', { className: 'r1-mono' }, p.device)),
        (p.facts || []).map(function (d, i) { return h('p', { key: i, className: 'r1-rail__line r1-num' }, playerLine(d, p.locale)); }),
        p.storage ? h(Meter, { value: p.storage.value, max: p.storage.max, family: p.storage.family || 'accent', label: p.storage.label || t.deck.storage }) : null) : null,
      keys ? h('div', { className: 'r1-rail__block r1-rail__keys' },
        h('p', { className: 'r1-rail__label' }, h('span', null, t.deck.shortcuts)),
        h('dl', null, keys.map(function (k, i) {
          return h('div', { key: i, className: 'r1-rail__key' },
            h('dt', null, k.keys.map(function (x, j) { return h('kbd', { key: j }, x); })),
            h('dd', null, k.label));
        }))) : null,
      p.href ? h('a', { className: 'r1-rail__link', href: p.href },
        h('span', null, p.linkLabel || t.deck.sync), h(Icon, { name: 'chevron-right', size: 24 })) : null);
  }

  // The stopped, fault and cannot-continue screens: the state and when, what happened, and the one thing to do.
  // A licence condition and a device fault differ in their words, their action and the facts beside them;
  // the fault also sets its state word in the family's text colour, because something is broken.
  function PlayerAlert(p) {
    var t = tx(p.locale);
    var cond = PLAYER_FAMILY[p.condition] ? p.condition : null;
    var family = cond ? PLAYER_FAMILY[cond] : RAIL_FAMILIES[p.family] ? p.family : 'danger';
    var tone = p.tone === 'fault' || (!p.tone && cond === 'fault') ? 'fault' : 'condition';
    var state = isNil(p.state) && cond ? t.deck.states[cond] : p.state;
    var when = isNil(p.when) || typeof p.when === 'string' ? p.when : formatStamp(p.when, p.locale);
    return h('section', { className: cx('r1-palert', 'r1-palert--' + family, 'r1-palert--' + tone, p.className), role: 'alert', style: p.style },
      state || when ? h('p', { className: 'r1-palert__state' },
        h('span', { className: 'r1-palert__icon' }, h(StatusIcon, { family: family, size: 24, cutout: 'page' })),
        h('span', { className: 'r1-palert__stamp' }, state ? h('span', { className: 'r1-palert__word' }, state) : null, when ? h('span', { className: 'r1-palert__when r1-num' }, when) : null)) : null,
      h('h1', { className: 'r1-palert__title' }, p.title),
      p.why ? h('p', { className: 'r1-palert__why' }, p.why) : null,
      p.action ? h('p', { className: 'r1-palert__action' }, p.action) : null,
      p.children ? h('div', { className: 'r1-palert__foot' }, p.children) : null);
  }

  // Facts beside a Player alert: what the device still holds. A code reads in monospace; a number or a date
  // is written for the locale.
  function PlayerFacts(p) {
    var items = p.items || [];
    return h('div', { className: cx('r1-pfacts', p.className), style: p.style },
      p.title ? h('p', { className: 'r1-pfacts__title' }, p.title) : null,
      h('dl', null, items.map(function (it, i) {
        return h('div', { key: i, className: cx('r1-pfacts__item', it.code && 'r1-pfacts__item--code') },
          h('dt', null, it.label),
          h('dd', { className: cx('r1-pfacts__value', it.code ? 'r1-mono' : 'r1-num') }, it.code ? it.value : playerValue(it.value, p.locale)),
          it.note ? h('dd', { className: 'r1-pfacts__note' }, playerLine(it.note, p.locale)) : null);
      })));
  }

  // The Player frame. size "sm" is a phone, "md" a tablet, "lg" the 1920 x 1080 staff screen; orient turns sm and md
  // upright. On its side the rail runs down the left; upright it becomes a band across the top. Every Player part
  // scales with the frame, so a screen is written once and shown at every size. The frame's width and height, and
  // the sizes its parts share (--pl-*), come from tokens in bundle.css, one set per size.
  // The ground of a playing Player: the track's own cover, enlarged far past the frame and out of focus, under a veil of
  // the ground colour, so the glass panels above it have something to show. Drawn once and never animated: the Player
  // runs on old hardware, so the blur is paid for one time and the panels are see-through fills, not live backdrop
  // filters. A catalogue image (src) is used when there is one; until then the groove stand-in for the title.
  function PlayerAmbient(p) {
    return h('div', { className: cx('r1-ambient', p.className), style: p.style, 'aria-hidden': 'true' },
      h('div', { className: 'r1-ambient__art' },
        p.src ? h('img', { className: 'r1-ambient__img', src: p.src, alt: '' })
          : h(Artwork, { variant: 'groove', title: p.title, size: 320, style: { width: '100%', height: '100%' } })));
  }

  function PlayerFrame(p) {
    var size = p.size === 'lg' || p.size === 'sm' ? p.size : 'md';
    var upright = size !== 'lg' && p.orient === 'portrait';
    // A retired tone name maps to its brand tone; anything else falls back to the track's own tone.
    var asked = RETIRED_TONES[p.tone] || p.tone;
    var tone = p.tone === 'none' || !p.track ? null : (TRACK_TONES.indexOf(asked) >= 0 ? asked : toneOf(p.track));
    // Glass comes with the tone: only while a track plays. ambient={false} keeps the flat tone ground.
    var ambient = !!tone && p.ambient !== false;
    return h('div', { className: cx('r1-pframe', 'r1-pframe--' + size, upright ? 'r1-pframe--portrait' : 'r1-pframe--landscape', tone && 'r1-toned r1-tone--' + tone, ambient && 'r1-pframe--ambient', p.className), 'data-theme': 'player', lang: lang(p.locale), style: p.style },
      ambient ? h(PlayerAmbient, { title: p.track, src: p.art }) : null,
      h(PlayerRail, Object.assign({ locale: p.locale }, p.rail || {}, { size: size })),
      h('main', { className: 'r1-pframe__main' }, p.children));
  }

  // What plays next. Times may be Dates or timestamps; the summary and the "more" line can be built from values.
  function UpNext(p) {
    var t = tx(p.locale);
    var next = p.next || [], later = p.later || [];
    function hm(v) { return playerValue(v, p.locale, 'time'); }
    // start and end, not from and to: an x-import on the canvas reserves `from` for a module address.
    var summary = !isNil(p.summary) ? p.summary : !isNil(p.start) && !isNil(p.end)
      ? hm(p.start) + '–' + hm(p.end) + (isNil(p.left) ? '' : ', ' + t.deck.leftIn.replace('{d}', formatDuration(p.left, p.locale))) : null;
    var more = !isNil(p.more) ? p.more : !isNil(p.moreCount)
      ? (isNil(p.moreUntil) ? t.deck.moreAll : t.deck.more).replace('{n}', formatCount(p.moreCount, p.locale)).replace('{until}', hm(p.moreUntil)) : null;
    function track(it) {
      return h('span', { className: 'r1-upnext__track' },
        h('span', { className: 'r1-upnext__title' }, it.title),
        it.performer ? h('span', { className: 'r1-upnext__by' }, it.performer) : null);
    }
    return h('section', { className: cx('r1-upnext', p.className), style: p.style, 'aria-label': p.schedule || t.deck.schedule },
      p.schedule || summary ? h('header', { className: 'r1-upnext__head' },
        p.schedule ? h('h2', { className: 'r1-upnext__schedule' }, p.schedule) : null,
        summary ? h('p', { className: 'r1-upnext__summary' }, summary) : null) : null,
      next.length ? h('div', { className: 'r1-upnext__group' },
        h('h3', { className: 'r1-upnext__label' }, p.nextLabel || t.deck.upNext),
        h('ol', { className: 'r1-upnext__list' }, next.map(function (it, i) {
          return h('li', { key: i, className: cx('r1-upnext__item', i === 0 && 'r1-upnext__item--first') },
            h('span', { className: 'r1-upnext__time r1-num' }, hm(it.time)), track(it));
        }))) : null,
      later.length ? h('div', { className: 'r1-upnext__group r1-upnext__group--later' },
        h('h3', { className: 'r1-upnext__label' }, t.deck.later),
        h('ol', { className: 'r1-upnext__list r1-upnext__list--compact' }, later.map(function (it, i) {
          return h('li', { key: i, className: 'r1-upnext__item' },
            h('span', { className: 'r1-upnext__time r1-num' }, hm(it.time)),
            h('span', { className: 'r1-upnext__track' }, h('span', { className: 'r1-upnext__title' }, it.title)));
        })),
        more ? h('p', { className: 'r1-upnext__more' }, more) : null) : null,
      // Nothing scheduled after this track: the column says so rather than going blank.
      !next.length && !later.length ? h('p', { className: 'r1-upnext__empty' }, p.empty || t.deck.nothingNext) : null);
  }

  var R1 = {
    PageHeader: PageHeader, StatStrip: StatStrip, Meter: Meter, ViewState: ViewState, DeviceBar: DeviceBar,
    Artwork: Artwork, PlayerControls: PlayerControls, UpNext: UpNext,
    PlayerFrame: PlayerFrame, PlayerAmbient: PlayerAmbient, SecretValue: SecretValue, PlayerRail: PlayerRail, WaveRing: WaveRing, WaveBar: WaveBar, Clock: Clock, PlayerAlert: PlayerAlert, PlayerFacts: PlayerFacts, QrCode: QrCode,
    Icon: Icon, StatusIcon: StatusIcon, StatusBadge: StatusBadge, Button: Button, ButtonRow: ButtonRow,
    FieldMessage: FieldMessage, TextField: TextField, Select: Select, Table: Table, Banner: Banner,
    Dialog: Dialog, EmptyState: EmptyState, Skeleton: Skeleton,
    MoneyValue: MoneyValue, CountValue: CountValue, DateValue: DateValue, Identifier: Identifier,
    ProvenanceChip: ProvenanceChip, FactList: FactList, FreshnessLine: FreshnessLine,
    Stepper: Stepper, FileUpload: FileUpload, LegalTextViewer: LegalTextViewer, SignatureBlock: SignatureBlock,
    ApprovalPair: ApprovalPair, QueueList: QueueList, Timeline: Timeline,
    PlayerStatusBlock: PlayerStatusBlock, NowPlaying: NowPlaying, Chart: Chart,
    PublicShell: PublicShell, PortalShell: PortalShell, ConsoleShell: ConsoleShell, LangToggle: LangToggle,
    Panel: Panel, Divider: Divider, Checkbox: Checkbox, ChoiceList: ChoiceList, SegmentedControl: SegmentedControl, FilterBar: FilterBar, Link: Link,
    CodeInput: CodeInput, NumberedSteps: NumberedSteps, StatusLine: StatusLine, NavList: NavList, ItemList: ItemList, ScheduleGrid: ScheduleGrid,
    Switch: Switch, MoneyField: MoneyField, TimeField: TimeField, Disclosure: Disclosure, Toggletip: Toggletip, Tooltip: Tooltip, Toast: Toast, Avatar: Avatar, ShareSplit: ShareSplit, Comparison: Comparison, TracePath: TracePath, FileList: FileList, DocumentPreview: DocumentPreview, BulkBar: BulkBar, SidePanel: SidePanel, ScanView: ScanView, AudioRecorder: AudioRecorder,
    Tabs: Tabs, Pagination: Pagination, SearchField: SearchField, Combobox: Combobox, Calendar: Calendar, DateField: DateField, PasswordField: PasswordField, Breakdown: Breakdown, MetricValue: MetricValue, DeadlineClock: DeadlineClock, FieldRows: FieldRows, FieldRow: FieldRow, AudioPreview: AudioPreview, PrintableRecord: PrintableRecord, VerificationResult: VerificationResult, Menu: Menu, NoticeList: NoticeList,
    format: { money: formatMoney, count: formatCount, percent: formatPercent, date: formatDate, dateShort: formatDateShort, timestamp: formatTimestamp, stamp: formatStamp, period: formatPeriod, time: formatTime }
  };
  window.R1 = Object.assign(window.R1 || {}, R1);
})();
