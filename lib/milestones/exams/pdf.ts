// Leitura de PDF (editais). Usa a biblioteca `unpdf` — instale com:  npm i unpdf
//
// O import é "ignorado" pelo empacotador e sem checagem de tipo DE PROPÓSITO: se a biblioteca
// ainda não estiver instalada, o build NÃO quebra — o sistema só avisa "leitor de PDF indisponível"
// no diagnóstico e segue lendo as páginas em HTML.
export async function pdfToText(buf: ArrayBuffer): Promise<string> {
  let mod: any
  try {
    // @ts-ignore — pacote opcional
    mod = await import(/* webpackIgnore: true */ 'unpdf')
  } catch {
    throw new Error('leitor de PDF indisponível (rode: npm i unpdf)')
  }
  const pdf = await mod.getDocumentProxy(new Uint8Array(buf))
  const { text } = await mod.extractText(pdf, { mergePages: true })
  return Array.isArray(text) ? text.join('\n') : String(text ?? '')
}
