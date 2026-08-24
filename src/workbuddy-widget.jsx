import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@modelcontextprotocol/ext-apps'
import { FinanceDashboard } from './finance-dashboard.jsx'
import { composeFinanceTask } from './task-prompt.js'

const MAX_FILES = 200

function normalizeSelectedFiles(selected) {
  return [...selected].slice(0, MAX_FILES).map((file, index) => ({
    relative: file.webkitRelativePath || file.name || `文件-${index + 1}`,
    name: file.name || `文件-${index + 1}`,
    size: Number(file.size || 0),
    modifiedAt: Number(file.lastModified || Date.now()),
    sourceFile: file,
  }))
}

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
  return Promise.resolve()
}

function WorkBuddyFinanceApp() {
  const [files, setFiles] = useState([])
  const [status, setStatus] = useState('WorkBuddy 图形工作台已就绪 · 数据保存在本机')
  const [launching, setLaunching] = useState(false)
  const appRef = useRef(null)
  const filePicker = useRef(null)
  const folderPicker = useRef(null)

  useEffect(() => {
    if (window.parent === window) {
      setStatus('独立预览模式 · 工作流指令会复制到剪贴板')
      return undefined
    }
    const app = new App(
      { name: 'workbuddy-finance-workbench', version: '2.5.0' },
      {},
      { autoResize: true },
    )
    let disposed = false
    app.onhostcontextchanged = context => {
      if (context?.theme) document.documentElement.dataset.hostTheme = context.theme
    }
    app.ontoolresult = result => {
      const version = result?.structuredContent?.version
      if (version) setStatus(`已连接 WorkBuddy MCP App · v${version}`)
    }
    void app.connect().then(async () => {
      if (disposed) return
      appRef.current = app
      document.documentElement.dataset.hostTheme = app.getHostContext()?.theme || 'light'
      setStatus('已连接 WorkBuddy · 数据保存在本机，可随时导出备份')
      try { await app.requestDisplayMode({ mode: 'fullscreen' }) } catch {}
    }).catch(() => setStatus('Widget 已打开；若功能未连接，请重新加载 WorkBuddy 会话'))
    return () => { disposed = true; appRef.current = null }
  }, [])

  const addFiles = selected => {
    const incoming = normalizeSelectedFiles(selected)
    setFiles(current => {
      const merged = new Map(current.map(item => [item.relative, item]))
      for (const item of incoming) merged.set(item.relative, item)
      return [...merged.values()].slice(0, MAX_FILES)
    })
    setStatus(`已在当前 Widget 索引 ${incoming.length} 个文件；执行时请在 WorkBuddy 输入框确认附件`)
  }

  const launchWorkflow = async workflow => {
    setLaunching(true)
    const matched = files.length ? `\n当前 Widget 已选择：${files.slice(0, 12).map(item => item.name).join('、')}${files.length > 12 ? '等' : ''}。发送前请在 WorkBuddy 输入框核对并添加原始附件。` : '\n发送前请在 WorkBuddy 输入框添加需要处理的原始附件。'
    const prompt = `请使用 finance-workbench 执行「${workflow.title}」。\n\n${composeFinanceTask(workflow)}${matched}`
    try {
      if (appRef.current) {
        const result = await appRef.current.sendMessage({
          role: 'user',
          content: [{ type: 'text', text: prompt }],
          _meta: { 'codebuddy.ai/sendMessageMode': 'fill' },
        })
        setStatus(result?.isError ? 'WorkBuddy 未接收指令，请复制后手动粘贴' : '工作流指令已填入 WorkBuddy 输入框；核对附件后发送')
      } else {
        await copyText(prompt)
        setStatus('工作流指令已复制；请粘贴到 WorkBuddy 并添加附件')
      }
    } catch {
      await copyText(prompt).catch(() => {})
      setStatus('工作流指令已复制；请粘贴到 WorkBuddy 并添加附件')
    } finally {
      setLaunching(false)
    }
  }

  const downloadFile = file => {
    if (!file.sourceFile) { setStatus('请重新选择该文件后再下载'); return }
    const url = URL.createObjectURL(file.sourceFile)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.name
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  }

  return <>
    <FinanceDashboard
      sessionId="workbuddy-mcp-app"
      files={files}
      workspace={{ name: 'WorkBuddy 当前对话', path: 'Widget 只建立文件索引；原件仍由你在对话附件中确认' }}
      status={status}
      onStatus={setStatus}
      onRefresh={() => setStatus(`已刷新 · 当前索引 ${files.length} 个文件`)}
      onOpenWorkspace={() => setStatus('WorkBuddy Widget 不直接访问 Finder；请使用“选择文件”添加资料')}
      onChooseFiles={() => filePicker.current?.click()}
      onChooseFolder={() => folderPicker.current?.click()}
      onUploadFiles={addFiles}
      onReferenceFile={file => setStatus(`已引用 ${file.name}；启动工作流后请核对输入框附件`)}
      onDownloadFile={downloadFile}
      onLaunchWorkflow={launchWorkflow}
      launching={launching}
      onClose={() => { void appRef.current?.requestDisplayMode({ mode: 'inline' }) }}
    />
    <input ref={filePicker} hidden type="file" multiple onChange={event => { addFiles(event.target.files || []); event.target.value = '' }}/>
    <input ref={folderPicker} hidden type="file" multiple webkitdirectory="" onChange={event => { addFiles(event.target.files || []); event.target.value = '' }}/>
  </>
}

createRoot(document.getElementById('root')).render(<WorkBuddyFinanceApp/>)
