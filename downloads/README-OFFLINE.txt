MIGHTORA HAR ANALYSER — OFFLINE EDITION
=====================================

No application install or network is required.

1. Extract this ZIP to a folder.
2. Double-click har-analyser.html in Chrome, Edge or Firefox.
3. You should see the 'OFFLINE EDITION · SELF-CONTAINED' label.
4. For network verification, expand 'How to verify independently with F12'.
   - Press F12 (or Ctrl+Shift+I, macOS Command+Option+I).
   - Choose Network / All, enable Preserve log, then reload the HTML file.
   - Open a HAR and verify that no HAR upload requests appear.
5. Optionally select 'Refresh network evidence' in the on-screen Network Transparency panel.

This offline tool embeds all necessary code, CSS and logo in one HTML file.
It deliberately blocks outbound HTTP(S) requests using a restrictive Content
Security Policy. The on-screen Resource Timing information is supplemental
and does not replace a network inspector or independent security audit.

HAR files can contain secrets, cookies, API tokens and private content.
Never share raw HAR captures or exported reports without reviewing them.
Disconnect from the network for additional assurance when using sensitive data.

Project: https://github.com/mightora/har
Website: https://har.mightora.io/
License: MIT (see LICENSE.txt)
