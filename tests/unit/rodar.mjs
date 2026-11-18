// Empacota (esbuild via npx) e roda os testes unitários da lógica de metas de evento.
// Uso, na raiz do projeto:  node tests/unit/rodar.mjs
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const sh = process.platform === 'win32'
import { readdirSync } from 'node:fs'
for (const f of readdirSync(join(raiz, 'tests/unit')).filter(x => x.endsWith('.test.ts'))) {
  const out = join(mkdtempSync(join(tmpdir(), 'ut-')), 't.mjs')
  execFileSync('npx', ['--yes', 'esbuild', join(raiz, 'tests/unit', f), '--bundle', '--platform=node', '--format=esm', '--packages=external',
    `--outfile=${out}`, `--alias:@=${raiz}`, '--log-level=error'], { stdio: 'inherit', shell: sh })
  console.log('\n== ' + f)
  execFileSync('node', [out], { stdio: 'inherit' })
}
