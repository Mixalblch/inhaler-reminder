// Renderer regression with fixture IPC; persistence is covered by history-test.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('assert');
const path = require('path');
let cfg, summary, lang;
function fixture(locale, appearance) {
  lang = locale;
  cfg = { locale, appearance, snoozeMinutes:15, graceMinutes:120, puffsPerDose:1,
    soundEnabled:true, autostart:false,
    windows:Array.from({length:8}, (_,i)=>({id:'w'+(i+1),name:'Long dose / Длинное название интервала '+(i+1),enabled:true,start:'09:00',end:'10:00'})) };
  summary={todayStatus:{},trackedCount:16,confirmedCount:1,days:[
    {date:'2026-11-01',w1:'missed'}, {date:'2026-11-02',w1:'missed'}]};
}
ipcMain.handle('layout-fixture', (_event, name, args) => {
  if(name==='getStrings') return require('../src/locales/'+lang);
  if(name==='getConfig') return cfg;
  if(name==='getHistorySummary') return summary;
  if(name==='getInhaler') return {total:120,remaining:50};
  if(name==='setConfig') {Object.assign(cfg,args[0]);return cfg;}
  if(name==='setLocale') {lang=args[0];cfg.locale=lang;return cfg;}
  if(name==='backdateDose'||name==='undoBackdate') {
    summary.days.find(d=>d.date===args[0])[args[1]]=name==='backdateDose'?'confirmed':'missed';
    return {ok:true,summary};
  }
});
const pause = ms => new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,useContentSize:true,width:390,height:845,
    webPreferences:{preload:path.join(__dirname,'history-layout-preload.js'),contextIsolation:true,sandbox:true}});
  let count=0;
  try {
    for(const locale of ['ru','en']) for(const theme of ['light','dark']) {
      fixture(locale,theme);
      await win.loadFile(path.join(__dirname,'../src/renderer/settings/settings.html'));
      for(let i=0;i<100;i++) {
        if(await win.webContents.executeJavaScript("document.querySelectorAll('.history-row:not(.history-header)').length===2")) break;
        await pause(25);
      }
      for(const width of [320,360,390,430,640]) {
        win.setContentSize(width,Math.round(width*19.5/9));
        await pause(75);
        const result=await win.webContents.executeJavaScript(`(()=>{
          const cells=[...document.querySelectorAll('.history-row:not(.history-header) .history-cell')];
          const bad=[];
          for(const c of cells) {
            const box=c.getBoundingClientRect();
            const parts=[...c.children].filter(n=>getComputedStyle(n).display!=='none');
            for(const p of parts) {
              const r=p.getBoundingClientRect();
              if(r.left<box.left-1||r.right>box.right+1||r.bottom>box.bottom+1)bad.push('overflow');
            }
            for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
              const a=parts[i].getBoundingClientRect(),b=parts[j].getBoundingClientRect();
              if(a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1)bad.push('overlap');
            }
          }
          return {count:cells.length,bad,overflow:document.querySelector('.content').scrollWidth>innerWidth,
            names:cells.every(c=>c.querySelector('.history-dose-name').textContent.length>0)};
        })()`);
        assert.strictEqual(result.count,16);
        assert.deepStrictEqual(result.bad,[],locale+' '+theme+' '+width);
        assert.strictEqual(result.overflow,false,'Page must not scroll horizontally');
        assert.strictEqual(result.names,true);
        count++;
      }
      await win.webContents.executeJavaScript("document.querySelector('.cell-action[data-action=mark]').click()");
      await pause(100);
      assert(await win.webContents.executeJavaScript("!!document.querySelector('.cell-action[data-action=undo]')"));
      await win.webContents.executeJavaScript("document.querySelector('.cell-action[data-action=undo]').click()");
      await pause(100);
      assert(await win.webContents.executeJavaScript("!document.querySelector('.cell-action[data-action=undo]')"));
      await win.webContents.executeJavaScript("document.getElementById('addWindowBtn').click()");
      await pause(100);
      assert.strictEqual(await win.webContents.executeJavaScript("document.querySelectorAll('.history-row:not(.history-header) .history-cell').length"),18);
    }
    console.log('HISTORY_LAYOUT_OK: '+count+' viewport/theme/locale cases; mark, undo, add-dose interactions');
    win.destroy();app.exit(0);
  } catch(e) {console.error(e);win.destroy();app.exit(1);}
}).catch(e=>{console.error(e);app.exit(1);});
