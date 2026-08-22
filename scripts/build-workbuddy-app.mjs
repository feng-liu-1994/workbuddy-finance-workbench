import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { FINANCE_DASHBOARD_STYLES } from '../src/finance-dashboard-styles.js'

const root = new URL('../', import.meta.url)
const output = new URL('./workbuddy/', root)
const esbuild = await import('esbuild')
await mkdir(output, { recursive: true })

const widget = await esbuild.build({
  entryPoints: [fileURLToPath(new URL('./src/workbuddy-widget.jsx', root))],
  bundle: true,
  write: false,
  minify: true,
  platform: 'browser',
  format: 'iife',
  target: ['chrome123'],
  jsx: 'automatic',
  alias: {
    react: 'preact/compat',
    'react-dom/client': 'preact/compat/client',
    'react/jsx-runtime': 'preact/jsx-runtime',
  },
})
const widgetCode = new TextDecoder().decode(widget.outputFiles[0].contents).replaceAll('</script>', '<\\/script>')
const baseStyles = `
:root{color-scheme:light dark;--dsw-font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;--dsw-alias-bg-base:#f7f8fc;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#f4f6fd;--dsw-alias-bg-hover:#eef1fb;--dsw-alias-border-l1:#e4e7f0;--dsw-alias-border-l2:#d9deea;--dsw-alias-label-primary:#17213b;--dsw-alias-label-secondary:#65708b;--dsw-alias-label-tertiary:#8790a7;--dsw-alias-interactive-bg-hover:#edf0fa;--dsw-specific-sidebar-nav-item-hover:#edf0fa;--dsw-specific-sidebar-nav-item-active:#e7ebfb}
html[data-host-theme="dark"]{--dsw-alias-bg-base:#121826;--dsw-alias-bg-layer-1:#182033;--dsw-alias-bg-layer-2:#202a40;--dsw-alias-bg-hover:#263149;--dsw-alias-border-l1:#293650;--dsw-alias-border-l2:#35425d;--dsw-alias-label-primary:#eff3fb;--dsw-alias-label-secondary:#b6c0d2;--dsw-alias-label-tertiary:#8f9bb0;--dsw-alias-interactive-bg-hover:#263149;--dsw-specific-sidebar-nav-item-hover:#263149;--dsw-specific-sidebar-nav-item-active:#303c57}
html,body,#root{width:100%;height:100%;min-height:720px;margin:0}body{overflow:hidden;background:var(--dsw-alias-bg-base);font-family:var(--dsw-font-family)}#root{container:finance-workbench / inline-size}#root>.dfinance_panel{height:100%!important;min-height:720px}
`
const packedStyles = gzipSync(baseStyles + FINANCE_DASHBOARD_STYLES, { level: 9 }).toString('base64')
const packedWidget = gzipSync(widgetCode, { level: 9 }).toString('base64')
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'"><title>WorkBuddy 财务工作台</title></head><body><div id="root"></div><script>(()=>{const u=async s=>{const b=Uint8Array.from(atob(s),c=>c.charCodeAt(0));return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text()};Promise.all([u('${packedStyles}'),u('${packedWidget}')]).then(([c,j])=>{const y=document.createElement('style');y.textContent=c;document.head.append(y);const x=document.createElement('script');x.textContent=j;document.body.append(x)}).catch(e=>{document.body.textContent='工作台资源加载失败，请重新打开：'+e.message})})()</script></body></html>`
const bytes = Buffer.byteLength(html)
if (bytes >= 256 * 1024) throw new Error(`WorkBuddy Widget 为 ${bytes} 字节，超过 MCP Apps 256 KB 预取上限`)
await writeFile(new URL('./widget.html', output), html)

await esbuild.build({
  entryPoints: [fileURLToPath(new URL('./src/workbuddy-mcp-server.mjs', root))],
  bundle: true,
  outfile: fileURLToPath(new URL('./server.mjs', output)),
  minify: true,
  platform: 'node',
  format: 'esm',
  target: ['node20'],
})

const serverSize = Buffer.byteLength(await readFile(new URL('./server.mjs', output)))
console.log(`built WorkBuddy MCP App · widget ${bytes} B packed (${Buffer.byteLength(widgetCode)} B JS raw) · server ${serverSize} B`)
