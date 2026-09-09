import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const root=new URL('../',import.meta.url)
test('offline reproduction package preserves every source hash and full workflow prompt', async()=>{
 const html=await readFile(new URL('docs/reproduce/index.html',root),'utf8')
 const payload=JSON.parse(html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1])
 const pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8'))
 const teacher=pkg.name.includes('teacher')
 const data=await import(new URL(teacher?'src/teacher-workflows.js':'src/finance-data.js',root))
 const compose=await import(new URL('src/task-prompt.js',root))
 const workflows=teacher?data.TEACHER_WORKFLOWS:data.FINANCE_WORKFLOWS
 assert.equal(payload.workflows.length,teacher?12:25)
 assert.equal(payload.version,pkg.version)
 for(let i=0;i<workflows.length;i++) assert.equal(payload.workflows[i].prompt,teacher?compose.composeTeacherTask(workflows[i]):compose.composeFinanceTask(workflows[i]))
 assert.equal(payload.master,await readFile(new URL('docs/reproduce/MASTER_PROMPT.md',root),'utf8'))
 assert.equal(payload.context,await readFile(new URL('docs/reproduce/source-context.md',root),'utf8'))
 const manifest=JSON.parse(await readFile(new URL('docs/reproduce/manifest.json',root),'utf8'))
 for(const file of manifest.files) assert.equal(createHash('sha256').update(await readFile(new URL(file.path,root))).digest('hex'),file.sha256,file.path)
 assert.ok(manifest.files.some(f=>f.path==='package-lock.json'))
 assert.doesNotMatch(html,/<script[^>]+src=/)
})
