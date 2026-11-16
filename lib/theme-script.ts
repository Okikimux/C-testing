// Runs in <head> before the first paint so the saved theme is applied with no white flash.
// "campora-theme" holds 'light' | 'dark'; no value means "follow the device (System)".
export const themeInitScript = `(function(){try{var p=localStorage.getItem('campora-theme');var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.setAttribute('data-theme',d?'dark':'light');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
