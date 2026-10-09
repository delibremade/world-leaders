// The one HTML shell for single-file builds (v57's page chrome: dark background, border-box sizing).
// Shared by build.js (App) and build-legacy.js (v57) so both render identically.
export const shell = (js) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>World Leaders</title>
<style>html,body{height:100%;margin:0;background:#06090d}*{box-sizing:border-box}</style></head><body><div id="root"></div>
<script>${js.replace(/<\/script>/g, '<\\/script>')}</script>
</body></html>`;
