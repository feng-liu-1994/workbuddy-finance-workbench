import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const teacher = pkg.name.includes('teacher')
const title = teacher ? '教师工作台' : '财务工作台'
const repo = teacher ? 'deepseek-harness-teacher-workbench' : 'workbuddy-finance-workbench'
const data = await import(path.join(root, teacher ? 'src/teacher-workflows.js' : 'src/finance-data.js'))
const composers = await import(path.join(root, 'src/task-prompt.js'))
const workflows = (teacher ? data.TEACHER_WORKFLOWS : data.FINANCE_WORKFLOWS).map(w => ({id:w.id, title:w.title, prompt:teacher ? composers.composeTeacherTask(w) : composers.composeFinanceTask(w)}))
async function walk(dir) {
  const entries = await readdir(path.join(root,dir),{withFileTypes:true})
  const result=[]
  for(const e of entries.sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
    const p=path.posix.join(dir,e.name)
    if(e.isDirectory()) result.push(...await walk(p))
    else if(e.isFile()) result.push(p)
  }
  return result
}
const extras = (await readdir(root,{withFileTypes:true})).filter(e=>e.isFile() && /(?:\.md|\.json|\.yml|\.sh|\.command|LICENSE|\.gitignore)$/.test(e.name)).map(e=>e.name)
const docs = (await walk('docs')).filter(p=>!p.startsWith('docs/reproduce/') && /\.(md|json|yml)$/.test(p))
const optional=[]
for(const dir of ['agents','.codebuddy-plugin','.github']) { try { optional.push(...(await walk(dir)).filter(p=>/\.(md|json|yml|yaml)$/.test(p))) } catch(e) { if(e.code!=='ENOENT') throw e } }
const paths = [...new Set(['package.json','package-lock.json','build.mjs','cordis.patch.yml',...extras,...docs,...optional,...await walk('src'),...await walk('scripts'),...await walk('test')])].sort()
const files=[]
for(const p of paths) {
  const content=await readFile(path.join(root,p),'utf8')
  files.push({path:p,sha256:createHash('sha256').update(content).digest('hex'),content})
}
const master = [
'# '+title+' '+pkg.version+'：源码级精确复刻总提示词',
'你是负责交付可运行软件的 AI 工程师。请完整复刻本仓库工作台，不要用静态看板、功能缩水示例或重新设计的界面替代。',
'## 1. 获取基准',
'仓库：https://github.com/feng-liu-1994/'+repo,
teacher ? '本仓库为私密仓库。由用户通过 GitHub 登录、授权连接器或本地源码提供访问；不要索取、输出或硬编码令牌。' : '这是现有开源仓库的增量版本；保留已有 WorkBuddy、DSH 和通用 Agent 三种入口。',
'优先读取已有本地仓库。否则克隆到新的目录，不覆盖用户工作。若没有仓库访问能力，请使用用户附带的 source-context.md，按文件标题恢复相对路径。',
'## 2. 完整读取',
'先读取 README.md、存在的 AGENTS.md、package.json、package-lock.json、build.mjs、cordis.patch.yml、src/、scripts/ 和 test/；以实际源码为准，不凭印象猜测接口。',
'## 3. 同样的外观与行为',
'保持源码的布局、模块顺序、中文文案、字体、间距、颜色、主题、图标、响应式断点和交互。保留资料上传、索引、搜索、筛选、引用、下载、置顶，任务创建、编辑、状态、备份恢复及所有源码已有功能。',
'工作流必须使用原 task-prompt.js 的组合器，保持角色、材料要求、完整执行规则、模块指令与验收清单。共 '+workflows.length+' 个工作流，逐个核对，不删减为摘要。',
'复用原宿主协议、客户端注入和服务端注册，不虚构 RPC。按锁文件安装依赖；不要批量升级或强制替换宿主内部协议包。界面依赖宿主时，明确宿主要求，不把独立 HTML 预览当作真实安装成功。',
'## 4. 运行与实现',
'Node.js >=20；执行 npm ci，然后 '+(teacher ? 'npm run check && npm run audit:release' : 'npm run verify:release')+'。优先原样构建；确需适配环境时只做最小变更，逐项记录原因、差异和回滚步骤。',
'安装按仓库说明和已有安装脚本执行；先备份已有插件与配置，保留用户数据。涉及退出或重启宿主时先提醒用户保存并取得确认。',
'## 5. 保护数据',
'演示仅使用合成数据；原始业务资料只读，输出另存，禁止写入仓库、日志或公开页面。不得自动付款、入账、纳税申报或替用户作重大专业判断；这些操作必须人工复核确认。',
'## 6. 验收',
'逐项运行测试与安全扫描，核对 manifest.json 的路径和 SHA-256。实际打开宿主页面，检查桌面和 390px 窄屏、主题切换、资料与任务交互、全部工作流提示词复制；确认浏览器无目标功能控制台错误。',
'实际触发至少一次工作流，确认发送到 AI 的正文与组合器结果一致。无宿主时记录为待验收，不声称端到端成功。',
'交付可运行源码、构建产物、中文安装/使用指南、测试结果、实际截图、已知限制、恢复方式；列明任何与基准的差异。',
'## 7. 精确复刻的边界',
'同一份源码和锁文件是复刻基准；单靠自然语言无法保证任何 AI 都生成像素级相同界面。应保留源码而非让 AI 自由重写；宿主版本、系统字体和窗口尺寸可能影响最终显示。'
].join('\n\n')
const context = '# 源码上下文包\n\n按相对路径恢复 UTF-8 文件；manifest.json 用于完整性核对。此包含构建、源码、脚本和测试，不含依赖目录、运行资料或凭据。\n\n'+files.map(f=>'## '+f.path+'\n\nSHA-256: '+f.sha256+'\n\n~~~~~~text\n'+f.content+'\n~~~~~~').join('\n\n')
const payload={title,version:pkg.version,master,context,workflows}
const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' · 提示词中心</title><style>body{margin:0;background:#edf2f7;color:#172b42;font:17px/1.7 system-ui}main{max-width:1050px;margin:auto;padding:40px 20px}h1{font-size:32px}section{background:white;padding:24px;border-radius:18px;margin:20px 0}button,input{font:inherit;padding:11px 16px;border:1px solid #aabacf;border-radius:10px;margin:5px;max-width:100%;box-sizing:border-box}button{background:#173d68;color:white;cursor:pointer}input{width:100%;margin:0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:15px/1.7 system-ui}#status{position:sticky;top:0;background:#e0ebfa;padding:12px}summary{cursor:pointer} @media(max-width:430px){main{padding:16px 12px}section{padding:16px}h1{font-size:25px}button{width:100%;margin:5px 0}}</style><main><h1>'+title+' · 提示词中心</h1><p>版本 '+pkg.version+' · 完整源码复刻 + '+workflows.length+' 个工作流 · 离线使用，无远程依赖</p><p>先下载本 HTML，再双击打开。GitHub 文件预览本身不执行复制按钮。教师页面及源码请仅与获准人员分享。</p><div id="status" role="status" aria-live="polite">选择需要的提示词</div><section><h2>让 AI 制作同样的工作台</h2><p>推荐把整个仓库交给 AI，再复制总提示词；无仓库访问时可复制含源码的大文本包，注意 AI 上下文长度限制。</p><button id="master">复制总提示词</button><button id="full">复制总提示词 + 全部源码</button><button id="download">下载源码上下文</button><details><summary>展开总提示词</summary><pre id="preview"></pre></details></section><section><h2>完整工作流提示词</h2><input id="search" aria-label="搜索工作流" placeholder="搜索名称或提示词内容"><div id="list"></div></section><noscript>请启用 JavaScript，或直接读取同目录的 MASTER_PROMPT.md 和 WORKFLOWS.md。</noscript></main><script id="data" type="application/json">'+JSON.stringify(payload).replaceAll('<','\\u003c')+'</script><script>const d=JSON.parse(document.getElementById("data").textContent);const status=document.getElementById("status");async function copy(text){let ok=false;try{await navigator.clipboard.writeText(text);ok=true}catch{const t=document.createElement("textarea");t.value=text;t.setAttribute("aria-label","手动复制提示词");document.body.append(t);t.select();try{ok=document.execCommand("copy")}catch{}if(ok)t.remove();else{status.textContent="自动复制未完成，请在下方文本框全选后复制";return}}status.textContent=ok?"已复制 "+text.length+" 个字符": "请手动复制"}document.getElementById("master").onclick=()=>copy(d.master);document.getElementById("full").onclick=()=>copy(d.master+"\\n\\n"+d.context);document.getElementById("preview").textContent=d.master;document.getElementById("download").onclick=()=>{const url=URL.createObjectURL(new Blob([d.context],{type:"text/markdown;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="source-context.md";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};function render(){const q=document.getElementById("search").value.trim().toLowerCase();const list=document.getElementById("list");list.replaceChildren();d.workflows.filter(w=>(w.title+w.prompt).toLowerCase().includes(q)).forEach(w=>{const box=document.createElement("section");const h=document.createElement("h3");h.textContent=w.title;const b=document.createElement("button");b.textContent="复制完整提示词";b.onclick=()=>copy(w.prompt);const details=document.createElement("details");const s=document.createElement("summary");s.textContent="查看全文";const pre=document.createElement("pre");pre.textContent=w.prompt;details.append(s,pre);box.append(h,b,details);list.append(box)})}document.getElementById("search").oninput=render;render();</script></html>'
const dir=path.join(root,'docs/reproduce')
await mkdir(dir,{recursive:true})
for(const [name,value] of Object.entries({'MASTER_PROMPT.md':master,'WORKFLOWS.md':'# 完整工作流提示词\n\n'+workflows.map(w=>'## '+w.title+'\n\n~~~~text\n'+w.prompt+'\n~~~~').join('\n\n'),'source-context.md':context,'manifest.json':JSON.stringify({version:pkg.version,workflowCount:workflows.length,files:files.map(({path,sha256})=>({path,sha256}))},null,2)+'\n','index.html':html})) await writeFile(path.join(dir,name),value)
console.log(title+': '+workflows.length+' prompts, '+files.length+' source files')
