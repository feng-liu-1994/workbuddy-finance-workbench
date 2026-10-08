import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
const port = Number(process.env.PORT || 4173)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须为 1–65535')
const widget = new URL('../workbuddy/widget.html', import.meta.url)
await readFile(widget)
createServer(async (request, response) => {
  if (request.url === '/' || request.url === '/index.html') {
    try {
      const html = await readFile(widget)
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
      response.end(html)
    } catch { response.writeHead(503); response.end('预览资源暂不可读，请完成构建后刷新') }
  } else { response.writeHead(request.url === '/favicon.ico' ? 204 : 404); response.end() }
}).listen(port, '127.0.0.1', () => console.log(`财务工作台本机预览：http://127.0.0.1:${port}（Ctrl+C 停止）`))
